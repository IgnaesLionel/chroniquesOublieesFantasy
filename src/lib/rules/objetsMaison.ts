// Construction d'objets maison (créateur manuel). Pur TypeScript, sans React.
// Valide la saisie puis le résultat via itemSchema (erreur explicite sinon).

import { parseDiceExpression } from "@/src/lib/rules/dice/roller";
import { itemSchema } from "@/src/lib/data/validation";
import type { ArmeFamille, Item, ItemCategorie } from "@/src/lib/rules/world/types";

export interface SaisieObjetMaison {
  nom: string;
  categorie: ItemCategorie;
  description?: string;
  effet?: string;
  quantite?: number;
  bonusAttaque?: number;
  degats?: string;
  familles?: ArmeFamille[];
  mains?: 0 | 1 | 2;
  bonusDefense?: number;
  emplacement?: "torse" | "bouclier" | "accessoire";
  magique?: boolean;
}

const intPositif = (v: unknown, defaut: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return defaut;
  return Math.max(0, Math.floor(v));
};

/**
 * Construit un objet maison valide (id fourni ou `custom-…`).
 * Arme : dégâts validés (ex. "1d8+2"). Armure : mains déduites
 * (bouclier 1, torse 0). Erreur explicite si invalide.
 */
export function construireObjetMaison(saisie: SaisieObjetMaison, id?: string): Item {
  const nom = saisie.nom.trim();
  if (!nom) throw new Error("Nom d'objet requis.");
  const objet: Record<string, unknown> = {
    id: id ?? `custom-${Date.now().toString(36)}`,
    nom,
    categorie: saisie.categorie,
    quantite: intPositif(saisie.quantite, 1),
    exemple: false,
  };
  const texte = (v: unknown): string | undefined => {
    const t = typeof v === "string" ? v.trim() : "";
    return t ? t : undefined;
  };
  const description = texte(saisie.description);
  const effet = texte(saisie.effet);
  if (description) objet.description = description;
  if (effet) objet.effet = effet;
  if (saisie.magique) objet.magique = true;
  if (saisie.categorie === "arme") {
    const degats = (saisie.degats ?? "").trim() || "1d6";
    try {
      parseDiceExpression(degats);
    } catch {
      throw new Error(`Dégâts invalides : "${degats}" (ex. 1d8+2).`);
    }
    objet.estArme = true;
    objet.bonusAttaque = intPositif(saisie.bonusAttaque, 0);
    objet.degats = degats;
    objet.familles = [...(saisie.familles ?? [])];
    objet.mains = saisie.mains ?? 1;
  } else if (saisie.categorie === "armure") {
    const emplacement = saisie.emplacement ?? "torse";
    objet.bonusDefense = intPositif(saisie.bonusDefense, 0);
    objet.emplacement = emplacement;
    objet.mains = emplacement === "bouclier" ? 1 : 0;
  }
  return itemSchema.parse(objet) as Item;
}
