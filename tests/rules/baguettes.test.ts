import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  SEUIL_CHARGES_BAGUETTE,
  USAGE_BAGUETTE,
  genererBaguette,
} from "@/src/lib/rules/baguettes";

/** RNG donnant exactement la face `voulue` sur un dé à `faces` faces. */
const face = (voulue: number, faces: number) => (voulue - 1 + 0.5) / faces;

describe("baguettes magiques", () => {
  it("2d20 charges, sort scellé comme un parchemin", () => {
    // Rang 3 (d6=6), air (d20=1) → Télékinésie, charges 1+1.
    const b = genererBaguette("mineur", fixedRng([face(6, 6), face(1, 20), 0, 0, 0]));
    expect(b.rang).toBe(3);
    expect(b.sortNom).toBe("Télékinésie");
    expect(b.jetsCharges).toEqual([1, 1]);
    expect(b.charges).toBe(2);
  });

  it("niveau de magie : moitié sous 30 charges, rang à 30+", () => {
    expect(SEUIL_CHARGES_BAGUETTE).toBe(30);
    // Rang 2, 15+14 = 29 charges → moitié arrondie inf. = 1.
    const sous = genererBaguette("mineur", fixedRng([face(4, 6), face(1, 20), 0, face(15, 20), face(14, 20)]));
    expect(sous.charges).toBe(29);
    expect(sous.niveauMagie).toBe(1);
    // Rang 2, 15+15 = 30 charges → rang.
    const seuil = genererBaguette("mineur", fixedRng([face(4, 6), face(1, 20), 0, face(15, 20), face(15, 20)]));
    expect(seuil.charges).toBe(30);
    expect(seuil.niveauMagie).toBe(2);
    // Rang 1 sous 30 charges → moitié arrondie inf. = 0 (règle du livre).
    const petite = genererBaguette("mineur", fixedRng([face(1, 6), face(1, 20), 0, 0, 0]));
    expect(petite.niveauMagie).toBe(0);
    expect(petite.detail).toMatch(/niveau de magie 0/);
  });

  it("pas de baguettes majeures", () => {
    expect(() => genererBaguette("majeur" as "mineur")).toThrow(/majeur|mineur ou moyen/);
  });

  it("rappel d'usage (lanceurs, niveau, attaque, charges)", () => {
    expect(USAGE_BAGUETTE).toMatch(/action d'attaque/);
    expect(USAGE_BAGUETTE).toMatch(/30 charges/);
    expect(USAGE_BAGUETTE).toMatch(/niveau au moins égal/);
  });
});
