import { CLASSES } from "@/src/lib/data/classes";
import { VOIE_MAGE } from "@/src/lib/data/peuples";
import { FAMILLES, REGLES_PROFILS, type FamilleCOF } from "@/src/lib/rules/personnage";

// Couleurs et lecture des familles COF : une seule source de vérité pour tout
// le site (app/globals.css porte les variables --fam-*, ce module nomme
// l'accent et le déduit d'une fiche, d'un sort, d'une voie ou d'une capacité).
//
// Base demandée : Combattant rouge sang #a83232, Aventurier vert mousse
// #4f7a3d, Mystique violet améthyste #7a5ba8, Mage bleu arcanique #3b6ea5.
// Le TRAIT garde la base (rails, pastilles, filets), le FOND en est la version
// translucide, le TEXTE la version éclaircie (contraste vérifié par
// tests/rules/famille.test.ts : ≥ 4.5:1 sur les cartes sombres).

/** Classe CSS portant l'accent d'une famille ("fam-mage" ; "fam-neutre" si aucune). */
export function classeFamille(famille?: string | null): string {
  return famille && (FAMILLES as string[]).includes(famille) ? `fam-${famille.toLowerCase()}` : "fam-neutre";
}

/** Famille d'un profil ; null si ce n'est pas un des 14 profils (monstres, vide). */
export function familleDuProfil(profil?: string | null): FamilleCOF | null {
  return REGLES_PROFILS[(profil ?? "").trim()]?.famille ?? null;
}

/**
 * Famille commune à une liste de profils (champ `familles` d'un sort ou d'une
 * capacité = profils qui peuvent l'apprendre). null si la liste est vide
 * (toutes classes) ou si les profils viennent de familles différentes :
 * mieux vaut aucun accent qu'un accent faux.
 */
export function familleDesProfils(profils?: readonly string[] | null): FamilleCOF | null {
  const familles = new Set(
    (profils ?? []).map((p) => familleDuProfil(p)).filter((f): f is FamilleCOF => f !== null)
  );
  if (familles.size !== 1) return null;
  return [...familles][0];
}

/** Voie -> famille (les 70 voies de profil ; "Voie du mage" est Mage). */
const VOIE_VERS_FAMILLE: Map<string, FamilleCOF> = new Map<string, FamilleCOF>([
  ...CLASSES.flatMap((c) => c.voies.map((v) => [v, c.famille] as [string, FamilleCOF])),
  [VOIE_MAGE.voie, "Mage"],
]);

/** Famille d'une voie ("Voie de la foi" → Mystique) ; null pour une voie de peuple. */
export function familleDeLaVoie(voie?: string | null): FamilleCOF | null {
  return VOIE_VERS_FAMILLE.get((voie ?? "").trim()) ?? null;
}

/** Famille d'un sort (ou d'un talent) : profils qui l'apprennent, à défaut sa voie. */
export function familleDuSort(sort: { familles?: string[] | null; voie?: string | null }): FamilleCOF | null {
  // `familles: []` veut dire « toutes classes » (pas une famille) : null, jamais
  // la couleur de la voie. `familles` absente (sorts d'auteur) : repli sur la voie.
  if (sort.familles != null) return familleDesProfils(sort.familles);
  return familleDeLaVoie(sort.voie);
}
