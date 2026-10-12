// Générateur d'objets de puissance COF — caractéristique, forme, bonus, niveau.
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Les objets de puissance augmentent une caractéristique (forme imposée :
// ceinture FOR, bandeau INT/VOL, gantelets AGI, masque PER, robe CHA,
// amulette CON) ou une caractéristique mineure (DR, PC, PM, PV, forme libre).
// Bonus 1-2 au d2, sans lien avec le niveau de l'objet (mineures : DR/PC en
// points, PM/PV par tranches de 3/5 pour suivre la table des niveaux).
// Niveau de magie = bonus × 3 (+2 conseillé en classique, +3 en high fantasy) ;
// mineurs : DR/PC 1 par point, PM 1 par tranche de 3, PV 1 par tranche de 5.

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";

export type CaracPuissance =
  | "AGI" | "CON" | "FOR" | "PER" | "CHA" | "INT" | "VOL"
  | "DR" | "PC" | "PM" | "PV";

export const CARACS_PUISSANCE_MAJEURES: CaracPuissance[] = ["AGI", "CON", "FOR", "PER", "CHA", "INT", "VOL"];
export const CARACS_PUISSANCE_MINEURES: CaracPuissance[] = ["DR", "PC", "PM", "PV"];

/** Légende des caractéristiques mineures (DR = récupération, etc.). */
export const LEGENDE_CARACS_MINEURES: Record<string, string> = {
  DR: "récupération",
  PC: "chance",
  PM: "mana",
  PV: "vigueur",
};

export interface PlagePuissance {
  min: number;
  max: number;
  carac: CaracPuissance | "relancer";
}

/** Caractéristique affectée (1d12, 12 = relancer). */
export const TABLE_PUISSANCE: { de: 12; plages: PlagePuissance[] } = {
  de: 12,
  plages: [
    { min: 1, max: 1, carac: "AGI" },
    { min: 2, max: 2, carac: "CON" },
    { min: 3, max: 3, carac: "FOR" },
    { min: 4, max: 4, carac: "PER" },
    { min: 5, max: 5, carac: "CHA" },
    { min: 6, max: 6, carac: "INT" },
    { min: 7, max: 7, carac: "VOL" },
    { min: 8, max: 8, carac: "DR" },
    { min: 9, max: 9, carac: "PC" },
    { min: 10, max: 10, carac: "PM" },
    { min: 11, max: 11, carac: "PV" },
    { min: 12, max: 12, carac: "relancer" },
  ],
};

/** Forme imposée par la caractéristique (mineures : forme libre, MJ). */
export const FORMES_PUISSANCE: Record<string, string | null> = {
  AGI: "Gantelets d'agilité",
  CON: "Amulette de constitution",
  FOR: "Ceinture de force",
  PER: "Masque de perception",
  CHA: "Robe de charisme",
  INT: "Bandeau d'intelligence",
  VOL: "Bandeau de volonté",
  DR: null,
  PC: null,
  PM: null,
  PV: null,
};

/** Niveau de magie = bonus × 3 (ex. cape de charisme +2 → 6). */
export function niveauPuissance(bonus: number): number {
  return Math.max(0, Math.floor(bonus)) * 3;
}

/** Niveau des mineurs : DR/PC 1 par point, PM 1 par tranche de 3, PV 1 par tranche de 5. */
export function niveauPuissanceMineure(carac: string, points: number): number {
  const pts = Math.max(0, Math.floor(points));
  if (carac === "DR" || carac === "PC") return pts;
  if (carac === "PM") return Math.floor(pts / 3);
  if (carac === "PV") return Math.floor(pts / 5);
  throw new Error(`Pas une caractéristique mineure : ${carac} (DR, PC, PM ou PV).`);
}

export interface PuissanceTiree {
  /** Tous les tirages d12 (relances du 12 incluses). */
  jets: number[];
  carac: CaracPuissance;
  /** Majeure (AGI…VOL) ou mineure (DR, PC, PM, PV). */
  mineure: boolean;
  /** Forme imposée (null pour les mineures : MJ). */
  forme: string | null;
  /** Jet du d2 de bonus / points. */
  jetBonus: number;
  /** Bonus majeur (1-2) ou points mineurs (DR/PC 1-2, PM 3/6, PV 5/10). */
  bonus: number;
  /** Niveau de magie (bonus × 3, tranches pour les mineures). */
  niveauMagie: number;
  /** "Ceinture de force (FOR +2)", "Objet de puissance (PM +3)", … */
  label: string;
  detail: string;
}

/**
 * Tire un objet de puissance complet : caractéristique (d12, 12 relancé),
 * forme, bonus au d2 (majeures 1-2, mineures DR/PC 1-2, PM 3/6, PV 5/10).
 */
export function genererPuissance(rng: Rng = Math.random): PuissanceTiree {
  const jets: number[] = [];
  let carac: CaracPuissance | null = null;
  for (let essai = 0; essai < 20; essai++) {
    const jet = rollDie(TABLE_PUISSANCE.de, rng);
    jets.push(jet);
    const plage = TABLE_PUISSANCE.plages.find((p) => jet >= p.min && jet <= p.max)!;
    if (plage.carac !== "relancer") {
      carac = plage.carac;
      break;
    }
  }
  if (!carac) throw new Error("Tirage de puissance impossible (que des 12).");
  const mineure = (CARACS_PUISSANCE_MINEURES as string[]).includes(carac);
  const forme = FORMES_PUISSANCE[carac] ?? null;
  const jetBonus = rollDie(2, rng);
  const bonus = mineure
    ? carac === "PM"
      ? jetBonus * 3
      : carac === "PV"
        ? jetBonus * 5
        : jetBonus
    : jetBonus;
  const niveauMagie = mineure ? niveauPuissanceMineure(carac, bonus) : niveauPuissance(bonus);
  const nom = forme ?? "Objet de puissance";
  return {
    jets,
    carac,
    mineure,
    forme,
    jetBonus,
    bonus,
    niveauMagie,
    label: `${nom} (${carac}${mineure ? ", mineur" : ""} +${bonus})`,
    detail:
      `d12 = ${jets.join(", ")} → ${carac}${forme ? ` (${forme})` : ""} ; ` +
      `d2 = ${jetBonus} → +${bonus} (niveau de magie ${niveauMagie})`,
  };
}
