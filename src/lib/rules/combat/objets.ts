// Objets d'inventaire utilisables en combat : potions, parchemins et
// baguettes. Les objets de trésor ne portent pas toujours un champ structuré :
// la nature est déduite de la catégorie et du nom. Pur TypeScript, sans React.

import type { ActionDRS, FamilleCOF, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import {
  parseDiceExpression,
  rollDie,
  rollDiceExpression,
  substituerDesEvolutifs,
  substituerStats,
  type Rng,
} from "@/src/lib/rules/dice/roller";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { familleDeLaVoie, familleDuProfil, familleDuSort } from "@/src/lib/ui/famille";
import { rangMaxSortsConnus } from "@/src/lib/rules/parchemins";
import { niveauAttaque } from "@/src/lib/rules/personnage";

export type NatureObjetCombat = "potion" | "parchemin" | "baguette";

/** Action DRS nécessaire pour utiliser l'objet. */
export const ACTION_OBJET: Record<NatureObjetCombat, ActionDRS> = {
  potion: "mouvement",
  parchemin: "limitee",
  baguette: "attaque",
};

export const LIBELLE_OBJET: Record<NatureObjetCombat, string> = {
  potion: "Potion",
  parchemin: "Parchemin",
  baguette: "Baguette",
};

function sansAccents(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Nature d'un objet utilisable en combat, null sinon.
 * - Potion : catégorie « potion ».
 * - Parchemin : nom contenant « parchemin », sauf parchemin vierge.
 * - Baguette : « baguette magique » ou baguette marquée magique. La baguette
 *   mundane de la fiche Mage (arme 1d4) reste une arme, pas un objet magique.
 */
export function natureObjetCombat(
  item: Pick<Item, "nom" | "categorie" | "magique">
): NatureObjetCombat | null {
  if (item.categorie === "potion") return "potion";
  const nom = sansAccents(item.nom);
  if (nom.includes("parchemin") && !nom.includes("vierge")) return "parchemin";
  if (nom.includes("baguette magique")) return "baguette";
  if (item.magique && nom.includes("baguette")) return "baguette";
  return null;
}

function extraireRang(texte: string): number | null {
  const m = /\brang\s*(\d+)/i.exec(texte);
  return m ? Number(m[1]) : null;
}

/** Charges de départ inscrites sur une baguette (« 21 charges… »). */
export function chargesInitialesObjet(
  item: Pick<Item, "nom" | "effet" | "description">
): number | null {
  const texte = [item.effet, item.description].filter(Boolean).join(" ");
  const m = /\b(\d+)\s*charges?\b/i.exec(texte);
  return m ? Number(m[1]) : null;
}

/**
 * Charges restantes d'une baguette : compteur d'inventaire s'il existe, sinon
 * charges de départ de l'objet (les anciennes fiches n'ont pas de compteur).
 */
export function chargesRestantesObjet(
  entree: { charges?: number },
  item: Pick<Item, "nom" | "effet" | "description">
): number | null {
  return entree.charges ?? chargesInitialesObjet(item);
}

/** Résumé court pour la palette d'actions (effet, rang, charges). */
export function resumeObjetCombat(
  item: Pick<Item, "nom" | "effet" | "description">,
  nature: NatureObjetCombat,
  chargesRestantes?: number | null
): string {
  const texte = [item.nom, item.description, item.effet].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (nature === "parchemin") {
    const rang = extraireRang(texte);
    if (rang != null) parts.push(`rang ${rang}`);
  }
  if (nature === "baguette") {
    const charges =
      chargesRestantes !== undefined ? chargesRestantes : chargesInitialesObjet(item);
    if (charges != null) parts.push(`${charges} charge${charges > 1 ? "s" : ""}`);
  }
  const detail = nature === "potion" ? item.effet ?? item.description : item.description ?? item.effet;
  if (detail?.trim()) parts.push(detail.trim());
  return parts.join(" · ");
}

export interface SoinPotion {
  /** Expression après substitution du dé évolutif et des caractéristiques. */
  expression: string;
  details: number[];
  total: number;
}

const DICE_TOKEN = /\b\d*d\d+°?(?:\s*[+-]\s*(?:\d+|[A-Z]{3}))?/i;

/**
 * Effet de soin d'une potion, si son texte contient une formule de dés
 * (ex. « Rend des PV (1d4°) »). Retourne null pour les potions sans soin
 * chiffré (invisibilité, vol...) : l'effet reste alors au MJ.
 */
export function soinPotion(
  item: Pick<Item, "nom" | "effet">,
  niveau: number,
  caracs: Record<string, number> = {},
  rng: Rng = Math.random
): SoinPotion | null {
  // On ne lit que l'effet : la description des objets de trésor contient les
  // tirages (« d6 = 5… ») et ne doit pas être confondue avec une formule de soin.
  const texte = item.effet ?? "";
  if (!/\bPV\b/i.test(texte)) return null;
  const m = DICE_TOKEN.exec(texte);
  if (!m) return null;
  const brut = m[0].replace(/\s+/g, "");
  const expression = substituerStats(substituerDesEvolutifs(brut, niveau), caracs);
  try {
    const roll = rollDiceExpression(parseDiceExpression(expression), rng);
    return {
      expression,
      details: roll.rolls,
      total: Math.max(0, roll.total),
    };
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Parchemins : identification du sort scellé et test de lecture COF.
// ───────────────────────────────────────────────────────────────────────────

export interface IdentificationParchemin {
  sort: Sort | null;
  /** Nom entre guillemets (« … ») sur l'objet. */
  nomSort: string | null;
  voie: string | null;
  rang: number | null;
  famille: FamilleCOF | null;
}

function normaliserNom(valeur: string): string {
  return sansAccents(valeur).replace(/\s+/g, " ").trim();
}

/**
 * Retrouve le sort scellé d'un parchemin à partir de son libellé de trésor
 * (« Parchemin — « Feu grégeois » (Voie…, rang 3) »). Tolérant : le nom seul
 * suffit si la voie est absente.
 */
export function identifierParchemin(
  item: Pick<Item, "nom" | "effet" | "description">
): IdentificationParchemin {
  const texte = [item.nom, item.description, item.effet].filter(Boolean).join(" ");
  const nomSort = /«\s*([^»]+?)\s*»/.exec(texte)?.[1]?.trim() ?? null;
  const voie = /\(([^,()]+),\s*rang\s*\d+\)/i.exec(texte)?.[1]?.trim() ?? null;
  const rangBrut = /\brang\s*(\d+)/i.exec(texte)?.[1];
  const rang = rangBrut != null ? Number(rangBrut) : null;
  const sort =
    nomSort == null
      ? null
      : SEED_SORTS.find(
          (s) =>
            normaliserNom(s.nom) === normaliserNom(nomSort) &&
            (!voie || normaliserNom(s.voie ?? "") === normaliserNom(voie))
        ) ??
        SEED_SORTS.find((s) => normaliserNom(s.nom) === normaliserNom(nomSort)) ??
        null;
  return {
    sort,
    nomSort,
    voie: voie ?? sort?.voie ?? null,
    rang: rang ?? sort?.rang ?? null,
    famille: sort ? familleDuSort(sort) : familleDeLaVoie(voie),
  };
}

/** Données du lecteur nécessaires au test (fiche + participant). */
export interface LecteurParchemin {
  profil?: string;
  famille?: FamilleCOF | string;
  sorts: Pick<Sort, "rang">[];
  niveau: number;
  bonusMagique?: number;
  caracs?: Record<string, number>;
}

export type StatutLectureParchemin = "sans-test" | "test" | "impossible" | "inconnu";

export interface ResultatLectureParchemin {
  statut: StatutLectureParchemin;
  /** Le sort est lancé (lecture réussie ou aucun test requis). */
  lance: boolean;
  /** Le parchemin doit être retiré de l'inventaire. */
  consomme: boolean;
  difficulte: number | null;
  d20: number | null;
  bonus: number | null;
  total: number | null;
  marge: number | null;
  sortNom: string | null;
  rang: number | null;
  famille: FamilleCOF | null;
  message: string;
}

function resultatInconnu(
  id: IdentificationParchemin,
  raison: string
): ResultatLectureParchemin {
  return {
    statut: "inconnu",
    lance: false,
    consomme: false,
    difficulte: null,
    d20: null,
    bonus: null,
    total: null,
    marge: null,
    sortNom: id.nomSort,
    rang: id.rang,
    famille: id.famille,
    message: `${raison} Parchemin non consommé automatiquement : à résoudre par le MJ.`,
  };
}

function resultatImpossible(
  id: IdentificationParchemin,
  raison: string
): ResultatLectureParchemin {
  return {
    statut: "impossible",
    lance: false,
    consomme: false,
    difficulte: null,
    d20: null,
    bonus: null,
    total: null,
    marge: null,
    sortNom: id.nomSort,
    rang: id.rang,
    famille: id.famille,
    message: `${raison} Parchemin non consommé.`,
  };
}

/**
 * Résout la lecture d'un parchemin :
 * - aucun test si le sort vient du profil du lecteur et que son rang est maîtrisé ;
 * - sinon test d'attaque magique à 5 × rang (+5 pour un autre profil de la
 *   même famille) ;
 * - autre famille de profil : illisible ;
 * - échec de 10 points ou plus : sort effacé et parchemin consommé.
 * Le sort lui-même n'est pas appliqué ici (cible/portée/effets restent au MJ).
 */
export function lireParchemin(
  item: Pick<Item, "nom" | "effet" | "description">,
  lecteur: LecteurParchemin,
  rng: Rng = Math.random
): ResultatLectureParchemin {
  const id = identifierParchemin(item);
  const rang = id.rang ?? id.sort?.rang ?? null;
  if (!id.sort || rang == null) {
    return resultatInconnu(id, `Sort scellé non identifié${rang != null ? ` (rang ${rang})` : ""}.`);
  }

  // `familles: []` = sort ouvert à toutes les classes : aucune famille de
  // profil à comparer, le parchemin reste lisible par un lanceur de sorts.
  const universel = id.sort.familles != null && id.sort.familles.length === 0;
  if (!universel && id.famille == null) {
    return resultatInconnu(id, "Famille du sort scellé inconnue.");
  }

  const profil = (lecteur.profil ?? "").trim();
  const familleLecteur =
    familleDuProfil(profil) ??
    (typeof lecteur.famille === "string" ? (lecteur.famille as FamilleCOF) : null);
  if (familleLecteur == null) {
    return resultatInconnu(id, "Famille du lecteur inconnue.");
  }

  // Un profil qui figure dans les familles d'au moins un sort est un profil de
  // lanceur (Barde inclus), même si son grimoire est encore vide.
  const profilLanceur =
    profil !== "" &&
    SEED_SORTS.some((s) =>
      (s.familles ?? []).some((p) => normaliserNom(p) === normaliserNom(profil))
    );
  const estLanceur =
    (lecteur.sorts?.length ?? 0) > 0 ||
    profilLanceur ||
    familleLecteur === "Mage" ||
    familleLecteur === "Mystique";
  if (!estLanceur) {
    return resultatImpossible(id, `${profil || "Ce profil"} n'est pas un lanceur de sorts.`);
  }

  const memeFamille = universel || familleLecteur === id.famille;
  if (!memeFamille) {
    return resultatImpossible(
      id,
      `Parchemin illisible : autre famille de profil (${familleLecteur} / ${id.famille}).`
    );
  }

  const memeProfil =
    universel ||
    (id.sort.familles ?? []).some((p) => normaliserNom(p) === normaliserNom(profil));
  const maxRang = rangMaxSortsConnus(lecteur.sorts ?? []);
  const base = {
    sortNom: id.sort.nom,
    rang,
    famille: id.famille,
  };

  if (memeProfil && rang <= maxRang) {
    return {
      ...base,
      statut: "sans-test",
      lance: true,
      consomme: true,
      difficulte: null,
      d20: null,
      bonus: null,
      total: null,
      marge: null,
      message:
        `Sort du profil au rang maîtrisé (rang ${rang} ≤ ${maxRang}) : aucun test. ` +
        "Parchemin consommé, sort lancé (effet à résoudre).",
    };
  }

  const difficulte = 5 * rang + (memeProfil ? 0 : 5);
  const bonus =
    lecteur.bonusMagique ??
    niveauAttaque(lecteur.niveau) + (lecteur.caracs?.VOL ?? 0);
  const d20 = rollDie(20, rng);
  const total = d20 + bonus;
  const marge = total - difficulte;
  const reussi = marge >= 0;
  const consomme = reussi || marge <= -10;
  const formule = memeProfil ? `5 × ${rang}` : `5 × ${rang} + 5 (autre profil, même famille)`;
  const jet = `${d20}${bonus >= 0 ? "+" : ""}${bonus} = ${total} contre ${difficulte} (${formule})`;
  const suite = reussi
    ? "réussi. Parchemin consommé, sort lancé (effet à résoudre)."
    : marge <= -10
      ? `échec de ${-marge} (≥ 10) : sort effacé, parchemin consommé.`
      : `échec de ${-marge} (< 10) : parchemin conservé.`;
  return {
    ...base,
    statut: "test",
    lance: reussi,
    consomme,
    difficulte,
    d20,
    bonus,
    total,
    marge,
    message: `Test d'attaque magique : ${jet} → ${suite}`,
  };
}
