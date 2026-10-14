import { describe, expect, it } from "vitest";
import { optionsProprieteArme, texteEffetProprieteArme } from "@/src/lib/rules/armesMagiques";
import { decrireProprieteArmure, optionsProprieteArmure, reduireDegatsResistance } from "@/src/lib/rules/armuresMagiques";
import { construireObjetMaison } from "@/src/lib/rules/objetsMaison";
import { ajouterAInventaire } from "@/src/lib/rules/equipement";
import { filtrerCatalogue } from "@/src/components/tresors/CatalogueObjets";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";

describe("propriétés prédéfinies du créateur", () => {
  it("armes : tables contact/distance + parade, sans tirage double", () => {
    const opts = optionsProprieteArme();
    const valeurs = opts.map((o) => o.valeur);
    expect(valeurs).toContain("affutee");
    expect(valeurs).toContain("precision");
    expect(valeurs).toContain("element:feu");
    expect(valeurs).toContain("element:froid");
    expect(valeurs).toContain("element:foudre");
    expect(valeurs).toContain("fleau:démons");
    expect(valeurs).toContain("parade");
    expect(valeurs.some((v) => v.includes("double"))).toBe(false);
  });

  it("armes : textes d'effet MJ", () => {
    expect(texteEffetProprieteArme("affutee")?.effet).toMatch(/critique/);
    expect(texteEffetProprieteArme("element:feu")).toMatchObject({ label: "Feu" });
    expect(texteEffetProprieteArme("fleau:démons")?.effet).toMatch(/démons/);
    expect(texteEffetProprieteArme("parade", 2)?.effet).toMatch(/\+2 DEF/);
    expect(texteEffetProprieteArme("inexistant")).toBeNull();
  });

  it("armures : 11 propriétés (12 = tirage MJ) + variantes", () => {
    const opts = optionsProprieteArmure();
    expect(opts).toHaveLength(11);
    expect(opts[0].label).toMatch(/^1 — /);
    expect(decrireProprieteArmure("defense", "superieure").label).toMatch(/supérieure/);
    expect(decrireProprieteArmure("resistance-feu").effet).toMatch(/−20 % aux DM de feu/);
    expect(decrireProprieteArmure("ombre").effet).toMatch(/discrétion/);
  });

  it("créateur : effet de combat connu accepté, inconnu rejeté", () => {
    const o = construireObjetMaison(
      { nom: "Dague empoisonnée", categorie: "arme", effetCle: "empoisonne", effetDuree: 3 },
      "x-dague-effet"
    );
    expect(o).toMatchObject({ effetCle: "empoisonne", effetDuree: 3 });
    expect(() => construireObjetMaison({ nom: "X", categorie: "arme", effetCle: "zzz" }, "x-ko")).toThrow(/inconnu/);
    expect(() => construireObjetMaison({ nom: "X", categorie: "arme", effetCle: "empoisonne", effetDuree: 0 }, "x-duree")).toThrow(/Durée/);
  });

  it("résistance maison : −20 %, arrondi inférieur", () => {
    expect(reduireDegatsResistance(10)).toBe(8);
    expect(reduireDegatsResistance(9)).toBe(7);
    expect(reduireDegatsResistance(1)).toBe(0);
    expect(reduireDegatsResistance(0)).toBe(0);
  });

  it("don : fusion des quantités, non équipé", () => {
    const vide = ajouterAInventaire([], "item-epee", 1);
    expect(vide).toEqual([{ itemId: "item-epee", quantite: 1, equipe: false }]);
    const fusion = ajouterAInventaire(vide, "item-epee", 2);
    expect(fusion).toEqual([{ itemId: "item-epee", quantite: 3, equipe: false }]);
  });

  it("recherche catalogue : nom insensible casse/accents, combinée aux filtres", () => {
    const tout = { recherche: "", categorie: "toutes", famille: "toutes" } as const;
    expect(filtrerCatalogue(SEED_ITEMS, tout)).toHaveLength(SEED_ITEMS.length);
    const cles = filtrerCatalogue(SEED_ITEMS, { ...tout, recherche: "cle" });
    expect(cles.map((o) => o.id)).toContain("item-cle");
    const majuscules = filtrerCatalogue(SEED_ITEMS, { ...tout, recherche: "POTION" });
    expect(majuscules.map((o) => o.id)).toContain("item-potion");
    const combine = filtrerCatalogue(SEED_ITEMS, { recherche: "epee", categorie: "arme", famille: "toutes" });
    expect(combine.length).toBeGreaterThan(0);
    expect(combine.every((o) => o.categorie === "arme")).toBe(true);
    const aucun = filtrerCatalogue(SEED_ITEMS, { ...tout, recherche: "zzz-introuvable" });
    expect(aucun).toEqual([]);
  });
});
