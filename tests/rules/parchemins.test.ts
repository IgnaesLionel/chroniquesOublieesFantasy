import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import type { Sort } from "@/src/lib/rules/types";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import {
  RANGS_PARCHEMIN,
  USAGE_PARCHEMIN,
  VOIES_PARCHEMIN,
  genererParchemin,
  rangMaxSortsConnus,
  voieParchemin,
} from "@/src/lib/rules/parchemins";

/** RNG donnant exactement la face `voulue` sur un dé à `faces` faces. */
const face = (voulue: number, faces: number) => (voulue - 1 + 0.5) / faces;

const FAUX_GRIMOIRE: Sort[] = [
  { id: "faux-air-1", nom: "Faux air", type: "utilitaire", voie: "Voie de l'air", rang: 1 },
];

describe("tables de parchemins", () => {
  it("mineur 1-3/4-5/6 → rangs 1/2/3, moyen 1-2/3-4/5-6 → rangs 3/4/5", () => {
    const attentes: Record<"mineur" | "moyen", Record<number, { rang: number; sort: string }>> = {
      mineur: {
        1: { rang: 1, sort: "Murmures dans le vent" },
        2: { rang: 1, sort: "Murmures dans le vent" },
        3: { rang: 1, sort: "Murmures dans le vent" },
        4: { rang: 2, sort: "Sous tension" },
        5: { rang: 2, sort: "Sous tension" },
        6: { rang: 3, sort: "Télékinésie" },
      },
      moyen: {
        1: { rang: 3, sort: "Télékinésie" },
        2: { rang: 3, sort: "Télékinésie" },
        3: { rang: 4, sort: "Foudre" },
        4: { rang: 4, sort: "Foudre" },
        5: { rang: 5, sort: "Forme éthérée" },
        6: { rang: 5, sort: "Forme éthérée" },
      },
    };
    for (const [palier, rangs] of Object.entries(attentes) as ["mineur" | "moyen", Record<number, { rang: number; sort: string }>][]) {
      expect(RANGS_PARCHEMIN[palier].de).toBe(6);
      for (const [jet, a] of Object.entries(rangs)) {
        // d20 = 1 (air, pourvue à tous les rangs) : aucune relance.
        const p = genererParchemin(palier, fixedRng([face(Number(jet), 6), face(1, 20), 0]));
        expect(p.rang).toBe(a.rang);
        expect(p.jetRang).toBe(Number(jet));
        expect(p.voie).toBe("Voie de l'air");
        expect(p.sortNom).toBe(a.sort);
        expect(p.jetsVoie).toEqual([1]);
      }
    }
  });

  it("table d20 : 20 voies, profils lanceurs", () => {
    const couverts = new Set<number>();
    for (const p of VOIES_PARCHEMIN.plages) {
      for (let i = p.min; i <= p.max; i++) couverts.add(i);
    }
    expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(voieParchemin(1)).toMatchObject({ voie: "Voie de l'air", profil: "Ensorceleur" });
    expect(voieParchemin(10)).toMatchObject({ voie: "Voie de la magie universelle", profil: "Magicien" });
    expect(voieParchemin(15)).toMatchObject({ voie: "Voie de la sombre magie", profil: "Sorcier" });
    expect(voieParchemin(19)).toMatchObject({ voie: "Voie de la spiritualité", profil: "Prêtre" });
    expect(voieParchemin(20)).toMatchObject({ voie: "Voie des végétaux", profil: "Druide" });
    expect(() => voieParchemin(21)).toThrow(/1-20/);
  });

  it("astérisque : voie sans sort au rang → relance du d20", () => {
    // Mort (12) sans rang 1 dans le faux grimoire, puis air (1) : 2 tirages.
    const p = genererParchemin("mineur", fixedRng([face(1, 6), face(12, 20), face(1, 20), 0]), FAUX_GRIMOIRE);
    expect(p.jetsVoie).toEqual([12, 1]);
    expect(p.voie).toBe("Voie de l'air");
    expect(p.sortNom).toBe("Faux air");
  });

  it("aucune voie pourvue : le MJ choisit (borne anti-boucle)", () => {
    const p = genererParchemin("mineur", fixedRng([0]), []);
    expect(p.jetsVoie).toHaveLength(20);
    expect(p.voie).toBeNull();
    expect(p.sortNom).toBeNull();
    expect(p.detail).toMatch(/choisir par le MJ/);
  });

  it("le vrai grimoire résout chaque rang 1 à 5", () => {
    const facesRang: [number, "mineur" | "moyen"][] = [
      [1, "mineur"], [4, "mineur"], [6, "mineur"], [3, "moyen"], [5, "moyen"],
    ];
    for (const [jetD6, palier] of facesRang) {
      const p = genererParchemin(palier, fixedRng([face(jetD6, 6), face(1, 20), 0]), SEED_SORTS);
      expect(p.sortNom).not.toBeNull();
    }
  });

  it("pas de parchemins majeurs", () => {
    expect(() => genererParchemin("majeur" as "mineur")).toThrow(/majeur|mineur ou moyen/);
  });

  it("rappel d'usage (lanceurs, difficulté, action limitée)", () => {
    expect(USAGE_PARCHEMIN).toMatch(/action limitée/);
    expect(USAGE_PARCHEMIN).toMatch(/5 × rang/);
    expect(USAGE_PARCHEMIN).toMatch(/10 points/);
  });

  it("rang max des sorts connus (maîtrise pour parchemins)", () => {
    expect(rangMaxSortsConnus([])).toBe(0);
    expect(rangMaxSortsConnus([{ rang: 1 }, { rang: 3 }, {}])).toBe(3);
    expect(rangMaxSortsConnus([{ rang: 2 }])).toBe(2);
  });
});
