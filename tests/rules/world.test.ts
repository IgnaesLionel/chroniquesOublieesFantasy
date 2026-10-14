import { describe, expect, it } from "vitest";
import { itemSchema, npcSchema } from "@/src/lib/data/validation";
import { SEED_ITEMS, SEED_NPCS } from "@/src/lib/data/worldSeeds";
import { fusionnerCatalogue } from "@/src/lib/store/useCatalogueObjets";

describe("PNJ et objets", () => {
  it("PNJ d'exemple valides", () => {
    expect(SEED_NPCS.length).toBeGreaterThan(0);
    for (const n of SEED_NPCS) {
      expect(() => npcSchema.parse(n)).not.toThrow();
    }
  });

  it("objets d'exemple valides, quantités >= 0", () => {
    expect(SEED_ITEMS.length).toBeGreaterThan(0);
    for (const o of SEED_ITEMS) {
      expect(() => itemSchema.parse(o)).not.toThrow();
      expect(o.quantite).toBeGreaterThanOrEqual(0);
    }
    // Objets magiques : flag non cumulé accepté.
    expect(() => itemSchema.parse({ id: "x", nom: "Anneau +2", categorie: "armure", quantite: 1, exemple: false, bonusDefense: 2, magique: true })).not.toThrow();
  });

  it("clé de quête présente (lien avec le flag cle)", () => {
    expect(SEED_ITEMS.some((o) => o.id === "item-cle" && o.categorie === "quete")).toBe(true);
  });

  it("deux armes à deux mains distinctes (épée + hache, 2d6)", () => {
    expect(SEED_ITEMS.some((o) => o.id === "item-arme-2mains-2d6")).toBe(false);
    const epee = SEED_ITEMS.find((o) => o.id === "item-epee-2mains-2d6")!;
    const hache = SEED_ITEMS.find((o) => o.id === "item-hache-2mains-2d6")!;
    expect(epee.nom).toBe("Épée à deux mains (2d6)");
    expect(hache.nom).toBe("Hache à deux mains (2d6)");
    for (const arme of [epee, hache]) {
      expect(arme.estArme).toBe(true);
      expect(arme.degats).toBe("2d6");
      expect(arme.mains).toBe(2);
    }
    expect(epee.familles).toEqual(["epees"]);
    expect(hache.familles).toEqual(["haches"]);
  });

  it("catalogue fusionné : ids uniques même si le stockage contient déjà un seed", () => {
    const doublon = { ...SEED_ITEMS.find((o) => o.id === "item-cle")!, nom: "Clé (maison)" };
    const catalogue = fusionnerCatalogue(SEED_ITEMS, [doublon]);
    const cles = catalogue.filter((o) => o.id === "item-cle");
    expect(cles).toHaveLength(1);
    // La version maison gagne, sans dupliquer la clé React.
    expect(cles[0].nom).toBe("Clé (maison)");
    const ids = catalogue.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
