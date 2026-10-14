import { describe, expect, it } from "vitest";
import { sessionSchema } from "@/src/lib/data/validation";
import { validateBackup } from "@/src/lib/store/backup";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { ensureSessionDefaults, progressOf } from "@/src/lib/rules/session/types";
import {
  moveScenario,
  newSession,
  nextScenario,
  prevScenario,
  setCurrent,
  setPlaylist,
  toggleMembre,
  toggleTermine,
  validateSession,
} from "@/src/lib/rules/session/engine";
import { profilScene, resumeScenario } from "@/src/lib/rules/scenario/engine";

describe("sessions : table + campagne multi-scénarios", () => {
  it("création vide puis membres par référence", () => {
    let s = newSession("Table du mardi");
    expect(s.nom).toBe("Table du mardi");
    expect(s.characterIds).toEqual([]);
    s = toggleMembre(s, "c1");
    expect(s.characterIds).toEqual(["c1"]);
    s = toggleMembre(s, "c1");
    expect(s.characterIds).toEqual([]);
  });

  it("playlist ordonnée : ajout, réordre, courant nettoyé", () => {
    let s = newSession("Campagne");
    s = setPlaylist(s, ["a", "b", "a", "c"]);
    expect(s.scenarioIds).toEqual(["a", "b", "c"]);
    expect(s.currentScenarioId).toBe("a");
    s = moveScenario(s, "c", -1);
    expect(s.scenarioIds).toEqual(["a", "c", "b"]);
    s = setPlaylist(s, ["b"]);
    expect(s.currentScenarioId).toBe("b");
    expect(s.terminees).toEqual([]);
  });

  it("courant / précédent / suivant / terminés", () => {
    let s = setPlaylist(newSession("C"), ["s1", "s2", "s3"]);
    expect(prevScenario(s)).toBeNull();
    expect(nextScenario(s)).toBe("s2");
    s = setCurrent(s, "s2");
    expect(prevScenario(s)).toBe("s1");
    expect(nextScenario(s)).toBe("s3");
    s = setCurrent(s, "hors-playlist");
    expect(s.currentScenarioId).toBe("s2");
    s = toggleTermine(s, "s1");
    expect(progressOf(s)).toEqual({ total: 3, termines: 1, indexCourant: 1 });
    s = setCurrent(s, "s3");
    expect(nextScenario(s)).toBeNull();
  });

  it("anciennes sauvegardes migrent sans perte", () => {
    const legacy = { id: "ses-x", nom: "Vieille table" };
    const m = ensureSessionDefaults(legacy as never);
    expect(m.characterIds).toEqual([]);
    expect(m.scenarioIds).toEqual([]);
    expect(m.notes).toBe("");
  });

  it("validation : table vide et références manquantes signalées", () => {
    const vide = newSession("V");
    expect(validateSession(vide)).toContain("Aucun personnage dans la table.");
    expect(validateSession(vide)).toContain("Aucun scénario dans la playlist.");
    const s = setPlaylist(toggleMembre(newSession("T"), "c-ghost"), ["s-ghost"]);
    const avert = validateSession(s, { characters: ["c1"], scenarios: ["s1"] });
    expect(avert.some((a) => a.includes("c-ghost"))).toBe(true);
    expect(avert.some((a) => a.includes("s-ghost"))).toBe(true);
  });

  it("sessions persistées via le backup (round-trip)", () => {
    const s = setPlaylist(toggleMembre(newSession("Backup"), "c1"), ["s1"]);
    const parsed = sessionSchema.safeParse(s);
    expect(parsed.success).toBe(true);
    const { backup, report } = validateBackup({ data: { sessions: [s] } });
    expect(report.imported.sessions).toBe(1);
    expect(backup!.data.sessions).toHaveLength(1);
  });
});

describe("railroad vs embranchements (structurel, sans migration)", () => {
  it("scène : 0 lien = fin, 1 = railroad, 2+ = embranchement", () => {
    expect(profilScene({ choix: [] })).toBe("fin");
    expect(profilScene({ choix: [{ id: "c", label: "L", versSceneId: "x" }] })).toBe("railroad");
    expect(profilScene({ choix: [{ id: "a", label: "A", versSceneId: "x" }, { id: "b", label: "B", versSceneId: "y" }] })).toBe("embranchement");
  });

  it("seed : scénario avec embranchements détecté", () => {
    const r = resumeScenario(SEED_SCENARIOS[0]);
    expect(r.total).toBe(5);
    expect(r.hubs).toBeGreaterThan(0);
    expect(r.label).toBe("avec embranchements");
  });

  it("scénario chaîne pure = railroad", () => {
    const r = resumeScenario({
      scenes: [
        { id: "a", choix: [{ id: "c1", label: "Aller", versSceneId: "b" }] },
        { id: "b", choix: [] },
      ],
    } as never);
    expect(r.label).toBe("railroad");
    expect(r.fins).toBe(1);
  });
});
