import { describe, expect, it } from "vitest";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { groupeDepuisFiches, groupeSimplifie, membreDepuisPersonnage } from "@/src/lib/encounters/party";

describe("profil de groupe", () => {
  it("mode simplifié : effectif, niveau et hypothèses explicites", () => {
    const g = groupeSimplifie(4, 3);
    expect(g.mode).toBe("simplifie");
    expect(g.nombre).toBe(4);
    expect(g.niveauMoyen).toBe(3);
    expect(g.niveauEffectif).toBe(3);
    expect(g.pvTotal).toBeGreaterThan(0);
    expect(g.dpr).toBeGreaterThan(0);
    expect(g.membres).toHaveLength(4);
    expect(g.hypotheses.some((h) => /Mode simplifié/i.test(h))).toBe(true);
    expect(g.hypotheses.some((h) => /PAS des fiches officielles/i.test(h))).toBe(true);
  });

  it("mode simplifié : l'état réduit les PV et les ressources", () => {
    const frais = groupeSimplifie(4, 4, { etat: "frais" });
    const epuise = groupeSimplifie(4, 4, { etat: "epuise" });
    expect(epuise.pvActuel).toBeLessThan(frais.pvActuel);
    expect(epuise.tauxPv).toBeCloseTo(0.4, 1);
    const mageEpuise = epuise.membres.find((m) => m.manaMax > 0);
    const mageFrais = frais.membres.find((m) => m.manaMax > 0);
    expect(mageEpuise?.tauxMana).toBeLessThan(mageFrais?.tauxMana ?? 1);
  });

  it("mode fiches : lit PV, DEF, attaques, sorts et équipement", () => {
    const fiches = SEED_CHARACTERS.slice(0, 4);
    const g = groupeDepuisFiches(fiches, { catalogue: SEED_ITEMS });
    expect(g.mode).toBe("fiches");
    expect(g.nombre).toBe(fiches.length);
    expect(g.pvTotal).toBeGreaterThan(0);
    expect(g.dpr).toBeGreaterThan(0);
    expect(g.bonusAttaqueMoyen).toBeGreaterThan(0);
    expect(g.membres.every((m) => m.attaques.length > 0)).toBe(true);
    expect(g.hypotheses.some((h) => /fiches/i.test(h))).toBe(true);
  });

  it("un personnage isolé conserve ses valeurs de fiche", () => {
    const c = SEED_CHARACTERS[0];
    const m = membreDepuisPersonnage(c, SEED_ITEMS);
    expect(m.nom).toBe(c.nom);
    expect(m.niveau).toBe(c.niveau);
    expect(m.pv).toBeLessThanOrEqual(m.pvMax);
    expect(m.defense).toBeGreaterThanOrEqual(c.defense);
    expect(m.dpr).toBeGreaterThanOrEqual(0);
    expect(m.attaques.length).toBeGreaterThan(0);
  });

  it("groupe vide : aucun crash, niveau effectif nul", () => {
    const g = groupeDepuisFiches([]);
    expect(g.nombre).toBe(0);
    expect(g.niveauEffectif).toBe(0);
    expect(g.pvTotal).toBe(0);
    expect(g.avertissements.length).toBeGreaterThan(0);
  });
});
