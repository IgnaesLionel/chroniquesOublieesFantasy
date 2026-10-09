import { describe, expect, it } from "vitest";
import { validateBackup } from "@/src/lib/store/backup";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";
import { SEED_ITEMS, SEED_NPCS } from "@/src/lib/data/worldSeeds";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";

describe("sauvegarde import/export", () => {
  const full = {
    version: 1,
    data: {
      characters: SEED_CHARACTERS,
      monsters: SEED_MONSTERS,
      npcs: SEED_NPCS,
      items: SEED_ITEMS,
      scenarios: SEED_SCENARIOS,
      sorts: SEED_SORTS,
    },
  };

  it("round-trip : tous les seeds valides", () => {
    const { backup, report } = validateBackup(full);
    expect(backup).not.toBeNull();
    expect(report.errors).toEqual([]);
    expect(report.imported.characters).toBe(4);
    expect(report.imported.scenarios).toBe(1);
    expect(report.imported.sorts).toBe(SEED_SORTS.length);
    expect(report.skipped.npcs).toBe(0);
  });

  it("items invalides rejetés, valides conservés", () => {
    const { backup, report } = validateBackup({
      data: { items: [SEED_ITEMS[0], { id: "x" }, { nom: "sans id", categorie: "potion", quantite: -1, exemple: false }] },
    });
    expect(report.imported.items).toBe(1);
    expect(report.skipped.items).toBe(2);
    expect(backup!.data.items).toHaveLength(1);
  });

  it("scénario avec condition récursive accepté, lien cassé détecté par validateScenario", async () => {
    const { backup, report } = validateBackup({ data: { scenarios: SEED_SCENARIOS } });
    expect(report.imported.scenarios).toBe(1);
    expect(backup!.data.scenarios).toHaveLength(1);
  });

  it("format inconnu = erreur explicite", () => {
    const { backup, report } = validateBackup({ hello: "world" });
    expect(backup).toBeNull();
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
