// PNJ et objets. Données pures, sans React.
// Valeurs d'exemple uniquement, NON officielles.

export interface Npc {
  id: string;
  nom: string;
  role?: string;
  portraitUrl?: string;
  description?: string;
  personnalite?: string;
  statistiques?: string;
  dialogues: string[];
  secret?: string;
  relations?: string;
  notesMJ?: string;
  exemple: boolean;
}

export type ItemCategorie = "arme" | "armure" | "potion" | "quete" | "outil" | "argent" | "divers";

export const ITEM_CATEGORIES: ItemCategorie[] = ["arme", "armure", "potion", "quete", "outil", "argent", "divers"];

/** Type de dégâts d'une famille d'armes (purement descriptif, sans effet moteur). */
export type DegatType = "tranchant" | "perforant" | "contondant" | "distance" | "autre";

export const DEGAT_LABEL: Record<DegatType, string> = {
  tranchant: "Tranchant",
  perforant: "Perforant",
  contondant: "Contondant",
  distance: "À distance",
  autre: "Autre",
};

/** Famille d'arme (feuille de la taxonomie : épées, haches, dagues...). */
export const ARME_FAMILLE_KEYS = [
  "epees", "haches",
  "estoc", "dagues", "lances",
  "masses", "batons", "gourdins",
  "arcs", "arbaletes", "jet", "poudre",
  "mains-nues",
] as const;

export type ArmeFamille = (typeof ARME_FAMILLE_KEYS)[number];

export interface ArmeFamilleDef {
  key: ArmeFamille;
  label: string;
  degat: DegatType;
  /** Ce que font ces armes (aide MJ). */
  verbes: string;
  exemples: string;
}

/** Taxonomie des armes : tranchantes, perforantes/d'estoc, contondantes, à distance, autres. */
export const ARME_FAMILLES: ArmeFamilleDef[] = [
  { key: "epees", label: "Épées", degat: "tranchant", verbes: "coupent, tranchent, fendent", exemples: "épée longue, bâtarde, deux mains, cimeterre, katana" },
  { key: "haches", label: "Haches", degat: "tranchant", verbes: "coupent, tranchent, fendent", exemples: "hache à une main, deux mains, hachette" },
  { key: "estoc", label: "Lames d'estoc", degat: "perforant", verbes: "piquent, poignardent, percent", exemples: "rapière, vivelame, épée courte en pointe" },
  { key: "dagues", label: "Dagues et couteaux", degat: "perforant", verbes: "piquent, poignardent, percent", exemples: "dague, dague de lancer, couteau de combat" },
  { key: "lances", label: "Lances et épieux", degat: "perforant", verbes: "piquent, poignardent, percent", exemples: "lance, épieu, pique (charge ou pointe)" },
  { key: "masses", label: "Masses et marteaux", degat: "contondant", verbes: "écrasent, assomment, fracassent", exemples: "masse d'armes, marteau de guerre" },
  { key: "batons", label: "Bâtons", degat: "contondant", verbes: "écrasent, assomment, fracassent", exemples: "bâton, bâton ferré, bâton de combat" },
  { key: "gourdins", label: "Gourdins et improvisées", degat: "contondant", verbes: "écrasent, assomment, fracassent", exemples: "gourdin, arme improvisée contondante" },
  { key: "arcs", label: "Arcs", degat: "distance", verbes: "frappent à distance", exemples: "arc court, arc long" },
  { key: "arbaletes", label: "Arbalètes", degat: "distance", verbes: "frappent à distance", exemples: "arbalète légère, lourde" },
  { key: "jet", label: "Armes de jet", degat: "distance", verbes: "frappent à distance", exemples: "javelot, hachette ou dague de lancer" },
  { key: "poudre", label: "Armes à poudre", degat: "distance", verbes: "frappent à distance", exemples: "pistolet, mousquet (si utilisées)" },
  { key: "mains-nues", label: "Mains nues", degat: "autre", verbes: "frappent au corps à corps", exemples: "poings, pieds" },
];

/** Libellé d'une famille (repli : la clé). */
export function labelFamilleArme(key: ArmeFamille): string {
  return ARME_FAMILLES.find((f) => f.key === key)?.label ?? key;
}

export interface Item {
  id: string;
  nom: string;
  categorie: ItemCategorie;
  description?: string;
  effet?: string;
  quantite: number;
  poids?: number;
  valeur?: number;
  /** Arme : utilisable en combat (bonus + dégâts). */
  estArme?: boolean;
  bonusAttaque?: number;
  /** Dégâts de l'arme (ex: "1d8+3"). */
  degats?: string;
  /** Familles d'arme (cumul possible : ex. hachette de lancer = haches + jet). */
  familles?: ArmeFamille[];
  /** Effet appliqué si TOUCHÉ (clé du catalogue, ex: "empoisonne"). */
  effetCle?: string;
  effetDuree?: number | null;
  exemple: boolean;
}
