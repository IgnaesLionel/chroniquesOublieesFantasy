import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  CATEGORIES_POTION,
  EFFETS_POTIONS,
  USAGE_POTION,
  genererPotion,
  type CategoriePotion,
} from "@/src/lib/rules/potions";

/** RNG donnant exactement la face `voulue` sur un dé à `faces` faces. */
const face = (voulue: number, faces: number) => (voulue - 1 + 0.5) / faces;

describe("tables de potions", () => {
  it("catégorie 1d6 : 1-3 soins, 4-5 commune, 6 rare", () => {
    const couverts = new Set<number>();
    for (const p of CATEGORIES_POTION.plages) {
      for (let i = p.min; i <= p.max; i++) couverts.add(i);
    }
    expect([...couverts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("effets : couverture complète (d6 soins, d10 communes, d20 rares)", () => {
    const attentes: Record<CategoriePotion, number> = { soins: 6, commune: 10, rare: 20 };
    for (const [cat, de] of Object.entries(attentes) as [CategoriePotion, number][]) {
      expect(EFFETS_POTIONS[cat].de).toBe(de);
      const couverts = new Set<number>();
      for (const e of EFFETS_POTIONS[cat].effets) {
        for (let i = e.min; i <= e.max; i++) couverts.add(i);
      }
      expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: de }, (_, i) => i + 1));
    }
  });

  it("tirages nominaux", () => {
    expect(genererPotion(fixedRng([face(1, 6), face(1, 6)])).nom).toBe("Soins légers (Prêtre)*");
    expect(genererPotion(fixedRng([face(3, 6), face(6, 6)])).nom).toBe("Délivrance (Prêtre)*");
    const commune = genererPotion(fixedRng([face(4, 6), face(9, 10)]));
    expect(commune.categorie).toBe("commune");
    expect(commune.nom).toBe("Invisibilité (Magicien)");
    expect(commune.detail).toBe("d6 = 4 → Potion commune ; d10 = 9 → Invisibilité (Magicien)");
    const rare = genererPotion(fixedRng([face(6, 6), face(20, 20)]));
    expect(rare.categorie).toBe("rare");
    expect(rare.nom).toBe("Sanctuaire (Prêtre)");
  });

  it("rappel d'usage (action mouvement, tout le monde)", () => {
    expect(USAGE_POTION).toMatch(/mouvement/);
  });
});
