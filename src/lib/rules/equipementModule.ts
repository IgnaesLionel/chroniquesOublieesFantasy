// Correspondances module Foundry COF2 (cof2-base) -> modèle de l'assistant.
// Pur TypeScript, sans React. Les catégories martiales et types de dégâts
// du module sont rabattus sur NOS familles d'armes et types de dégâts
// (catégories d'arme et armures conservées telles quelles).

import type { ArmeFamille, DegatType } from "@/src/lib/rules/world/types";

/** martialCategory du module -> famille d'arme de l'assistant. */
export const CATEGORIE_MARTIALE_VERS_FAMILLE: Record<string, ArmeFamille> = {
  // Épées
  longSword: "epees",
  shortSword: "epees",
  bastardSword: "epees",
  greatSword: "epees",
  swiftblade: "estoc",
  // Lames d'estoc et dagues
  rapier: "estoc",
  dagger: "dagues",
  stiletto: "dagues",
  throwingKnife: "dagues",
  // Haches
  axe: "haches",
  greatAxe: "haches",
  throwingAxe: "haches",
  // Armes de jet (cumulables : hachette = haches + jet, géré côté seeds)
  javelin: "jet",
  sling: "jet",
  // Lances
  pike: "lances",
  spear: "lances",
  lance: "lances",
  // Masses et contondantes
  mace: "masses",
  hammer: "masses",
  flail: "masses",
  greatFlail: "masses",
  club: "gourdins",
  staff: "batons",
  ironStaff: "batons",
  // Distance
  shortBow: "arcs",
  longBow: "arcs",
  lightCrossbow: "arbaletes",
  heavyCrossbow: "arbaletes",
  handCrossbow: "arbaletes",
  musket: "poudre",
  handCannon: "poudre",
  // Mains nues
  unarmed: "mains-nues",
};

/** damagetype du module -> type de dégâts de l'assistant. */
export const DEGAT_MODULE_VERS_DEGAT: Record<string, DegatType> = {
  piercing: "perforant",
  slashing: "tranchant",
  impact: "contondant",
  magic: "autre",
};

/** martialCategory d'armure/bouclier du module -> nom de notre échelle. */
export const ARMURE_MODULE_VERS_NOM: Record<string, string> = {
  paddedClothFur: "Tissu matelassé",
  leather: "Cuir",
  studdedLeather: "Cuir renforcé",
  chainShirt: "Chemise de mailles",
  chainMail: "Cotte de mailles",
  plateArmor: "Armure de plaque",
  fullPlate: "Plaque complète",
  smallShield: "Petit bouclier",
  largeShield: "Grand bouclier",
};

/** Famille d'arme pour une catégorie martiale (null si inconnue). */
export function mapperFamilleModule(categorie: string): ArmeFamille | null {
  return CATEGORIE_MARTIALE_VERS_FAMILLE[categorie] ?? null;
}

/** Type de dégâts pour un damagetype du module (null si inconnu). */
export function mapperDegatModule(damagetype: string): DegatType | null {
  return DEGAT_MODULE_VERS_DEGAT[damagetype] ?? null;
}

/** Nom de notre échelle pour une armure du module (null si inconnue). */
export function nomArmureModule(categorie: string): string | null {
  return ARMURE_MODULE_VERS_NOM[categorie] ?? null;
}

/** Libellés pour contrôle : toutes les catégories martiales connues du module. */
export function categoriesMartialesConnues(): string[] {
  return Object.keys(CATEGORIE_MARTIALE_VERS_FAMILLE);
}
