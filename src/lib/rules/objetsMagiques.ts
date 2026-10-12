// Générateur d'objets magiques COF — définit ce qu'est un objet magique
// mineur, moyen ou majeur (second générateur de l'onglet Trésors).
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Procédure par objet : 1d12 sur la table du palier. Potion, parchemin ou
// baguette magique : c'est l'objet. "Objet magique niveau N" : second tirage
// sur la table de catégorie du palier (mineur au d6, moyen/majeur au d12).

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import { genererArmeMagique, type TirageArmeMagique } from "@/src/lib/rules/armesMagiques";
import { genererArmureMagique, type TirageArmureMagique } from "@/src/lib/rules/armuresMagiques";
import { genererPuissance, type PuissanceTiree } from "@/src/lib/rules/puissance";
import { USAGE_BAGUETTE, genererBaguette, type BaguetteTiree } from "@/src/lib/rules/baguettes";
import { USAGE_PARCHEMIN, genererParchemin, type ParcheminTire } from "@/src/lib/rules/parchemins";
import { genererPotion, type PotionTiree } from "@/src/lib/rules/potions";
import { construireObjetMaison } from "@/src/lib/rules/objetsMaison";
import type { Item } from "@/src/lib/rules/world/types";

export type PalierMagique = "mineur" | "moyen" | "majeur";

export const PALIERS_MAGIQUES: PalierMagique[] = ["mineur", "moyen", "majeur"];

/** Nature finale d'un objet magique. */
export type NatureObjetMagique =
  | "potion"
  | "parchemin"
  | "baguette"
  | "arme"
  | "armure"
  | "pouvoir"
  | "puissance";

export interface PlageTypeObjet {
  min: number;
  max: number;
  /** Consommable direct, ou "niveau" (= tirer la catégorie du palier). */
  sorte: "potion" | "parchemin" | "baguette" | "niveau";
  /** Niveau de l'objet si sorte === "niveau". */
  niveau: number | null;
  /** Doses de potion (moyen : 3 doses). */
  doses?: number;
  label: string;
}

export interface TableTypeObjet {
  palier: PalierMagique;
  de: 12;
  plages: PlageTypeObjet[];
}

/** Tables de type d'objet magique (1d12) par palier. */
export const TYPES_OBJETS_MAGIQUES: Record<PalierMagique, TableTypeObjet> = {
  mineur: {
    palier: "mineur",
    de: 12,
    plages: [
      { min: 1, max: 4, sorte: "potion", niveau: null, label: "Potion" },
      { min: 5, max: 6, sorte: "parchemin", niveau: null, label: "Parchemin" },
      { min: 7, max: 7, sorte: "baguette", niveau: null, label: "Baguette magique" },
      { min: 8, max: 11, sorte: "niveau", niveau: 1, label: "Objet magique niveau 1" },
      { min: 12, max: 12, sorte: "niveau", niveau: 2, label: "Objet magique niveau 2" },
    ],
  },
  moyen: {
    palier: "moyen",
    de: 12,
    plages: [
      { min: 1, max: 2, sorte: "potion", niveau: null, doses: 3, label: "Potion (3 doses)" },
      { min: 3, max: 3, sorte: "parchemin", niveau: null, label: "Parchemin" },
      { min: 4, max: 4, sorte: "baguette", niveau: null, label: "Baguette magique" },
      { min: 5, max: 8, sorte: "niveau", niveau: 2, label: "Objet magique niveau 2" },
      { min: 9, max: 11, sorte: "niveau", niveau: 3, label: "Objet magique niveau 3" },
      { min: 12, max: 12, sorte: "niveau", niveau: 4, label: "Objet magique niveau 4" },
    ],
  },
  majeur: {
    palier: "majeur",
    de: 12,
    plages: [
      { min: 1, max: 3, sorte: "niveau", niveau: 3, label: "Objet magique niveau 3" },
      { min: 4, max: 9, sorte: "niveau", niveau: 4, label: "Objet magique niveau 4" },
      { min: 10, max: 12, sorte: "niveau", niveau: 5, label: "Objet magique niveau 5" },
    ],
  },
};

export interface PlageCategorie {
  min: number;
  max: number;
  nature: "arme" | "armure" | "pouvoir" | "puissance";
  label: string;
}

export interface TableCategorieObjet {
  palier: PalierMagique;
  de: 6 | 12;
  plages: PlageCategorie[];
}

/** Tables de catégorie d'objet magique par palier (mineur au d6). */
export const CATEGORIES_OBJETS_MAGIQUES: Record<PalierMagique, TableCategorieObjet> = {
  mineur: {
    palier: "mineur",
    de: 6,
    plages: [
      { min: 1, max: 2, nature: "arme", label: "Arme" },
      { min: 3, max: 4, nature: "armure", label: "Armure" },
      { min: 5, max: 6, nature: "pouvoir", label: "Objet de pouvoir" },
    ],
  },
  moyen: {
    palier: "moyen",
    de: 12,
    plages: [
      { min: 1, max: 3, nature: "arme", label: "Arme" },
      { min: 4, max: 6, nature: "armure", label: "Armure" },
      { min: 7, max: 8, nature: "puissance", label: "Objet de puissance" },
      { min: 9, max: 12, nature: "pouvoir", label: "Objet de pouvoir" },
    ],
  },
  majeur: {
    palier: "majeur",
    de: 12,
    plages: [
      { min: 1, max: 3, nature: "arme", label: "Arme" },
      { min: 4, max: 6, nature: "armure", label: "Armure" },
      { min: 7, max: 8, nature: "puissance", label: "Objet de puissance" },
      { min: 9, max: 12, nature: "pouvoir", label: "Objet de pouvoir" },
    ],
  },
};

const CATEGORIE_LABEL: Record<PlageCategorie["nature"], string> = {
  arme: "Arme magique",
  armure: "Armure magique",
  pouvoir: "Objet de pouvoir",
  puissance: "Objet de puissance",
};

export interface ObjetMagiqueTire {
  palier: PalierMagique;
  jetType: number;
  jetCategorie: number | null;
  nature: NatureObjetMagique;
  /** Niveau de l'objet (null pour potion / parchemin / baguette). */
  niveau: number | null;
  doses?: number;
  /** "Potion", "Potion (3 doses) — Invisibilité (Magicien)", "Arme magique niveau 2", … */
  label: string;
  /** Contenu tiré pour une potion (doses moyennes : même contenu, dose par dose). */
  contenuPotion?: PotionTiree;
  /** Rang et sort tirés pour un parchemin (voie + sort du grimoire). */
  contenuParchemin?: ParcheminTire;
  /** Sort, charges et niveau tirés pour une baguette magique. */
  contenuBaguette?: BaguetteTiree;
  /** Arme magique tirée (bonus +N = niveau). */
  contenuArme?: TirageArmeMagique;
  /** Objet défensif tiré (bonus +N = niveau). */
  contenuArmure?: TirageArmureMagique;
  /** Objet de puissance tiré (caractéristique + forme, bonus : MJ). */
  contenuPuissance?: PuissanceTiree;
  /** Détail des tirages (ex. "d12 = 9 → niveau 1 ; d6 = 1 → Arme"). */
  detail: string;
}

function dansPlage<T extends { min: number; max: number }>(plages: T[], jet: number): T {
  const plage = plages.find((p) => jet >= p.min && jet <= p.max);
  if (!plage) throw new Error(`Tirage ${jet} hors table (couverture 1-${Math.max(...plages.map((p) => p.max))} requise).`);
  return plage;
}

/** Tire un objet magique d'un palier (type au d12, catégorie si niveau). */
export function genererObjetMagique(palier: PalierMagique, rng: Rng = Math.random): ObjetMagiqueTire {
  const table = TYPES_OBJETS_MAGIQUES[palier];
  if (!table) throw new Error(`Palier magique inconnu : ${palier}.`);
  const jetType = rollDie(table.de, rng);
  const plage = dansPlage(table.plages, jetType);
  if (plage.sorte !== "niveau") {
    if (plage.sorte === "potion") {
      const contenu = genererPotion(rng);
      return {
        palier,
        jetType,
        jetCategorie: null,
        nature: "potion",
        niveau: null,
        ...(plage.doses ? { doses: plage.doses } : {}),
        label: `${plage.label} — ${contenu.nom}`,
        contenuPotion: contenu,
        detail: `d12 = ${jetType} → ${plage.label} ; ${contenu.detail}`,
      };
    }
    if (plage.sorte === "parchemin") {
      const contenu = genererParchemin(palier as "mineur" | "moyen", rng);
      const intitule =
        contenu.sortNom && contenu.voie
          ? `« ${contenu.sortNom} » (${contenu.voie}, rang ${contenu.rang})`
          : `sort de rang ${contenu.rang} à choisir par le MJ`;
      return {
        palier,
        jetType,
        jetCategorie: null,
        nature: "parchemin",
        niveau: null,
        label: `${plage.label} — ${intitule}`,
        contenuParchemin: contenu,
        detail: `d12 = ${jetType} → ${plage.label} ; ${contenu.detail}`,
      };
    }
    if (plage.sorte === "baguette") {
      const contenu = genererBaguette(palier as "mineur" | "moyen", rng);
      const intitule =
        contenu.sortNom && contenu.voie
          ? `« ${contenu.sortNom} » (${contenu.voie}, rang ${contenu.rang}, ${contenu.charges} charges)`
          : `sort de rang ${contenu.rang} à choisir par le MJ`;
      return {
        palier,
        jetType,
        jetCategorie: null,
        nature: "baguette",
        niveau: null,
        label: `Baguette magique — ${intitule}`,
        contenuBaguette: contenu,
        detail: `d12 = ${jetType} → ${plage.label} ; ${contenu.detail}`,
      };
    }
    return {
      palier,
      jetType,
      jetCategorie: null,
      nature: plage.sorte,
      niveau: null,
      ...(plage.doses ? { doses: plage.doses } : {}),
      label: plage.label,
      detail: `d12 = ${jetType} → ${plage.label}`,
    };
  }
  const tableCat = CATEGORIES_OBJETS_MAGIQUES[palier];
  const jetCategorie = rollDie(tableCat.de, rng);
  const cat = dansPlage(tableCat.plages, jetCategorie);
  if (cat.nature === "arme") {
    // Bonus +N = niveau N de l'objet (règle confirmée).
    const contenu = genererArmeMagique(plage.niveau!, rng);
    return {
      palier,
      jetType,
      jetCategorie,
      nature: cat.nature,
      niveau: plage.niveau,
      label: contenu.label,
      contenuArme: contenu,
      detail: `d12 = ${jetType} → niveau ${plage.niveau} ; d${tableCat.de} = ${jetCategorie} → ${cat.label} ; ${contenu.detail}`,
    };
  }
  if (cat.nature === "armure") {
    // Bonus +N = niveau N (règle confirmée, comme les armes).
    const contenu = genererArmureMagique(plage.niveau!, rng);
    return {
      palier,
      jetType,
      jetCategorie,
      nature: cat.nature,
      niveau: plage.niveau,
      label: contenu.label,
      contenuArmure: contenu,
      detail: `d12 = ${jetType} → niveau ${plage.niveau} ; d${tableCat.de} = ${jetCategorie} → ${cat.label} ; ${contenu.detail}`,
    };
  }
  if (cat.nature === "puissance") {
    const contenu = genererPuissance(rng);
    return {
      palier,
      jetType,
      jetCategorie,
      nature: cat.nature,
      niveau: plage.niveau,
      label: contenu.label,
      contenuPuissance: contenu,
      detail: `d12 = ${jetType} → niveau ${plage.niveau} ; d${tableCat.de} = ${jetCategorie} → ${cat.label} ; ${contenu.detail}`,
    };
  }
  return {
    palier,
    jetType,
    jetCategorie,
    nature: cat.nature,
    niveau: plage.niveau,
    label: `${CATEGORIE_LABEL[cat.nature]} niveau ${plage.niveau}`,
    detail: `d12 = ${jetType} → niveau ${plage.niveau} ; d${tableCat.de} = ${jetCategorie} → ${cat.label}`,
  };
}

/** Tire `nombre` objets magiques d'un palier. */
export function tirerObjetsMagiques(
  palier: PalierMagique,
  nombre: number,
  rng: Rng = Math.random
): ObjetMagiqueTire[] {
  return Array.from({ length: Math.max(0, Math.floor(nombre)) }, () => genererObjetMagique(palier, rng));
}

/** "1-4", "7" ou "8-11". */
export function formaterPlage(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

/** Dégâts mundanes connus par base (défaut 1d6, à vérifier dans Objets). */
const DEGATS_BASES: Record<string, string> = {
  "Bâton": "1d6",
  "Dague": "1d4",
  "Épée courte": "1d6",
  "Épée longue": "1d8",
  "Hache à une main": "1d8",
  "Hache à deux mains": "2d6",
  "Épée à deux mains": "2d6",
  "Masse ou marteau": "1d6",
  "Rapière": "1d6",
  "Arc court": "1d6",
  "Arc long": "1d8",
  "Javelot": "1d6",
};

/** Mains d'une arme de trésor (2 pour deux mains / arcs / arbalètes / bâtons). */
function mainsArmeTresor(base: string | null, sceptre: boolean): 1 | 2 {
  if (sceptre) return 1;
  if (!base) return 1;
  return /deux mains|arc|arbalète|bâton/i.test(base) ? 2 : 1;
}

/** Emplacement d'une base défensive (bouclier, accessoire, sinon torse). */
function emplacementArmureTresor(base: string): "torse" | "bouclier" | "accessoire" {
  if (/bouclier/i.test(base)) return "bouclier";
  if (/anneau|cape|bracelet|robe/i.test(base)) return "accessoire";
  return "torse";
}

/**
 * Convertit un objet du trésor en objet d'inventaire (maison, magique),
 * prêt à attribuer : bonus d'attaque +N, DM pré-remplis (base mundane +
 * FOR du bénéficiaire au contact + bonus — à vérifier dans Objets, objets
 * modifiables). Familles : à compléter dans Objets (talents liés).
 */
export function objetTresorVersItem(objet: ObjetMagiqueTire, forBeneficiaire = 0, id?: string): Item {
  const FOR = Math.trunc(forBeneficiaire) || 0;
  switch (objet.nature) {
    case "potion": {
      const contenu = objet.contenuPotion;
      return construireObjetMaison(
        {
          nom: objet.label,
          categorie: "potion",
          description: objet.detail,
          effet: contenu
            ? `${contenu.nom}${objet.doses ? ` — ${objet.doses} doses à consommer indépendamment` : ""}`
            : undefined,
          magique: true,
        },
        id
      );
    }
    case "parchemin": {
      const contenu = objet.contenuParchemin;
      const sort = contenu?.sortNom && contenu.voie
        ? `« ${contenu.sortNom} » (${contenu.voie}, rang ${contenu.rang})`
        : `sort de rang ${contenu?.rang ?? "?"} (MJ)`;
      return construireObjetMaison(
        { nom: `Parchemin — ${sort}`, categorie: "outil", description: objet.detail, effet: USAGE_PARCHEMIN, magique: true },
        id
      );
    }
    case "baguette": {
      const contenu = objet.contenuBaguette;
      const sort = contenu?.sortNom && contenu.voie
        ? `« ${contenu.sortNom} » (${contenu.voie}, rang ${contenu.rang})`
        : `sort de rang ${contenu?.rang ?? "?"} (MJ)`;
      return construireObjetMaison(
        {
          nom: `Baguette — ${sort}`,
          categorie: "outil",
          description: objet.detail,
          effet: `${contenu?.charges ?? "?"} charges, niveau de magie ${contenu?.niveauMagie ?? "?"}. ${USAGE_BAGUETTE}`,
          magique: true,
        },
        id
      );
    }
    case "arme": {
      const arme = objet.contenuArme;
      const bonus = arme?.bonus ?? objet.niveau ?? 1;
      const sceptre = arme?.type === "sceptre";
      const base = arme?.arme ?? null;
      const de = (base && DEGATS_BASES[base]) ?? "1d6";
      const total = sceptre || arme?.type === "distance" ? bonus : FOR + bonus;
      const props = (arme?.proprietes ?? []).map((p) => p.label).join(", ");
      const notes = [
        ...(props ? [props] : []),
        ...(sceptre ? ["bonus en attaque magique et aux DM des sorts"] : []),
        `+${bonus} aux DM (pré-remplis ${de}+${total} : vérifiez dans Objets)`,
      ];
      return construireObjetMaison(
        {
          nom: objet.label,
          categorie: "arme",
          description: objet.detail,
          effet: notes.join(". ") + ".",
          bonusAttaque: bonus,
          degats: `${de}+${total}`,
          familles: [],
          mains: mainsArmeTresor(base, sceptre),
          magique: true,
        },
        id
      );
    }
    case "armure": {
      const armure = objet.contenuArmure;
      const bonus = armure?.bonus ?? objet.niveau ?? 0;
      const base = armure?.base ?? "Armure";
      const props = (armure?.proprietes ?? []).map((p) => p.label).join(", ");
      return construireObjetMaison(
        {
          nom: objet.label,
          categorie: "armure",
          description: objet.detail,
          effet: props ? `${props}.` : undefined,
          bonusDefense: bonus,
          emplacement: emplacementArmureTresor(base),
          magique: true,
        },
        id
      );
    }
    case "puissance": {
      const contenu = objet.contenuPuissance;
      return construireObjetMaison(
        {
          nom: objet.label,
          categorie: "divers",
          description: objet.detail,
          effet: contenu ? `+${contenu.bonus} ${contenu.carac} (niveau de magie ${contenu.niveauMagie})` : undefined,
          magique: true,
        },
        id
      );
    }
    case "pouvoir":
    default: {
      return construireObjetMaison(
        {
          nom: objet.label,
          categorie: "divers",
          description: objet.detail,
          effet: "Pouvoir 1/jour en général (parfois permanent).",
          magique: true,
        },
        id
      );
    }
  }
}
