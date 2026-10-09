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
  /** Effet appliqué si TOUCHÉ (clé du catalogue, ex: "empoisonne"). */
  effetCle?: string;
  effetDuree?: number | null;
  exemple: boolean;
}
