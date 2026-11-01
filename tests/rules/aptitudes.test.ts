import { describe, expect, it } from "vitest";
import { CAPACITES } from "@/src/lib/data/capacites";
import { VOIE_MAGE, VOIES_PEUPLE } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import {
  aptitudesSort,
  aptitudesTalent,
  localiserTalent,
  resumeTalent,
} from "@/src/lib/data/aptitudes";

const personnage = (id: string) => SEED_CHARACTERS.find((c) => c.id === id)!;

describe("aptitudes affichées sur la fiche", () => {
  it("conserve les bonus de compétence des exemples du DRS", () => {
    const thornak = personnage("pj-guerrier-nain");
    const vivacite = resumeTalent("Vivacité", thornak);
    expect(vivacite).toBeDefined();
    expect(vivacite).toContain("+3 Init");
    expect(vivacite).toContain("immobilisé");

    const nyssa = personnage("pj-rodeur-demi-elfe");
    const survie = resumeTalent("Survie", nyssa);
    expect(survie).toBeDefined();
    expect(survie).toContain("escalade");
    expect(survie).toContain("survie nature");
  });

  it("affiche les bonus raciaux d'érudition et d'artistiques", () => {
    const isildeen = personnage("pj-pretre-elfe-haut");
    const lumiere = aptitudesTalent(isildeen).find((a) => a.nom === "Lumière intérieure");
    expect(lumiere?.source).toBe("peuple");
    expect(lumiere?.resume).toContain("érudition");
    expect(lumiere?.resume).toContain("artistiques");
  });

  it("distingue les traits de peuple des capacités de la Voie du mage", () => {
    const mae = personnage("pj-sorcier-humain");
    const aptitudes = aptitudesTalent(mae);
    expect(aptitudes.find((a) => a.nom === "Diversité")?.source).toBe("peuple");
    expect(aptitudes.find((a) => a.nom === "Capacité de peuple + occultisme")?.source).toBe("mage");
  });

  it("affiche le rang 1 racial même si l'ancienne fiche ne le liste pas", () => {
    const isildeen = { ...personnage("pj-pretre-elfe-haut"), traitsPeuple: [] };
    const lumiere = aptitudesTalent(isildeen).find((a) => a.nom === "Lumière intérieure");
    expect(lumiere?.source).toBe("peuple");
    expect(lumiere?.resume).toContain("érudition");
  });

  it("liste tous les traits de peuple et talents connus des personnages de départ", () => {
    for (const c of SEED_CHARACTERS) {
      const aptitudes = aptitudesTalent(c);
      const noms = new Set(aptitudes.map((a) => a.nom));
      for (const nom of [...(c.traitsPeuple ?? []), ...(c.capacites ?? [])]) {
        expect(noms.has(nom), `${c.nom} : ${nom} sans fiche affichable`).toBe(true);
      }
    }
  });

  it("donne un résumé à chaque capacité de profil, de peuple et de mage", () => {
    for (const [profil, voies] of Object.entries(CAPACITES)) {
      for (const voie of voies) {
        for (const capacite of voie.capacites) {
          expect(capacite.resume.trim(), `${profil} / ${voie.voie} / ${capacite.nom}`).not.toBe("");
        }
      }
    }
    for (const voie of [...VOIES_PEUPLE, { ...VOIE_MAGE, peuple: "Mage" }]) {
      for (const capacite of voie.capacites) {
        expect(capacite.resume.trim(), `${voie.voie} / ${capacite.nom}`).not.toBe("");
      }
    }
  });

  it("donne une description aux sorts connus et au grimoire", () => {
    for (const sort of SEED_SORTS) {
      expect(sort.description?.trim(), sort.nom).not.toBe("");
    }
    for (const c of SEED_CHARACTERS) {
      for (const sort of aptitudesSort(c)) {
        expect(sort.description.trim(), `${c.nom} / ${sort.nom}`).not.toBe("");
      }
    }
  });

  it("privilégie la version du profil quand un nom existe aussi chez le peuple", () => {
    const nyssa = personnage("pj-rodeur-demi-elfe");
    const archer = localiserTalent("Archer émérite", nyssa);
    expect(archer?.resume).toContain("arc");
    // Le Rôdeur a sa propre version ; le texte ne doit pas être celui du peuple.
    expect(archer?.resume).not.toContain("Arcs courts utilisables quel que soit le profil");
  });
});
