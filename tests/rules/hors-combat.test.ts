import { describe, expect, it } from "vitest";
import type { Character, Sort } from "@/src/lib/rules/types";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  lancerSortHorsCombat,
  sortLancableHorsCombat,
} from "@/src/lib/rules/combat/attack";
import { SEED_SORTS } from "@/src/lib/data/sorts";

function pretre(nom = "Prêtre"): Character {
  return {
    id: `pj-${nom}`,
    kind: "personnage",
    nom,
    classe: "Prêtre",
    niveau: 1,
    pvMax: 20,
    pv: 20,
    defense: 12,
    initMod: 1,
    caracteristiques: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 2, INT: 0, VOL: 2 },
    peuple: "Humain",
    famille: "Mystique",
    profil: "Prêtre",
    attaques: [],
    capacites: [],
    ressources: { mana: { max: 5, actuel: 5 } },
    effets: [],
    inventaire: [],
    sorts: [],
    exemple: false,
  };
}

describe("sorts hors combat", () => {
  it("récupération mineure : lançable hors combat malgré son action d'attaque (DRS A, ignorée hors combat)", () => {
    const sort = SEED_SORTS.find((s) => s.id === "sort-recuperation-mineure")!;
    expect(sort.type).toBe("defensif");
    expect(sort.action).toBe("attaque"); // DRS : A
    expect(sortLancableHorsCombat(sort).ok).toBe(true);
  });

  it("offensif / zone / invocation : refusés hors combat", () => {
    const offensif: Sort = { id: "o", nom: "Foudre", type: "offensif" };
    expect(sortLancableHorsCombat(offensif).ok).toBe(false);
    expect(() => lancerSortHorsCombat(pretre(), pretre("Cible"), offensif)).toThrow(/combat/);

    const zone: Sort = { id: "z", nom: "Armée", type: "utilitaire", zone: true };
    expect(sortLancableHorsCombat(zone).ok).toBe(false);

    const invoc: Sort = {
      id: "i",
      nom: "Invocation",
      type: "utilitaire",
      invocation: { nom: "Démon", pvBase: 0, pvParNiveau: 5, defense: 18, bonusAttaque: "magique", degats: "2d4" },
    };
    expect(sortLancableHorsCombat(invoc).ok).toBe(false);
  });

  it("soin hors combat : PV rendus (plafond pvMax), mana payé, action ignorée", () => {
    const lanceur = pretre();
    const cible = { ...pretre("Blessé"), id: "pj-blesse", pv: 10 };
    const sort: Sort = {
      id: "s",
      nom: "Récupération mineure",
      type: "defensif",
      action: "attaque", // A en combat, ignorée hors combat
      soin: "1d4",
      cout: { ressource: "mana", montant: 1 },
    };
    // 1d4 : 3 PV.
    const { lanceur: l2, cible: c2, resolution } = lancerSortHorsCombat(lanceur, cible, sort, fixedRng([0.5]));
    expect(resolution.soinTotal).toBe(3);
    expect(c2.pv).toBe(13);
    expect(l2.ressources.mana.actuel).toBe(4);
    expect(resolution.manaPaye).toBe(1);
  });

  it("brûlure hors combat : à 0 PM, 1 DR par PM (jamais pour les soins)", () => {
    const lanceur = pretre();
    const cible = pretre("Cible");
    const sort: Sort = { id: "b", nom: "Bouclier", type: "defensif", action: "limitee", cout: { ressource: "mana", montant: 2 } };
    const sec = { ...lanceur, ressources: { mana: { max: 5, actuel: 0 } } };
    // d8 (repli Prêtre/Mystique), rng 0.5 -> 5 par dé = 10 PV (20 -> 10), mana intact.
    const { lanceur: l2, resolution } = lancerSortHorsCombat(sec, cible, sort, fixedRng([0.5]), "brulure");
    expect(resolution.manaPaye).toBe(0);
    expect(resolution.pvBrules).toBe(10);
    expect(resolution.detailsBrulure).toEqual([5, 5]);
    expect(l2.pv).toBe(10);
    expect(l2.ressources.mana.actuel).toBe(0);
    // Interdits : mana restant, sorts de soins.
    expect(() => lancerSortHorsCombat(lanceur, cible, sort, Math.random, "brulure")).toThrow(/0 mana/);
    const soin: Sort = { id: "s", nom: "Soins", type: "defensif", soin: "1d4", cout: { ressource: "mana", montant: 1 } };
    expect(() => lancerSortHorsCombat(sec, cible, soin, Math.random, "brulure")).toThrow(/soins/);
  });

  it("soin sur soi : sacrifice PV puis soin cumulés sur la même fiche", () => {
    const lanceur = { ...pretre(), pv: 15 };
    const sort: Sort = {
      id: "s",
      nom: "Sang",
      type: "defensif",
      soin: "1d4",
      cout: { ressource: "mana", montant: 1 },
      coutPV: "1d4",
    };
    // Sacrifice 1d4 : 3 (15 -> 12), soin 1d4 : 3 (12 -> 15).
    const { lanceur: l2, resolution } = lancerSortHorsCombat(lanceur, lanceur, sort, fixedRng([0.5, 0.5]));
    expect(resolution.pvSacrifie).toBe(3);
    expect(resolution.soinTotal).toBe(3);
    expect(l2.pv).toBe(15);
    expect(l2.ressources.mana.actuel).toBe(4);
  });

  it("niveau et mana vérifiés hors combat", () => {
    const lanceur = pretre();
    const cible = pretre("Cible");
    const haut: Sort = { id: "h", nom: "Gros soin", type: "defensif", rang: 5, soin: "3d4", cout: { ressource: "mana", montant: 5 } };
    expect(() => lancerSortHorsCombat(lanceur, cible, haut)).toThrow(/niveau 7 requis/);
    const cher: Sort = { id: "c", nom: "Cher", type: "defensif", soin: "1d4", cout: { ressource: "mana", montant: 99 } };
    expect(() => lancerSortHorsCombat(lanceur, cible, cher)).toThrow(/insuffisant/);
  });

  it("effet et attaque accordée appliqués hors combat (Aspect du démon)", () => {
    const lanceur = { ...pretre("Sorcier"), caracteristiques: { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 2, VOL: 3 } };
    const cible = pretre("Cible");
    const sort: Sort = {
      id: "as",
      nom: "Aspect du démon",
      type: "utilitaire",
      action: "attaque",
      cout: { ressource: "mana", montant: 4 },
      effetCle: "Aspect du démon",
      effetDuree: null,
      effetMods: { defense: 5 },
      attaqueAccordee: { nom: "Griffes du démon", degats: "1d4°+INT" },
    };
    const { cible: c2, resolution } = lancerSortHorsCombat(lanceur, cible, sort);
    expect(resolution.effetNom).toBe("Aspect du démon");
    expect(c2.effets[0].modificateurs).toMatchObject({ defense: 5 });
    const accordee = c2.attaques.find((a) => a.id === "sort-tmp:as");
    expect(accordee?.degats).toBe("1d4+2");
    expect(resolution.attaqueAccordee).toBe("Griffes du démon");
  });

  it("sort narratif sans soin ni effet : coût payé, effet au MJ", () => {
    const lanceur = pretre();
    const cible = pretre("Cible");
    const sort: Sort = { id: "a", nom: "Augure", type: "utilitaire", action: "limitee", cout: { ressource: "mana", montant: 2 } };
    const { lanceur: l2, resolution } = lancerSortHorsCombat(lanceur, cible, sort);
    expect(l2.ressources.mana.actuel).toBe(3);
    expect(resolution.soinTotal).toBe(0);
    expect(resolution.effetNom).toBeNull();
  });
});
