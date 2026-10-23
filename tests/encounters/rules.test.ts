import { describe, expect, it } from "vitest";
import {
  classerDifficulte,
  ciblePm,
  CONFIGURATION_PAR_DEFAUT,
  moyenneDegats,
  nrPourPm,
  pmPourNc,
  probabiliteToucher,
  TABLE_PM_DRS,
} from "@/src/lib/encounters/rules";

describe("tables et formules du générateur de rencontres", () => {
  it("table NC → Pm du DRS : paliers connus et monotonie", () => {
    expect(TABLE_PM_DRS["0"]).toBe(3);
    expect(TABLE_PM_DRS["5"]).toBe(100);
    expect(TABLE_PM_DRS["13"]).toBe(700);
    expect(TABLE_PM_DRS["20"]).toBe(2000);
    const cles = Object.keys(TABLE_PM_DRS)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = 1; i < cles.length; i++) {
      expect(TABLE_PM_DRS[String(cles[i])]).toBeGreaterThan(TABLE_PM_DRS[String(cles[i - 1])]);
    }
  });

  it("convertit NC ↔ Pm avec interpolation", () => {
    expect(pmPourNc(0)).toBe(3);
    expect(pmPourNc(5)).toBe(100);
    expect(pmPourNc(13)).toBe(700);
    expect(nrPourPm(100)).toBe(5);
    // Entre deux paliers : interpolation linéaire documentée.
    expect(pmPourNc(1.5)).toBe(15);
    expect(nrPourPm(15)).toBeCloseTo(1.5, 5);
    // Prolongement au-delà du dernier palier : +200 Pm / NC.
    expect(pmPourNc(21)).toBe(2200);
  });

  it("budget ajusté au nombre de PJ (× PJ / 4)", () => {
    expect(ciblePm(5, 4)).toBe(100);
    expect(ciblePm(5, 2)).toBe(50);
    expect(ciblePm(5, 6)).toBe(150);
  });

  it("probabilité de toucher (1d20 + bonus ≥ DEF)", () => {
    expect(probabiliteToucher(10, 15)).toBeCloseTo(0.8, 5);
    expect(probabiliteToucher(0, 20)).toBeCloseTo(0.05, 5);
    expect(probabiliteToucher(30, 10)).toBe(1);
    // 20 naturel touche toujours : plancher à 5 %.
    expect(probabiliteToucher(-5, 25)).toBe(0.05);
  });

  it("moyenne des dés et classification des écarts", () => {
    expect(moyenneDegats("1d6")).toBe(3.5);
    expect(moyenneDegats("2d6+3")).toBe(10);
    expect(moyenneDegats("1d1-1")).toBe(0);
    expect(classerDifficulte(-2)).toBe("facile");
    expect(classerDifficulte(0)).toBe("normal");
    expect(classerDifficulte(1)).toBe("boss");
  });

  it("le boss demande plus de budget qu'une rencontre normale", () => {
    // Régression : avec un décalage de +1, la simulation produisait des boss
    // plus faciles que les rencontres normales (75 % contre 67 % au niveau 8).
    const { decalageNr } = CONFIGURATION_PAR_DEFAUT;
    expect(decalageNr.boss).toBeGreaterThan(1);
    expect(decalageNr.facile).toBeLessThan(decalageNr.normal);
    expect(decalageNr.normal).toBeLessThan(decalageNr.boss);
    // Ordonne les bandes de classement sur le même axe.
    expect(classerDifficulte(decalageNr.boss)).toBe("boss");
  });
});
