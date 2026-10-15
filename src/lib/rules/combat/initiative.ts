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
 * Effets : à la FIN du tour de leur porteur (l'ancien actif en partant),
 * on applique les dégâts/soins par tour PUIS on consomme les durées.
 * Ainsi un DoT "N tours" blesse N fois à la fin des tours de sa victime,
 * et un malus "1 tour" posé sur un ennemi couvre tout son tour avant
 * d'expirer à la fin de celui-ci.
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
  // 1) Fin de tour de l'ancien actif : dégâts/soins par tour (ex: Saignement),
  // puis durées consommées. Un effet posé pendant ce même tour est épargné
  // (il doit encore couvrir un tour complet).
  const ancien = participants[state.tourIndex];
  if (ancien && ancien.effets.length > 0) {
    // Un effet posé pendant ce même tour ne blesse pas encore (tour complet à venir).
    const prets = ancien.effets.filter(
      (e) => !(e.pose != null && e.pose.manche === state.manche && e.pose.tourIndex === state.tourIndex)
    );
    const pvDelta = ancien.statut === "actif" ? pvParTourTotal(prets) : 0;
    if (pvDelta !== 0) {
      const pv = Math.max(0, Math.min(ancien.pvMax, ancien.pv + pvDelta));
      participants = participants.map((p, i) => (
        i === state.tourIndex
          ? { ...p, pv, statut: pv <= 0 ? ("ko" as const) : p.statut }
          : p
      ));
      log.push(entry(manche, `${ancien.nom} : effet (${pvDelta > 0 ? "+" : ""}${pvDelta} PV) -> ${pv}/${ancien.pvMax} PV`));
      if (pv <= 0 && ancien.statut === "actif") log.push(entry(manche, `${ancien.nom} est hors combat`));
    }
    const { restants, expires } = decrementerFinDeTour(ancien.effets, state.manche, state.tourIndex);
    participants = participants.map((p, i) => (i === state.tourIndex ? { ...p, effets: restants } : p));
    for (const e of expires) log.push(entry(manche, `Effet "${e.nom}" expiré sur ${ancien.nom} (fin de tour).`));
  }
  // 2) Tour du nouvel actif (aucun tick : déjà appliqué en fin de tour).
  const actif = participants[idx];
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
