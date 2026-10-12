import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  ARMES_CONTACT,
  ARMES_DISTANCE,
  CHANCE_PARADE,
  PROPRIETES_CONTACT,
  PROPRIETES_DISTANCE,
  TYPES_ARME_MAGIQUE,
  combinerProjectileArme,
  genererArmeMagique,
  proprieteParade,
} from "@/src/lib/rules/armesMagiques";
import { formaterPlage } from "@/src/lib/rules/objetsMagiques";

/** RNG donnant exactement la face `voulue` sur un dé à `faces` faces. */
const face = (voulue: number, faces: number) => (voulue - 1 + 0.5) / faces;

describe("armes magiques", () => {
  it("type d6 : 1-3 contact, 4-5 distance, 6 sceptre", () => {
    const attentes: Record<number, string> = { 1: "contact", 3: "contact", 4: "distance", 5: "distance", 6: "sceptre" };
    for (const [jet, type] of Object.entries(attentes)) {
      // Bonus 1 : test de propriété toujours raté (1d6 < 1 impossible), parade ratée (50).
      const a = genererArmeMagique(1, fixedRng([face(Number(jet), 6), 0, 0.495, 0.495]));
      expect(a.type).toBe(type);
      expect(a.proprietes).toHaveLength(0);
    }
    const couverts = new Set<number>();
    for (const p of TYPES_ARME_MAGIQUE.plages) {
      for (let i = p.min; i <= p.max; i++) couverts.add(i);
    }
    expect([...couverts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("propriété si 1d6 < bonus (strict) : +1 jamais, +2 sur 1", () => {
    const sans = genererArmeMagique(2, fixedRng([face(1, 6), face(2, 20), face(2, 6), face(50, 100)]));
    expect(sans.jetPropriete).toBe(2);
    expect(sans.proprietes).toHaveLength(0);
    const avec = genererArmeMagique(2, fixedRng([face(1, 6), face(1, 6), face(1, 6), face(1, 12), face(50, 100)]));
    expect(avec.proprietes.map((p) => p.label)).toEqual(["affûtée"]);
    expect(avec.niveauMagie).toBe(3); // 2 + affûtée 1
    expect(avec.jetArme).toBe(2);
    expect(avec.arme).toBe("Bâton");
    expect(avec.label).toBe("Bâton +2 (affûtée)");
  });

  it("table contact 1-12 couverte, distance = miroir (Affûtée → de précision)", () => {
    const couverts = new Set<number>();
    for (const p of PROPRIETES_CONTACT.plages) {
      for (let i = p.min; i <= p.max; i++) couverts.add(i);
    }
    expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(PROPRIETES_DISTANCE.plages.map((p) => `${formaterPlage(p.min, p.max)} ${p.label}`)).toEqual(
      PROPRIETES_CONTACT.plages.map((p) =>
        `${formaterPlage(p.min, p.max)} ${p.sorte === "affutee" ? "De précision" : p.label}`
      )
    );
  });

  it("exemple du livre : +2 de feu intense → niveau 6", () => {
    const a = genererArmeMagique(
      2,
      fixedRng([face(1, 6), face(9, 20), face(1, 6), face(11, 12), face(8, 12), face(8, 12), face(50, 100)])
    );
    expect(a.proprietes).toHaveLength(1);
    expect(a.proprietes[0]).toMatchObject({ sorte: "element", objet: "feu", doublee: true, dmDes: 2, niveau: 4 });
    expect(a.niveauMagie).toBe(6); // 2 + 2 × 2
    expect(a.arme).toBe("Épée longue");
    expect(a.label).toBe("Épée longue +2 (de feu intense)");
  });

  it("11-12 différentes : deux propriétés simples", () => {
    const a = genererArmeMagique(
      2,
      fixedRng([face(1, 6), face(9, 20), face(1, 6), face(11, 12), face(1, 12), face(8, 12), face(50, 100)])
    );
    expect(a.proprietes.map((p) => p.label)).toEqual(["affûtée", "de feu"]);
    expect(a.niveauMagie).toBe(5); // 2 + 1 + 2
    expect(a.label).toBe("Épée longue +2 (affûtée, de feu)");
  });

  it("tables des bases 1-20 couvertes", () => {
    for (const table of [ARMES_CONTACT, ARMES_DISTANCE]) {
      const couverts = new Set<number>();
      for (const e of table.armes) {
        for (let i = e.min; i <= e.max; i++) couverts.add(i);
      }
      expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    }
  });

  it("transcription exacte des bases à distance (image du livre)", () => {
    expect(ARMES_DISTANCE.armes.map((e) => `${formaterPlage(e.min, e.max)} ${e.nom}`)).toEqual([
      "1 Arbalète de poing",
      "2-3 Arbalète légère",
      "4-5 Arbalète lourde",
      "6-7 Arc court",
      "8-9 Arc long",
      "10 Dague",
      "11 Fronde",
      "12 Hachette",
      "13 Javelot",
      "14-15 Carreaux d'arbalète (1d12)",
      "16-17 Flèches (1d12)",
      "18 Billes de fronde (1d12)",
      "19-20 Autre arme",
    ]);
  });

  it("distance : mêmes propriétés, Affûtée → de précision", () => {
    const a = genererArmeMagique(2, fixedRng([face(4, 6), face(8, 20), face(1, 6), face(1, 12)]));
    expect(a.type).toBe("distance");
    expect(a.arme).toBe("Arc long");
    expect(a.proprietes).toMatchObject([{ sorte: "precision", doublee: false, dmDes: 1, critiquePlus: 1, niveau: 1 }]);
    expect(a.niveauMagie).toBe(3);
    expect(a.label).toBe("Arc long +2 (de précision)");
  });

  it("distance doublée : de précision intense", () => {
    const a = genererArmeMagique(
      2,
      fixedRng([face(4, 6), face(8, 20), face(1, 6), face(11, 12), face(1, 12), face(1, 12)])
    );
    expect(a.proprietes.map((p) => p.label)).toEqual(["de précision intense"]);
    expect(a.niveauMagie).toBe(4); // 2 + 2 × 1
    expect(a.label).toBe("Arc long +2 (de précision intense)");
  });

  it("sceptre : bonus magie, DM 1d6, sans propriété", () => {
    const a = genererArmeMagique(2, fixedRng([face(6, 6)]));
    expect(a.type).toBe("sceptre");
    expect(a.jetPropriete).toBeNull();
    expect(a.niveauMagie).toBe(2);
    expect(a.label).toBe("Sceptre de magie +2 (DM 1d6)");
  });

  it("parade : +N DEF simple et cumulable, 10 % au tirage", () => {
    expect(CHANCE_PARADE).toBe(10);
    expect(proprieteParade(2)).toMatchObject({ sorte: "parade", niveau: 2, label: "de parade (+2 DEF)" });
    // Épée longue +2, test raté, d100 = 5 → parade +2 DEF.
    const a = genererArmeMagique(2, fixedRng([face(1, 6), face(9, 20), face(2, 6), face(5, 100)]));
    expect(a.jetParade).toBe(5);
    expect(a.proprietes).toMatchObject([{ sorte: "parade", defense: 2, niveau: 2 }]);
    expect(a.niveauMagie).toBe(4);
    expect(a.label).toBe("Épée longue +2 (de parade (+2 DEF))");
    // Bonus +3 → parade +3 DEF.
    const b = genererArmeMagique(3, fixedRng([face(1, 6), face(9, 20), face(6, 6), face(5, 100)]));
    expect(b.proprietes).toMatchObject([{ sorte: "parade", defense: 3 }]);
    expect(b.niveauMagie).toBe(6);
    // d100 = 50 → pas de parade.
    const c = genererArmeMagique(2, fixedRng([face(1, 6), face(9, 20), face(2, 6), face(50, 100)]));
    expect(c.proprietes).toHaveLength(0);
    expect(c.label).toBe("Épée longue +2");
  });

  it("projectiles : plus haut bonus, +10 m par point du plus faible", () => {
    expect(combinerProjectileArme(4, 2)).toEqual({ bonus: 4, porteePlusM: 20 });
    expect(combinerProjectileArme(2, 2)).toEqual({ bonus: 2, porteePlusM: 20 });
    expect(combinerProjectileArme(1, 3)).toEqual({ bonus: 3, porteePlusM: 10 });
  });
});
