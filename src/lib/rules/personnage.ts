// Règles COF Fantasy — Personnages (transcription des 4 fiches + tableau récapitulatif).
// Pur TypeScript, sans React. Source de vérité pour les dérivations.

import type { Character, Sort } from "@/src/lib/rules/types";
import type { InventaireEntree } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import { estTorse } from "@/src/lib/rules/world/types";
import { normaliserBourse } from "@/src/lib/rules/bourse";
import { CAPACITES, slug } from "@/src/lib/data/capacites";
import { VOIES_PEUPLE, VOIE_MAGE, adopterVoieMage, traitsInitiaux } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { deEvolutif, parseDiceExpression, rollDiceExpression, type Rng } from "@/src/lib/rules/dice/roller";

export interface Caracteristiques {
  AGI: number;
  CON: number;
  FOR: number;
  PER: number;
  CHA: number;
  INT: number;
  VOL: number;
  /** Indexation par nom (substitution "1d4°+INT", calculs génériques). */
  [stat: string]: number;
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

/** PV gagnés par niveau (table DRS) : on y ajoute CON. Ex. Lhagva (Combattant CON+2) : 12 PV niv. 1, +7 au niv. 2 = 19. */
export const PV_GAIN_PAR_FAMILLE: Record<FamilleCOF, number> = {
  Combattant: 5,
  Aventurier: 4,
  Mystique: 4,
  Mage: 3,
};

/** Dé évolutif COF V2 (notation °) : d4 (1-5), d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+). */
export { deEvolutif };

/** Niveau effectif des attaques : +1/niveau jusqu'au niveau 10. */
export function niveauAttaque(niveau: number): number {
  return Math.min(Math.max(1, Math.floor(niveau)), 10);
}

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

/** Points de vigueur max : base + CON × niveau + gains par niveau (CON rétroactive, min 1). */
export function pvMaxBase(famille: FamilleCOF, con: number, niveau = 1): number {
  const niv = Math.max(1, Math.floor(niveau));
  return Math.max(1, PV_BASE_PAR_FAMILLE[famille] + con * niv + PV_GAIN_PAR_FAMILLE[famille] * (niv - 1));
}

/** Points de chance max : 2 + CHA (+1 si Aventurier => 3 + CHA). Min 0.
 * Éclaireur (Rôdeur) : +1 DR au lieu du +1 PC aventurier. */
export function chanceMax(cha: number, profil: string, familleReplis?: FamilleCOF, talents: string[] = []): number {
  const r = regleProfil(profil, familleReplis);
  const eclaireur = r.bonusChance > 0 && talents.some((t) => normaliserNomCapacite(t) === "éclaireur");
  return Math.max(0, 2 + cha + r.bonusChance - (eclaireur ? 1 : 0));
}

/** Nombre de dés de récupération : 2 + CON (+1 si Mystique, +1 si Éclaireur, +VOL si Pacte démoniaque). Min 0. */
export function drNombre(con: number, profil: string, familleReplis?: FamilleCOF, talents: string[] = [], vol = 0): number {
  const r = regleProfil(profil, familleReplis);
  const eclaireur = talents.some((t) => normaliserNomCapacite(t) === "éclaireur");
  const pacte = talents.some((t) => normaliserNomCapacite(t) === "pacte démoniaque");
  return Math.max(0, 2 + con + r.bonusDR + (eclaireur ? 1 : 0) + (pacte ? vol : 0));
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

/** 3 attaques : Contact = niv + FOR, Distance = niv + AGI, Magique = niv + VOL (niv. capé à 10). */
export function attaquesBase(niveau: number, car: Caracteristiques): AttaquesBase {
  const niv = niveauAttaque(niveau);
  return {
    contact: niv + car.FOR,
    distance: niv + car.AGI,
    magique: niv + car.VOL,
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
  /** Dé évolutif courant (d4 1-5, d6 6-8, d8 9-11, d10 12-14, d12 15+). */
  de: number;
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

function equipementEffectif(c: Character, catalogue: Item[] = []): number {
  const base = typeof c.defenseEquipement === "number" ? c.defenseEquipement : (c.armure?.def ?? 0);
  return base + bonusDefenseInventaire(c, catalogue);
}

/** Bonus DEF des armures / boucliers ÉQUIPÉS de l'inventaire.
 * Objets mundanes cumulés + meilleur bonus magique (pas de cumul magique :
 * anneau +2 et armure +2 → +2). Talents, mods et buffs se cumulent, eux. */
export function bonusDefenseInventaire(c: Pick<Character, "inventaire">, catalogue: Item[] = []): number {
  return bonusDefenseMundane(c, catalogue) + bonusDefenseMagique(c, catalogue);
}

/** Somme des bonus DEF des objets NON magiques équipés (bouclier + mailles : +6). */
export function bonusDefenseMundane(c: Pick<Character, "inventaire">, catalogue: Item[] = []): number {
  if (!c.inventaire || c.inventaire.length === 0 || catalogue.length === 0) return 0;
  let total = 0;
  for (const e of c.inventaire) {
    if (!e.equipe) continue;
    const item = catalogue.find((o) => o.id === e.itemId);
    if (!item || item.magique) continue;
    total += item.bonusDefense ?? 0;
  }
  return total;
}

/** Meilleur bonus DEF des objets MAGIQUES équipés (0 si aucun). */
export function bonusDefenseMagique(c: Pick<Character, "inventaire">, catalogue: Item[] = []): number {
  if (!c.inventaire || c.inventaire.length === 0 || catalogue.length === 0) return 0;
  let meilleur = 0;
  for (const e of c.inventaire) {
    if (!e.equipe) continue;
    const item = catalogue.find((o) => o.id === e.itemId);
    if (!item || !item.magique) continue;
    meilleur = Math.max(meilleur, item.bonusDefense ?? 0);
  }
  return meilleur;
}

function modEffectif(c: Character): number {
  return c.defenseMod ?? 0;
}

/** Noms connus (talents + traits de peuple + sorts), normalisés, pour les bonus dérivés. */
type SourceNoms = { capacites?: string[]; sorts?: Sort[]; traitsPeuple?: string[]; peuple?: string };
function nomsConnus(c: SourceNoms): Set<string> {
  const s = new Set((c.capacites ?? []).map((t) => normaliserNomCapacite(t)));
  for (const t of c.traitsPeuple ?? []) s.add(normaliserNomCapacite(t));
  for (const x of c.sorts ?? []) s.add(normaliserNomCapacite(x.nom));
  return s;
}

/** Caractéristiques de base, que la source soit une fiche ou un combattant. */
function caracsDe(c: { caracteristiques?: Caracteristiques; caracs?: Record<string, number> }): Caracteristiques {
  return (c.caracteristiques ?? c.caracs ?? { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 }) as Caracteristiques;
}

/**
 * Bonus permanents de caractéristiques accordés par les talents et traits de
 * peuple (DRS). Les choix explicites (Combattant héroïque AGI/FOR,
 * Supériorité elfique INT/CHA) sont tranchés par défaut en faveur de la
 * première option ; la fiche peut toujours être éditée par le MJ.
 */
export function bonusCaracteristiquesTalents(
  c: SourceNoms & { profil?: string; classe?: string; caracteristiques?: Caracteristiques; caracs?: Record<string, number> }
): Partial<Caracteristiques> {
  const noms = nomsConnus(c);
  const bonus: Partial<Caracteristiques> = {};
  const ajouter = (cle: keyof Caracteristiques, n = 1) => {
    bonus[cle] = (bonus[cle] ?? 0) + n;
  };
  if (noms.has(normaliserNomCapacite("Force héroïque"))) ajouter("FOR");
  if (
    noms.has(normaliserNomCapacite("Constitution héroïque")) ||
    noms.has(normaliserNomCapacite("Pacte ténébreux")) ||
    noms.has(normaliserNomCapacite("Ténacité")) ||
    noms.has(normaliserNomCapacite("Ascétisme")) ||
    noms.has(normaliserNomCapacite("Endurer"))
  ) {
    ajouter("CON");
  }
  if (noms.has(normaliserNomCapacite("Agilité héroïque"))) ajouter("AGI");
  if (noms.has(normaliserNomCapacite("Combattant héroïque"))) ajouter("AGI");
  if (noms.has(normaliserNomCapacite("Perception héroïque"))) ajouter("PER");
  if (noms.has(normaliserNomCapacite("Charisme héroïque"))) ajouter("CHA");
  if (noms.has(normaliserNomCapacite("Volonté héroïque"))) ajouter("VOL");
  if (noms.has(normaliserNomCapacite("Esprit supérieur"))) {
    ajouter("INT");
    ajouter("VOL");
  }
  if (noms.has(normaliserNomCapacite("Ténacité"))) ajouter("VOL");
  if (noms.has(normaliserNomCapacite("Supériorité elfique"))) {
    if (/demi-elfe/i.test(`${c.peuple ?? ""} ${c.profil ?? ""} ${c.classe ?? ""}`)) {
      ajouter("AGI");
      ajouter("PER");
    } else {
      ajouter("VOL");
      ajouter("INT");
    }
  }
  if (noms.has(normaliserNomCapacite("Polyvalence"))) {
    ajouter("VOL");
    // +1 à la plus faible caractéristique (hors VOL déjà traité).
    const car = caracsDe(c);
    const cles: (keyof Caracteristiques)[] = ["AGI", "CON", "FOR", "PER", "CHA", "INT"];
    const faible = cles.reduce((a, b) => (car[a] <= car[b] ? a : b));
    ajouter(faible);
  }
  return bonus;
}

/** Caractéristiques effectives (base + talents/traits permanents). */
export function caracteristiquesEffectives<T extends { caracteristiques: Caracteristiques } & SourceNoms & { profil?: string; classe?: string }>(
  c: T
): Caracteristiques {
  const car = { ...c.caracteristiques };
  for (const [cle, n] of Object.entries(bonusCaracteristiquesTalents(c))) {
    car[cle] = (car[cle] ?? 0) + (n ?? 0);
  }
  return car;
}

/** Rang max connu dans une voie du profil (0 si voie absente) : dégâts et
 *  difficultés de sorts au rang de voie, Exsangue +3 au rang 5, etc. */
export function rangMaxVoie(
  c: { capacites?: string[]; sorts?: Sort[]; profil?: string; classe?: string; traitsPeuple?: string[] },
  voie: string
): number {
  const noms = nomsConnus(c);
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const v = (CAPACITES[profil] ?? []).find((x) => x.voie === voie);
  if (!v) return 0;
  const rangs = v.capacites.filter((x) => noms.has(normaliserNomCapacite(x.nom))).map((x) => x.rang);
  return rangs.length > 0 ? Math.max(...rangs) : 0;
}

/** Bonus DEF permanent des talents connus (DRS) :
 * - Armure d'os +3, +1 par rang 4 en voie sorcier
 * - Défense au bouclier +1 (+1 avec Renvoi = rang 5)
 * - Bouclier de la foi +1 (+1 avec Mot de pouvoir = rang 5)
 * - Dur à cuire +1 ; Rempart +1
 * - Parade croisée +1 (+1 au rang 5 = Double peine)
 * - Grand pas +1 en nature (+1 au rang 5 = Increvable, MJ : extérieur)
 * - Tactiques +1 par rang 5 en voie du profil. */
export function bonusDefenseTalents(
  c: SourceNoms & {
    profil?: string;
    classe?: string;
    caracteristiques?: Caracteristiques;
    caracs?: Record<string, number>;
    compagnon?: unknown;
  },
  catalogue: Item[] = [],
  inventaire: InventaireEntree[] = []
): number {
  const noms = nomsConnus(c);
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const voies = CAPACITES[profil] ?? [];
  const car = caracsDe(c);
  const armureTorse = inventaire.some(
    (e) => e.equipe && catalogue.some((i) => i.id === e.itemId && estTorse(i))
  );
  const sansArmure = !armureTorse;
  const rang = (voie: string) => rangMaxVoie(c, voie);
  const compteRang = (rang: number, prefixeVoie?: string): number => {
    let n = 0;
    for (const v of voies) {
      if (prefixeVoie && !v.voie.toLowerCase().includes(prefixeVoie)) continue;
      if (v.capacites.some((x) => x.rang === rang && noms.has(normaliserNomCapacite(x.nom)))) n += 1;
    }
    return n;
  };
  let bonus = 0;
  if (noms.has(normaliserNomCapacite("Armure d'os"))) {
    // DRS : +3, +1 par rang 4 atteint dans une voie de sorcier.
    bonus += 3 + compteRang(4);
  }
  if (noms.has(normaliserNomCapacite("Défense au bouclier"))) {
    // +1 DEF (+2 au rang 5 de la voie), bouclier manié requis. Renvoi de
    // sort ne donne rien (règle corrigée) ; Expertise du bouclier
    // (compagnon, autre progression) exclue via le nom de voie.
    if (bouclierEquipe(inventaire, catalogue)) {
      bonus += rangVoieBouclier(c.capacites ?? [], c.profil, c.classe) >= 5 ? 2 : 1;
    }
  }
  if (noms.has(normaliserNomCapacite("Bouclier de la foi"))) {
    bonus += 1;
    if (noms.has(normaliserNomCapacite("Mot de pouvoir"))) bonus += 1;
  }
  if (noms.has(normaliserNomCapacite("Dur à cuire"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Rempart"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Parade croisée"))) {
    bonus += 1;
    if (noms.has(normaliserNomCapacite("Double peine"))) bonus += 1;
  }
  if (noms.has(normaliserNomCapacite("Grand pas"))) {
    bonus += 1;
    if (rangMaxVoie(c, "Voie de la survie") >= 5) bonus += 1;
  }
  if (noms.has(normaliserNomCapacite("Tactiques de meute"))) {
    for (const v of voies) {
      if (v.capacites.some((x) => x.rang === 5 && noms.has(normaliserNomCapacite(x.nom)))) bonus += 1;
    }
  }
  if (noms.has(normaliserNomCapacite("Exsangue"))) {
    // Sorcier : +2 DEF (+3 si rang 5 en Voie du sang : Lien de sang).
    bonus += rangMaxVoie(c, "Voie du sang") >= 5 ? 3 : 2;
    // −1 si autre armure qu'os : armure d'os = talent (pas d'objet) ;
    // un torse mundane équipé sans le talent compte comme autre armure.
    if (!noms.has(normaliserNomCapacite("Armure d'os"))) {
      const torseMundane = inventaire.some(
        (e) => e.equipe && torseMundaneEquipe(e.itemId, catalogue)
      );
      if (torseMundane) bonus -= 1;
    }
  }
  // Défenses passives de voies / peuples (DRS).
  if (noms.has(normaliserNomCapacite("Peau de pierre"))) {
    bonus += 1 + (rang("Voie du pagne") >= 4 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Réflexes éclair"))) {
    bonus += 1 + (rang("Voie du pourfendeur") >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Souplesse du félin"))) {
    bonus += 2 + (rang("Voie de l'aventurier") >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Agile"))) {
    const r = rang("Voie du déplacement");
    bonus += 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Peau de fer"))) {
    bonus += 2 + (rang("Voie du poing") >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Course du vent"))) {
    bonus += 1 + (rang("Voie du vent") >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Grâce féline"))) {
    bonus += 1 + (rang("Voie du saltimbanque") >= 4 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Maîtrise du ki"))) {
    bonus += 2 + (rang("Voie de la méditation") >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Armure de vent"))) {
    bonus += sansArmure ? (rang("Voie du primitif") >= 5 ? 3 : 2) : 1;
  }
  if (noms.has(normaliserNomCapacite("Dentelle et rapière")) && sansArmure) {
    bonus += Math.min(Math.max(0, car.CHA), Math.max(1, rang("Voie de la séduction")));
  }
  if (noms.has(normaliserNomCapacite("Runes de défense"))) {
    const r = rang("Voie des runes");
    bonus += 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Armure lourde"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Combattant aguerri"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Combat de masse"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Tour de magie"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Murmures dans le vent"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Divination"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Familier"))) bonus += 2;
  if (noms.has(normaliserNomCapacite("Petit compagnon")) && c.compagnon) bonus += 2;
  return bonus;
}

/** Torse mundane équipé (armure de corps à bonus, hors armure d'os qui est un talent). */
function torseMundaneEquipe(itemId: string, catalogue: Item[]): boolean {
  const item = catalogue.find((o) => o.id === itemId);
  return !!item && estTorse(item) && (item.bonusDefense ?? 0) > 0;
}

/** Bouclier manié (équipé) : l'item ou null. Voie du bouclier : requis pour Protéger/Parer/Absorber/Renvoi et le bonus passif. */
export function bouclierEquipe(inventaire: InventaireEntree[] = [], catalogue: Item[] = []): Item | null {
  for (const e of inventaire) {
    if (!e.equipe) continue;
    const item = catalogue.find((o) => o.id === e.itemId);
    if (item && item.emplacement === "bouclier") return item;
  }
  return null;
}

/** Modificateur de DEF du bouclier manié (null = pas de bouclier). */
export function bonusBouclier(inventaire: InventaireEntree[] = [], catalogue: Item[] = []): number | null {
  const b = bouclierEquipe(inventaire, catalogue);
  return b ? (b.bonusDefense ?? 0) : null;
}

/**
 * Zombies contrôlables (Animation des morts) : 1 +1 par rang 5 atteint dans
 * une voie du profil Sorcier. Les autres profils ne progressent pas ici.
 */
export function maxZombiesControles(capacites: string[] = []): number {
  const noms = new Set(capacites.map(normaliserNomCapacite));
  const voies = CAPACITES["Sorcier"] ?? [];
  let rangs5 = 0;
  for (const v of voies) {
    for (const c of v.capacites) {
      if (c.rang === 5 && noms.has(normaliserNomCapacite(c.nom))) rangs5 += 1;
    }
  }
  return 1 + rangs5;
}

/**
 * Rang max connu dans la Voie du bouclier (Guerrier) : +1 DEF, +2 au rang 5,
 * réduction des DM de zone égale au rang. Expertise du bouclier (compagnon,
 * autre progression) exclue via le nom de voie.
 */
export function rangVoieBouclier(capacites: string[] = [], profil?: string, classe?: string): number {
  const noms = new Set(capacites.map(normaliserNomCapacite));
  const p = (profil ?? "").trim() || (classe ?? "").trim();
  const voies = p ? (CAPACITES[p] ?? []) : Object.values(CAPACITES).flat();
  let rang = 0;
  for (const v of voies) {
    if (!v.voie.toLowerCase().includes("bouclier")) continue;
    for (const c of v.capacites) {
      if (noms.has(normaliserNomCapacite(c.nom))) rang = Math.max(rang, c.rang);
    }
  }
  return rang;
}

/** Bonus CON permanent des talents connus : Pacte ténébreux (Sorcier) +1. */
export function bonusConTalents(c: Pick<Character, "capacites" | "sorts">): number {
  return nomsConnus(c).has(normaliserNomCapacite("Pacte ténébreux")) ? 1 : 0;
}

type SourceDerives = SourceNoms & {
  profil?: string;
  classe?: string;
  caracteristiques?: Caracteristiques;
  caracs?: Record<string, number>;
};

/** Bonus de mana permanent (Tour de magie : +2 PM en l'apprenant). */
export function bonusManaTalents(c: SourceNoms): number {
  return nomsConnus(c).has(normaliserNomCapacite("Tour de magie")) ? 2 : 0;
}

/** Bonus PV max permanent des talents et traits connus (DRS). */
export function bonusPvTalents(c: SourceDerives): number {
  const noms = nomsConnus(c);
  const car = caracsDe(c);
  let bonus = 0;
  if (noms.has(normaliserNomCapacite("Robustesse"))) {
    const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
    const voie = (CAPACITES[profil] ?? []).find((v) => v.voie === "Voie de la résistance");
    if (voie) {
      const rangs = voie.capacites.filter((x) => noms.has(normaliserNomCapacite(x.nom))).map((x) => x.rang);
      if (rangs.length > 0) bonus += Math.max(...rangs) + 2;
    }
  }
  if (noms.has(normaliserNomCapacite("Argument de taille"))) bonus += Math.max(0, car.FOR);
  if (noms.has(normaliserNomCapacite("Vigueur"))) bonus += rangMaxVoie(c, "Voie du pagne");
  if (noms.has(normaliserNomCapacite("Proche de la nature"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Grosse tête"))) bonus += Math.max(0, car.INT);
  if (noms.has(normaliserNomCapacite("Maîtrise du ki"))) bonus += Math.max(0, car.VOL);
  return bonus;
}

/** Bonus INIT permanent des talents, traits et sorts connus. */
export function bonusInitiativeTalents(c: SourceDerives): number {
  const noms = nomsConnus(c);
  const car = caracsDe(c);
  const rang = (voie: string) => rangMaxVoie(c, voie);
  let bonus = 0;
  if (noms.has(normaliserNomCapacite("Vivacité"))) bonus += 3;
  if (noms.has(normaliserNomCapacite("Réflexes éclair"))) bonus += 3;
  if (noms.has(normaliserNomCapacite("Souplesse du félin"))) bonus += 2 + (rang("Voie de l'aventurier") >= 5 ? 1 : 0);
  if (noms.has(normaliserNomCapacite("Agile"))) {
    const r = rang("Voie du déplacement");
    bonus += 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Grâce féline"))) bonus += Math.max(0, car.CHA);
  if (noms.has(normaliserNomCapacite("Attaque en finesse"))) bonus += Math.max(0, car.AGI);
  if (noms.has(normaliserNomCapacite("Pas du vent"))) bonus += 3;
  if (noms.has(normaliserNomCapacite("Plus vite que son ombre"))) bonus += 5;
  if (noms.has(normaliserNomCapacite("Maîtrise du ki"))) bonus += Math.max(0, car.VOL);
  if (noms.has(normaliserNomCapacite("Murmures dans le vent"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Divination"))) bonus += 1;
  if (noms.has(normaliserNomCapacite("Familier"))) bonus += 2;
  if (noms.has(normaliserNomCapacite("Archer émérite"))) {
    const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
    const voie = (CAPACITES[profil] ?? []).find((v) => v.voie === "Voie de l'archer");
    if (voie) {
      const rangs = voie.capacites
        .filter((x) => noms.has(normaliserNomCapacite(x.nom)))
        .map((x) => x.rang);
      if (rangs.length > 0) bonus += Math.max(...rangs);
    }
  }
  return bonus;
}

type SourceAttaque = SourceDerives & { niveau?: number };

type AttaqueMin = { nom?: string; familles?: string[] };

function famillesDe(attaque: AttaqueMin): string[] {
  return attaque.familles ?? [];
}

function estMainsNues(attaque: AttaqueMin): boolean {
  return famillesDe(attaque).includes("mains-nues") || /mains nues|poing|griffe/i.test(attaque.nom ?? "");
}

function estArmeLegere(attaque: AttaqueMin): boolean {
  const f = famillesDe(attaque);
  return f.includes("dagues") || f.includes("epees") || /dague|épée courte|epee courte|rapière|rapiere/i.test(attaque.nom ?? "");
}

/**
 * Bonus permanents au jet d'attaque (talents/traits). Les substitutions de
 * caractéristique (AGI au lieu de FOR) sont converties en écart positif.
 */
export function bonusAttaqueTalents(
  c: SourceAttaque,
  attaque: AttaqueMin,
  distance = false
): number {
  const noms = nomsConnus(c);
  const car = caracsDe(c);
  const f = famillesDe(attaque);
  const mainsNues = estMainsNues(attaque);
  const leger = estArmeLegere(attaque);
  let bonus = 0;
  if (noms.has(normaliserNomCapacite("Haches et marteaux")) && (f.includes("haches") || f.includes("masses"))) {
    bonus += 1;
  }
  if (noms.has(normaliserNomCapacite("Mains d'énergie")) && mainsNues) {
    bonus += rangMaxVoie(c, "Voie de l'énergie vitale") + 2;
  }
  if (noms.has(normaliserNomCapacite("Poings de fer")) && mainsNues) {
    bonus += Math.max(0, car.AGI - car.FOR);
  }
  if (
    (noms.has(normaliserNomCapacite("Attaque en finesse")) || noms.has(normaliserNomCapacite("Précision"))) &&
    leger &&
    !distance
  ) {
    bonus += Math.max(0, car.AGI - car.FOR);
  }
  if (noms.has(normaliserNomCapacite("Attaque flamboyante")) && leger && !distance) {
    bonus += Math.max(0, car.CHA);
  }
  if (noms.has(normaliserNomCapacite("Poudre puissante")) && distance) {
    bonus += 1;
  }
  return bonus;
}

/** Bonus permanents aux DM (talents/traits), hors dés conditionnels. */
export function bonusDegatsTalents(
  c: SourceAttaque,
  attaque: AttaqueMin,
  distance = false
): number {
  const noms = nomsConnus(c);
  const car = caracsDe(c);
  const f = famillesDe(attaque);
  const leger = estArmeLegere(attaque);
  let bonus = 0;
  if (noms.has(normaliserNomCapacite("Haches et marteaux")) && (f.includes("haches") || f.includes("masses"))) {
    bonus += 1;
  }
  if (noms.has(normaliserNomCapacite("Attaque flamboyante")) && leger && !distance) {
    bonus += Math.max(0, car.CHA);
  }
  if (noms.has(normaliserNomCapacite("Doigts agiles")) && distance && f.includes("dagues")) {
    const r = rangMaxVoie(c, "Voie du roublard");
    bonus += 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0);
  }
  if (noms.has(normaliserNomCapacite("Poudre puissante")) && distance) {
    bonus += 1 + (rangMaxVoie(c, "Voie des explosifs") >= 5 ? 1 : 0);
  }
  return bonus;
}

/** Réduction fixe des DM subis (Fils du roc, Peau d'acier), minimum 1 DM. */
export function reductionDegatsPassifs(c: SourceNoms & { niveau?: number }): number {
  const noms = nomsConnus(c);
  let rd = 0;
  if (noms.has(normaliserNomCapacite("Fils du roc"))) rd += (c.niveau ?? 1) >= 10 ? 3 : 2;
  if (noms.has(normaliserNomCapacite("Peau d'acier"))) rd += 3;
  return rd;
}

/** Seuil de critique permanent (19-20, 18-20...) selon talents/peuple. */
export function seuilCritiqueTalents(
  c: SourceAttaque,
  attaque: AttaqueMin,
  distance = false
): number {
  const noms = nomsConnus(c);
  const f = famillesDe(attaque);
  const mainsNues = estMainsNues(attaque);
  const leger = estArmeLegere(attaque);
  let seuil = 20;
  if (noms.has(normaliserNomCapacite("Briseur d'os")) && !distance) seuil = Math.min(seuil, 19);
  if (noms.has(normaliserNomCapacite("Morsure du serpent")) && mainsNues) seuil = Math.min(seuil, 19);
  if (noms.has(normaliserNomCapacite("Tir précis")) && distance) {
    seuil = Math.min(seuil, rangMaxVoie(c, "Voie de la précision") >= 5 ? 18 : 19);
  }
  if (noms.has(normaliserNomCapacite("Frappe chirurgicale")) && leger && !distance) seuil = Math.min(seuil, 18);
  if (
    noms.has(normaliserNomCapacite("Archer émérite")) &&
    distance &&
    f.includes("arcs") &&
    /demi-elfe/i.test(`${c.peuple ?? ""} ${(c.traitsPeuple ?? []).join(" ")}`)
  ) {
    seuil = Math.min(seuil, 19);
  }
  return seuil;
}

/** Calcule toutes les valeurs dérivées d'un personnage COF. */
export function deriverPersonnage(c: Character, catalogue: Item[] = []): DerivePersonnage {
  const profil = profilEffectif(c);
  const famille = familleEffective(c);
  // Caractéristiques effectives : base + talents/traits permanents
  // (Force héroïque, Ténacité, Pacte ténébreux, Supériorité elfique...).
  const car = caracteristiquesEffectives(c);
  const nbSorts = c.sorts?.length ?? 0;
  const con = car.CON;
  return {
    famille,
    initiative: initiativeBase(car) + bonusInitiativeTalents(c),
    defense: defenseBase(car, equipementEffectif(c, catalogue) + bonusDefenseTalents(c, catalogue, c.inventaire ?? []), modEffectif(c)),
    pvMax: pvMaxBase(famille, con, c.niveau) + bonusPvTalents(c),
    chanceMax: chanceMax(car.CHA, profil, famille, c.capacites ?? []),
    drType: drType(profil, famille),
    drNombre: drNombre(con, profil, famille, c.capacites ?? [], car.VOL),
    manaMax: manaMax(car.VOL, nbSorts) + bonusManaTalents(c),
    attaques: attaquesBase(c.niveau, car),
    de: deEvolutif(c.niveau),
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
export function recalculerPersonnage<T extends Character>(c: T, catalogue: Item[] = []): T {
  const d = deriverPersonnage(c, catalogue);
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
 * Remet un personnage à zéro (retour sortie de création, niveau 1) :
 * niveau 1, talents/sorts vidés, traits du peuple réinitialisés au rang 1
 * de base (Voie du mage conservée si adoptée), inventaire remplacé par
 * celui de base (2e param, fiche d'origine — sinon vide), PV / chance /
 * mana au max, dés de récupération à l'initiale (2 dés, 3 si Mystique —
 * pas le max), effets en cours vidés.
 * Caracs / peuple / profil / famille / idéal / travers : inchangés.
 */
export function remettreAZeroPersonnage<T extends Character>(
  c: T,
  inventaireBase?: Character["inventaire"]
): T {
  const vide: T = {
    ...c,
    niveau: 1,
    capacites: [],
    sorts: [],
    traitsPeuple: c.voieMage ? adopterVoieMage(c.peuple) : traitsInitiaux(c.peuple),
    inventaire: (inventaireBase ?? []).map((e) => ({ ...e })),
    migreSorts: true,
    compagnon: undefined,
  };
  const r = recalculerPersonnage(vide);
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
export function verifierPersonnage(c: Character, catalogue: Item[] = []): string[] {
  const d = deriverPersonnage(c, catalogue);
  const ecarts: string[] = [];
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  if (!(PROFILS_PAR_FAMILLE[c.famille] ?? []).includes(profil)) {
    ecarts.push(`Profil ${profil || "?"} impossible en famille ${c.famille} (corriger dans Éditer)`);
  }
  if (c.pvMax !== d.pvMax) ecarts.push(`PV ${c.pvMax} ≠ ${d.pvMax} (${PV_BASE_PAR_FAMILLE[d.famille]}+CON+Robustesse)`);
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
  const capacites: string[] = Array.isArray(o.capacites) ? (o.capacites as string[]) : [];
  // Création : la réserve de DR démarre à l'initiale (2 dés, 3 si mystique), pas au max.
  const drSaisi = (o.desRecuperation ?? undefined) as Character["desRecuperation"];
  const desRecuperation = drSaisi ?? {
    type: drType(profil, famille),
    max: drNombre(caracteristiques.CON, profil, famille, capacites, caracteristiques.VOL),
    actuel: drInitial(caracteristiques.CON, profil, famille),
  };
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
  const manaFormule = Math.max(0, manaMax(caracteristiques.VOL, sorts.length) + bonusManaTalents({ capacites, sorts }));
  const mana = ressources.mana
    ? { max: Math.max(ressources.mana.max, manaFormule), actuel: Math.min(ressources.mana.actuel, Math.max(ressources.mana.max, manaFormule)) }
    : { max: manaFormule, actuel: manaFormule };
  const usagesJournaliers =
    o.usagesJournaliers && typeof o.usagesJournaliers === "object"
      ? Object.fromEntries(
          Object.entries(o.usagesJournaliers as Record<string, unknown>)
            .filter(([, v]) => typeof v === "number" && (v as number) >= 0)
            .map(([k, v]) => [k, Math.floor(v as number)])
        )
      : undefined;
  const compagnonBrut = o.compagnon as { pv?: unknown } | undefined;
  const compagnon =
    compagnonBrut && typeof compagnonBrut.pv === "number" && (compagnonBrut.pv as number) >= 0
      ? { pv: Math.floor(compagnonBrut.pv as number) }
      : undefined;
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
      chance: ressources.chance ?? {
        max: chanceMax(caracteristiques.CHA, profil, famille, capacites),
        actuel: chanceMax(caracteristiques.CHA, profil, famille, capacites),
      },
    },
    effets: Array.isArray(o.effets) ? (o.effets as Character["effets"]) : [],
    inventaire: Array.isArray(o.inventaire) ? (o.inventaire as Character["inventaire"]) : [],
    bourse: normaliserBourse((o.bourse ?? undefined) as Character["bourse"]),
    sorts,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    exemple: o.exemple === true,
    migreSorts,
    ...(usagesJournaliers ? { usagesJournaliers } : {}),
    ...(compagnon ? { compagnon } : {}),
  };
}

/**
 * Fusionne une édition (modal Personnages) sur la fiche courante : seuls les
 * champs du modal sont repris (nom, niveau, peuple, famille, profil, armure,
 * idéal, travers, caracs, PV, DEF...). Tout ce qui se gère hors modal —
 * inventaire, sorts/talents (sauf vidage volontaire au changement de
 * famille), effets, ressources, DR, bourse, attaques — est conservé depuis
 * la fiche courante, jamais écrasé par un brouillon périmé.
 */
export function fusionnerEditionPersonnage(courant: Character, edite: Character): Character {
  const familleChangee = (edite.famille ?? "") !== (courant.famille ?? "");
  return {
    ...edite,
    inventaire: courant.inventaire,
    sorts: familleChangee ? edite.sorts : courant.sorts,
    capacites: familleChangee ? edite.capacites : courant.capacites,
    effets: courant.effets,
    ressources: courant.ressources,
    desRecuperation: courant.desRecuperation,
    bourse: courant.bourse,
    attaques: courant.attaques,
  };
}

/**
 * Fait apprendre un sort du grimoire à un personnage (copie avec un nouvel id).
 * Le mana max suit la formule VOL + sorts connus (+1 par sort appris) et la
 * mana est remise à fond. Les PV courants sont conservés : apprendre un sort
 * n'est pas une montée de niveau et ne doit pas soigner (la garde PV du
 * stockage bloquerait l'écriture d'une fiche blessée).
 */
export function apprendreSort<T extends Character>(c: T, modele: Sort): T {
  const sort: Sort = { ...modele, id: `sort-${Date.now().toString(36)}` };
  const sorts = [...(c.sorts ?? []), sort];
  const max = manaMax(c.caracteristiques.VOL, sorts.length);
  return {
    ...c,
    sorts,
    ressources: { ...(c.ressources ?? {}), mana: { max, actuel: max } },
  };
}

/**
 * Champs mécaniques de sort complétés depuis le grimoire quand la fiche ne
 * les connaît pas (sort appris avant leur introduction : champ undefined).
 * Seuls les champs ABSENTS sont remplis, jamais les valeurs définies
 * (personnalisation MJ préservée : un `toucheAuto: false`, des dégâts ou
 * des `cibleEspeces` maison restent intacts). En contrepartie, un homebrew
 * qui partage le NOM d'un sort du grimoire hérite des mécaniques manquantes.
 * Appariement par nom (les copies de fiche ont un id unique), sans muter
 * l'entrée (copie des tableaux et objets).
 */
const CHAMPS_SORTS_COMPLETABLES = [
  "toucheAuto", "cibleEspeces",
  "effetCle", "effetDuree", "effetDegats", "effetMods", "effetSauvegarde",
  "degats", "degatsParRangVoie", "demiDegatsSiRate", "difficulteAttaque",
  "testOppose", "exigeVivant", "tailleMax",
  "limiteCombat", "limiteParCible", "zone", "zonePersistante", "rituelHorsCombat", "patientsParCha", "concentrationInterdite", "ciblesMax", "ciblesLibres", "ciblesAllies",
  "invocation", "attaqueAccordee", "coutPV", "action", "bonus", "soin", "cout",
] as const;

/**
 * Ancienne conversion des durées "en minutes" (×10 tours) devenue fausse avec
 * la règle de table : 1 minute = 6 tours. Utilisée uniquement quand le
 * grimoire porte déjà la valeur corrigée, pour réaligner les fiches existantes.
 */
const DUREES_MINUTES_HERITEES: Record<string, string> = {
  "CHA*10": "CHA*6",
  "INT*10": "INT*6",
  "PER*10": "PER*6",
};

/** Clé de correspondance tolérante (casse, accents, espaces) pour les copies héritées. */
function cleNomSortHerite(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function completerSortsDepuisGrimoire(sorts: Sort[], grimoire: Sort[] = SEED_SORTS): Sort[] {
  const refs = new Map(grimoire.map((s) => [cleNomSortHerite(s.nom), s]));
  let touche = false;
  const complete = sorts.map((s) => {
    const ref = refs.get(cleNomSortHerite(s.nom));
    if (!ref) return s;
    let out = s;
    // Règle de table 1 minute = 6 tours : les durées encodées avec l'ancienne
    // conversion ×10 sont réalignées sur le grimoire (idempotent).
    const heritee = typeof out.effetDuree === "string" ? DUREES_MINUTES_HERITEES[out.effetDuree] : undefined;
    if (heritee && ref.effetDuree === heritee) {
      out = { ...out, effetDuree: heritee };
      touche = true;
    }
    for (const champ of CHAMPS_SORTS_COMPLETABLES) {
      if (out[champ] === undefined && ref[champ] !== undefined) {
        const v = ref[champ] as unknown;
        const copie = Array.isArray(v) ? [...v] : (typeof v === "object" && v !== null ? { ...v } : v);
        out = { ...out, [champ]: copie } as Sort;
        touche = true;
      }
    }
    return out;
  });
  return touche ? complete : sorts;
}

/**
 * Fait apprendre une capacité (talent de voie, sans PM) : ajoute son nom aux
 * capacités du personnage (sans doublon) et remet la mana à fond (max
 * inchangé). Les PV courants sont conservés : apprendre une capacité n'est
 * pas une montée de niveau et ne doit pas soigner (la garde PV du stockage
 * bloquerait l'écriture d'une fiche blessée). Doublon / nom vide : inchangé.
 */
export function ajouterCapacite<T extends Character>(c: T, nom: string): T {
  const n = nom.trim();
  if (!n || (c.capacites ?? []).includes(n)) return c;
  const mana = c.ressources?.mana;
  return {
    ...c,
    capacites: [...(c.capacites ?? []), n],
    ressources: mana
      ? { ...(c.ressources ?? {}), mana: { ...mana, actuel: mana.max } }
      : c.ressources,
  };
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

/**
 * Passage de niveau : +1 niveau, PV max et courants +gain famille + CON.
 * Attaques, points (2/niveau), dé évolutif et mana (nouveaux sorts) suivent
 * automatiquement via les dérivations. Pur et testable.
 */
export function monterNiveau(c: Character): Character {
  const gain = (PV_GAIN_PAR_FAMILLE[c.famille] ?? 4) + c.caracteristiques.CON;
  const pvMax = Math.max(1, c.pvMax + gain);
  return { ...c, niveau: c.niveau + 1, pvMax, pv: Math.min(c.pv + gain, pvMax) };
}

/**
 * Perte de niveau (erreur de saisie) : -1 niveau (min 1), PV max et courants
 * réduits du gain (plancher 1 / plafonnés). Alertes éventuelles via les vérifications.
 */
export function descendreNiveau(c: Character): Character {
  if (c.niveau <= 1) return c;
  const perte = (PV_GAIN_PAR_FAMILLE[c.famille] ?? 4) + c.caracteristiques.CON;
  const pvMax = Math.max(1, c.pvMax - perte);
  return { ...c, niveau: c.niveau - 1, pvMax, pv: Math.min(c.pv, pvMax) };
}

export interface RecuperationResolution {
  /** PV soignés (dé + moitié de niveau, plafonnés par le max manquant). */
  soinTotal: number;
  /** Tirage du dé (ex. [5] pour 1d8) ou valeur max ([8]) si sans lancer. */
  details: number[];
  /** Bonus ajouté au dé : moitié du niveau arrondie à l'inférieur. */
  bonusNiveau: number;
  /** Vrai si la valeur maximale du dé a été prise (récupération complète). */
  valeurMax: boolean;
  pvAvant: number;
  pvApres: number;
  drAvant: number;
  drApres: number;
}

/**
 * Dépense 1 dé de récupération pour regagner de la vigueur :
 * soin = 1 dé (d6/d8/d10 selon famille, dé simple non évolutif) + moitié du niveau
 * arrondie à l'inférieur, plafonné aux PV max. Décrémente la réserve.
 * Refusé sans dé disponible ou à PV pleins (évite le gaspillage).
 */
export function depenserDeRecuperation<T extends Character>(
  c: T,
  rng: Rng = Math.random
): { personnage: T; resolution: RecuperationResolution } {
  const dr = c.desRecuperation;
  if (!dr || dr.actuel <= 0) {
    throw new Error(`${c.nom} : plus de dé de récupération (${dr?.actuel ?? 0}/${dr?.max ?? 0}).`);
  }
  if (c.pv >= c.pvMax) {
    throw new Error(`${c.nom} : vigueur au maximum (${c.pv}/${c.pvMax}), dé non dépensé.`);
  }
  const roll = rollDiceExpression(parseDiceExpression(dr.type), rng);
  const bonusNiveau = Math.max(0, Math.floor(Math.max(1, Math.floor(c.niveau)) / 2));
  const soinTotal = Math.max(0, roll.total + bonusNiveau);
  const pvAvant = c.pv;
  const pvApres = Math.min(c.pvMax, pvAvant + soinTotal);
  const personnage: T = {
    ...c,
    pv: pvApres,
    desRecuperation: { ...dr, actuel: dr.actuel - 1 },
  };
  return {
    personnage,
    resolution: {
      soinTotal: pvApres - pvAvant,
      details: roll.rolls,
      bonusNiveau,
      valeurMax: false,
      pvAvant,
      pvApres,
      drAvant: dr.actuel,
      drApres: dr.actuel - 1,
    },
  };
}

/**
 * Récupération complète : +1 DR (plafond max) et TOUS les points de mana,
 * + remise à zéro des quotas journaliers (mineure, phénix, rétablissement...).
 * Refusée si déjà au complet (DR et mana au max). Le soin éventuel se fait
 * ensuite via depenserDeRecuperation (dé lancé) ou
 * depenserDeRecuperationMax (valeur max, proposée aussitôt).
 */
export function recuperationComplete<T extends Character>(
  c: T
): {
  personnage: T;
  resolution: { drAvant: number; drApres: number; manaAvant: number; manaApres: number };
} {
  const dr = c.desRecuperation;
  const mana = c.ressources?.mana;
  const drAvant = dr?.actuel ?? 0;
  const drApres = dr ? Math.min(dr.max, drAvant + 1) : drAvant;
  const manaAvant = mana?.actuel ?? 0;
  const manaApres = mana ? mana.max : manaAvant;
  if ((!dr || drAvant >= (dr?.max ?? 0)) && (!mana || manaAvant >= mana.max)) {
    throw new Error(
      `${c.nom} : déjà au complet (DR ${drAvant}/${dr?.max ?? 0}, mana ${manaAvant}/${mana?.max ?? 0}).`
    );
  }
  return {
    personnage: {
      ...c,
      desRecuperation: dr ? { ...dr, actuel: drApres } : dr,
      ressources: mana ? { ...c.ressources, mana: { ...mana, actuel: manaApres } } : c.ressources,
      usagesJournaliers: {},
    },
    resolution: { drAvant, drApres, manaAvant, manaApres },
  };
}

/**
 * Dépense 1 DR en valeur maximale, sans lancer le dé : soin = max du dé
 * + moitié du niveau, plafonné aux PV max. Proposé juste après une
 * récupération complète (le joueur enchaîne ou garde son DR pour plus tard).
 * Mêmes refus que le tirage (réserve vide ou vigueur pleine).
 */
export function depenserDeRecuperationMax<T extends Character>(
  c: T
): { personnage: T; resolution: RecuperationResolution } {
  const dr = c.desRecuperation;
  if (!dr || dr.actuel <= 0) {
    throw new Error(`${c.nom} : plus de dé de récupération (${dr?.actuel ?? 0}/${dr?.max ?? 0}).`);
  }
  if (c.pv >= c.pvMax) {
    throw new Error(`${c.nom} : vigueur au maximum (${c.pv}/${c.pvMax}), dé non dépensé.`);
  }
  const faces = parseDiceExpression(dr.type).sides;
  const bonusNiveau = Math.max(0, Math.floor(Math.max(1, Math.floor(c.niveau)) / 2));
  const pvAvant = c.pv;
  const pvApres = Math.min(c.pvMax, pvAvant + faces + bonusNiveau);
  const personnage: T = {
    ...c,
    pv: pvApres,
    desRecuperation: { ...dr, actuel: dr.actuel - 1 },
  };
  return {
    personnage,
    resolution: {
      soinTotal: pvApres - pvAvant,
      details: [faces],
      bonusNiveau,
      valeurMax: true,
      pvAvant,
      pvApres,
      drAvant: dr.actuel,
      drApres: dr.actuel - 1,
    },
  };
}
