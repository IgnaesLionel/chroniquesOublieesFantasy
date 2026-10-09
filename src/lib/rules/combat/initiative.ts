import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import type { ActiveEffect } from "@/src/lib/rules/types";
import type { CombatLogEntry, CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import { tickEffects } from "@/src/lib/rules/effects/effects";
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

/** Lance 1d20+initMod pour chacun, trie décroissant. Départage : initMod puis ordre stable. */
export function rollInitiatives(state: CombatState, rng: Rng = Math.random): CombatState {
  const rolled: CombatParticipant[] = state.participants.map((p) => ({
    ...p,
    initiative: rollDie(20, rng) + p.initMod,
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

/** Prochain tour (saute KO/morts si sauterKO). Manche++ à chaque boucle. Tick les effets du nouvel actif. */
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
  const actif = participants[idx];
  if (actif && actif.effets.length > 0) {
    const { restants, pvDelta, expires } = tickEffects(actif.effets);
    let pv = actif.pv;
    if (pvDelta !== 0 && actif.statut === "actif") {
      pv = Math.max(0, Math.min(actif.pvMax, actif.pv + pvDelta));
      log.push(entry(manche, `${actif.nom} : effet (${pvDelta > 0 ? "+" : ""}${pvDelta} PV) -> ${pv}/${actif.pvMax} PV`));
    }
    for (const e of expires) log.push(entry(manche, `Effet "${e.nom}" expiré sur ${actif.nom}.`));
    const statut = pv <= 0 ? ("ko" as const) : actif.statut;
    if (pv <= 0 && actif.statut === "actif") log.push(entry(manche, `${actif.nom} est hors combat`));
    participants = participants.map((p, i) => (i === idx ? { ...p, effets: restants, pv, statut } : p));
  }
  log.push(entry(manche, `Tour de ${actif?.nom ?? "—"} (manche ${manche}).`));
  return checkEnd({ ...state, participants, tourIndex: idx, manche, log });
}

/** Ajoute un effet à un participant (pur). */
export function addParticipantEffect(state: CombatState, instanceId: string, effet: ActiveEffect): CombatState {
  return {
    ...state,
    participants: state.participants.map((p) =>
      p.instanceId === instanceId ? { ...p, effets: [...p.effets, effet] } : p
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
