import { describe, expect, it } from "vitest";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import type { ContexteRencontre, DifficulteRencontre } from "@/src/lib/encounters/types";
import { evaluerModeles } from "@/src/lib/encounters/evaluate";
import { groupeSimplifie } from "@/src/lib/encounters/party";

function contexte(partiel: Partial<ContexteRencontre> = {}): ContexteRencontre {
  return {
    type: "bataille",
    terrain: "plaine",
    surprise: "aucune",
    theme: "toutes",
    inclureV1: false,
    inclureHorsDrs: false,
    ...partiel,
  };
}

function monstre(nom: string) {
  const m = SEED_MONSTERS.find((x) => x.nom === nom);
  if (!m) throw new Error(`Monstre introuvable : ${nom}`);
  return m;
}

describe("évaluation d'une rencontre", () => {
  const groupe = groupeSimplifie(4, 3);

  it("calcule le budget Pm et le NR officiel", () => {
    const e = evaluerModeles(groupe, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    expect(e.nombreEnnemis).toBe(1);
    expect(e.pmTotal).toBe(40);
    expect(e.pmNormalise).toBe(40);
    expect(e.nrBudget).toBe(3);
    expect(e.cibleNrRegle).toBe(3);
    expect(e.ecartBudget).toBeCloseTo(0, 5);
    expect(e.dprParti).toBeGreaterThan(0);
    expect(e.dprEnnemis).toBeGreaterThan(0);
    expect(e.estimationRounds).toBeGreaterThan(0);
  });

  it("sépare le budget officiel du NR estimé", () => {
    const e = evaluerModeles(groupe, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    expect(e).toHaveProperty("nrBudget");
    expect(e).toHaveProperty("nrEstime");
    expect(e.nrEstime).not.toBe(e.nrBudget + e.facteurTerrain - e.facteurTerrain);
    expect(e.deltaDanger).toBeCloseTo(e.nrEstime - e.niveauEffectif, 5);
    expect(e.facteurs.some((f) => f.origine === "regle")).toBe(true);
    expect(e.facteurs.some((f) => f.origine === "estimation")).toBe(true);
  });

  it("le terrain sous l'eau augmente le danger", () => {
    const plaine = evaluerModeles(groupe, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    const eau = evaluerModeles(groupe, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte({ terrain: "eau" }));
    expect(eau.nrEstime).toBeGreaterThan(plaine.nrEstime);
    expect(eau.facteurTerrain).toBeGreaterThan(1);
    expect(eau.slots[0].profil.nom).toBe("Ogre");
  });

  it("la surprise ennemie augmente le danger, la surprise des PJ le réduit", () => {
    // Un adversaire déjà très faible sature la borne basse de correction :
    // on prend une rencontre non saturée pour observer l'effet de la surprise.
    const cible = monstre("Géant du feu");
    const aucune = evaluerModeles(groupe, [{ monstre: cible, quantite: 1 }], "normal", contexte());
    const ennemis = evaluerModeles(groupe, [{ monstre: cible, quantite: 1 }], "normal", contexte({ surprise: "ennemis" }));
    const pj = evaluerModeles(groupe, [{ monstre: cible, quantite: 1 }], "normal", contexte({ surprise: "pj" }));
    expect(ennemis.ratioPuissance).toBeGreaterThan(aucune.ratioPuissance);
    expect(pj.ratioPuissance).toBeLessThan(aucune.ratioPuissance);
    expect(ennemis.nrEstime).toBeGreaterThanOrEqual(aucune.nrEstime);
    expect(pj.nrEstime).toBeLessThanOrEqual(aucune.nrEstime);
  });

  it("un groupe épuisé est plus menacé", () => {
    const frais = groupeSimplifie(4, 3, { etat: "frais" });
    const epuise = groupeSimplifie(4, 3, { etat: "epuise" });
    const a = evaluerModeles(frais, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    const b = evaluerModeles(epuise, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    expect(b.nrEstime).toBeGreaterThan(a.nrEstime);
  });

  it("compte les résistances dans les PV effectifs", () => {
    const normal = evaluerModeles(groupe, [{ monstre: monstre("Garde de la ville"), quantite: 1 }], "normal", contexte());
    const resistant = evaluerModeles(groupe, [{ monstre: monstre("Squelette"), quantite: 3 }], "normal", contexte());
    expect(resistant.pvEffectifsEnnemis).toBeGreaterThan(0);
    expect(resistant.slots[0].profil.facteurDegatsSubis).toBeLessThan(normal.slots[0].profil.facteurDegatsSubis);
  });

  it("ne plante pas le NR estimé à 0 sur les faibles niveaux", () => {
    // Le budget DRS est bloqué au plus petit palier (NC 0 = 3 Pm). Sans cela,
    // la correction tactique serait annulée et une rencontre très
    // sous-dimensionnée resterait artificiellement « normale ».
    const faible = groupeSimplifie(4, 1, { etat: "frais" });
    const e = evaluerModeles(faible, [{ monstre: monstre("Gobelin de base"), quantite: 1 }], "normal", contexte());
    expect(e.nrBudget).toBe(0);
    expect(e.nrEstime).toBeLessThan(e.nrBudget);
    expect(e.deltaDanger).toBeLessThan(-1.25);
    expect(e.difficulteEstimee).toBe("facile");
  });

  it("gère une composition vide sans exception", () => {
    const e = evaluerModeles(groupe, [], "normal", contexte());
    expect(e.pmTotal).toBe(0);
    expect(e.nrBudget).toBe(0);
    expect(e.nombreEnnemis).toBe(0);
    expect(e.avertissements.length).toBeGreaterThan(0);
  });

  it("applique la RD ennemie aux dégâts du groupe", () => {
    // Régression : le DPR du groupe était calculé avec rd = 0, en ignorant la
    // réduction de dégâts des fiches. Chimère et Éléphant partagent la même DEF
    // (21) ; seul l'Éléphant a une RD. Le groupe doit donc y faire moins mal.
    const sansRd = evaluerModeles(groupe, [{ monstre: monstre("Chimère"), quantite: 1 }], "normal", contexte());
    const avecRd = evaluerModeles(groupe, [{ monstre: monstre("Éléphant"), quantite: 1 }], "normal", contexte());
    expect(sansRd.slots[0].profil.defense).toBe(avecRd.slots[0].profil.defense);
    expect(sansRd.slots[0].profil.rd).toBe(0);
    expect(avecRd.slots[0].profil.rd).toBeGreaterThan(0);
    expect(avecRd.dprParti).toBeLessThan(sansRd.dprParti);
  });

  it("classe la difficulté estimée avec les bandes documentées", () => {
    const facile: DifficulteRencontre[] = [];
    const options = [
      monstre("Gobelin de base"),
      monstre("Bandit de base"),
      monstre("Ogre"),
      monstre("Dragon des forêts"),
    ];
    for (const m of options) {
      const e = evaluerModeles(groupe, [{ monstre: m, quantite: 1 }], "normal", contexte());
      facile.push(e.difficulteEstimee);
    }
    expect(facile).toContain("facile");
    expect(facile.some((d) => d === "normal" || d === "boss")).toBe(true);
  });
});
