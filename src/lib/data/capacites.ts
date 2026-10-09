import { CAPACITES_COMBATTANT } from "./capacites-combattant";
import { CAPACITES_AVENTURIER } from "./capacites-aventurier";
import { CAPACITES_MYSTIQUE } from "./capacites-mystique";
import { CAPACITES_MAGE } from "./capacites-mage";
import type { ActionDRS } from "@/src/lib/rules/types";

/** Une capacité (talent) d'une voie : nom, rang 1-5, résumé mécanique. */
export interface Capacite {
  nom: string;
  rang: number;
  resume: string;
  /** Id du grimoire si la capacité est un sort à PM. */
  sortId?: string;
}

/** Une voie (arbre de talents) et ses 5 capacités. */
export interface VoieDetail {
  voie: string;
  capacites: Capacite[];
}

/** Toutes les capacités par profil (14 profils × 5 voies × 5 rangs). */
export const CAPACITES: Record<string, VoieDetail[]> = {
  ...CAPACITES_COMBATTANT,
  ...CAPACITES_AVENTURIER,
  ...CAPACITES_MYSTIQUE,
  ...CAPACITES_MAGE,
};

/** Voies détaillées d'un profil (tableau vide si inconnu). */
export function voiesDe(profil: string): VoieDetail[] {
  return CAPACITES[profil] ?? [];
}

export const ACTION_LABEL: Record<ActionDRS, string> = {
  attaque: "Attaque (A)",
  mouvement: "Mouvement (M)",
  limitee: "Limitée (L)",
  gratuite: "Gratuite (G)",
};

/**
 * Déduit le type d'action DRS d'un résumé ("Action limitée", "Action gratuite"...).
 * Indéfini pour les talents passifs (bonus permanents, sans activation).
 */
export function infererAction(resume: string): ActionDRS | undefined {
  const t = resume.toLowerCase();
  if (t.includes("action limitée")) return "limitee";
  if (t.includes("action gratuite")) return "gratuite";
  if (t.includes("action de mouvement")) return "mouvement";
  if (t.includes("action d'attaque")) return "attaque";
  return undefined;
}

/** Une capacité (talent non-sort) présentée au catalogue : apprise telle quelle. */
export interface CapaciteCatalogue {
  id: string;
  nom: string;
  voie: string;
  rang: number;
  profil: string;
  resume: string;
  action?: ActionDRS;
}

function slug(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Catalogue des talents utilisables : toutes les capacités des voies SAUF les
 * sorts (déjà au grimoire via sortId). Apprendre = copier le nom dans le PJ.
 */
export function catalogueCapacites(): CapaciteCatalogue[] {
  const liste: CapaciteCatalogue[] = [];
  for (const [profil, voies] of Object.entries(CAPACITES)) {
    for (const v of voies) {
      for (const cap of v.capacites) {
        if (cap.sortId) continue; // déjà au grimoire
        liste.push({
          id: `cap-${slug(profil)}-${slug(cap.nom)}`,
          nom: cap.nom,
          voie: v.voie,
          rang: cap.rang,
          profil,
          resume: cap.resume,
          action: infererAction(cap.resume),
        });
      }
    }
  }
  return liste;
}
