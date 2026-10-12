import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  CATEGORIES_OBJETS_MAGIQUES,
  TYPES_OBJETS_MAGIQUES,
  formaterPlage,
  genererObjetMagique,
  objetTresorVersItem,
  tirerObjetsMagiques,
  type PalierMagique,
} from "@/src/lib/rules/objetsMagiques";

/** RNG donnant exactement la face `face` sur un dé à `faces` faces. */
const face = (faceVoulue: number, faces: number) => (faceVoulue - 1 + 0.5) / faces;

describe("tables d'objets magiques", () => {
  it("couverture complète 1-12 (types) et 1-6 / 1-12 (catégories)", () => {
    for (const palier of ["mineur", "moyen", "majeur"] as PalierMagique[]) {
      const couverts = new Set<number>();
      for (const p of TYPES_OBJETS_MAGIQUES[palier].plages) {
        for (let i = p.min; i <= p.max; i++) couverts.add(i);
        if (p.sorte === "niveau") expect(p.niveau).toBeGreaterThanOrEqual(1);
        else expect(p.niveau).toBeNull();
      }
      expect([...couverts].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      const de = CATEGORIES_OBJETS_MAGIQUES[palier].de;
      const couvertsCat = new Set<number>();
      for (const p of CATEGORIES_OBJETS_MAGIQUES[palier].plages) {
        for (let i = p.min; i <= p.max; i++) couvertsCat.add(i);
      }
      expect([...couvertsCat].sort((a, b) => a - b)).toEqual(Array.from({ length: de }, (_, i) => i + 1));
    }
    expect(CATEGORIES_OBJETS_MAGIQUES.mineur.de).toBe(6);
  });

  it("type mineur face par face (potions avec contenu tiré)", () => {
    const attendu: Record<number, { label: string; categorie: boolean }> = {
      1: { label: "Potion — Soins légers (Prêtre)*", categorie: false },
      4: { label: "Potion — Soins légers (Prêtre)*", categorie: false },
      5: { label: "Parchemin — « Murmures dans le vent » (Voie de l'air, rang 1)", categorie: false },
      7: { label: "Baguette magique — « Murmures dans le vent » (Voie de l'air, rang 1, 2 charges)", categorie: false },
      8: { label: "Arbalète de poing +1", categorie: true },
      12: { label: "Objet de pouvoir niveau 2", categorie: true },
    };
    for (const [f, a] of Object.entries(attendu)) {
      // Tirages explicites : d12, d6 (rang / catégorie), d20 (voie/base), choix, parade.
      const seq =
        Number(f) === 5
          ? [face(5, 12), 0, face(1, 20), 0] // parchemin rang 1, voie de l'air
          : Number(f) === 7
            ? [face(7, 12), 0, face(1, 20), 0, 0, 0] // baguette rang 1, air, 2 charges
            : Number(f) === 8
              ? [face(8, 12), face(1, 6), face(4, 6), face(1, 20), face(4, 6), face(50, 100)] // arbalète +1, sans parade
              : [face(Number(f), 12), Number(f) === 12 ? 0.99 : 0];
      const o = genererObjetMagique("mineur", fixedRng(seq));
      expect(o.label).toBe(a.label);
      expect(o.jetCategorie !== null).toBe(a.categorie);
    }
    const potion = genererObjetMagique("mineur", fixedRng([face(1, 12), 0]));
    expect(potion.nature).toBe("potion");
    expect(potion.contenuPotion?.nom).toBe("Soins légers (Prêtre)*");
  });

  it("moyen : potion triple dose au contenu unique", () => {
    const potion = genererObjetMagique("moyen", fixedRng([face(1, 12), face(5, 6), face(9, 10)]));
    expect(potion.label).toBe("Potion (3 doses) — Invisibilité (Magicien)");
    expect(potion.doses).toBe(3);
    expect(potion.contenuPotion?.categorie).toBe("commune");
  });

  it("moyen : potion triple dose, majeur : niveaux 3 à 5 sans consommable", () => {
    const potion = genererObjetMagique("moyen", fixedRng([face(1, 12)]));
    expect(potion.label).toBe("Potion (3 doses) — Soins légers (Prêtre)*");
    expect(potion.doses).toBe(3);
    expect(potion.niveau).toBeNull();
    // Majeur : toutes les faces donnent un niveau 3, 4 ou 5.
    for (let f = 1; f <= 12; f++) {
      const o = genererObjetMagique("majeur", fixedRng([face(f, 12), 0]));
      expect(o.niveau).toBeGreaterThanOrEqual(3);
      expect(o.niveau).toBeLessThanOrEqual(5);
    }
    const arme3 = genererObjetMagique("majeur", fixedRng([face(2, 12), face(1, 12)]));
    expect(arme3.label).toBe("Maniques (mains nues) +3 (affûtée)");
    expect(arme3.contenuArme?.niveauMagie).toBe(4); // 3 + affûtée 1
    const puissance4 = genererObjetMagique("majeur", fixedRng([face(5, 12), face(8, 12), face(5, 12), 0.25]));
    expect(puissance4.nature).toBe("puissance");
    expect(puissance4.label).toBe("Robe de charisme (CHA +1)");
    expect(puissance4.contenuPuissance?.carac).toBe("CHA");
  });

  it("moyen : arme magique câblée (bonus = niveau)", () => {    // d12 = 12 → niveau 2, d6 = 1 → arme, contact, Épée courte, test raté (2 < 2 faux).
    const o = genererObjetMagique("mineur", fixedRng([face(12, 12), face(1, 6), face(1, 6), face(6, 20), face(2, 6)]));
    expect(o.nature).toBe("arme");
    expect(o.label).toBe("Épée courte +2");
    expect(o.contenuArme?.bonus).toBe(2);
    expect(o.contenuArme?.niveauMagie).toBe(2);
  });

  it("mineur : armure magique câblée (bonus = niveau, supposition)", () => {
    // d12 = 12 → niveau 2, d6 = 3 → armure, d20 = 12 → cotte, test raté.
    const o = genererObjetMagique("mineur", fixedRng([face(12, 12), face(3, 6), face(12, 20), face(2, 6)]));
    expect(o.nature).toBe("armure");
    expect(o.label).toBe("Cotte de mailles +2");
    expect(o.contenuArmure?.bonus).toBe(2);
    expect(o.contenuArmure?.niveauMagie).toBe(2);
  });

  it("moyen : puissance câblée (FOR +1)", () => {
    // d12 = 5 → niveau 2, d12 = 7 → puissance, d12 = 3 → FOR, d2 = 1.
    const o = genererObjetMagique("moyen", fixedRng([face(5, 12), face(7, 12), face(3, 12), 0.25]));
    expect(o.nature).toBe("puissance");
    expect(o.label).toBe("Ceinture de force (FOR +1)");
    expect(o.contenuPuissance?.carac).toBe("FOR");
    expect(o.contenuPuissance?.bonus).toBe(1);
  });

  it("palier inconnu = erreur, tirages multiples", () => {
    expect(() => genererObjetMagique("légendaire" as PalierMagique)).toThrow(/inconnu/);
    const lot = tirerObjetsMagiques("mineur", 3, fixedRng([0]));
    expect(lot).toHaveLength(3);
    expect(tirerObjetsMagiques("mineur", 0)).toHaveLength(0);
  });

  it("formats", () => {
    expect(formaterPlage(7, 7)).toBe("7");
    expect(formaterPlage(8, 11)).toBe("8-11");
  });
});

describe("trésor vers inventaire (attribution)", () => {
  const FOR = 2;
  it("potion : contenu + doses", () => {
    const o = genererObjetMagique("mineur", fixedRng([face(1, 12), 0]));
    expect(o.nature).toBe("potion");
    const item = objetTresorVersItem(o, FOR, "x-pot");
    expect(item).toMatchObject({ id: "x-pot", categorie: "potion", magique: true, exemple: false });
    expect(item.nom).toMatch(/^Potion — /);
    expect(item.effet).toMatch(/Soins légers/);
  });
  it("parchemin : sort, rang, voie et usage", () => {
    const o = genererObjetMagique("mineur", fixedRng([face(5, 12), 0, face(1, 20), 0]));
    const item = objetTresorVersItem(o, FOR, "x-par");
    expect(item.categorie).toBe("outil");
    expect(item.nom).toContain("Murmures dans le vent");
    expect(item.effet).toMatch(/action limitée/);
  });
  it("baguette : charges et niveau", () => {
    const o = genererObjetMagique("mineur", fixedRng([face(7, 12), 0, face(1, 20), 0, 0, 0]));
    const item = objetTresorVersItem(o, FOR, "x-bag");
    expect(item.effet).toMatch(/2 charges/);
  });
  it("arme contact : bonus, DM base + FOR + bonus", () => {
    // Épée longue +2 affûtée, FOR +2 → 1d8+4.
    const o = genererObjetMagique("mineur", fixedRng([face(12, 12), face(1, 6), face(1, 6), face(9, 20), face(1, 6), face(1, 12), face(50, 100)]));
    expect(o.contenuArme?.arme).toBe("Épée longue");
    const item = objetTresorVersItem(o, FOR, "x-epee");
    expect(item).toMatchObject({ categorie: "arme", estArme: true, bonusAttaque: 2, degats: "1d8+4", mains: 1, magique: true });
    expect(item.effet).toMatch(/affûtée/);
  });
  it("arme distance : sans FOR ; base inconnue : 1d6 par défaut", () => {
    const o = genererObjetMagique("mineur", fixedRng([face(8, 12), face(1, 6), face(4, 6), face(1, 20), face(4, 6), face(50, 100)]));
    expect(o.contenuArme?.arme).toBe("Arbalète de poing");
    const item = objetTresorVersItem(o, FOR, "x-arb");
    expect(item).toMatchObject({ degats: "1d6+1", mains: 2 });
    expect(item.effet).toMatch(/vérifiez/);
  });
  it("armure : emplacement bouclier / torse / accessoire", () => {
    const bouclier = genererObjetMagique("mineur", fixedRng([face(12, 12), face(4, 6), face(19, 20), face(6, 6)]));
    expect(bouclier.contenuArmure?.base).toBe("Grand bouclier");
    expect(objetTresorVersItem(bouclier, FOR, "x-b").emplacement).toBe("bouclier");
    const anneau = genererObjetMagique("mineur", fixedRng([face(12, 12), face(4, 6), face(1, 20), face(6, 6)]));
    expect(anneau.contenuArmure?.base).toBe("Anneau ou cape de protection");
    const itemAnneau = objetTresorVersItem(anneau, FOR, "x-a");
    expect(itemAnneau.emplacement).toBe("accessoire");
    expect(itemAnneau.bonusDefense).toBe(2);
    expect(itemAnneau.magique).toBe(true);
  });
  it("pouvoir et puissance descriptifs", () => {
    const pouvoir = genererObjetMagique("mineur", fixedRng([face(12, 12), face(6, 6)]));
    expect(pouvoir.nature).toBe("pouvoir");
    const itemPouvoir = objetTresorVersItem(pouvoir, FOR, "x-p");
    expect(itemPouvoir.categorie).toBe("divers");
    expect(itemPouvoir.effet).toMatch(/1\/jour/);
    const puissance = genererObjetMagique("moyen", fixedRng([face(5, 12), face(7, 12), face(3, 12), 0.25]));
    const itemPuissance = objetTresorVersItem(puissance, FOR, "x-pu");
    expect(itemPuissance.effet).toMatch(/\+1 FOR/);
  });
});
