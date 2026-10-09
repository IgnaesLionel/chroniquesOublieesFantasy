import { describe, expect, it } from "vitest";
import { characterSchema, monsterSchema } from "@/src/lib/data/validation";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";

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
});
