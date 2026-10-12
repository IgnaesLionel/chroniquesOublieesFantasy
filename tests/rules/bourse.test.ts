import { describe, expect, it } from "vitest";
import type { Character } from "@/src/lib/rules/types";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { characterSchema } from "@/src/lib/data/validation";
import { normaliserPersonnage } from "@/src/lib/rules/personnage";
import {
  ajusterCoupure,
  ajouterBourse,
  bourseVide,
  consoliderBourse,
  depenserBourse,
  normaliserBourse,
  partagerEgale,
  totalPaBourse,
} from "@/src/lib/rules/bourse";

describe("bourse", () => {
  it("normalisation (défauts, négatifs et décimaux exclus)", () => {
    expect(normaliserBourse()).toEqual({ pp: 0, po: 0, pa: 0 });
    expect(normaliserBourse({ po: 3 })).toEqual({ pp: 0, po: 3, pa: 0 });
    expect(normaliserBourse({ pp: -2, po: 1.9, pa: NaN })).toEqual({ pp: 0, po: 1, pa: 0 });
  });

  it("total en pa (100 pa = 10 po = 1 pp)", () => {
    expect(totalPaBourse({ pp: 1, po: 36, pa: 40 })).toBe(500);
    expect(bourseVide({ pp: 0, po: 0, pa: 0 })).toBe(true);
    expect(bourseVide({ pp: 0, po: 0, pa: 1 })).toBe(false);
  });

  it("gain sans consolidation", () => {
    expect(ajouterBourse({ pp: 0, po: 0, pa: 40 }, { po: 1, pa: 70 })).toEqual({ pp: 0, po: 1, pa: 110 });
  });

  it("dépense avec rendu de monnaie (grosses coupures gardées)", () => {
    expect(depenserBourse({ pp: 1, po: 0, pa: 0 }, { pa: 50 })).toEqual({ pp: 0, po: 5, pa: 0 });
    expect(depenserBourse({ pp: 0, po: 2, pa: 0 }, { pa: 15 })).toEqual({ pp: 0, po: 0, pa: 5 });
    expect(depenserBourse({ pp: 1, po: 36, pa: 40 }, { pp: 1, po: 36, pa: 40 })).toEqual({ pp: 0, po: 0, pa: 0 });
  });

  it("fonds insuffisants = erreur, bourse inchangée", () => {
    const bourse = { pp: 0, po: 1, pa: 0 };
    expect(() => depenserBourse(bourse, { pa: 15 })).toThrow(/insuffisants/);
    expect(bourse).toEqual({ pp: 0, po: 1, pa: 0 });
  });

  it("consolidation vers le haut", () => {
    expect(consoliderBourse({ pp: 0, po: 0, pa: 150 })).toEqual({ pp: 1, po: 5, pa: 0 });
    expect(consoliderBourse({ pp: 2, po: 3, pa: 47 })).toEqual({ pp: 2, po: 7, pa: 7 });
  });

  it("ajustement par coupure (plancher 0, sans monnaie)", () => {
    expect(ajusterCoupure({ pp: 1, po: 0, pa: 0 }, "pa", -1)).toEqual({ pp: 1, po: 0, pa: 0 });
    expect(ajusterCoupure({ pp: 0, po: 2, pa: 0 }, "po", 3)).toEqual({ pp: 0, po: 5, pa: 0 });
  });

  it("partage à parts égales (reste explicite)", () => {
    expect(partagerEgale(500, 3)).toEqual({ part: 166, reste: 2 });
    expect(partagerEgale(500, 1)).toEqual({ part: 500, reste: 0 });
    expect(partagerEgale(500, 0)).toEqual({ part: 0, reste: 500 });
  });

  it("verser une part consolide les coupures", () => {
    // 500 pa à 3 : 166 pa chacun → 1 pp, 6 po, 6 pa.
    const { part } = partagerEgale(500, 3);
    expect(ajouterBourse({ pp: 0, po: 0, pa: 0 }, consoliderBourse({ pa: part }))).toEqual({ pp: 1, po: 6, pa: 6 });
  });
});

describe("bourse des personnages", () => {
  it("normalisée à vide sur les vieilles sauvegardes", () => {
    const sans = normaliserPersonnage({ ...(SEED_CHARACTERS[0] as unknown as Record<string, unknown>), bourse: undefined });
    expect(sans.bourse).toEqual({ pp: 0, po: 0, pa: 0 });
    const avec = normaliserPersonnage({ ...(SEED_CHARACTERS[0] as unknown as Record<string, unknown>), bourse: { po: 5, pa: -3 } });
    expect(avec.bourse).toEqual({ pp: 0, po: 5, pa: 0 });
  });

  it("schéma : bourse optionnelle", () => {
    const base = SEED_CHARACTERS[0] as unknown as Record<string, unknown>;
    expect(() => characterSchema.parse({ ...base })).not.toThrow();
    expect(() => characterSchema.parse({ ...base, bourse: { pp: 1, po: 2, pa: 3 } })).not.toThrow();
    expect(() => characterSchema.parse({ ...base, bourse: { pp: -1, po: 0, pa: 0 } })).toThrow();
  });

  it("personnage seed typé avec bourse", () => {
    const c: Character = SEED_CHARACTERS[0];
    expect(totalPaBourse(c.bourse ?? { pp: 0, po: 0, pa: 0 })).toBe(0);
  });
});
