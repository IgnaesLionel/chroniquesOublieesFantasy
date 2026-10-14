import { describe, expect, it } from "vitest";
import { scenarioSchema } from "@/src/lib/data/validation";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import {
  backTo,
  ensurePlayDefaults,
  followChoice,
  gotoScene,
  linkedScenes,
  orphanScenes,
  setFlag,
  setNotes,
  setSceneNote,
  startPlay,
  toggleIndice,
  toggleTerminee,
} from "@/src/lib/rules/scenario/engine";
import { narrationOf, secretsOf, statusOf } from "@/src/lib/rules/scenario/types";

describe("fiches de scène modulables", () => {
  it("seed enrichi : type, narration, actions, secrets, conséquences", () => {
    const scn = SEED_SCENARIOS[0];
    const s1 = scn.scenes.find((s) => s.id === "s1")!;
    expect(s1.type).toBe("narration");
    expect(narrationOf(s1)).toContain("village");
    expect(secretsOf(s1).length).toBeGreaterThan(0);
    expect(s1.actionsPossibles!.length).toBeGreaterThan(0);
    expect(s1.consequences).toBeTruthy();
  });

  it("anciennes données sans type restent valides (repli narration)", () => {
    const legacy = { id: "x", titre: "Vieille scène", texteMJ: "Bonjour", choix: [] };
    const parsed = scenarioSchema.safeParse({
      id: "scn", titre: "T", chapitres: [], scenes: [legacy], exemple: false,
    });
    expect(parsed.success).toBe(true);
    expect(narrationOf(legacy)).toBe("Bonjour");
    expect(statusOf("x", { sceneId: "autre", historique: [], visitees: [], terminees: [] })).toBe("non_visitee");
  });

  it("scènes liées et non linéarité : aller-retour libre", () => {
    const scn = SEED_SCENARIOS[0];
    let play = startPlay(scn);
    play = followChoice(scn, play, "c1a");
    expect(play.sceneId).toBe("s2a");
    expect(play.visitees).toContain("s2a");
    expect(play.decisions!.length).toBe(1);
    // saut libre vers une scène ignorée jusque-là
    play = gotoScene(scn, play, "s2c");
    expect(play.sceneId).toBe("s2c");
    // retour arrière sans perdre l'historique
    const len = play.historique.length;
    play = backTo(scn, play, "s1");
    expect(play.sceneId).toBe("s1");
    expect(play.historique.length).toBe(len + 1);
    expect(linkedScenes(scn, "s1").length).toBe(4);
  });

  it("suivi : terminées, indices, notes, flags corrigibles", () => {
    const scn = SEED_SCENARIOS[0];
    let play = startPlay(scn);
    play = toggleTerminee(play, "s1");
    expect(statusOf("s1", play)).toBe("terminee");
    play = toggleTerminee(play, "s1");
    expect(play.terminees).toEqual([]);
    play = toggleIndice(play, "Traces de gobelins vers la forêt");
    expect(play.indices).toContain("Traces de gobelins vers la forêt");
    play = setSceneNote(play, "s1", "Tobin méfiant");
    play = setNotes(play, "Journal MJ");
    expect(play.notesScenes!["s1"]).toBe("Tobin méfiant");
    expect(play.notes).toBe("Journal MJ");
    // correction d'erreur : changer un flag ne perd ni notes ni historique
    play = setFlag(play, "cle", true);
    play = setFlag(play, "cle", false);
    expect(play.flags["cle"]).toBe(false);
    expect(play.notes).toBe("Journal MJ");
    expect(play.historique.length).toBeGreaterThan(0);
  });

  it("anciennes parties sans nouveaux champs migrent sans perte", () => {
    const scn = SEED_SCENARIOS[0];
    const legacy = { scenarioId: scn.id, sceneId: "s1", historique: ["s1"], flags: { cle: true } };
    const migrated = ensurePlayDefaults(legacy as never);
    expect(migrated.visitees).toContain("s1");
    expect(migrated.indices).toEqual([]);
    expect(migrated.flags["cle"]).toBe(true);
  });

  it("orphelines détectées sans bloquer", () => {
    const scn = SEED_SCENARIOS[0];
    expect(orphanScenes(scn)).toEqual([]);
    const withIso = { ...scn, scenes: [...scn.scenes, { id: "iso", titre: "Isolée", texteMJ: "", choix: [] as never[] }] };
    expect(orphanScenes(withIso as never).map((s) => s.id)).toContain("iso");
  });
});
