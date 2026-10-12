import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import type { ActiveEffect } from "@/src/lib/rules/types";
import type { CombatLogEntry, CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import { decrementerFinDeTour, marquerPose, pvParTourTotal } from "@/src/lib/rules/effects/effects";
import { checkEnd } from "@/src/lib/rules/combat/attack";

function entry(manche: number, message: string): CombatLogEntry {
  return { id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, at: new Date().toISOString(), manche, message };
}

export function createCombat(participants: CombatParticipant[]): CombatState {
  return {
    id: `combat-${Date.now().toString(36)}`,
    participants: [...participants],
    tourIndex: 0,
    manche: 1,
    log: [entry(1, `Combat démarré (${participants.length} participants). Lancez les initiatives.`)],
    termine: false,
    gagnant: null,
  };
}

/** Lance 1d20+initMod pour chacun, trie décroissant. Usages de sorts à zéro. */
export function rollInitiatives(state: CombatState, rng: Rng = Math.random): CombatState {
  const rolled: CombatParticipant[] = state.participants.map((p) => ({
    ...p,
    initiative: rollDie(20, rng) + p.initMod,
    usagesSorts: {},
  }));
  rolled.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || b.initMod - a.initMod);
  return {
    ...state,
    participants: rolled,
    tourIndex: 0,
    manche: 1,
    log: [
      ...state.log,
      ...rolled.map((p) => entry(1, `Initiative ${p.nom} : ${p.initiative} (mod ${p.initMod >= 0 ? "+" : ""}${p.initMod})`)),
      entry(1, `Tour de ${rolled[0]?.nom ?? "—"} (manche 1).`),
    ],
  };
}

export function getActive(state: CombatState): CombatParticipant | null {
  return state.participants[state.tourIndex] ?? null;
}

/**
 * Prochain tour (saute KO/morts si sauterKO). Manche++ à chaque boucle.
 * Effets : les durées sont consommées à la FIN du tour de leur porteur
 * (l'ancien actif est décrémenté en partant) et les dégâts/soins par tour
 * sont appliqués au DÉBUT du tour du nouvel actif (sans décrément).
 * Ainsi un malus "1 tour" posé sur un ennemi couvre tout son tour et
 * n'expire qu'à la fin de celui-ci.
 */
export function nextTurn(state: CombatState, sauterKO = true): CombatState {
  if (state.termine || state.participants.length === 0) return state;
  let idx = state.tourIndex;
  let manche = state.manche;
  for (let step = 0; step < state.participants.length; step++) {
    idx += 1;
    if (idx >= state.participants.length) {
      idx = 0;
      manche += 1;
    }
    if (!sauterKO || state.participants[idx]?.statut === "actif") break;
  }
  const log = [...state.log];
  let participants = state.participants;
  // 1) Fin de tour de l'ancien actif : on consomme ses durées d'effets.
  // Un effet posé pendant ce même tour est épargné (il doit encore couvrir
  // un tour complet, ex. auto-buff "1 tour" lancé pendant son propre tour).
  const ancien = participants[state.tourIndex];
  if (ancien && ancien.effets.length > 0) {
    const { restants, expires } = decrementerFinDeTour(ancien.effets, state.manche, state.tourIndex);
    participants = participants.map((p, i) => (i === state.tourIndex ? { ...p, effets: restants } : p));
    for (const e of expires) log.push(entry(manche, `Effet "${e.nom}" expiré sur ${ancien.nom} (fin de tour).`));
  }
  // 2) Début de tour du nouvel actif : dégâts/soins par tour, sans décrément.
  const actif = participants[idx];
  if (actif && actif.effets.length > 0) {
    const pvDelta = pvParTourTotal(actif.effets);
    let pv = actif.pv;
    if (pvDelta !== 0 && actif.statut === "actif") {
      pv = Math.max(0, Math.min(actif.pvMax, actif.pv + pvDelta));
      log.push(entry(manche, `${actif.nom} : effet (${pvDelta > 0 ? "+" : ""}${pvDelta} PV) -> ${pv}/${actif.pvMax} PV`));
    }
    const statut = pv <= 0 ? ("ko" as const) : actif.statut;
    if (pv <= 0 && actif.statut === "actif") log.push(entry(manche, `${actif.nom} est hors combat`));
    if (pv !== actif.pv || statut !== actif.statut) {
      participants = participants.map((p, i) => (i === idx ? { ...p, pv, statut } : p));
    }
  }
  log.push(entry(manche, `Tour de ${actif?.nom ?? "—"} (manche ${manche}).`));
  return checkEnd({ ...state, participants, tourIndex: idx, manche, log });
}

/** Ajoute un effet à un participant (pur). Tamponne le tour de pose. */
export function addParticipantEffect(state: CombatState, instanceId: string, effet: ActiveEffect): CombatState {
  const tamponne = marquerPose(effet, state.manche, state.tourIndex);
  return {
    ...state,
    participants: state.participants.map((p) =>
      p.instanceId === instanceId ? { ...p, effets: [...p.effets, tamponne] } : p
    ),
    log: [...state.log, entry(state.manche, `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${state.participants.find((p) => p.instanceId === instanceId)?.nom ?? "?"}.`)],
  };
}

/** Retire un effet (suppression manuelle MJ). */
export function removeParticipantEffect(state: CombatState, instanceId: string, effetId: string): CombatState {
  const p = state.participants.find((x) => x.instanceId === instanceId);
  const nom = p?.effets.find((e) => e.id === effetId)?.nom ?? "effet";
  return {
    ...state,
    participants: state.participants.map((x) =>
      x.instanceId === instanceId ? { ...x, effets: x.effets.filter((e) => e.id !== effetId) } : x
    ),
    log: [...state.log, entry(state.manche, `Effet "${nom}" retiré de ${p?.nom ?? "?"} (manuel).`)],
  };
}

export function prevTurn(state: CombatState): CombatState {
  if (state.participants.length === 0) return state;
  let idx = state.tourIndex - 1;
  let manche = state.manche;
  if (idx < 0) {
    idx = state.participants.length - 1;
    manche = Math.max(1, manche - 1);
  }
  return { ...state, tourIndex: idx, manche, log: [...state.log, entry(manche, `Retour au tour de ${state.participants[idx]?.nom ?? "—"}.`)] };
}
