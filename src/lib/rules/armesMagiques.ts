// Générateur d'armes magiques COF — type, bonus, propriétés spéciales.
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Règles du livre : bonus en attaque et aux DM (+N), propriétés affûtée /
// fléau / élément / parade (doublables : +2d4°), projectiles consommables
// non cumulés (+10 m de portée par point du plus faible), niveau de magie =
// bonus + niveaux des propriétés (doublés si doublées).
// Supposition documentée (voir Règles → Points à confirmer) : la parade est
// en plus tirée à 10 % (d100) lors d'un tirage d'arme.

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";

export type TypeArmeMagique = "contact" | "distance" | "sceptre";

export interface PlageTypeArme {
  min: number;
  max: number;
  type: TypeArmeMagique;
  label: string;
}

/** Type d'arme magique (1d6). */
export const TYPES_ARME_MAGIQUE: { de: 6; plages: PlageTypeArme[] } = {
  de: 6,
  plages: [
    { min: 1, max: 3, type: "contact", label: "Arme de contact" },
    { min: 4, max: 5, type: "distance", label: "Arme à distance" },
    { min: 6, max: 6, type: "sceptre", label: "Sceptre de magie" },
  ],
};

export interface PlageArmeBase {
  min: number;
  max: number;
  /** "Autre arme" : base au choix du MJ. */
  nom: string;
}

export type SortePropriete = "affutee" | "fleau" | "element" | "precision" | "parade";

/** Armes de contact (1d20). */
export const ARMES_CONTACT: { de: 20; armes: PlageArmeBase[] } = {
  de: 20,
  armes: [
    { min: 1, max: 1, nom: "Maniques (mains nues)" },
    { min: 2, max: 2, nom: "Bâton" },
    { min: 3, max: 4, nom: "Dague" },
    { min: 5, max: 5, nom: "Épée bâtarde" },
    { min: 6, max: 7, nom: "Épée courte" },
    { min: 8, max: 10, nom: "Épée longue" },
    { min: 11, max: 11, nom: "Hache à une main" },
    { min: 12, max: 13, nom: "Épée à deux mains" },
    { min: 14, max: 14, nom: "Hache à deux mains" },
    { min: 15, max: 16, nom: "Masse ou marteau" },
    { min: 17, max: 18, nom: "Rapière" },
    { min: 19, max: 19, nom: "Vivelame ou Katana" },
    { min: 20, max: 20, nom: "Autre arme" },
  ],
};

/** Armes à distance (1d20). */
export const ARMES_DISTANCE: { de: 20; armes: PlageArmeBase[] } = {
  de: 20,
  armes: [
    { min: 1, max: 1, nom: "Arbalète de poing" },
    { min: 2, max: 3, nom: "Arbalète légère" },
    { min: 4, max: 5, nom: "Arbalète lourde" },
    { min: 6, max: 7, nom: "Arc court" },
    { min: 8, max: 9, nom: "Arc long" },
    { min: 10, max: 10, nom: "Dague" },
    { min: 11, max: 11, nom: "Fronde" },
    { min: 12, max: 12, nom: "Hachette" },
    { min: 13, max: 13, nom: "Javelot" },
    { min: 14, max: 15, nom: "Carreaux d'arbalète (1d12)" },
    { min: 16, max: 17, nom: "Flèches (1d12)" },
    { min: 18, max: 18, nom: "Billes de fronde (1d12)" },
    { min: 19, max: 20, nom: "Autre arme" },
  ],
};

export interface ProprieteArme {
  sorte: SortePropriete;
  /** Créature (fléau) ou élément/substance. */
  objet?: string;
  /** Doublée (intense) : dés et niveau doublés. */
  doublee: boolean;
  /** Nombre de d4° de la propriété (2 si doublée). */
  dmDes: number;
  /** Affûtée : +1 aux chances de critique (2 si doublée). */
  critiquePlus?: number;
  /** Parade : bonus de DEF (choisi par le MJ). */
  defense?: number | null;
  /** Niveau de magie apporté. */
  niveau: number;
  /** "affûtée", "fléau des démons", "de feu intense", … */
  label: string;
}

/** Niveau de magie des propriétés (parade : += bonus DEF). */
export const NIVEAU_PROPRIETE: Record<"affutee" | "fleau" | "element" | "precision", number> = {
  affutee: 1,
  fleau: 1,
  element: 2,
  precision: 1,
};

export interface PlagePropriete {
  min: number;
  max: number;
  sorte: "affutee" | "fleau" | "element" | "precision" | "double";
  /** Créature ou élément (fléau / élément). */
  objet?: string;
  label: string;
}

export interface TableProprietes {
  de: 12;
  plages: PlagePropriete[];
}

/** Propriétés des armes de contact (1d12). */
export const PROPRIETES_CONTACT: TableProprietes = {
  de: 12,
  plages: [
    { min: 1, max: 2, sorte: "affutee", label: "Affûtée" },
    { min: 3, max: 3, sorte: "fleau", objet: "morts", label: "Fléau des morts" },
    { min: 4, max: 4, sorte: "fleau", objet: "dragons", label: "Fléau des dragons" },
    { min: 5, max: 5, sorte: "fleau", objet: "géants", label: "Fléau des géants" },
    { min: 6, max: 6, sorte: "fleau", objet: "goblinoïdes", label: "Fléau des goblinoïdes" },
    { min: 7, max: 7, sorte: "fleau", objet: "démons", label: "Fléau des démons" },
    { min: 8, max: 8, sorte: "element", objet: "feu", label: "Feu" },
    { min: 9, max: 9, sorte: "element", objet: "froid", label: "Froid" },
    { min: 10, max: 10, sorte: "element", objet: "foudre", label: "Foudre" },
    { min: 11, max: 12, sorte: "double", label: "Deux propriétés (doublées si identiques)" },
  ],
};

/** Propriétés des armes à distance (1d12) : comme au contact, Affûtée → de précision. */
export const PROPRIETES_DISTANCE: TableProprietes = {
  de: 12,
  plages: [
    { min: 1, max: 2, sorte: "precision", label: "De précision" },
    { min: 3, max: 3, sorte: "fleau", objet: "morts", label: "Fléau des morts" },
    { min: 4, max: 4, sorte: "fleau", objet: "dragons", label: "Fléau des dragons" },
    { min: 5, max: 5, sorte: "fleau", objet: "géants", label: "Fléau des géants" },
    { min: 6, max: 6, sorte: "fleau", objet: "goblinoïdes", label: "Fléau des goblinoïdes" },
    { min: 7, max: 7, sorte: "fleau", objet: "démons", label: "Fléau des démons" },
    { min: 8, max: 8, sorte: "element", objet: "feu", label: "Feu" },
    { min: 9, max: 9, sorte: "element", objet: "froid", label: "Froid" },
    { min: 10, max: 10, sorte: "element", objet: "foudre", label: "Foudre" },
    { min: 11, max: 12, sorte: "double", label: "Deux propriétés (doublées si identiques)" },
  ],
};

type SorteConstructible = "affutee" | "fleau" | "element" | "precision";

function construirePropriete(
  sorte: SorteConstructible,
  objet: string | undefined,
  doublee: boolean
): ProprieteArme {
  const base = NIVEAU_PROPRIETE[sorte];
  const nomBase =
    sorte === "affutee"
      ? "affûtée"
      : sorte === "precision"
        ? "de précision"
        : sorte === "fleau"
          ? `fléau des ${objet}`
          : `de ${objet}`;
  return {
    sorte,
    ...(objet ? { objet } : {}),
    doublee,
    dmDes: doublee ? 2 : 1,
    ...((sorte === "affutee" || sorte === "precision") ? { critiquePlus: doublee ? 2 : 1 } : {}),
    niveau: doublee ? base * 2 : base,
    label: doublee ? `${nomBase} intense` : nomBase,
  };
}

/** Propriété de parade : +N DEF simple et cumulable (N = bonus de l'arme). */
export function proprieteParade(defense: number): ProprieteArme {
  return {
    sorte: "parade",
    doublee: false,
    dmDes: 0,
    defense,
    niveau: defense,
    label: `de parade (+${defense} DEF)`,
  };
}

/** Tirage 1-10 d'une propriété concrète (un 11-12 imbriqué n'a pas de sens). */
function tirerProprieteConcrete(table: TableProprietes, rng: Rng): { jet: number; plage: PlagePropriete } {
  for (let essai = 0; essai < 20; essai++) {
    const jet = rollDie(table.de, rng);
    const plage = table.plages.find((p) => jet >= p.min && jet <= p.max)!;
    if (plage.sorte !== "double") return { jet, plage };
  }
  const plage = table.plages[0];
  return { jet: plage.min, plage };
}

/** Résout un tirage de propriété (dont 11-12 : deux tirages fusionnés si identiques). */
function resoudreProprietes(
  table: TableProprietes,
  jet: number,
  rng: Rng
): { proprietes: ProprieteArme[]; detail: string } {
  const plage = table.plages.find((p) => jet >= p.min && jet <= p.max)!;
  if (plage.sorte === "double") {
    const a = tirerProprieteConcrete(table, rng);
    const b = tirerProprieteConcrete(table, rng);
    const detailTirages = `d12 = ${jet} → deux propriétés : d12 = ${a.jet} → ${a.plage.label}, d12 = ${b.jet} → ${b.plage.label}`;
    if (a.plage.sorte === b.plage.sorte && a.plage.objet === b.plage.objet) {
      return {
        proprietes: [construirePropriete(a.plage.sorte as SorteConstructible, a.plage.objet, true)],
        detail: `${detailTirages} (identiques → doublée)`,
      };
    }
    return {
      proprietes: [
        construirePropriete(a.plage.sorte as SorteConstructible, a.plage.objet, false),
        construirePropriete(b.plage.sorte as SorteConstructible, b.plage.objet, false),
      ],
      detail: detailTirages,
    };
  }
  return {
    proprietes: [construirePropriete(plage.sorte as SorteConstructible, plage.objet, false)],
    detail: `d12 = ${jet} → ${plage.label}`,
  };
}

/** Chance (%) de parade en plus lors d'un tirage d'arme (supposition). */
export const CHANCE_PARADE = 10;

export interface TirageArmeMagique {
  /** Bonus +N (= niveau de l'objet). */
  bonus: number;
  niveauObjet: number;
  jetType: number;
  type: TypeArmeMagique;
  typeLabel: string;
  /** d20 de la base (null pour les sceptres, sans table de formes). */
  jetArme: number | null;
  /** Base (épée, arc…), null pour "Autre arme" (MJ) et les sceptres. */
  arme: string | null;
  /** d6 du test de propriété (null pour les sceptres, sans propriété). */
  jetPropriete: number | null;
  proprietes: ProprieteArme[];
  /** d100 de parade (null pour les sceptres, sans parade). */
  jetParade: number | null;
  /** Niveau de magie total (bonus + propriétés). */
  niveauMagie: number;
  /** "Épée longue +2 (affûtée)", "Sceptre de magie +2 (DM 1d6)", … */
  label: string;
  detail: string;
}

/**
 * Tire une arme magique de bonus +N : type (d6), base (d20 de la colonne),
 * puis propriété si 1d6 < niveau (= bonus). Table d12 du type (11-12 = deux
 * tirages fusionnés si identiques ; distance : Affûtée → de précision).
 * Sceptre : bonus en attaque magique et DM des sorts, DM 1d6.
 */
export function genererArmeMagique(bonus: number, rng: Rng = Math.random): TirageArmeMagique {
  const jetType = rollDie(TYPES_ARME_MAGIQUE.de, rng);
  const typePlage = TYPES_ARME_MAGIQUE.plages.find((p) => jetType >= p.min && jetType <= p.max)!;
  if (typePlage.type === "sceptre") {
    return {
      bonus,
      niveauObjet: bonus,
      jetType,
      type: "sceptre",
      typeLabel: typePlage.label,
      jetArme: null,
      arme: null,
      jetPropriete: null,
      proprietes: [],
      jetParade: null,
      niveauMagie: bonus,
      label: `Sceptre de magie +${bonus} (DM 1d6)`,
      detail: `d6 = ${jetType} → sceptre (bonus +${bonus} en attaque magique et aux DM des sorts, DM 1d6 comme un bâton)`,
    };
  }
  const tableBase = typePlage.type === "contact" ? ARMES_CONTACT : ARMES_DISTANCE;
  const jetArme = rollDie(tableBase.de, rng);
  const basePlage = tableBase.armes.find((p) => jetArme >= p.min && jetArme <= p.max)!;
  const arme = basePlage.nom === "Autre arme" ? null : basePlage.nom;
  const detailBase = `d20 = ${jetArme} → ${basePlage.nom}`;
  const jetPropriete = rollDie(6, rng);
  const avecPropriete = jetPropriete < bonus;
  let proprietes: ProprieteArme[] = [];
  let detailPropriete = `d6 = ${jetPropriete} (propriété si < ${bonus}) → aucune`;
  if (avecPropriete) {
    const table = typePlage.type === "contact" ? PROPRIETES_CONTACT : PROPRIETES_DISTANCE;
    const jet = rollDie(table.de, rng);
    const resolution = resoudreProprietes(table, jet, rng);
    proprietes = resolution.proprietes;
    detailPropriete = `d6 = ${jetPropriete} (propriété car < ${bonus}) ; ${resolution.detail}`;
  }
  const jetParade = rollDie(100, rng);
  let detailParade = `d100 = ${jetParade} (parade si ≤ ${CHANCE_PARADE}) → aucune`;
  if (jetParade <= CHANCE_PARADE) {
    proprietes.push(proprieteParade(bonus));
    detailParade = `d100 = ${jetParade} (parade car ≤ ${CHANCE_PARADE}) → de parade (+${bonus} DEF)`;
  }
  const niveauMagie = bonus + proprietes.reduce((total, p) => total + p.niveau, 0);
  // Qualificatifs entre parenthèses, cités comme dans les tables (pas d'accord).
  const etiquettes = proprietes.map((p) => p.label);
  if (!arme) etiquettes.push("base au choix du MJ");
  const nomBase = arme ?? typePlage.label;
  return {
    bonus,
    niveauObjet: bonus,
    jetType,
    type: typePlage.type,
    typeLabel: typePlage.label,
    jetArme,
    arme,
    jetPropriete,
    proprietes,
    jetParade,
    niveauMagie,
    label: `${nomBase} +${bonus}${etiquettes.length > 0 ? ` (${etiquettes.join(", ")})` : ""}`,
    detail: `d6 = ${jetType} → ${typePlage.label.toLowerCase()} ; ${detailBase} ; ${detailPropriete} ; ${detailParade} ; niveau de magie ${niveauMagie}`,
  };
}

/** Règle des projectiles magiques (rappel affiché au MJ). */
export const REGLE_PROJECTILES =
  "Consommables : perdent leur enchantement ou se brisent après usage. " +
  "Avec une arme magique, seul le plus haut bonus s'applique (attaque et DM), " +
  "plus +10 m de portée par point du bonus le plus faible.";

export interface BonusProjectiles {
  /** Bonus appliqué (attaque et DM) : le plus haut des deux. */
  bonus: number;
  /** Portée gagnée : +10 m par point du bonus le plus faible. */
  porteePlusM: number;
}

/** Ex. flèche +4 sur arc +2 : bonus +4, portée +20 m. */
export function combinerProjectileArme(bonusProjectile: number, bonusArme: number): BonusProjectiles {
  return { bonus: Math.max(bonusProjectile, bonusArme), porteePlusM: 10 * Math.min(bonusProjectile, bonusArme) };
}
