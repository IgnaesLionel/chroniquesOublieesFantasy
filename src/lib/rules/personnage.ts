// Règles COF Fantasy — Personnages (transcription des 4 fiches + tableau récapitulatif).
// Pur TypeScript, sans React. Source de vérité pour les dérivations.

import type { Character, Sort } from "@/src/lib/rules/types";
import { CAPACITES, slug } from "@/src/lib/data/capacites";
import { VOIES_PEUPLE, VOIE_MAGE, traitsInitiaux } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";

export interface Caracteristiques {
  AGI: number;
  CON: number;
  FOR: number;
  PER: number;
  CHA: number;
  INT: number;
  VOL: number;
}

export type FamilleCOF = "Combattant" | "Aventurier" | "Mystique" | "Mage";

export type DeRecupType = "d6" | "d8" | "d10";

export const FAMILLES: FamilleCOF[] = ["Combattant", "Aventurier", "Mystique", "Mage"];

export const PROFILS_PAR_FAMILLE: Record<FamilleCOF, string[]> = {
  Combattant: ["Barbare", "Chevalier", "Guerrier"],
  Aventurier: ["Arquebusier", "Barde", "Rôdeur", "Voleur"],
  Mystique: ["Druide", "Prêtre", "Moine"],
  Mage: ["Ensorceleur", "Forgesort", "Magicien", "Sorcier"],
};

/** Base PV (Points de vigueur) au niveau 1 : base + CON. */
export const PV_BASE_PAR_FAMILLE: Record<FamilleCOF, number> = {
  Combattant: 10,
  Aventurier: 8,
  Mystique: 8,
  Mage: 6,
};

/** Dé de récupération par famille (le +1 DR des Mystiques est géré via BONUS_DR). */
export const DE_RECUP_PAR_FAMILLE: Record<FamilleCOF, DeRecupType> = {
  Combattant: "d10",
  Aventurier: "d8",
  Mystique: "d8",
  Mage: "d6",
};

export interface ProfilRegle {
  profil: string;
  famille: FamilleCOF;
  de: DeRecupType;
  /** +1 dé de récupération (Druide, Prêtre, Moine). */
  bonusDR: number;
  /** Bonus de chance : 0 (2+CHA) ou 1 (3+CHA = 2+CHA+1 pour les Aventuriers). */
  bonusChance: number;
}

function regle(profil: string, famille: FamilleCOF): ProfilRegle {
  const de = DE_RECUP_PAR_FAMILLE[famille];
  return {
    profil,
    famille,
    de,
    bonusDR: famille === "Mystique" ? 1 : 0,
    bonusChance: famille === "Aventurier" ? 1 : 0,
  };
}

/** Tableau récapitulatif fourni (14 profils). */
export const REGLES_PROFILS: Record<string, ProfilRegle> = {
  Barbare: regle("Barbare", "Combattant"),
  Chevalier: regle("Chevalier", "Combattant"),
  Guerrier: regle("Guerrier", "Combattant"),
  Arquebusier: regle("Arquebusier", "Aventurier"),
  Barde: regle("Barde", "Aventurier"),
  "Rôdeur": regle("Rôdeur", "Aventurier"),
  Rodeur: regle("Rodeur", "Aventurier"),
  Voleur: regle("Voleur", "Aventurier"),
  Druide: regle("Druide", "Mystique"),
  "Prêtre": regle("Prêtre", "Mystique"),
  Pretre: regle("Pretre", "Mystique"),
  Moine: regle("Moine", "Mystique"),
  Ensorceleur: regle("Ensorceleur", "Mage"),
  Forgesort: regle("Forgesort", "Mage"),
  Magicien: regle("Magicien", "Mage"),
  Sorcier: regle("Sorcier", "Mage"),
};

export function regleProfil(profil: string, familleReplis?: FamilleCOF): ProfilRegle {
  const direct = REGLES_PROFILS[profil] ?? REGLES_PROFILS[profil?.trim()] ;
  if (direct) return direct;
  const fam = (familleReplis && (FAMILLES as string[]).includes(familleReplis) ? familleReplis : "Aventurier") as FamilleCOF;
  return regle(profil || "?", fam);
}

export function familleDe(profil: string, familleReplis?: FamilleCOF): FamilleCOF {
  return regleProfil(profil, familleReplis).famille;
}

// ---------------------------------------------------------------- Peuples

export type PeupleCOF = "Humain" | "Demi-Elfe" | "Elfe haut" | "Nain";
// Note : les traits des voies du peuple vivent dans src/lib/data/peuples.ts
// (VOIES_PEUPLE + VOIE_MAGE, noms DRS canoniques). Pas de doublon ici.

// ---------------------------------------------------------------- Dérivations

/** Initiative de base : 10 + PER. */
export function initiativeBase(car: Caracteristiques): number {
  return 10 + car.PER;
}

/** DEF de base : 10 + AGI + Équipement + Mod. */
export function defenseBase(car: Caracteristiques, equipement = 0, mod = 0): number {
  return 10 + car.AGI + equipement + mod;
}

/** Points de vigueur max : base famille + CON (niveau 1 ; min 1). */
export function pvMaxBase(famille: FamilleCOF, con: number): number {
  return Math.max(1, PV_BASE_PAR_FAMILLE[famille] + con);
}

/** Points de chance max : 2 + CHA (+1 si Aventurier => 3 + CHA). Min 0. */
export function chanceMax(cha: number, profil: string, familleReplis?: FamilleCOF): number {
  const r = regleProfil(profil, familleReplis);
  return Math.max(0, 2 + cha + r.bonusChance);
}

/** Nombre de dés de récupération : 2 + CON (+1 si Mystique). Min 0. */
export function drNombre(con: number, profil: string, familleReplis?: FamilleCOF): number {
  const r = regleProfil(profil, familleReplis);
  return Math.max(0, 2 + con + r.bonusDR);
}

/**
 * Réserve initiale de DR à la création : la base sans le CON, soit 2 dés
 * (3 si Mystique), plafonnée au max (CON négative). Ex : Guerrier CON+3
 * -> 2/5, Prêtre CON+1 -> 3/4.
 */
export function drInitial(con: number, profil: string, familleReplis?: FamilleCOF): number {
  const r = regleProfil(profil, familleReplis);
  return Math.min(drNombre(con, profil, familleReplis), 2 + r.bonusDR);
}

export function drType(profil: string, familleReplis?: FamilleCOF): DeRecupType {
  return regleProfil(profil, familleReplis).de;
}

/** Points de mana max : VOL + nombre de sorts connus (min 0). */
export function manaMax(vol: number, nbSortsConnus: number): number {
  return Math.max(0, vol + nbSortsConnus);
}

export interface AttaquesBase {
  contact: number;
  distance: number;
  magique: number;
}

/** 3 attaques : Contact = niv + FOR, Distance = niv + AGI, Magique = niv + VOL. */
export function attaquesBase(niveau: number, car: Caracteristiques): AttaquesBase {
  return {
    contact: niveau + car.FOR,
    distance: niveau + car.AGI,
    magique: niveau + car.VOL,
  };
}

export interface DerivePersonnage {
  initiative: number;
  defense: number;
  pvMax: number;
  chanceMax: number;
  drType: DeRecupType;
  drNombre: number;
  manaMax: number;
  attaques: AttaquesBase;
  famille: FamilleCOF;
}

function profilEffectif(c: Pick<Character, "profil" | "classe" | "famille">): string {
  const p = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  return p || "?";
}

function familleEffective(c: Pick<Character, "profil" | "classe" | "famille">): FamilleCOF {
  const fam = (c.famille ?? "").trim() as FamilleCOF;
  if ((FAMILLES as string[]).includes(fam)) return fam;
  return familleDe(profilEffectif(c), undefined);
}

function equipementEffectif(c: Character): number {
  if (typeof c.defenseEquipement === "number") return c.defenseEquipement;
  return c.armure?.def ?? 0;
}

function modEffectif(c: Character): number {
  return c.defenseMod ?? 0;
}

/** Calcule toutes les valeurs dérivées d'un personnage COF. */
export function deriverPersonnage(c: Character): DerivePersonnage {
  const profil = profilEffectif(c);
  const famille = familleEffective(c);
  const car = c.caracteristiques;
  const nbSorts = c.sorts?.length ?? 0;
  return {
    famille,
    initiative: initiativeBase(car),
    defense: defenseBase(car, equipementEffectif(c), modEffectif(c)),
    pvMax: pvMaxBase(famille, car.CON),
    chanceMax: chanceMax(car.CHA, profil, famille),
    drType: drType(profil, famille),
    drNombre: drNombre(car.CON, profil, famille),
    manaMax: manaMax(car.VOL, nbSorts),
    attaques: attaquesBase(c.niveau, car),
  };
}

/**
 * Resynchronise les champs stockés (pvMax, defense, initMod, ressources mana/chance,
 * dés de récupération) à partir des caractéristiques + profil + sorts.
 * Les valeurs actuelles (pv, actuel) sont conservées et plafonnées aux nouveaux max.
 * Un personnage sans DR (création) démarre avec la réserve initiale : 2 dés
 * (3 si Mystique), pas le max.
 * Idéal héroïque / travers : narratifs, aucun bonus (non touchés).
 */
export function recalculerPersonnage<T extends Character>(c: T): T {
  const d = deriverPersonnage(c);
  const prevMana = c.ressources?.mana;
  const prevChance = c.ressources?.chance;
  const prevDR = c.desRecuperation;
  const nbSorts = c.sorts?.length ?? 0;
  void nbSorts;
  return {
    ...c,
    famille: d.famille,
    profil: profilEffectif(c),
    pvMax: d.pvMax,
    pv: Math.min(c.pv, d.pvMax),
    defense: d.defense,
    initMod: d.initiative - 10,
    ressources: {
      ...(c.ressources ?? {}),
      mana: { max: d.manaMax, actuel: Math.min(prevMana?.actuel ?? d.manaMax, d.manaMax) },
      chance: { max: d.chanceMax, actuel: Math.min(prevChance?.actuel ?? d.chanceMax, d.chanceMax) },
    },
    desRecuperation: {
      type: d.drType,
      max: d.drNombre,
      actuel: prevDR ? Math.min(prevDR.actuel, d.drNombre) : drInitial(c.caracteristiques.CON, profilEffectif(c), d.famille),
    },
  };
}

/**
 * Remet un personnage à zéro (retour à l'état de création) : resynchronise
 * les max via les formules, remonte PV / chance / mana au max, replace les
 * dés de récupération à l'initiale (2 dés, 3 si Mystique — pas le max) et
 * vide les effets en cours.
 * Idéal / travers / inventaire / sorts / capacités : inchangés.
 */
export function remettreAZeroPersonnage<T extends Character>(c: T): T {
  const r = recalculerPersonnage(c);
  return {
    ...r,
    pv: r.pvMax,
    ressources: {
      ...r.ressources,
      mana: { ...r.ressources.mana, actuel: r.ressources.mana.max },
      chance: { ...r.ressources.chance, actuel: r.ressources.chance.max },
    },
    desRecuperation: r.desRecuperation
      ? { ...r.desRecuperation, actuel: drInitial(r.caracteristiques.CON, r.profil || r.classe, r.famille) }
      : r.desRecuperation,
    effets: [],
  };
}

/** Garde-fou : vérifie qu'un personnage stocké respecte les formules (tolère les bonus MJ). */
export function verifierPersonnage(c: Character): string[] {
  const d = deriverPersonnage(c);
  const ecarts: string[] = [];
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  if (!(PROFILS_PAR_FAMILLE[c.famille] ?? []).includes(profil)) {
    ecarts.push(`Profil ${profil || "?"} impossible en famille ${c.famille} (corriger dans Éditer)`);
  }
  if (c.pvMax !== d.pvMax) ecarts.push(`PV ${c.pvMax} ≠ ${d.pvMax} (${PV_BASE_PAR_FAMILLE[d.famille]}+CON)`);
  if (c.defense !== d.defense) ecarts.push(`DEF ${c.defense} ≠ ${d.defense} (10+AGI+Équip+Mod)`);
  if (c.initMod !== d.initiative - 10) ecarts.push(`Init ${c.initMod} ≠ +${d.initiative - 10} (10+PER=${d.initiative})`);
  const manaMaxStocke = c.ressources?.mana?.max;
  if (manaMaxStocke !== undefined && manaMaxStocke !== d.manaMax)
    ecarts.push(`Mana ${manaMaxStocke} ≠ ${d.manaMax} (VOL+sorts)`);
  const chanceMaxStockee = c.ressources?.chance?.max;
  if (chanceMaxStockee !== undefined && chanceMaxStockee !== d.chanceMax)
    ecarts.push(`Chance ${chanceMaxStockee} ≠ ${d.chanceMax} (2+CHA${d.famille === "Aventurier" ? "+1" : ""})`);
  if (c.desRecuperation && (c.desRecuperation.type !== d.drType || c.desRecuperation.max !== d.drNombre))
    ecarts.push(`DR ${c.desRecuperation.type}×${c.desRecuperation.max} ≠ ${d.drType}×${d.drNombre}`);
  return ecarts;
}

/** Convertit un bloc stats legacy (FOR/DEX/CON/INT/SAG/CHA ~10) en caractéristiques COF. */
export function caracteristiquesDepuisLegacy(stats: Record<string, number>): Caracteristiques {
  const conv = (v: unknown) => (typeof v === "number" ? Math.round((v - 10) / 2) : 0);
  return {
    AGI: conv(stats.DEX),
    CON: conv(stats.CON),
    FOR: conv(stats.FOR),
    PER: conv(stats.SAG),
    CHA: conv(stats.CHA),
    INT: conv(stats.INT),
    VOL: conv(stats.SAG),
  };
}

/**
 * Normalise un objet quelconque (vieille sauvegarde v2, import partiel) en Character COF
 * complet, sans recalculer les valeurs (utiliser recalculerPersonnage ensuite si besoin).
 */
/** Normalise un nom de capacité ("Flèche sanglante (L)" -> "flèche sanglante"). */
export function normaliserNomCapacite(nom: string): string {
  return nom.replace(/\s*\([A-Z]\)\s*$/, "").trim().toLowerCase();
}

/**
 * Retrouve l'entrée grimoire d'un talent qui est aussi un sort (via sortId),
 * dans les voies de profils comme du peuple/mage. Indéfini sinon.
 */
export function sortDuTalent(nom: string, grimoire: Sort[]): Sort | undefined {
  const q = normaliserNomCapacite(nom);
  const cherche = (voies: { capacites: { nom: string; sortId?: string }[] }[]): string | undefined => {
    for (const v of voies) {
      const cap = v.capacites.find((x) => x.sortId && normaliserNomCapacite(x.nom) === q);
      if (cap?.sortId) return cap.sortId;
    }
    return undefined;
  };
  const id =
    cherche(Object.values(CAPACITES).flat()) ?? cherche(VOIES_PEUPLE) ?? cherche([VOIE_MAGE]);
  if (!id) return undefined;
  return grimoire.find((s) => s.id === id);
}

export function normaliserPersonnage(input: Record<string, unknown>): Character {
  const o = (input ?? {}) as Record<string, unknown>;
  const legacy = o.stats as Record<string, number> | undefined;
  const caracteristiques = (o.caracteristiques as Caracteristiques | undefined)
    ?? (legacy ? caracteristiquesDepuisLegacy(legacy) : { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 });
  const classe = String(o.classe ?? o.profil ?? "?");
  const profil = String(o.profil ?? classe ?? "?");
  const familleBrute = String(o.famille ?? "");
  const famille = ((FAMILLES as string[]).includes(familleBrute)
    ? familleBrute
    : familleDe(profil, undefined)) as FamilleCOF;
  const ressources = (o.ressources ?? {}) as Character["ressources"];
  const niveau = typeof o.niveau === "number" && o.niveau >= 1 ? Math.floor(o.niveau) : 1;
  // Création : la réserve de DR démarre à l'initiale (2 dés, 3 si mystique), pas au max.
  const drSaisi = (o.desRecuperation ?? undefined) as Character["desRecuperation"];
  const desRecuperation = drSaisi ?? {
    type: drType(profil, famille),
    max: drNombre(caracteristiques.CON, profil, famille),
    actuel: drInitial(caracteristiques.CON, profil, famille),
  };
  const capacites: string[] = Array.isArray(o.capacites) ? (o.capacites as string[]) : [];
  // Migration sorts (one-shot) : un talent qui est aussi un sort obtient son
  // entrée lançable (id déterministe). Une suppression volontaire postérieure
  // n'est jamais réimportée (drapeau migreSorts).
  let sorts: Sort[] = Array.isArray(o.sorts) ? (o.sorts as Sort[]) : [];
  let migreSorts = o.migreSorts === true;
  if (!migreSorts) {
    const connus = new Set(sorts.map((s) => normaliserNomCapacite(s.nom)));
    const ajouts: Sort[] = [];
    for (const t of capacites) {
      const q = normaliserNomCapacite(t);
      if (connus.has(q)) continue;
      const modele = sortDuTalent(t, SEED_SORTS);
      if (!modele) continue;
      connus.add(q);
      ajouts.push({ ...modele, id: `sort-auto-${slug(t)}` });
    }
    if (ajouts.length > 0) sorts = [...sorts, ...ajouts];
    migreSorts = true;
  }
  // Le max de mana suit VOL + sorts connus (l'actuel est conservé, plafonné).
  const manaFormule = Math.max(0, manaMax(caracteristiques.VOL, sorts.length));
  const mana = ressources.mana
    ? { max: Math.max(ressources.mana.max, manaFormule), actuel: Math.min(ressources.mana.actuel, Math.max(ressources.mana.max, manaFormule)) }
    : { max: manaFormule, actuel: manaFormule };
  return {
    id: String(o.id ?? `pj-${Date.now().toString(36)}`),
    kind: "personnage",
    nom: String(o.nom ?? "Sans nom"),
    classe,
    niveau,
    pvMax: typeof o.pvMax === "number" ? Math.max(1, Math.floor(o.pvMax)) : pvMaxBase(famille, caracteristiques.CON),
    pv: typeof o.pv === "number" ? Math.max(0, Math.floor(o.pv)) : 1,
    defense: typeof o.defense === "number" ? Math.floor(o.defense) : 10 + caracteristiques.AGI,
    initMod: typeof o.initMod === "number" ? Math.floor(o.initMod) : caracteristiques.PER,
    caracteristiques,
    stats: legacy as Character["stats"],
    peuple: String(o.peuple ?? "Humain"),
    famille,
    profil,
    idealHeroique: typeof o.idealHeroique === "string" ? o.idealHeroique : undefined,
    travers: typeof o.travers === "string" ? o.travers : undefined,
    traitsPeuple: Array.isArray(o.traitsPeuple) ? (o.traitsPeuple as string[]) : [],
    voieMage: o.voieMage === true ? true : undefined,
    armure: (o.armure ?? undefined) as Character["armure"],
    defenseEquipement: typeof o.defenseEquipement === "number" ? o.defenseEquipement : undefined,
    defenseMod: typeof o.defenseMod === "number" ? o.defenseMod : undefined,
    desRecuperation,
    attaques: Array.isArray(o.attaques) ? (o.attaques as Character["attaques"]) : [],
    capacites,
    ressources: {
      ...ressources,
      mana,
      chance: ressources.chance ?? { max: Math.max(0, 2 + caracteristiques.CHA), actuel: Math.max(0, 2 + caracteristiques.CHA) },
    },
    effets: Array.isArray(o.effets) ? (o.effets as Character["effets"]) : [],
    inventaire: Array.isArray(o.inventaire) ? (o.inventaire as Character["inventaire"]) : [],
    sorts,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    exemple: o.exemple === true,
    migreSorts,
  };
}

/**
 * Fait apprendre un sort du grimoire à un personnage (copie avec un nouvel id).
 * Le mana max suit la formule VOL + sorts connus (l'actuel est conservé,
 * plafonné au nouveau max).
 */
export function apprendreSort<T extends Character>(c: T, modele: Sort): T {
  const sort: Sort = { ...modele, id: `sort-${Date.now().toString(36)}` };
  const sorts = [...(c.sorts ?? []), sort];
  const max = manaMax(c.caracteristiques.VOL, sorts.length);
  const prev = c.ressources?.mana ?? { max, actuel: max };
  return {
    ...c,
    sorts,
    ressources: { ...(c.ressources ?? {}), mana: { max, actuel: Math.min(prev.actuel, max) } },
  };
}

/**
 * Fait apprendre une capacité (talent de voie, sans PM) : ajoute son nom aux
 * capacités du personnage (sans doublon). Le mana est inchangé.
 */
export function ajouterCapacite<T extends Character>(c: T, nom: string): T {
  const n = nom.trim();
  if (!n || (c.capacites ?? []).includes(n)) return c;
  return { ...c, capacites: [...(c.capacites ?? []), n] };
}

/**
 * Changement de famille : vide les sorts/talents des voies (liés à l'ancienne
 * famille), ramène le profil sur la nouvelle famille (choix impossibles interdits)
 * et suit la Voie du mage (retirée en quittant Mage). Pur et testable ;
 * la confirmation destructive reste côté UI.
 */
export function changerFamille(c: Character, famille: FamilleCOF): Character {
  if (c.famille === famille) return c;
  const profils = PROFILS_PAR_FAMILLE[famille] ?? [];
  const profilActuel = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const profil = profils.includes(profilActuel) ? c.profil : (profils[0] ?? c.profil);
  const base: Character = {
    ...c,
    famille,
    profil,
    classe: profil,
    capacites: [],
    sorts: [],
  };
  if (famille === "Mage") return base;
  return { ...base, voieMage: undefined, traitsPeuple: traitsInitiaux(c.peuple) };
}
