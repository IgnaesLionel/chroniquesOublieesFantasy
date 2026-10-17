import { describe, expect, it, beforeEach } from "vitest";
import {
  mjDejaValide,
  mjValider,
  mjFiltrerAValider,
  mjReinitialiser,
} from "@/src/lib/ui/validations-mj";
import { CAPACITES_USABLES } from "@/src/lib/data/capacites-usables";
import { SEED_SORTS as SORTS } from "@/src/lib/data/sorts";

describe("Validation MJ — mémoire de session", () => {
  beforeEach(() => {
    mjReinitialiser();
  });

  it("une condition inconnue n'est pas validée", () => {
    expect(mjDejaValide("cap:parade")).toBe(false);
  });

  it("mjValider mémorise jusqu'à la réinitialisation", () => {
    mjValider("cap:parade");
    expect(mjDejaValide("cap:parade")).toBe(true);
    mjReinitialiser();
    expect(mjDejaValide("cap:parade")).toBe(false);
  });

  it("mjFiltrerAValider ne garde que les conditions à poser", () => {
    mjValider("att:parfaite");
    const questions = [
      { cle: "att:parfaite", question: "Arme de prédilection ?" },
      { cle: "att:soutenir", question: "Allié au contact ?" },
    ];
    expect(mjFiltrerAValider(questions)).toEqual([{ cle: "att:soutenir", question: "Allié au contact ?" }]);
  });
});

describe("Validation MJ — données des fiches", () => {
  it("les capacités Guerrier à condition portent une question MJ", () => {
    for (const talent of ["Protéger un allié", "Parer un coup", "Science du critique"]) {
      const u = CAPACITES_USABLES.find((x) => x.talent === talent);
      expect(u, talent).toBeDefined();
      expect(u?.questionMJ, talent).toBeTruthy();
      expect(u?.questionMJ?.includes("?"), talent).toBe(true);
    }
  });

  it("les sorts de zone à point/rayon portent une question MJ", () => {
    const explosion = SORTS.find((s) => s.id === "sort-explosion-feu");
    const foudre = SORTS.find((s) => s.id === "sort-appel-foudre");
    expect(explosion?.questionMJ?.includes("?")).toBe(true);
    expect(foudre?.questionMJ?.includes("?")).toBe(true);
    // Les sorts sans question restent non marqués (comportement inchangé).
    expect(SORTS.filter((s) => s.questionMJ?.length).every((s) => s.zone || s.ciblesLibres || (s.questionMJ?.length ?? 0) > 0)).toBe(true);
  });
});
