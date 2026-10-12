// Générateur de potions COF — contenu d'une potion (mineure ou moyenne).
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Les potions de palier moyen contiennent trois doses bues indépendamment :
// un seul tirage définit le contenu du flacon, à consommer dose par dose.

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";

export type CategoriePotion = "soins" | "commune" | "rare";

export interface PlageCategoriePotion {
  min: number;
  max: number;
  categorie: CategoriePotion;
  label: string;
}

/** Tirage de la catégorie de potion (1d6) : soins, commune ou rare. */
export const CATEGORIES_POTION: { de: 6; plages: PlageCategoriePotion[] } = {
  de: 6,
  plages: [
    { min: 1, max: 3, categorie: "soins", label: "Potion de soins" },
    { min: 4, max: 5, categorie: "commune", label: "Potion commune" },
    { min: 6, max: 6, categorie: "rare", label: "Potion rare" },
  ],
};

export interface PlageEffetPotion {
  min: number;
  max: number;
  nom: string;
}

export interface TableEffetsPotion {
  categorie: CategoriePotion;
  de: 6 | 10 | 20;
  effets: PlageEffetPotion[];
}

/** Effets de potion par catégorie. */
export const EFFETS_POTIONS: Record<CategoriePotion, TableEffetsPotion> = {
  soins: {
    categorie: "soins",
    de: 6,
    effets: [
      { min: 1, max: 3, nom: "Soins légers (Prêtre)*" },
      { min: 4, max: 5, nom: "Soins modérés (Prêtre)*" },
      { min: 6, max: 6, nom: "Délivrance (Prêtre)*" },
    ],
  },
  commune: {
    categorie: "commune",
    de: 10,
    effets: [
      { min: 1, max: 1, nom: "Détection de l'invisible (Ensorceleur)" },
      { min: 2, max: 2, nom: "Lévitation (Magicien)" },
      { min: 3, max: 3, nom: "Forme gazeuse (Magicien)" },
      { min: 4, max: 4, nom: "Accélération (Magicien)" },
      { min: 5, max: 5, nom: "Maîtrise des éléments (Magicien)" },
      { min: 6, max: 6, nom: "Respiration aquatique (Magicien)" },
      { min: 7, max: 7, nom: "Armure de mana (Magicien)" },
      { min: 8, max: 8, nom: "Chute ralentie (Magicien)" },
      { min: 9, max: 9, nom: "Invisibilité (Magicien)" },
      { min: 10, max: 10, nom: "Vol (Magicien)" },
    ],
  },
  rare: {
    categorie: "rare",
    de: 20,
    effets: [
      { min: 1, max: 1, nom: "Langage des animaux (Druide, 1d6 minutes)" },
      { min: 2, max: 2, nom: "Masque du prédateur (Druide)" },
      { min: 3, max: 3, nom: "Forme animale (Druide, 1d6 minutes)" },
      { min: 4, max: 4, nom: "Terrains difficiles (Druide, 2d6 h)" },
      { min: 5, max: 5, nom: "Forme d'arbre (Druide, 2d6 minutes)" },
      { min: 6, max: 6, nom: "Peau d'écorce (Druide, +5 DEF)" },
      { min: 7, max: 7, nom: "Clairvoyance (Ensorceleur, 1d6 tours)" },
      { min: 8, max: 8, nom: "Sous tension (Ensorceleur)" },
      { min: 9, max: 9, nom: "Forme éthérée (Ensorceleur)" },
      { min: 10, max: 10, nom: "Imitation (Ensorceleur)" },
      { min: 11, max: 11, nom: "Fortifiant (Forgesort)" },
      { min: 12, max: 12, nom: "Feu grégeois (Forgesort)" },
      { min: 13, max: 13, nom: "Elixir de guérison (Forgesort)" },
      { min: 14, max: 14, nom: "Déphasage (Magicien)" },
      { min: 15, max: 15, nom: "Beauté de la succube (Sorcier)" },
      { min: 16, max: 16, nom: "Aspect du démon (Sorcier)" },
      { min: 17, max: 17, nom: "Masque mortuaire (Sorcier)" },
      { min: 18, max: 18, nom: "Reptation (Sorcier)" },
      { min: 19, max: 19, nom: "Ailes célestes (Prêtre)" },
      { min: 20, max: 20, nom: "Sanctuaire (Prêtre)" },
    ],
  },
};

/** Règle d'usage des potions (rappel affiché au MJ). */
export const USAGE_POTION =
  "Boire une potion = action de mouvement (M), utilisable par tout le monde.";

export interface PotionTiree {
  categorie: CategoriePotion;
  categorieLabel: string;
  jetCategorie: number;
  jetEffet: number;
  /** "Invisibilité (Magicien)", "Soins légers (Prêtre)*", … */
  nom: string;
  /** Détail des tirages (ex. "d6 = 5 → commune ; d10 = 9 → Invisibilité (Magicien)"). */
  detail: string;
}

/** Tire le contenu d'une potion (catégorie au d6, puis effet de la table). */
export function genererPotion(rng: Rng = Math.random): PotionTiree {
  const jetCategorie = rollDie(CATEGORIES_POTION.de, rng);
  const plage = CATEGORIES_POTION.plages.find((p) => jetCategorie >= p.min && jetCategorie <= p.max);
  if (!plage) throw new Error(`Tirage ${jetCategorie} hors table des catégories de potions.`);
  const table = EFFETS_POTIONS[plage.categorie];
  const jetEffet = rollDie(table.de, rng);
  const effet = table.effets.find((e) => jetEffet >= e.min && jetEffet <= e.max);
  if (!effet) throw new Error(`Tirage ${jetEffet} hors table des effets (${plage.categorie}).`);
  return {
    categorie: plage.categorie,
    categorieLabel: plage.label,
    jetCategorie,
    jetEffet,
    nom: effet.nom,
    detail: `d6 = ${jetCategorie} → ${plage.label} ; d${table.de} = ${jetEffet} → ${effet.nom}`,
  };
}
