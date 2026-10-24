// Chance de toucher : factorisation du calcul de `resolveAttack` (attack.ts)
// pour que l'affichage de l'interface ne diverge jamais du moteur.
//
// Règles COF2 appliquées (aucune invention) :
// - test : 1d20 + bonus d'attaque ≥ DEF de la cible ;
// - 1 naturel = échec automatique, 20 naturel = touche automatique ;
// - seuil de critique éventuel (19-20 du maître d'armes) : le jet naturel qui
//   l'atteint touche automatiquement dans le moteur ;
// - dé bonus (garde le meilleur) / dé malus (garde le pire) ;
// - prédilection du maître d'armes : +1 au jet (règle déjà appliquée par le
//   moteur, pas une statistique de fiche).

import { getModifier } from "@/src/lib/rules/effects/effects";
import type { AttackDef } from "@/src/lib/rules/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";

/** Situation du jet construite par l'interface (options tactiques, talents). */
export interface SituationAttaque {
  /** Mod. manuel + option tactique + Double/Circulaire. */
  modAttaque?: number;
  /** Remplace le bonus de la fiche (Attaque éclair : niveau + AGI). */
  bonusOverride?: number;
  /** Attaque d'arme (ouvre le +1 de prédilection). */
  arme?: boolean;
  /** Attaque à distance (malus d'aveuglement spécifique). */
  distance?: boolean;
}

export interface ComposantesAttaque {
  /** Bonus de la fiche (ou override). */
  base: number;
  /** Effets de l'attaquant + mod. de situation, hors distance. */
  modEffets: number;
  /** Malus d'attaque à distance lié aux effets (aveuglé). */
  modDistance: number;
  /** +1 de prédilection (0 ou 1). */
  predilection: number;
  /** Somme : ce que le d20 doit compléter. */
  bonus: number;
}

/** Décompose le bonus d'attaque effectif, comme `resolveAttack`. */
export function composantesAttaque(
  attaquant: Pick<CombatParticipant, "effets" | "famillePredilection">,
  attaque: Pick<AttackDef, "bonus" | "familles">,
  situation: SituationAttaque = {}
): ComposantesAttaque {
  const base = situation.bonusOverride ?? attaque.bonus;
  const modEffets = getModifier(attaquant.effets, "attaque") + (situation.modAttaque ?? 0);
  const modDistance = situation.distance ? getModifier(attaquant.effets, "attaqueDistance") : 0;
  const predilection =
    situation.arme && attaquant.famillePredilection && (attaque.familles ?? []).includes(attaquant.famillePredilection)
      ? 1
      : 0;
  return { base, modEffets, modDistance, predilection, bonus: base + modEffets + modDistance + predilection };
}

/** Seuil à atteindre : DEF + effets de la cible (ou difficulté fixe du sort). */
export function seuilDefense(
  cible: Pick<CombatParticipant, "defense" | "effets">,
  difficulteFixe?: number
): number {
  return difficulteFixe ?? cible.defense + getModifier(cible.effets, "defense");
}

/**
 * Probabilité de toucher (0..1) d'un d20 + bonus contre un seuil.
 * `avantage` reproduit le dé bonus/malus du moteur ; `seuilCritique` le seuil
 * de critique automatique (20 par défaut, 19 avec Science du critique).
 */
export function probabiliteToucher(
  bonus: number,
  defense: number,
  avantage: "bonus" | "malus" | null = null,
  seuilCritique = 20
): number {
  let echecs = 0;
  for (let d = 1; d <= 20; d++) {
    const touche = d >= seuilCritique || (d !== 1 && d + bonus >= defense);
    if (!touche) echecs++;
  }
  const pEchec = echecs / 20;
  if (avantage === "bonus") return 1 - pEchec * pEchec;
  if (avantage === "malus") return (1 - pEchec) * (1 - pEchec);
  return 1 - pEchec;
}
