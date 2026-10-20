// Application des auras de début de combat (ex. Effroi de Sigméus).
// Pur (aucune dépendance React) : appelé une fois au lancement de la rencontre.
import type { ActiveEffect } from "@/src/lib/rules/types";
import type { CombatLogEntry, CombatState } from "@/src/lib/rules/combat/types";
import { AURAS_DEBUT_COMBAT } from "@/src/lib/data/auras-combat";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";
import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";

function entry(manche: number, message: string): CombatLogEntry {
  return {
    id: `aura-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    at: new Date().toISOString(),
    manche,
    message,
  };
}

let counter = 0;
function idEffet(): string {
  counter += 1;
  return `eff-aura-${Date.now().toString(36)}-${counter}`;
}

/** Lance une expression "NdM" (ex. "1d4"). */
function lancerDe(expr: string, rng: Rng): number {
  const m = /^(\d+)\s*[dD]\s*(\d+)$/.exec(expr.trim());
  if (!m) return 0;
  let total = 0;
  for (let i = 0; i < Number(m[1]); i++) total += rollDie(Number(m[2]), rng);
  return total;
}

/**
 * Auras de début de combat : pour chaque porteur, chaque adversaire actif
 * passe un test de la caractéristique (d20 + carac >= difficulté). Les échecs
 * reçoivent un état qui, ici, leur interdit d'attaquer le porteur pendant 1d4
 * tours (`interditCible`). Le tout est journalisé et ne dépend PAS de l'ordre
 * d'initiative. À appeler une seule fois, au lancement.
 */
export function appliquerAurasDebutCombat(state: CombatState, rng: Rng = Math.random): CombatState {
  if (AURAS_DEBUT_COMBAT.length === 0) return state;
  let participants = state.participants;
  const log = [...state.log];
  for (const porteur of state.participants) {
    if (porteur.statut !== "actif") continue;
    const connues = (porteur.capacites ?? []).map(normaliserNomCapacite);
    for (const aura of AURAS_DEBUT_COMBAT) {
      if (!connues.includes(normaliserNomCapacite(aura.capacite))) continue;
      for (const cible of state.participants) {
        if (cible.statut !== "actif" || cible.camp === porteur.camp) continue;
        const carac = cible.caracs?.[aura.carac] ?? 0;
        const d20 = rollDie(20, rng);
        const total = d20 + carac;
        const reussi = total >= aura.difficulte;
        log.push(
          entry(
            state.manche,
            `${aura.capacite} — ${cible.nom} : test de ${aura.statNom} ${d20}${carac >= 0 ? "+" : ""}${carac} = ${total} vs ${aura.difficulte} → ${reussi ? "réussi" : "échec"}`
          )
        );
        if (reussi) continue;
        const duree = lancerDe(aura.dureeDe, rng);
        const effet: ActiveEffect = {
          id: idEffet(),
          nom: aura.effetNom,
          description: `Test de ${aura.statNom} raté : ne peut pas attaquer ${porteur.nom} tant que l'effet dure.`,
          dureeTours: duree,
          toursRestants: duree,
          modificateurs: {},
          source: aura.capacite,
          interditCible: porteur.instanceId,
        };
        participants = participants.map((p) =>
          p.instanceId === cible.instanceId ? { ...p, effets: [...p.effets, effet] } : p
        );
        log.push(
          entry(
            state.manche,
            `${cible.nom} : ${aura.effetNom} (${duree} tour${duree > 1 ? "s" : ""}) — ne peut pas attaquer ${porteur.nom}.`
          )
        );
      }
    }
  }
  return { ...state, participants, log };
}
