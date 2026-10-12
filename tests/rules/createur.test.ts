import { describe, expect, it } from "vitest";
import { compterCapacites, creerPersonnage, etatCreation } from "@/src/lib/rules/creation";
import { traitsInitiaux } from "@/src/lib/data/peuples";
import type { Caracteristiques } from "@/src/lib/rules/personnage";

const CARACS: Caracteristiques = { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 };

describe("créateur de personnage", () => {
  it("crée un Rôdeur niveau 1 prêt à jouer (PV/DEF/init/chance/DR au max)", () => {
    const c = creerPersonnage({
      id: "pj-test",
      nom: "Test",
      peuple: "Demi-Elfe",
      famille: "Aventurier",
      profil: "Rôdeur",
      caracteristiques: CARACS,
      traitsPeuple: traitsInitiaux("Demi-Elfe"),
      talents: ["Archer émérite", "Survie"],
    });
    expect(c.nom).toBe("Test");
    expect(c.niveau).toBe(1);
    expect(c.pv).toBe(c.pvMax);
    expect(c.pvMax).toBe(9); // 8 + CON 1
    expect(c.defense).toBe(13); // 10 + AGI 3
    expect(c.ressources.chance).toEqual({ max: 3, actuel: 3 });
    expect(c.desRecuperation?.actuel).toBe(2);
    expect(etatCreation(c)?.alertes).toEqual([]);
  });

  it("nom vide ou profil vide refusés", () => {
    const base = {
      id: "x", nom: "  ", peuple: "Humain", famille: "Aventurier" as const,
      profil: "Rôdeur", caracteristiques: CARACS, traitsPeuple: [], talents: [],
    };
    expect(() => creerPersonnage(base)).toThrow(/Nom requis/);
    expect(() => creerPersonnage({ ...base, nom: "Ok", profil: " " })).toThrow(/Profil requis/);
  });

  it("un talent-sort crée son entrée lançable (+ mana)", () => {
    const c = creerPersonnage({
      id: "pj-mage",
      nom: "Mage",
      peuple: "Humain",
      famille: "Mage",
      profil: "Sorcier",
      caracteristiques: { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 3 },
      traitsPeuple: traitsInitiaux("Humain"),
      talents: ["Malédiction", "Saignements"],
    });
    expect(c.capacites).toEqual(expect.arrayContaining(["Malédiction"]));
    expect(c.sorts.map((s) => s.nom)).toEqual(expect.arrayContaining(["Malédiction"]));
    expect(c.ressources.mana.max).toBeGreaterThanOrEqual(3);
    expect(compterCapacites(c).restants).toBe(0);
  });
});
