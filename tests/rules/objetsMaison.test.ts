import { describe, expect, it } from "vitest";
import { construireObjetMaison } from "@/src/lib/rules/objetsMaison";

describe("créateur manuel d'objets", () => {
  it("arme complète", () => {
    const o = construireObjetMaison(
      {
        nom: "Épée runique", categorie: "arme", bonusAttaque: 4, degats: "1d8+2",
        familles: ["epees"], mains: 1, magique: true, description: "Lame gravée.",
      },
      "custom-test-epee"
    );
    expect(o).toMatchObject({
      id: "custom-test-epee", nom: "Épée runique", categorie: "arme", quantite: 1,
      estArme: true, bonusAttaque: 4, degats: "1d8+2", familles: ["epees"], mains: 1,
      magique: true, exemple: false,
    });
  });

  it("armure : mains déduites de l'emplacement", () => {
    const torse = construireObjetMaison({ nom: "Cotte mithril", categorie: "armure", bonusDefense: 5, emplacement: "torse" }, "x-torse");
    expect(torse).toMatchObject({ mains: 0, emplacement: "torse", bonusDefense: 5 });
    expect(torse.estArme).toBeUndefined();
    const bouclier = construireObjetMaison({ nom: "Targe", categorie: "armure", bonusDefense: 1, emplacement: "bouclier" }, "x-bouclier");
    expect(bouclier).toMatchObject({ mains: 1, emplacement: "bouclier" });
  });

  it("divers : champs d'arme ignorés, défauts appliqués", () => {
    const o = construireObjetMaison({ nom: "Corde", categorie: "divers" }, "x-corde");
    expect(o).toMatchObject({ categorie: "divers", quantite: 1, exemple: false });
    expect(o.estArme).toBeUndefined();
    expect(o.degats).toBeUndefined();
  });

  it("erreurs explicites (nom vide, dégâts invalides)", () => {
    expect(() => construireObjetMaison({ nom: "  ", categorie: "arme" }, "x")).toThrow(/Nom/);
    expect(() => construireObjetMaison({ nom: "Hache", categorie: "arme", degats: "n'importe" }, "x")).toThrow(/Dégâts/);
  });

  it("id généré si absent", () => {
    const o = construireObjetMaison({ nom: "Dague", categorie: "arme" });
    expect(o.id.startsWith("custom-")).toBe(true);
  });
});
