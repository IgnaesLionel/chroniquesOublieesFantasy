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

  it("vérification DRS : Chimère/Gorille PV, Ours brun NC, RD renseignées", () => {
    const chimere = SEED_MONSTERS.find((m) => m.id === "notion-nc-7-chimere")!;
    expect(chimere.pvMax).toBe(100); // DRS (la capture VTT affichait 0)
    const gorille = SEED_MONSTERS.find((m) => m.id === "notion-nc-3-gorille")!;
    expect(gorille.pvMax).toBe(30); // DRS (la capture VTT affichait 0)
    const ours = SEED_MONSTERS.find((m) => m.id === "notion-nc-2-ours-brun")!;
    expect(ours.niveau).toBe(4); // VTT + DRS (titre Notion : NC 2)
    // RD du DRS (l'import Notion les laissait à 0 : format « — RD X »).
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-2-demonet")!.rd).toBe(5);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-9-geant-de-feu")!.rd).toBe(6);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-5-troll")!.rd).toBe(3);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-4-vampirien")!.rd).toBe(5);
  });

  it("vérification DRS : Chasseur ailé et Zombie ourhible (créatures DRS ajoutées)", () => {
    const chasseur = SEED_MONSTERS.find((m) => m.id === "notion-chasseur-aile")!;
    expect(chasseur.niveau).toBe(5);
    expect(chasseur.defense).toBe(18);
    expect(chasseur.pvMax).toBe(50);
    expect(chasseur.attaques[0]).toMatchObject({ nom: "Serres", bonus: 10, degats: "2d6+6" });
    expect(chasseur.capacitesPartagees).toContain("enlevement");
    const zomb = SEED_MONSTERS.find((m) => m.id === "notion-zombie-ourhible")!;
    expect(zomb.niveau).toBe(4);
    expect(zomb.defense).toBe(13);
    expect(zomb.pvMax).toBe(85);
    expect(zomb.attaques[0]).toMatchObject({ nom: "Bec et griffes", bonus: 12, degats: "2d8+10" });
    expect(zomb.capacitesPartagees).toEqual(
      expect.arrayContaining(["sans-esprit", "lenteur", "insensible-douleur", "resistance-zombie"]));
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
