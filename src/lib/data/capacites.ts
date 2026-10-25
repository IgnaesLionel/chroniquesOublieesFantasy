import { CAPACITES_COMBATTANT } from "./capacites-combattant";
import { CAPACITES_AVENTURIER } from "./capacites-aventurier";
import { CAPACITES_MYSTIQUE } from "./capacites-mystique";
import { CAPACITES_MAGE } from "./capacites-mage";
import { SEED_SORTS } from "./sorts";
import type { ActionDRS } from "@/src/lib/rules/types";

/** Une capacité (talent) d'une voie : nom, rang 1-5, résumé mécanique. */
export interface Capacite {
  nom: string;
  rang: number;
  resume: string;
  /** Id du grimoire si la capacité est un sort à PM. */
  sortId?: string;
  /** Type d'action déclaré (sinon déduit du sort lié ou du résumé). */
  action?: ActionDRS;
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

/** Lettre compacte affichée à côté d'une capacité ou d'un sort. */
export const ACTION_LETTER: Record<ActionDRS, string> = {
  attaque: "A",
  mouvement: "M",
  limitee: "L",
  gratuite: "G",
};

/** Libellé complet pour l'infobulle du badge (P = passif). */
export const ACTION_DESCRIPTION: Record<ActionDRS, string> = {
  attaque: "Action d'attaque (A)",
  mouvement: "Action de mouvement (M)",
  limitee: "Action limitée (L)",
  gratuite: "Action gratuite (G)",
};

/**
 * Déduit le type d'action DRS d'un résumé ("Action limitée", "Sort (limitée)",
 * "(mouvement/limitée)", "Sort d'attaque"...). C'est le premier marqueur
 * rencontré qui gagne : « (M) ... Rang 5 : (G) » reste une action de mouvement.
 * Indéfini pour les talents passifs.
 *
 * On ne cherche pas les mots « mouvement » ou « limitée » seuls : plusieurs
 * passifs les emploient dans leur description (« se relever en mouvement »)
 * et seraient alors étiquetés à tort comme actions.
 */
export function infererAction(resume: string): ActionDRS | undefined {
  const t = resume.toLowerCase();
  const marqueurs: [string, ActionDRS][] = [
    ["(g)", "gratuite"],
    ["action gratuite", "gratuite"],
    ["(gratuite", "gratuite"],
    ["(m)", "mouvement"],
    ["action de mouvement", "mouvement"],
    ["(mouvement", "mouvement"],
    ["(a)", "attaque"],
    ["action d'attaque", "attaque"],
    ["sort d'attaque", "attaque"],
    ["(attaque", "attaque"],
    ["(l)", "limitee"],
    ["action limitée", "limitee"],
    ["(limitée", "limitee"],
    ["(limitee", "limitee"],
  ];
  let premier: { position: number; action: ActionDRS } | undefined;
  for (const [marqueur, action] of marqueurs) {
    const position = t.indexOf(marqueur);
    if (position >= 0 && (!premier || position < premier.position)) {
      premier = { position, action };
    }
  }
  return premier?.action;
}

/** Action d'une capacité : champ explicite, sort lié, puis résumé. */
export function actionDeCapacite(
  capacite: Pick<Capacite, "resume" | "sortId" | "action">,
): ActionDRS | undefined {
  if (capacite.action) return capacite.action;
  if (capacite.sortId) {
    const sort = SEED_SORTS.find((s) => s.id === capacite.sortId);
    if (sort?.action) return sort.action;
  }
  return infererAction(capacite.resume);
}

function normaliserNom(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\((?:a|g|l|m)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Action d'un talent à partir de son nom. Le profil permet de lever les
 * homonymes entre classes ; sans profil, on cherche dans tout le catalogue.
 */
export function actionDeTalent(nom: string, profil?: string): ActionDRS | undefined {
  const q = normaliserNom(nom);
  const chercher = (voies: VoieDetail[]): ActionDRS | undefined => {
    for (const v of voies) {
      for (const c of v.capacites) {
        if (normaliserNom(c.nom) === q) return actionDeCapacite(c);
      }
    }
    return undefined;
  };
  if (profil) {
    const action = chercher(voiesDe(profil));
    if (action) return action;
  }
  return chercher(Object.values(CAPACITES).flat());
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

export function slug(texte: string): string {
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
          action: actionDeCapacite(cap),
        });
      }
    }
  }
  return liste;
}
