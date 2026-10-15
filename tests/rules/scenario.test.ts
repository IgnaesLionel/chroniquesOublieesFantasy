import { describe, expect, it } from "vitest";
import { followChoice, getDepart, getSceneSafe, orphanScenes, startPlay, validateScenario } from "@/src/lib/rules/scenario/engine";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";

describe("scénarios modulaires", () => {
  const scn = SEED_SCENARIOS[0];

  it("départ = Scène 1 avec 3 choix visibles + 1 conditionnel", () => {
    expect(getDepart(scn).id).toBe("s1");
    expect(getDepart(scn).choix).toHaveLength(4);
  });

  it("navigation A -> 2A puis forêt", () => {
    let play = startPlay(scn);
    play = followChoice(scn, play, "c1a");
    expect(play.sceneId).toBe("s2a");
    play = followChoice(scn, play, "c2a");
    expect(play.sceneId).toBe("s2b");
    expect(play.historique).toEqual(["s1", "s2a", "s2b"]);
  });

  it("choix invalide ou destination manquante = erreur", () => {
    const play = startPlay(scn);
    expect(() => followChoice(scn, play, "xxx")).toThrow();
    expect(validateScenario(scn)).toEqual([]);
    const broken = { ...scn, scenes: scn.scenes.map((s) => ({ ...s, choix: s.id === "s1" ? [{ id: "x", label: "X", versSceneId: "missing" }] : s.choix })) };
    expect(validateScenario(broken).length).toBeGreaterThan(0);
  });

  it("getSceneSafe ne lève pas sur ID inconnu", () => {
    expect(getSceneSafe(scn, "missing")).toBeNull();
    expect(getSceneSafe(scn, "s1")?.titre).toContain("Scène 1");
  });
});

describe("mise en jambes (transcription Notion)", () => {
  const mej = SEED_SCENARIOS.find((s) => s.id === "scn-mise-en-jambes")!;

  it("graine valide : schéma + liens + aucune orpheline", async () => {
    const { scenarioSchema } = await import("@/src/lib/data/validation");
    expect(() => scenarioSchema.parse(mej)).not.toThrow();
    expect(validateScenario(mej)).toEqual([]);
    expect(orphanScenes(mej)).toEqual([]);
  });

  it("navigation complète : carrefour -> pont -> charrette -> vautours -> auberge", () => {
    let play = startPlay(mej);
    expect(play.sceneId).toBe("mej-depart");
    play = followChoice(mej, play, "mej-c1a");
    expect(play.sceneId).toBe("mej-panneau");
    play = followChoice(mej, play, "mej-c2");
    play = followChoice(mej, play, "mej-c4");
    expect(play.sceneId).toBe("mej-charrette");
    play = followChoice(mej, play, "mej-c5");
    play = followChoice(mej, play, "mej-c6");
    expect(play.sceneId).toBe("mej-auberge");
  });

  it("PNJ et objets liés existent dans les bases", async () => {
    const { SEED_NPCS, SEED_ITEMS } = await import("@/src/lib/data/worldSeeds");
    const ch = mej.scenes.find((s) => s.id === "mej-charrette")!;
    for (const id of ch.pnjIds ?? []) expect(SEED_NPCS.some((n) => n.id === id)).toBe(true);
    for (const id of ch.itemIds ?? []) expect(SEED_ITEMS.some((o) => o.id === id)).toBe(true);
  });
});
