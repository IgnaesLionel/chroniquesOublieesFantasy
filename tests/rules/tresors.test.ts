import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  TABLE_TRESORS,
  convertirPa,
  formaterJet,
  formaterRepartition,
  formaterTest,
  genererTresor,
  ligneTresor,
  totalDistribuable,
} from "@/src/lib/rules/tresors";

describe("table des trésors", () => {
  it("29 niveaux (1/2 puis 1 à 28), triés et valides", () => {
    expect(TABLE_TRESORS).toHaveLength(29);
    expect(TABLE_TRESORS[0]).toMatchObject({ niveau: 0.5, label: "1/2" });
    const niveaux = TABLE_TRESORS.map((l) => l.niveau);
    expect([...niveaux].sort((a, b) => a - b)).toEqual(niveaux);
    for (const l of TABLE_TRESORS) {
      for (const gain of [l.monetaire, l.joyauxGain]) {
        expect(gain.des).toBeGreaterThanOrEqual(1);
        expect(gain.faces).toBeGreaterThanOrEqual(1);
        expect(gain.mult).toBeGreaterThanOrEqual(1);
      }
      for (const test of [l.joyauxTest, l.mineur, l.moyen, l.majeur]) {
        if (!test) continue;
        expect(test.seuil).toBeGreaterThanOrEqual(2);
        expect(test.seuil).toBeLessThanOrEqual(20);
        expect(test.essais).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("joyaux automatiques dès le niv. 10, testés avant", () => {
    for (const l of TABLE_TRESORS) {
      if (l.niveau >= 10) expect(l.joyauxTest).toBeNull();
      else expect(l.joyauxTest).not.toBeNull();
    }
  });

  it("niveau inconnu = erreur", () => {
    expect(() => ligneTresor(99)).toThrow(/inconnu/);
  });
});

describe("générateur de trésors", () => {
  it("exemple du livre (niv. 8 : 500 pa, pas de bijoux, 2 mineurs, 0 moyen)", () => {
    // 1d6=5, d20=3 (hors 4-20), mineurs 14 et 17 (2 succès 13+), moyen 13 (échec 17+).
    // Objets : Flèches (1d12) +1 (tests ratés) ; Potion — Invisibilité.
    const rng = fixedRng([0.7, 0.12, 0.66, 0.84, 0.62]);
    const r = genererTresor(8, rng);
    expect(r.label).toBe("8");
    expect(r.monetaire.totalPa).toBe(500);
    expect(r.monetaire.jets).toEqual([5]);
    expect(r.joyaux.present).toBe(false);
    expect(r.joyaux.tests).toEqual([3]);
    expect(r.joyaux.gain).toBeNull();
    const mineur = r.magiques.find((m) => m.type === "mineur")!;
    const moyen = r.magiques.find((m) => m.type === "moyen")!;
    expect(mineur.succes).toBe(2);
    expect(mineur.tests).toEqual([14, 17]);
    expect(moyen.succes).toBe(0);
    expect(r.magiques.some((m) => m.type === "majeur")).toBe(false);
    expect(r.objets.map((o) => o.label)).toEqual(["Flèches (1d12) +1", "Potion — Invisibilité (Magicien)"]);
  });

  it("distribuable = monétaire + joyaux (hors objets magiques)", () => {
    const rng = fixedRng([0.7, 0.12, 0.66, 0.84, 0.62]);
    const r = genererTresor(8, rng);
    expect(totalDistribuable(r)).toBe(500);
    const avecJoyaux = genererTresor(10, fixedRng([0.5, 0.5]));
    expect(totalDistribuable(avecJoyaux)).toBe(
      avecJoyaux.monetaire.totalPa + avecJoyaux.joyaux.gain!.totalPa
    );
  });

  it("niv. 1/2 sans magie, niv. 10+ avec bijoux auto et 3 catégories", () => {    const bas = genererTresor(0.5, fixedRng([0.99, 0.99, 0.99]));
    expect(bas.monetaire.totalPa).toBe(6);
    expect(bas.joyaux.present).toBe(true); // d20 = 20
    expect(bas.magiques).toHaveLength(0);
    const haut = genererTresor(10, fixedRng([0]));
    expect(haut.joyaux.present).toBe(true);
    expect(haut.joyaux.tests).toEqual([]);
    expect(haut.magiques.map((m) => m.type)).toEqual(["mineur", "moyen", "majeur"]);
  });
});

describe("monnaies (100 pa = 10 po = 1 pp)", () => {
  it("convertirPa découpe en pp / po / pa", () => {
    expect(convertirPa(500)).toEqual({ pp: 5, po: 0, pa: 0 });
    expect(convertirPa(140)).toEqual({ pp: 1, po: 4, pa: 0 });
    expect(convertirPa(7)).toEqual({ pp: 0, po: 0, pa: 7 });
  });

  it("formats", () => {
    expect(formaterJet({ des: 1, faces: 6, mult: 1, unite: "pa" })).toBe("1d6 pa");
    expect(formaterJet({ des: 1, faces: 6, mult: 100, unite: "po" })).toBe("1d6 × 100 po");
    expect(formaterTest(null)).toBe("—");
    expect(formaterTest({ seuil: 20, essais: 1 })).toBe("20/1");
    expect(formaterTest({ seuil: 13, essais: 2 })).toBe("13-20/2");
    expect(formaterRepartition({ pp: 5, po: 0, pa: 0 })).toBe("5 pp");
    expect(formaterRepartition({ pp: 1, po: 3, pa: 6 })).toBe("1 pp, 3 po et 6 pa");
  });
});
