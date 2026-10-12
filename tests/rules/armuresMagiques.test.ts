import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  ARMURES_MAGIQUES,
  PROPRIETES_ARMURES,
  genererArmureMagique,
} from "@/src/lib/rules/armuresMagiques";

/** RNG donnant exactement la face `voulue` sur un dé à `faces` faces. */
const face = (voulue: number, faces: number) => (voulue - 1 + 0.5) / faces;

describe("objets magiques défensifs", () => {
  it("bases 1-20 et propriétés 1-12 couvertes", () => {
    const couvertsBases = new Set<number>();
    for (const e of ARMURES_MAGIQUES.armures) {
      for (let i = e.min; i <= e.max; i++) couvertsBases.add(i);
    }
    expect([...couvertsBases].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const couvertsProps = new Set<number>();
    for (const p of PROPRIETES_ARMURES.plages) {
      for (let i = p.min; i <= p.max; i++) couvertsProps.add(i);
    }
    expect([...couvertsProps].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("base + bonus, propriété si 1d6 < bonus (strict)", () => {
    const sans = genererArmureMagique(2, fixedRng([face(12, 20), face(2, 6)]));
    expect(sans.base).toBe("Cotte de mailles");
    expect(sans.jetPropriete).toBe(2);
    expect(sans.proprietes).toHaveLength(0);
    expect(sans.label).toBe("Cotte de mailles +2");
    expect(sans.niveauMagie).toBe(2);
    const jamais = genererArmureMagique(1, fixedRng([face(12, 20), face(1, 6)]));
    expect(jamais.proprietes).toHaveLength(0);
  });

  it("Protection : RD implicite, niveau +1", () => {
    const a = genererArmureMagique(2, fixedRng([face(12, 20), face(1, 6), face(5, 12)]));
    expect(a.proprietes).toMatchObject([{ sorte: "protection", doublee: false, niveau: 1 }]);
    expect(a.niveauMagie).toBe(3);
    expect(a.label).toBe("Cotte de mailles +2 (Protection)");
  });

  it("12 avec deux défenses → supérieure (RD 4, +2)", () => {
    const a = genererArmureMagique(
      2,
      fixedRng([face(12, 20), face(1, 6), face(12, 12), face(2, 12), face(2, 12)])
    );
    expect(a.proprietes).toMatchObject([{ sorte: "defense", variante: "superieure", niveau: 2 }]);
    expect(a.niveauMagie).toBe(4);
    expect(a.label).toBe("Cotte de mailles +2 (Défense supérieure (RD 4))");
  });

  it("12 différentes : deux propriétés ; défense simple par défaut (MJ)", () => {
    const a = genererArmureMagique(
      2,
      fixedRng([face(1, 20), face(1, 6), face(12, 12), face(1, 12), face(5, 12)])
    );
    expect(a.proprietes.map((p) => p.label)).toEqual(["Action libre", "Protection"]);
    expect(a.niveauMagie).toBe(4);
    expect(a.detail).toMatch(/ou doublée \/ spéciale : MJ/);
  });

  it("résistance : X au choix du MJ", () => {
    const a = genererArmureMagique(2, fixedRng([face(12, 20), face(1, 6), face(7, 12)]));
    expect(a.proprietes).toMatchObject([{ sorte: "resistance-feu", valeur: null, niveau: 1 }]);
    expect(a.label).toBe("Cotte de mailles +2 (Résistance au feu (X : MJ))");
  });
});
