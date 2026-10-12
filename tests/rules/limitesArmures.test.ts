import { describe, expect, it } from "vitest";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import {
  ECHELLE_ARMURES,
  limiteEffective,
  nomArmureLimite,
  verifierArmurePortee,
} from "@/src/lib/rules/limitesArmures";

describe("port des armures", () => {
  it("échelle DEF 0 à 7", () => {
    expect(ECHELLE_ARMURES.map((e) => e.def)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(nomArmureLimite(5)).toBe("Cotte de mailles");
    // Les seeds couvrent toute l'échelle en torses équipables.
    const torses = SEED_ITEMS.filter((o) => o.categorie === "armure" && o.emplacement !== "bouclier");
    expect(torses.map((o) => o.bonusDefense ?? 0).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("limites de base + extensions de talents", () => {
    expect(limiteEffective("Guerrier", [])).toMatchObject({ limite: 5, bouclier: true });
    expect(limiteEffective("Guerrier", ["Armure lourde"])).toMatchObject({ limite: 6, via: "Armure lourde" });
    expect(limiteEffective("Barbare", ["Tour de force"])).toMatchObject({ limite: 4 });
    expect(limiteEffective("Barbare", ["Tour de force", "Briseur d'os"])).toMatchObject({ limite: 5 });
    expect(limiteEffective("Magicien", [])).toMatchObject({ limite: 0, bouclier: false });
    expect(limiteEffective("Rôdeur", [])).toMatchObject({ limite: 3, bouclier: false });
    expect(limiteEffective("Druide", [])).toMatchObject({ limite: 2, bouclier: true });
    expect(limiteEffective("Profil Inconnu", [])).toBeNull();
  });

  it("torse trop lourd : alerte, extension : silence", () => {
    const guerrier = { profil: "Guerrier", classe: "Guerrier", capacites: [] as string[], inventaire: [{ itemId: "item-armure-plaque", quantite: 1, equipe: true }] };
    const alertes = verifierArmurePortee(guerrier, SEED_ITEMS);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toMatch(/plaque.*dépasse.*Guerrier.*Cotte de mailles/i);
    const autorise = verifierArmurePortee({ ...guerrier, capacites: ["Armure lourde"] }, SEED_ITEMS);
    expect(autorise).toHaveLength(0);
  });

  it("bouclier : interdit sauf profils autorisés", () => {
    const bouclier = [{ itemId: "item-grand-bouclier", quantite: 1, equipe: true }];
    expect(verifierArmurePortee({ profil: "Rôdeur", classe: "Rôdeur", capacites: [], inventaire: bouclier }, SEED_ITEMS)).toHaveLength(1);
    expect(verifierArmurePortee({ profil: "Guerrier", classe: "Guerrier", capacites: [], inventaire: bouclier }, SEED_ITEMS)).toHaveLength(0);
  });

  it("vêtements +0 jamais en faute, non équipé ignoré, magique compté", () => {
    const mage = { profil: "Magicien", classe: "Magicien", capacites: [] as string[] };
    expect(verifierArmurePortee({ ...mage, inventaire: [{ itemId: "item-vetements-tissu", quantite: 1, equipe: true }] }, SEED_ITEMS)).toHaveLength(0);
    expect(verifierArmurePortee({ ...mage, inventaire: [{ itemId: "item-plaque-complete", quantite: 1, equipe: false }] }, SEED_ITEMS)).toHaveLength(0);
    const plaqueMagique = {
      id: "x-plaque", nom: "Plaque +7", categorie: "armure" as const, quantite: 1, exemple: false,
      bonusDefense: 7, mains: 0 as const, emplacement: "torse" as const, magique: true,
    };
    expect(
      verifierArmurePortee({ ...mage, inventaire: [{ itemId: "x-plaque", quantite: 1, equipe: true }] }, [...SEED_ITEMS, plaqueMagique])
    ).toHaveLength(1);
  });
});
