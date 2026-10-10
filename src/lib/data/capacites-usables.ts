// Usages par défaut des talents en combat : quel effet appliquer quand on
// utilise tel talent, et sur qui par défaut. Le MJ peut toujours choisir un
// autre effet (ou aucun : usage noté au journal) dans le panneau Capacités.
// Seuls les cas mécaniquement directs y figurent ; le reste se gère au cas
// par cas (durées variables, dés bonus non modélisés, etc.).

export type CibleCapacite = "allies" | "ennemis" | "tous";

export interface CapaciteUsable {
  /** Nom exact du talent (comparaison insensible à la casse, suffixes (L)/(A)... ignorés). */
  talent: string;
  /** Clé du catalogue d'effets appliquée par défaut. */
  effetCle: string;
  /** Durée par défaut (null = jusqu'à suppression manuelle). */
  dureeTours: number | null;
  /** Cibles suggérées par défaut. */
  cibles: CibleCapacite;
  /** Écart éventuel avec le texte DRS (approximation moteur). */
  note?: string;
}

export const CAPACITES_USABLES: CapaciteUsable[] = [
  {
    talent: "Protéger un allié",
    effetCle: "protection",
    dureeTours: 1,
    cibles: "allies",
    note: "DRS : +2 DEF contre 1 attaque ; moteur : +2 DEF pendant 1 round.",
  },
];
