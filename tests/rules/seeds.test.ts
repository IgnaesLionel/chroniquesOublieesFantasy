import { describe, expect, it } from "vitest";
import { characterSchema, monsterSchema } from "@/src/lib/data/validation";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";
import { fusionnerSeedsManquants } from "@/src/lib/store/useLocalCollection";

describe("Phase 1 : données personajes/monstres", () => {
  it("4 PJ valides", () => {
    expect(SEED_CHARACTERS).toHaveLength(4);
    for (const c of SEED_CHARACTERS) {
      expect(() => characterSchema.parse(c)).not.toThrow();
    }
  });

  it("monstres valides avec pv cohérents", () => {
    for (const m of SEED_MONSTERS) {
      expect(() => monsterSchema.parse(m)).not.toThrow();
      expect(m.pv).toBeLessThanOrEqual(m.pvMax);
    }
  });

  it("graines manquantes ajoutées sans toucher au stock", () => {
    const stock = [{ id: "a" }, { id: "b", nom: "Modifié" }];
    // Rien de neuf : même référence, pas de réécriture.
    expect(fusionnerSeedsManquants(stock, [{ id: "a" }, { id: "b" }])).toBe(stock);
    // Nouveau contenu : ajouté à la fin, existant intact.
    const next = fusionnerSeedsManquants(stock, [{ id: "b" }, { id: "c" }]);
    expect(next).toEqual([{ id: "a" }, { id: "b", nom: "Modifié" }, { id: "c" }]);
    // Graines vides : stock inchangé.
    expect(fusionnerSeedsManquants(stock, [])).toBe(stock);
  });
});
