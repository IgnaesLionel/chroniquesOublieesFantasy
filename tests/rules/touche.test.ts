import { describe, expect, it } from "vitest";
import { createEffect } from "@/src/lib/rules/effects/effects";
import { composantesAttaque, probabiliteToucher, seuilDefense } from "@/src/lib/rules/combat/touche";

describe("probabilité de toucher", () => {
  it("d20 + bonus contre DEF, 1 naturel toujours raté", () => {
    // DEF 11, bonus 0 : 11..20 touchent (10 faces), le 1 rate déjà.
    expect(probabiliteToucher(0, 11)).toBeCloseTo(0.5);
    // DEF 2 : toutes les faces sauf le 1.
    expect(probabiliteToucher(0, 2)).toBeCloseTo(0.95);
  });

  it("plancher et plafond par les jets naturels", () => {
    // DEF 22 : seul le 20 naturel touche.
    expect(probabiliteToucher(0, 22)).toBeCloseTo(0.05);
    // DEF 0 : seul le 1 naturel rate.
    expect(probabiliteToucher(0, 0)).toBeCloseTo(0.95);
  });

  it("dé bonus (garde le meilleur) et dé malus (garde le pire)", () => {
    expect(probabiliteToucher(0, 11, "bonus")).toBeCloseTo(0.75); // 1 - 0,5²
    expect(probabiliteToucher(0, 11, "malus")).toBeCloseTo(0.25); // 0,5²
  });

  it("seuil de critique 19 : le 19 naturel touche aussi", () => {
    // Bonus très faible : sans critique, seul le 20 passe (5 %).
    expect(probabiliteToucher(-10, 30)).toBeCloseTo(0.05);
    expect(probabiliteToucher(-10, 30, null, 19)).toBeCloseTo(0.1);
  });

  it("un bonus élevé reste plafonné par le 1 naturel", () => {
    expect(probabiliteToucher(30, 10)).toBeCloseTo(0.95);
  });
});

describe("bonus d'attaque effectif", () => {
  it("additionne fiche, effets, situation et prédilection", () => {
    const c = composantesAttaque(
      { effets: [createEffect("Bénédiction", { modificateurs: { attaque: 2 } })], famillePredilection: "epees" },
      { bonus: 7, familles: ["epees"] },
      { modAttaque: -3, arme: true }
    );
    expect(c).toEqual({ base: 7, modEffets: -1, modDistance: 0, predilection: 1, bonus: 7 });
  });

  it("n'applique pas la prédilection hors attaque d'arme", () => {
    const c = composantesAttaque(
      { effets: [], famillePredilection: "epees" },
      { bonus: 7, familles: ["epees"] },
      { arme: false }
    );
    expect(c.predilection).toBe(0);
    expect(c.bonus).toBe(7);
  });

  it("ajoute le malus à distance des effets (aveuglé)", () => {
    const c = composantesAttaque(
      { effets: [createEffect("Aveuglé", { modificateurs: { attaqueDistance: -5 } })] },
      { bonus: 5, familles: ["arcs"] },
      { distance: true }
    );
    expect(c.modDistance).toBe(-5);
    expect(c.bonus).toBe(0);
  });

  it("bonusOverride remplace le bonus de la fiche (Attaque éclair)", () => {
    const c = composantesAttaque({ effets: [] }, { bonus: 3 }, { bonusOverride: 9 });
    expect(c.base).toBe(9);
    expect(c.bonus).toBe(9);
  });
});

describe("seuil de défense", () => {
  it("applique les modificateurs d'effets de la cible", () => {
    expect(seuilDefense({ defense: 15, effets: [] })).toBe(15);
    expect(
      seuilDefense({
        defense: 15,
        effets: [createEffect("Défense partielle", { modificateurs: { defense: 3 } })],
      })
    ).toBe(18);
  });

  it("une difficulté fixe remplace la DEF", () => {
    expect(seuilDefense({ defense: 15, effets: [] }, 12)).toBe(12);
  });
});
