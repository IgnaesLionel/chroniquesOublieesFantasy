import { describe, expect, it } from "vitest";
import { itemSchema, npcSchema } from "@/src/lib/data/validation";
import { SEED_ITEMS, SEED_NPCS } from "@/src/lib/data/worldSeeds";

describe("PNJ et objets", () => {
  it("PNJ d'exemple valides", () => {
    expect(SEED_NPCS.length).toBeGreaterThan(0);
    for (const n of SEED_NPCS) {
      expect(() => npcSchema.parse(n)).not.toThrow();
    }
  });

  it("objets d'exemple valides, quantités >= 0", () => {
    expect(SEED_ITEMS.length).toBeGreaterThan(0);
    for (const o of SEED_ITEMS) {
      expect(() => itemSchema.parse(o)).not.toThrow();
      expect(o.quantite).toBeGreaterThanOrEqual(0);
    }
  });

  it("clé de quête présente (lien avec le flag cle)", () => {
    expect(SEED_ITEMS.some((o) => o.id === "item-cle" && o.categorie === "quete")).toBe(true);
  });
});
