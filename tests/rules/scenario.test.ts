import { describe, expect, it } from "vitest";
import { followChoice, getDepart, getSceneSafe, startPlay, validateScenario } from "@/src/lib/rules/scenario/engine";
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
