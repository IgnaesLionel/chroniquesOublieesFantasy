// Générateur d'objets magiques défensifs COF — base, bonus, propriétés.
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Règles du livre : bonus magique ajouté à la DEF (un seul bonus magique
// retenu : le plus haut ; bouclier et armure non cumulés, conversion du
// bonus inutilisé en RD contre les critiques si le MJ l'autorise), niveau
// de magie = bonus + propriétés (1 par propriété sauf précision).
// Suppositions documentées (voir Règles → Points à confirmer) : bonus +N =
// niveau N de l'objet (comme les armes) ; 12 = deux tirages fusionnés si
// identiques (ou doublée / spéciale : MJ) ; Défense par défaut simple.

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";

export interface PlageArmureBase {
  min: number;
  max: number;
  nom: string;
}

/** Armures magiques (1d20) : anneaux, robes, cuirs, mailles, plaques, boucliers. */
export const ARMURES_MAGIQUES: { de: 20; armures: PlageArmureBase[] } = {
  de: 20,
  armures: [
    { min: 1, max: 2, nom: "Anneau ou cape de protection" },
    { min: 3, max: 4, nom: "Bracelets de défense ou robe de mage" },
    { min: 5, max: 6, nom: "Cuir" },
    { min: 7, max: 8, nom: "Cuir renforcé" },
    { min: 9, max: 10, nom: "Chemise de mailles" },
    { min: 11, max: 13, nom: "Cotte de mailles" },
    { min: 14, max: 15, nom: "Demi-plaque" },
    { min: 16, max: 16, nom: "Plaque complète" },
    { min: 17, max: 18, nom: "Petit bouclier" },
    { min: 19, max: 20, nom: "Grand bouclier" },
  ],
};

export type SorteProprieteArmure =
  | "action-libre"
  | "defense"
  | "natation"
  | "ombre"
  | "protection"
  | "resistance-magie"
  | "resistance-feu"
  | "resistance-froid"
  | "resistance-electricite"
  | "resistance-acide"
  | "mobile"
  | "double";

export interface ProprieteArmure {
  sorte: Exclude<SorteProprieteArmure, "double">;
  /** Doublée : niveau ×2. */
  doublee: boolean;
  /** Défense simple ou supérieure (défaut simple, MJ). */
  variante?: "simple" | "superieure";
  /** Résistance [substance] X : X au choix du MJ. */
  valeur?: number | null;
  /** Niveau de magie apporté. */
  niveau: number;
  /** "Protection", "Défense supérieure (RD 4)", "Résistance au feu (X : MJ)", … */
  label: string;
  effet: string;
}

export interface PlageProprieteArmure {
  min: number;
  max: number;
  sorte: SorteProprieteArmure;
  label: string;
}

/** Propriétés des armures magiques (1d12). */
export const PROPRIETES_ARMURES: { de: 12; plages: PlageProprieteArmure[] } = {
  de: 12,
  plages: [
    { min: 1, max: 1, sorte: "action-libre", label: "Action libre" },
    { min: 2, max: 2, sorte: "defense", label: "Défense ou défense supérieure" },
    { min: 3, max: 3, sorte: "natation", label: "Natation" },
    { min: 4, max: 4, sorte: "ombre", label: "Ombre" },
    { min: 5, max: 5, sorte: "protection", label: "Protection" },
    { min: 6, max: 6, sorte: "resistance-magie", label: "Résistance à la magie" },
    { min: 7, max: 7, sorte: "resistance-feu", label: "Résistance au feu" },
    { min: 8, max: 8, sorte: "resistance-froid", label: "Résistance au froid" },
    { min: 9, max: 9, sorte: "resistance-electricite", label: "Résistance à l'électricité" },
    { min: 10, max: 10, sorte: "resistance-acide", label: "Résistance à l'acide" },
    { min: 11, max: 11, sorte: "mobile", label: "Mobile" },
    { min: 12, max: 12, sorte: "double", label: "Deux propriétés, doublée ou spéciale (MJ)" },
  ],
};

const EFFETS_PROPRIETE_ARMURE: Record<Exclude<SorteProprieteArmure, "double">, string> = {
  "action-libre": "Ni ralenti, immobilisé ou paralysé par magie ; +5 pour résister (contrainte physique)",
  defense: "RD 2 (Défense supérieure : RD 4)",
  natation: "+5 aux tests de natation ; l'armure flotte",
  ombre: "+5 aux tests de discrétion (AGI)",
  protection: "DM des critiques et attaques sournoises divisés par 2",
  "resistance-magie": "+5 en DEF ou aux tests contre la magie",
  "resistance-feu": "Retranche X aux DM de feu (X : MJ)",
  "resistance-froid": "Retranche X aux DM de froid (X : MJ)",
  "resistance-electricite": "Retranche X aux DM d'électricité (X : MJ)",
  "resistance-acide": "Retranche X aux DM d'acide (X : MJ)",
  mobile: "Malus d'armure réduit de 4",
};

function construireProprieteArmure(
  sorte: Exclude<SorteProprieteArmure, "double">,
  doublee: boolean,
  variante: "simple" | "superieure" = "simple"
): ProprieteArmure {
  const niveauBase = sorte === "defense" && variante === "superieure" ? 2 : 1;
  const label =
    sorte === "defense" && variante === "superieure"
      ? "Défense supérieure (RD 4)"
      : sorte === "defense"
        ? "Défense (RD 2)"
        : sorte === "action-libre"
          ? "Action libre"
          : sorte === "natation"
            ? "Natation"
            : sorte === "ombre"
              ? "Ombre"
              : sorte === "protection"
                ? "Protection"
                : sorte === "resistance-magie"
                  ? "Résistance à la magie"
                  : sorte === "mobile"
                    ? "Mobile"
                    : `Résistance ${sorte === "resistance-feu" ? "au feu" : sorte === "resistance-froid" ? "au froid" : sorte === "resistance-electricite" ? "à l'électricité" : "à l'acide"} (X : MJ)`;
  const estResistanceSubstance =
    sorte === "resistance-feu" ||
    sorte === "resistance-froid" ||
    sorte === "resistance-electricite" ||
    sorte === "resistance-acide";
  return {
    sorte,
    doublee,
    ...(sorte === "defense" ? { variante } : {}),
    ...(estResistanceSubstance ? { valeur: null } : {}),
    niveau: doublee ? niveauBase * 2 : niveauBase,
    label: doublee ? `${label} intense` : label,
    effet: EFFETS_PROPRIETE_ARMURE[sorte],
  };
}

/** Tirage 1-11 d'une propriété concrète (un 12 imbriqué n'a pas de sens). */
function tirerProprieteConcreteArmure(rng: Rng): { jet: number; plage: PlageProprieteArmure } {
  for (let essai = 0; essai < 20; essai++) {
    const jet = rollDie(PROPRIETES_ARMURES.de, rng);
    const plage = PROPRIETES_ARMURES.plages.find((p) => jet >= p.min && jet <= p.max)!;
    if (plage.sorte !== "double") return { jet, plage };
  }
  const plage = PROPRIETES_ARMURES.plages[0];
  return { jet: plage.min, plage };
}

/** Résout un tirage de propriété (dont 12 : deux tirages fusionnés si identiques). */
function resoudreProprietesArmure(
  jet: number,
  rng: Rng
): { proprietes: ProprieteArmure[]; detail: string } {
  const plage = PROPRIETES_ARMURES.plages.find((p) => jet >= p.min && jet <= p.max)!;
  if (plage.sorte === "double") {
    const a = tirerProprieteConcreteArmure(rng);
    const b = tirerProprieteConcreteArmure(rng);
    const detailTirages = `d12 = ${jet} → deux propriétés : d12 = ${a.jet} → ${a.plage.label}, d12 = ${b.jet} → ${b.plage.label} (ou doublée / spéciale : MJ)`;
    if (a.plage.sorte === b.plage.sorte) {
      // Deux défenses fusionnées = supérieure (RD 4, +2), comme au livre.
      const variante = a.plage.sorte === "defense" ? "superieure" : undefined;
      const fusionnee =
        a.plage.sorte === "defense"
          ? construireProprieteArmure("defense", false, variante)
          : construireProprieteArmure(
              a.plage.sorte as Exclude<SorteProprieteArmure, "double" | "defense">,
              true
            );
      return { proprietes: [fusionnee], detail: `${detailTirages} (identiques → fusionnées)` };
    }
    return {
      proprietes: [
        construireProprieteArmure(a.plage.sorte as Exclude<SorteProprieteArmure, "double">, false),
        construireProprieteArmure(b.plage.sorte as Exclude<SorteProprieteArmure, "double">, false),
      ],
      detail: detailTirages,
    };
  }
  const noteVariante = plage.sorte === "defense" ? " (ou supérieure : MJ)" : "";
  return {
    proprietes: [
      construireProprieteArmure(plage.sorte as Exclude<SorteProprieteArmure, "double">, false),
    ],
    detail: `d12 = ${jet} → ${plage.label}${noteVariante}`,
  };
}

export interface TirageArmureMagique {
  /** Bonus +N (= niveau de l'objet). */
  bonus: number;
  niveauObjet: number;
  jetArmure: number;
  /** Base (cotte de mailles, anneau, grand bouclier…). */
  base: string;
  /** d6 du test de propriété. */
  jetPropriete: number | null;
  proprietes: ProprieteArmure[];
  /** Niveau de magie total (bonus + propriétés). */
  niveauMagie: number;
  /** "Cotte de mailles +2 (Défense (RD 2))", "Grand bouclier +3", … */
  label: string;
  detail: string;
}

/**
 * Tire un objet magique défensif de bonus +N : base (d20), puis propriété
 * si 1d6 < niveau (= bonus). Chaque propriété vaut 1 niveau (supérieure : 2).
 */
export function genererArmureMagique(bonus: number, rng: Rng = Math.random): TirageArmureMagique {
  const jetArmure = rollDie(ARMURES_MAGIQUES.de, rng);
  const basePlage = ARMURES_MAGIQUES.armures.find((p) => jetArmure >= p.min && jetArmure <= p.max)!;
  const jetPropriete = rollDie(6, rng);
  let proprietes: ProprieteArmure[] = [];
  let detailPropriete = `d6 = ${jetPropriete} (propriété si < ${bonus}) → aucune`;
  if (jetPropriete < bonus) {
    const jet = rollDie(PROPRIETES_ARMURES.de, rng);
    const resolution = resoudreProprietesArmure(jet, rng);
    proprietes = resolution.proprietes;
    detailPropriete = `d6 = ${jetPropriete} (propriété car < ${bonus}) ; ${resolution.detail}`;
  }
  const niveauMagie = bonus + proprietes.reduce((total, p) => total + p.niveau, 0);
  const etiquettes = proprietes.map((p) => p.label);
  return {
    bonus,
    niveauObjet: bonus,
    jetArmure,
    base: basePlage.nom,
    jetPropriete,
    proprietes,
    niveauMagie,
    label: `${basePlage.nom} +${bonus}${etiquettes.length > 0 ? ` (${etiquettes.join(", ")})` : ""}`,
    detail: `d20 = ${jetArmure} → ${basePlage.nom} ; ${detailPropriete} ; niveau de magie ${niveauMagie}`,
  };
}
