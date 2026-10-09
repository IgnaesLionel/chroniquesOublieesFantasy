import { describe, expect, it } from "vitest";
import {
  NOMS_VOIE_MAGE,
  VOIES_PEUPLE,
  VOIE_MAGE,
  VOIE_PAR_PEUPLE,
  adopterVoieMage,
  traitsInitiaux,
  voiePeupleDe,
} from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";

describe("voies du peuple (DRS)", () => {
  it("4 voies du peuple, 5 rangs chacune, sources DRS", () => {
    expect(VOIES_PEUPLE).toHaveLength(4);
    expect(VOIES_PEUPLE.map((v) => v.peuple).sort()).toEqual(
      ["Demi-Elfe", "Elfe haut", "Humain", "Nain"].sort()
    );
    for (const v of VOIES_PEUPLE) {
      expect(v.capacites.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5]);
      expect(v.sourceUrl).toMatch(/^https:\/\/drs\.chroniques-oubliees\.fr\/fantasy\/voies\//);
      for (const c of v.capacites) {
        expect(c.nom.length).toBeGreaterThan(0);
        expect(c.resume.length).toBeGreaterThan(0);
      }
    }
    // Demi-Elfe suit la voie sylvain (fiche : "Demi-Elfe - Elfe sylvain").
    expect(VOIE_PAR_PEUPLE["Demi-Elfe"]).toBe("Voie de l'elfe sylvain");
    expect(voiePeupleDe("Demi-Elfe")?.voie).toBe("Voie de l'elfe sylvain");
    expect(voiePeupleDe("Humain")?.voie).toBe("Voie de l'humain");
    expect(voiePeupleDe("Nain")?.voie).toBe("Voie du nain");
    expect(voiePeupleDe("Elfe haut")?.voie).toBe("Voie de l'elfe haut");
    expect(voiePeupleDe("Gobelin")).toBeUndefined();
  });

  it("Voie du mage : option spéciale, pas un peuple", () => {
    expect(VOIE_MAGE.voie).toBe("Voie du mage");
    expect("peuple" in VOIE_MAGE).toBe(false);
    expect(VOIES_PEUPLE.some((v) => v.voie === "Voie du mage")).toBe(false);
    expect(VOIE_MAGE.capacites.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5]);
    expect(NOMS_VOIE_MAGE.size).toBe(5);
    // Ses 2 sorts sont au grimoire, réservés aux 4 profils Mage.
    for (const sortId of ["sort-maitrise-magie", "sort-tour-magie"]) {
      const sort = SEED_SORTS.find((s) => s.id === sortId);
      expect(sort, `${sortId} manquant au grimoire`).toBeTruthy();
      expect(sort!.voie).toBe("Voie du mage");
      expect([...(sort!.familles ?? [])].sort()).toEqual(
        ["Ensorceleur", "Forgesort", "Magicien", "Sorcier"].sort()
      );
    }
    const capSorts = VOIE_MAGE.capacites.filter((c) => c.sortId).map((c) => c.sortId).sort();
    expect(capSorts).toEqual(["sort-maitrise-magie", "sort-tour-magie"]);
  });

  it("traitsInitiaux : rang 1 du peuple, jamais automatique pour le mage", () => {
    expect(traitsInitiaux("Humain")).toEqual(["Diversité"]);
    expect(traitsInitiaux("Nain")).toEqual(["Habitant des tunnels"]);
    expect(traitsInitiaux("Elfe haut")).toEqual(["Lumière intérieure"]);
    expect(traitsInitiaux("Demi-Elfe")).toEqual(["Lumière des étoiles"]);
    expect(traitsInitiaux("Gobelin")).toEqual([]);
    // Pas d'ajout automatique de la voie du mage : c'est un choix explicite
    // (adopterVoieMage), même en famille Mage.
  });

  it("adopterVoieMage : garde le rang 1 du peuple + rang 1 du mage", () => {
    expect(adopterVoieMage("Humain")).toEqual(["Diversité", "Capacité de peuple + occultisme"]);
    expect(adopterVoieMage("Nain")).toEqual(["Habitant des tunnels", "Capacité de peuple + occultisme"]);
    expect(adopterVoieMage("Gobelin")).toEqual(["Capacité de peuple + occultisme"]);
  });
});
