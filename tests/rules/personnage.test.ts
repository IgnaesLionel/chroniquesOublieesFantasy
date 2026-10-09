import { describe, expect, it } from "vitest";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { characterSchema } from "@/src/lib/data/validation";
import {
  ajouterCapacite,
  attaquesBase,
  chanceMax,
  deriverPersonnage,
  drInitial,
  drNombre,
  drType,
  manaMax,
  normaliserPersonnage,
  recalculerPersonnage,
  remettreAZeroPersonnage,
  verifierPersonnage,
} from "@/src/lib/rules/personnage";

describe("COF Fantasy : modèles Personnage (4 fiches + tableau)", () => {
  it("4 PJ valides au schéma", () => {
    expect(SEED_CHARACTERS).toHaveLength(4);
    for (const c of SEED_CHARACTERS) {
      expect(() => characterSchema.parse(c)).not.toThrow();
    }
  });

  it("formules de base", () => {
    expect(attaquesBase(1, { AGI: 1, CON: 1, FOR: -1, PER: 0, CHA: -1, INT: 2, VOL: 4 }))
      .toEqual({ contact: 0, distance: 2, magique: 5 });
    expect(manaMax(4, 0)).toBe(4);
    expect(manaMax(-1, 0)).toBe(0);
    // Chance : 2+CHA sauf Aventurier 3+CHA
    expect(chanceMax(-1, "Sorcier", "Mage")).toBe(1);
    expect(chanceMax(0, "Rôdeur", "Aventurier")).toBe(3);
    expect(chanceMax(4, "Prêtre", "Mystique")).toBe(6);
    expect(chanceMax(0, "Guerrier", "Combattant")).toBe(2);
    // DR : type + nombre 2+CON (+1 Mystique)
    expect(drType("Guerrier", "Combattant")).toBe("d10");
    expect(drType("Rôdeur", "Aventurier")).toBe("d8");
    expect(drType("Prêtre", "Mystique")).toBe("d8");
    expect(drType("Sorcier", "Mage")).toBe("d6");
    expect(drNombre(1, "Sorcier", "Mage")).toBe(3);
    expect(drNombre(1, "Rôdeur", "Aventurier")).toBe(3);
    expect(drNombre(1, "Prêtre", "Mystique")).toBe(4);
    expect(drNombre(3, "Guerrier", "Combattant")).toBe(5);
  });

  it("fiche 1 : Humain / Mage Sorcier", () => {
    const c = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const d = deriverPersonnage(c);
    expect(d.initiative).toBe(10);
    expect(d.defense).toBe(11);
    expect(d.pvMax).toBe(7);
    expect(d.chanceMax).toBe(1);
    expect(d.drType).toBe("d6");
    expect(d.drNombre).toBe(3);
    expect(d.manaMax).toBe(4);
    expect(d.attaques).toEqual({ contact: 0, distance: 2, magique: 5 });
    expect(c.ressources.mana.max).toBe(4);
    expect(verifierPersonnage(c)).toEqual([]);
  });

  it("fiche 2 : Demi-Elfe / Rôdeur", () => {
    const c = SEED_CHARACTERS.find((x) => x.id === "pj-rodeur-demi-elfe")!;
    const d = deriverPersonnage(c);
    expect(d.initiative).toBe(12);
    expect(d.defense).toBe(13);
    expect(d.pvMax).toBe(9);
    expect(d.chanceMax).toBe(3);
    expect(d.drType).toBe("d8");
    expect(d.drNombre).toBe(3);
    expect(d.manaMax).toBe(0);
    expect(d.attaques.contact).toBe(2);
    expect(d.attaques.distance).toBe(4);
    expect(d.attaques.magique).toBe(0); // fiche affiche 1 : écart documenté
  });

  it("fiche 3 : Elfe haut / Prêtre", () => {
    const c = SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut")!;
    const d = deriverPersonnage(c);
    expect(d.initiative).toBe(10);
    expect(d.defense).toBe(10);
    expect(d.pvMax).toBe(9);
    expect(d.chanceMax).toBe(6);
    expect(d.drType).toBe("d8");
    expect(d.drNombre).toBe(4);
    expect(d.manaMax).toBe(2);
    expect(d.attaques).toEqual({ contact: 1, distance: 1, magique: 3 });
    expect(verifierPersonnage(c)).toEqual([]);
  });

  it("fiche 4 : Nain / Guerrier", () => {
    const c = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const d = deriverPersonnage(c);
    expect(d.initiative).toBe(11);
    expect(d.defense).toBe(11);
    expect(d.pvMax).toBe(13); // fiche affiche 14 : écart documenté en note
    expect(d.chanceMax).toBe(2);
    expect(d.drType).toBe("d10");
    expect(d.drNombre).toBe(5);
    expect(d.manaMax).toBe(0);
    expect(d.attaques).toEqual({ contact: 3, distance: 2, magique: 0 });
  });

  it("recalculer synchronise les stockés et conserve les actuels", () => {
    const c = {
      ...SEED_CHARACTERS[0],
      pv: 2,
      defense: 0,
      initMod: 99,
      desRecuperation: { type: "d6" as const, max: 3, actuel: 1 },
    } as typeof SEED_CHARACTERS[0];
    const r = recalculerPersonnage(c);
    expect(r.pvMax).toBe(7);
    expect(r.pv).toBe(2);
    expect(r.defense).toBe(11);
    expect(r.initMod).toBe(0);
    expect(r.ressources.chance.max).toBe(1);
    expect(r.desRecuperation).toEqual({ type: "d6", max: 3, actuel: 1 });
  });

  it("création : DR max selon 2+CON (+1 mystique), réserve initiale 2 (3 mystique)", () => {
    // Sorcier (Mage, CON+1) : 2+1 = 3 max, 2 au départ.
    const sorcier = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    expect(sorcier.desRecuperation).toEqual({ type: "d6", max: 3, actuel: 2 });
    // Prêtre (Mystique, CON+1) : 2+1+1 = 4 max, 3 au départ.
    const pretre = SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut")!;
    expect(pretre.desRecuperation).toEqual({ type: "d8", max: 4, actuel: 3 });
    // Guerrier (Combattant, CON+3) : 2+3 = 5 max, 2 au départ.
    const guerrier = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    expect(guerrier.desRecuperation).toEqual({ type: "d10", max: 5, actuel: 2 });
    // Chance et mana démarrent pleins (prêtre : 6/6 chance, 2/2 mana).
    expect(pretre.ressources.chance).toEqual({ max: 6, actuel: 6 });
    expect(pretre.ressources.mana).toEqual({ max: 2, actuel: 2 });
  });

  it("normaliser + recalculer sans DR : réserve initiale, pas le max", () => {
    const neuf = normaliserPersonnage({
      id: "pj-test", kind: "personnage", nom: "Test", classe: "Prêtre", niveau: 1,
      caracteristiques: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 4, INT: 0, VOL: 2 },
      peuple: "Elfe haut", famille: "Mystique", profil: "Prêtre",
      pvMax: 9, pv: 9, defense: 10, initMod: 0,
      attaques: [], capacites: [], ressources: {}, exemple: false,
    });
    expect(neuf.desRecuperation).toEqual({ type: "d8", max: 4, actuel: 3 });
    const r = recalculerPersonnage(neuf);
    expect(r.desRecuperation).toEqual({ type: "d8", max: 4, actuel: 3 });
  });

  it("drInitial : base sans CON, plafonnée au max si CON négative", () => {
    expect(drInitial(3, "Guerrier", "Combattant")).toBe(2);
    expect(drInitial(1, "Prêtre", "Mystique")).toBe(3);
    expect(drInitial(1, "Sorcier", "Mage")).toBe(2);
    expect(drInitial(-3, "Guerrier", "Combattant")).toBe(0);
  });

  it("idéal / travers : narratifs, recalcul ne les touche pas", () => {
    const c = SEED_CHARACTERS[0];
    const r = recalculerPersonnage({ ...c, idealHeroique: "X", travers: "Y" });
    expect(r.idealHeroique).toBe("X");
    expect(r.travers).toBe("Y");
  });

  it("remise à zéro : PV/chance/mana au max, DR à l'initiale, effets vidés", () => {
    const c = {
      ...SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut")!,
      pv: 2,
      ressources: {
        mana: { max: 2, actuel: 0 },
        chance: { max: 6, actuel: 1 },
      },
      desRecuperation: { type: "d8" as const, max: 4, actuel: 4 },
      effets: [{ id: "e1", nom: "Empoisonné", dureeTours: 3, toursRestants: 3, modificateurs: {} }],
    };
    const r = remettreAZeroPersonnage(c);
    expect(r.pv).toBe(r.pvMax);
    expect(r.ressources.chance).toEqual({ max: 6, actuel: 6 });
    expect(r.ressources.mana).toEqual({ max: 2, actuel: 2 });
    // Prêtre : reset -> 3/4, pas 4/4.
    expect(r.desRecuperation).toEqual({ type: "d8", max: 4, actuel: 3 });
    expect(r.effets).toEqual([]);

    const g = remettreAZeroPersonnage({
      ...SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!,
      pv: 1,
      desRecuperation: { type: "d10" as const, max: 5, actuel: 5 },
    });
    // Guerrier : reset -> 2/5, pas 5/5.
    expect(g.desRecuperation).toEqual({ type: "d10", max: 5, actuel: 2 });
    expect(g.pv).toBe(g.pvMax);
  });

  it("ajouterCapacite : apprend un talent sans doublon, mana inchangé", () => {
    const c = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    expect(c.capacites).not.toContain("Vivacité");
    const r = ajouterCapacite(c, "Vivacité");
    expect(r.capacites).toContain("Vivacité");
    expect(r.ressources.mana).toEqual(c.ressources.mana);
    expect(c.capacites).not.toContain("Vivacité"); // non muté
    const r2 = ajouterCapacite(r, "Vivacité");
    expect(r2.capacites.filter((x) => x === "Vivacité")).toHaveLength(1);
    expect(ajouterCapacite(r, "  ").capacites).toEqual(r.capacites);
  });
});
