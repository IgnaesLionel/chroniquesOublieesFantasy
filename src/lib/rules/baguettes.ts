// Générateur de baguettes magiques COF — sort scellé, charges et niveau.
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Une baguette contient un sort lançable une fois par charge (2d20 charges
// au départ). Mêmes tables de sort que les parchemins (rang au d6 selon le
// palier, voie au d20 avec relance si astérisque).

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import type { Sort } from "@/src/lib/rules/types";
import { tirerSortScelle } from "@/src/lib/rules/parchemins";

/** Règle d'usage des baguettes (rappel affiché au MJ). */
export const USAGE_BAGUETTE =
  "Lanceurs de sorts uniquement (bardes, druides et prêtres inclus), de niveau au moins égal au rang du sort. " +
  "Activer une baguette = action d'attaque, un sort par charge. " +
  "Niveau de magie : moitié du rang (arrondi inf.) sous 30 charges, rang du sort à 30 charges et plus.";

/** Seuil de charges : à partir de là, niveau de magie = rang du sort. */
export const SEUIL_CHARGES_BAGUETTE = 30;

export interface BaguetteTiree {
  palier: "mineur" | "moyen";
  jetRang: number;
  /** Rang du sort scellé. */
  rang: number;
  /** Tous les tirages d20 de voie (relances incluses). */
  jetsVoie: number[];
  /** Voie du sort (null si aucune n'a convenu : le MJ choisit). */
  voie: string | null;
  /** Sort du grimoire (voie + rang), null si à choisir par le MJ. */
  sortNom: string | null;
  /** Tirages des 2d20 de charges. */
  jetsCharges: number[];
  /** Charges au départ (2d20). */
  charges: number;
  /** Niveau de magie : moitié du rang (< 30 charges) ou rang (30+). */
  niveauMagie: number;
  /** Détail des tirages. */
  detail: string;
}

/** Tire une baguette complète : sort scellé, 2d20 charges, niveau de magie. */
export function genererBaguette(
  palier: "mineur" | "moyen",
  rng: Rng = Math.random,
  grimoire: Sort[] = SEED_SORTS
): BaguetteTiree {
  const s = tirerSortScelle(palier, rng, grimoire);
  const jetsCharges = [rollDie(20, rng), rollDie(20, rng)];
  const charges = jetsCharges[0] + jetsCharges[1];
  const niveauMagie = charges >= SEUIL_CHARGES_BAGUETTE ? s.rang : Math.floor(s.rang / 2);
  const tirages = `d20 = ${s.jetsVoie.join(", ")}`;
  const sortTxt =
    s.sortNom && s.voie ? `« ${s.sortNom} » (${s.voie})` : "sort à choisir par le MJ";
  return {
    palier,
    jetRang: s.jetRang,
    rang: s.rang,
    jetsVoie: s.jetsVoie,
    voie: s.voie,
    sortNom: s.sortNom,
    jetsCharges,
    charges,
    niveauMagie,
    detail:
      `d6 = ${s.jetRang} → rang ${s.rang} ; ${tirages} → ${sortTxt} ; ` +
      `2d20 = ${jetsCharges.join(" + ")} → ${charges} charges (niveau de magie ${niveauMagie})`,
  };
}
