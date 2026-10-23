import { describe, expect, it } from "vitest";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import type { ContexteRencontre } from "@/src/lib/encounters/types";
import { evaluerModeles } from "@/src/lib/encounters/evaluate";
import { groupeSimplifie } from "@/src/lib/encounters/party";
import { simulerRencontre } from "@/src/lib/encounters/calibration";

function contexte(): ContexteRencontre {
  return {
    type: "bataille",
    terrain: "plaine",
    surprise: "aucune",
    theme: "toutes",
    inclureV1: false,
    inclureHorsDrs: false,
  };
}

function monstre(nom: string) {
  const m = SEED_MONSTERS.find((x) => x.nom === nom);
  if (!m) throw new Error(`Monstre introuvable : ${nom}`);
  return m;
}

describe("simulation et calibration", () => {
  const groupe = groupeSimplifie(4, 1);

  it("renvoie des indicateurs bornés et cohérents", () => {
    const e = evaluerModeles(groupe, [{ monstre: monstre("Gobelin de base"), quantite: 2 }], "normal", contexte());
    const s = simulerRencontre(e, groupe, { iterations: 120, graine: 10 });
    expect(s.iterations).toBe(120);
    expect(s.victoires + s.defaites + s.nuls).toBe(120);
    expect(s.tauxVictoire).toBeGreaterThanOrEqual(0);
    expect(s.tauxVictoire).toBeLessThanOrEqual(1);
    expect(s.tauxVictoire + s.tauxDefaite + s.tauxNul).toBeCloseTo(1, 5);
    expect(s.roundsMoyens).toBeGreaterThanOrEqual(1);
    expect(s.roundsMoyens).toBeLessThanOrEqual(20);
    expect(s.pvPerdusMoyens).toBeGreaterThanOrEqual(0);
    expect(s.koMoyens).toBeGreaterThanOrEqual(0);
    expect(s.koMoyens).toBeLessThanOrEqual(groupe.nombre);
    expect(s.tauxTpk).toBeCloseTo(s.tauxDefaite, 5);
  });

  it("est reproductible avec la même graine", () => {
    const e = evaluerModeles(groupe, [{ monstre: monstre("Gobelin de base"), quantite: 2 }], "normal", contexte());
    const a = simulerRencontre(e, groupe, { iterations: 80, graine: 77 });
    const b = simulerRencontre(e, groupe, { iterations: 80, graine: 77 });
    expect(a).toEqual(b);
  });

  it("un adversaire trivial gagne moins souvent qu'un dragon", () => {
    const facile = evaluerModeles(groupe, [{ monstre: monstre("Gobelin de base"), quantite: 1 }], "facile", contexte());
    const mortel = evaluerModeles(groupe, [{ monstre: monstre("Dragon des forêts"), quantite: 1 }], "boss", contexte());
    const a = simulerRencontre(facile, groupe, { iterations: 150, graine: 3 });
    const b = simulerRencontre(mortel, groupe, { iterations: 150, graine: 3 });
    expect(a.tauxVictoire).toBeGreaterThan(b.tauxVictoire);
    expect(b.tauxDefaite).toBeGreaterThan(0);
  });

  it("un groupe épuisé perd plus de PV qu'un groupe frais", () => {
    const frais = groupeSimplifie(4, 3, { etat: "frais" });
    const epuise = groupeSimplifie(4, 3, { etat: "epuise" });
    const e1 = evaluerModeles(frais, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    const e2 = evaluerModeles(epuise, [{ monstre: monstre("Ogre"), quantite: 1 }], "normal", contexte());
    const s1 = simulerRencontre(e1, frais, { iterations: 120, graine: 4 });
    const s2 = simulerRencontre(e2, epuise, { iterations: 120, graine: 4 });
    expect(s2.pvPerdusPct).toBeGreaterThanOrEqual(s1.pvPerdusPct);
  });
});
