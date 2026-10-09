import { describe, expect, it } from "vitest";
import { availableChoices, describeCondition, evaluateCondition } from "@/src/lib/rules/scenario/conditions";
import { followChoice, setFlag, startPlay } from "@/src/lib/rules/scenario/engine";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";

describe("conditions et embranchements", () => {
  it("flag estVrai / estFaux / egal", () => {
    expect(evaluateCondition({ type: "flag", flag: "cle", op: "estVrai" }, { cle: true })).toBe(true);
    expect(evaluateCondition({ type: "flag", flag: "cle", op: "estVrai" }, {})).toBe(false);
    expect(evaluateCondition({ type: "flag", flag: "cle", op: "estFaux" }, {})).toBe(true);
    expect(evaluateCondition({ type: "flag", flag: "humeur", op: "egal", valeur: "hostile" }, { humeur: "hostile" })).toBe(true);
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it("et / ou / non", () => {
    const cle = { type: "flag", flag: "cle", op: "estVrai" } as const;
    const indice = { type: "flag", flag: "indice", op: "estVrai" } as const;
    expect(evaluateCondition({ type: "et", conditions: [cle, indice] }, { cle: true, indice: true })).toBe(true);
    expect(evaluateCondition({ type: "et", conditions: [cle, indice] }, { cle: true })).toBe(false);
    expect(evaluateCondition({ type: "ou", conditions: [cle, indice] }, { indice: true })).toBe(true);
    expect(evaluateCondition({ type: "non", condition: cle }, {})).toBe(true);
  });

  it("SI clé -> porte secrète SINON cachée", () => {
    const scn = SEED_SCENARIOS[0];
    let play = startPlay(scn);
    const s1 = scn.scenes.find((s) => s.id === "s1")!;
    expect(availableChoices(s1, play.flags).map((c) => c.id)).not.toContain("c1d");
    play = setFlag(play, "cle", true);
    expect(availableChoices(s1, play.flags).map((c) => c.id)).toContain("c1d");
    play = followChoice(scn, play, "c1d");
    expect(play.sceneId).toBe("s3");
  });

  it("choix verrouillé = erreur si forcé", () => {
    const scn = SEED_SCENARIOS[0];
    const play = startPlay(scn);
    expect(() => followChoice(scn, play, "c1d")).toThrow(/Condition/);
  });

  it("chef mort -> antre, indice -> dialogue spécial", () => {
    const scn = SEED_SCENARIOS[0];
    let play = setFlag(startPlay(scn), "chef_mort", true);
    play = followChoice(scn, play, "c1b"); // forêt
    expect(play.sceneId).toBe("s2b");
    play = followChoice(scn, play, "c2b2"); // antre car chef mort
    expect(play.sceneId).toBe("s3");
    expect(describeCondition({ type: "flag", flag: "cle", op: "estVrai" })).toContain("cle");
  });
});
