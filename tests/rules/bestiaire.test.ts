import { describe, expect, it } from "vitest";
import { monsterSchema } from "@/src/lib/data/validation";
import { parseDiceExpression } from "@/src/lib/rules/dice/roller";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import { CAPACITES_PARTAGEES } from "@/src/lib/data/capacites-partagees";

const CATALOG = new Set(CAPACITES_PARTAGEES.map((c) => c.cle));

describe("bestiaire Notion importé", () => {
  it("95 créatures valides au schéma", () => {
    expect(SEED_MONSTERS.length).toBeGreaterThanOrEqual(90);
    for (const m of SEED_MONSTERS) {
      expect(() => monsterSchema.parse(m), m.id).not.toThrow();
    }
  });

  it("IDs uniques, PV/défense cohérents", () => {
    const ids = SEED_MONSTERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of SEED_MONSTERS) {
      expect(m.pv, m.id).toBeLessThanOrEqual(m.pvMax);
      expect(m.pvMax, m.id).toBeGreaterThan(0);
    }
  });

  it("tous les dégâts passent le parser du moteur (combat sans crash)", () => {
    const sansAttaque = SEED_MONSTERS.filter((m) => m.attaques.length === 0).map((m) => m.id);
    expect(sansAttaque).toEqual(["notion-druid-arbre-anime"]);
    for (const m of SEED_MONSTERS) {
      for (const a of m.attaques) {
        expect(() => parseDiceExpression(a.degats), `${m.id}/${a.nom}: ${a.degats}`).not.toThrow();
      }
    }
  });

  it("références partagées résolues dans le catalogue", () => {
    for (const m of SEED_MONSTERS) {
      for (const ref of m.capacitesPartagees ?? []) {
        expect(CATALOG.has(ref), `${m.id} -> ${ref}`).toBe(true);
      }
    }
  });

  it("spot checks : Aigle et Gobelin de base", () => {
    const aigle = SEED_MONSTERS.find((m) => m.id === "notion-nc-0-5-aigle")!;
    expect(aigle.pv).toBe(3);
    expect(aigle.defense).toBe(13);
    expect(aigle.attaques[0]).toMatchObject({ nom: "Serres", bonus: 3, degats: "1d4" });
    expect(aigle.capacitesPartagees).toContain("vol-rapide");
    const gob = SEED_MONSTERS.find((m) => m.id === "notion-nc-0-gobelin-de-base")!;
    expect(gob.niveau).toBe(0);
    expect(gob.capacitesPartagees).toContain("attaque-en-meute");
  });
});
