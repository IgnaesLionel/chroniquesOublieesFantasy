import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  FORMES_PUISSANCE,
  TABLE_PUISSANCE,
  genererPuissance,
  niveauPuissance,
  niveauPuissanceMineure,
} from "@/src/lib/rules/puissance";

/** RNG donnant exactement la face `voulue` sur un d12. */
const face = (voulue: number) => (voulue - 1 + 0.5) / 12;

describe("objets de puissance", () => {
  it("table d12 couverte (12 = relancer)", () => {
    const couverts = new Set<number>();
    for (const p of TABLE_PUISSANCE.plages) {
      for (let i = p.min; i <= p.max; i++) couverts.add(i);
    }
    expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(TABLE_PUISSANCE.plages.find((p) => p.min === 12)).toMatchObject({ carac: "relancer" });
  });

  it("caractéristiques, formes et bonus d2", () => {
    const attentes: Record<number, { carac: string; forme: string | null; label: string; niveau: number }> = {
      1: { carac: "AGI", forme: "Gantelets d'agilité", label: "Gantelets d'agilité (AGI +2)", niveau: 6 },
      3: { carac: "FOR", forme: "Ceinture de force", label: "Ceinture de force (FOR +2)", niveau: 6 },
      5: { carac: "CHA", forme: "Robe de charisme", label: "Robe de charisme (CHA +2)", niveau: 6 },
      8: { carac: "DR", forme: null, label: "Objet de puissance (DR, mineur +2)", niveau: 2 },
      10: { carac: "PM", forme: null, label: "Objet de puissance (PM, mineur +6)", niveau: 2 },
      11: { carac: "PV", forme: null, label: "Objet de puissance (PV, mineur +10)", niveau: 2 },
    };
    for (const [jet, a] of Object.entries(attentes)) {
      const p = genererPuissance(fixedRng([face(Number(jet)), 0.75]));
      expect(p.carac).toBe(a.carac);
      expect(p.forme).toBe(a.forme);
      expect(p.jetBonus).toBe(2);
      expect(p.bonus).toBe(a.carac === "PM" ? 6 : a.carac === "PV" ? 10 : 2);
      expect(p.niveauMagie).toBe(a.niveau);
      expect(p.label).toBe(a.label);
      expect(p.jets).toEqual([Number(jet)]);
      expect(FORMES_PUISSANCE[a.carac]).toBe(a.forme);
    }
  });

  it("12 relancé, bonus 1", () => {
    const p = genererPuissance(fixedRng([face(12), face(3), 0.25]));
    expect(p.jets).toEqual([12, 3]);
    expect(p.carac).toBe("FOR");
    expect(p.bonus).toBe(1);
    expect(p.niveauMagie).toBe(3);
    expect(p.label).toBe("Ceinture de force (FOR +1)");
  });

  it("niveaux : bonus × 3, mineurs à la tranche", () => {
    expect(niveauPuissance(2)).toBe(6); // cape de charisme +2
    expect(niveauPuissance(0)).toBe(0);
    expect(niveauPuissanceMineure("DR", 2)).toBe(2);
    expect(niveauPuissanceMineure("PC", 1)).toBe(1);
    expect(niveauPuissanceMineure("PM", 6)).toBe(2);
    expect(niveauPuissanceMineure("PM", 3)).toBe(1);
    expect(niveauPuissanceMineure("PV", 10)).toBe(2);
    expect(niveauPuissanceMineure("PV", 5)).toBe(1);
    expect(() => niveauPuissanceMineure("FOR", 2)).toThrow(/mineure/);
  });
});
