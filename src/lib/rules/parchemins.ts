// Générateur de parchemins COF — rang du sort scellé + voie et sort (grimoire).
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Rappel d'usage : un parchemin n'est utilisable que par les profils de
// lanceur de sorts, jusqu'à un rang maximum égal au plus haut rang atteint
// dans une voie de magie. Utiliser un parchemin = action limitée.
// Procédure : rang au d6 selon le palier, puis 1d20 pour la voie. Si la voie
// ne propose aucun sort au rang tiré (astérisque du livre), relancer le d20.

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import type { Sort } from "@/src/lib/rules/types";

/** Règle d'usage des parchemins (rappel affiché au MJ). */
export const USAGE_PARCHEMIN =
  "Lanceurs de sorts uniquement (illisible hors famille de profil), jusqu'au plus haut rang atteint dans une voie de magie. " +
  "Sans test si le sort est du profil et d'un rang maîtrisé ; sinon test d'attaque magique difficulté 5 × rang " +
  "(+5 si autre profil de même famille). Échec d'au moins 10 points : sort effacé. " +
  "Utiliser un parchemin = action limitée, consommable unique.";

/**
 * Plus haut rang de sort connu (0 si aucun) : mesure la "maîtrise" d'un
 * lanceur pour les parchemins (pas de test si le parchemin est d'un rang
 * inférieur ou égal).
 */
export function rangMaxSortsConnus(sorts: Pick<Sort, "rang">[]): number {
  let max = 0;
  for (const s of sorts ?? []) {
    if (typeof s.rang === "number" && s.rang > max) max = Math.floor(s.rang);
  }
  return max;
}

export interface PlageRangParchemin {
  min: number;
  max: number;
  rang: number;
}

export interface TableRangParchemin {
  palier: "mineur" | "moyen";
  de: 6;
  plages: PlageRangParchemin[];
}

/** Rang du sort selon le niveau de l'objet (1d6). Pas de parchemins majeurs. */
export const RANGS_PARCHEMIN: Record<"mineur" | "moyen", TableRangParchemin> = {
  mineur: {
    palier: "mineur",
    de: 6,
    plages: [
      { min: 1, max: 3, rang: 1 },
      { min: 4, max: 5, rang: 2 },
      { min: 6, max: 6, rang: 3 },
    ],
  },
  moyen: {
    palier: "moyen",
    de: 6,
    plages: [
      { min: 1, max: 2, rang: 3 },
      { min: 3, max: 4, rang: 4 },
      { min: 5, max: 6, rang: 5 },
    ],
  },
};

export interface PlageVoieParchemin {
  min: number;
  max: number;
  voie: string;
  profil: string;
}

/** Voie du parchemin (1d20), regroupée par profil de lanceur. */
export const VOIES_PARCHEMIN: { de: 20; plages: PlageVoieParchemin[] } = {
  de: 20,
  plages: [
    { min: 1, max: 1, voie: "Voie de l'air", profil: "Ensorceleur" },
    { min: 2, max: 2, voie: "Voie de la divination", profil: "Ensorceleur" },
    { min: 3, max: 3, voie: "Voie de l'envoûteur", profil: "Ensorceleur" },
    { min: 4, max: 4, voie: "Voie des illusions", profil: "Ensorceleur" },
    { min: 5, max: 5, voie: "Voie de l'invocation", profil: "Ensorceleur" },
    { min: 6, max: 6, voie: "Voie de la magie des arcanes", profil: "Magicien" },
    { min: 7, max: 7, voie: "Voie de la magie destructrice", profil: "Magicien" },
    { min: 8, max: 8, voie: "Voie de la magie élémentaire", profil: "Magicien" },
    { min: 9, max: 9, voie: "Voie de la magie protectrice", profil: "Magicien" },
    { min: 10, max: 10, voie: "Voie de la magie universelle", profil: "Magicien" },
    { min: 11, max: 11, voie: "Voie du démon", profil: "Sorcier" },
    { min: 12, max: 12, voie: "Voie de la mort", profil: "Sorcier" },
    { min: 13, max: 13, voie: "Voie de l'outre-tombe", profil: "Sorcier" },
    { min: 14, max: 14, voie: "Voie du sang", profil: "Sorcier" },
    { min: 15, max: 15, voie: "Voie de la sombre magie", profil: "Sorcier" },
    { min: 16, max: 16, voie: "Voie de la foi", profil: "Prêtre" },
    { min: 17, max: 17, voie: "Voie de la prière", profil: "Prêtre" },
    { min: 18, max: 18, voie: "Voie des soins", profil: "Prêtre" },
    { min: 19, max: 19, voie: "Voie de la spiritualité", profil: "Prêtre" },
    { min: 20, max: 20, voie: "Voie des végétaux", profil: "Druide" },
  ],
};

/** Voie désignée par un tirage d20. */
export function voieParchemin(jet: number): PlageVoieParchemin {
  const plage = VOIES_PARCHEMIN.plages.find((p) => jet >= p.min && jet <= p.max);
  if (!plage) throw new Error(`Tirage ${jet} hors table des voies de parchemins (1-20).`);
  return plage;
}

/** Relances maximales du d20 avant de laisser le MJ choisir (garde-fou). */
export const MAX_RELANCES_VOIE = 20;

export interface ParcheminTire {
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
  /** Détail des tirages. */
  detail: string;
}

/** Sort scellé commun aux parchemins et aux baguettes (rang + voie + sort). */
export interface SortScelle {
  jetRang: number;
  rang: number;
  jetsVoie: number[];
  voie: string | null;
  sortNom: string | null;
}

/**
 * Tire le sort scellé d'un parchemin ou d'une baguette : rang (d6 selon le
 * palier), voie (d20), puis un sort du grimoire de cette voie à ce rang.
 * Sans sort correspondant (astérisque du livre), le d20 est relancé.
 */
export function tirerSortScelle(
  palier: "mineur" | "moyen",
  rng: Rng = Math.random,
  grimoire: Sort[] = SEED_SORTS
): SortScelle {
  const table = RANGS_PARCHEMIN[palier];
  if (!table) throw new Error(`Pas de rang de sort pour le palier ${palier} (mineur ou moyen uniquement).`);
  const jetRang = rollDie(table.de, rng);
  const plage = table.plages.find((p) => jetRang >= p.min && jetRang <= p.max);
  if (!plage) throw new Error(`Tirage ${jetRang} hors table des rangs de parchemins.`);
  const rang = plage.rang;
  const jetsVoie: number[] = [];
  let voie: string | null = null;
  let sortNom: string | null = null;
  for (let essai = 0; essai < MAX_RELANCES_VOIE; essai++) {
    const jet = rollDie(VOIES_PARCHEMIN.de, rng);
    jetsVoie.push(jet);
    const designation = voieParchemin(jet);
    const sorts = grimoire.filter((s) => s.voie === designation.voie && s.rang === rang);
    if (sorts.length === 0) continue; // astérisque : pas un sort, on relance
    voie = designation.voie;
    sortNom = sorts[Math.floor(rng() * sorts.length)].nom;
    break;
  }
  return { jetRang, rang, jetsVoie, voie, sortNom };
}

/**
 * Tire un parchemin complet : rang (d6), voie (d20), puis un sort du grimoire
 * de cette voie à ce rang. Sans sort correspondant (astérisque du livre), le
 * d20 est relancé pour une autre voie.
 */
export function genererParchemin(
  palier: "mineur" | "moyen",
  rng: Rng = Math.random,
  grimoire: Sort[] = SEED_SORTS
): ParcheminTire {
  const s = tirerSortScelle(palier, rng, grimoire);
  const tirages = `d20 = ${s.jetsVoie.join(", ")}`;
  return {
    palier,
    jetRang: s.jetRang,
    rang: s.rang,
    jetsVoie: s.jetsVoie,
    voie: s.voie,
    sortNom: s.sortNom,
    detail:
      s.sortNom && s.voie
        ? `d6 = ${s.jetRang} → rang ${s.rang} ; ${tirages} → ${s.voie} → « ${s.sortNom} »`
        : `d6 = ${s.jetRang} → rang ${s.rang} ; ${tirages} → sort à choisir par le MJ`,
  };
}
