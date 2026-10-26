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

  it("prix des objets existants alignés sur les tables (en pa)", () => {
    const prix: Record<string, number> = {
      "item-arbalete-poing": 8,
      "item-arbalete-legere": 10,
      "item-arbalete-lourde": 15,
      "item-arc": 8,
      "item-arc-court": 4,
      "item-armure-plaque": 60,
      "item-banquet": 10,
      "item-baton": 0,
      "item-baton-ferre": 2,
      "item-bon-repas": 5,
      "item-briquet": 1,
      "item-broigne": 8,
      "item-carquois": 3,
      "item-cervoise-biere": 0.2,
      "item-chemise-mailles": 15,
      "item-cidre-lait": 0.1,
      "item-cotte-mailles": 25,
      "item-corde": 2,
      "item-couteaux-lancer": 3,
      "item-couverture": 1,
      "item-cuir": 4,
      "item-cuir-renforce": 8,
      "item-dague": 3,
      "item-epee": 6,
      "item-epee-longue-1d8": 6,
      "item-epee-2mains-2d6": 10,
      "item-epee-batarde": 9,
      "item-epee-courte": 5,
      "item-epieu": 4,
      "item-fleau": 5,
      "item-fleau-2mains": 8,
      "item-fourrures": 2,
      "item-fronde": 0,
      "item-gourdin": 1,
      "item-grand-bouclier": 4,
      "item-grand-cru": 5,
      "item-grappin": 2,
      "item-hache-1main": 6,
      "item-hache-2mains-2d6": 10,
      "item-hachette": 2,
      "item-huile": 1,
      "item-hydromel-vin": 0.5,
      "item-javelot": 1,
      "item-lance": 4,
      "item-lance-cavalerie": 8,
      "item-lance-pierre": 0.1,
      "item-lanterne": 3,
      "item-marteau": 4,
      "item-masse": 4,
      "item-materiel-ecriture": 5,
      "item-nuit-chambre-4": 1,
      "item-nuit-chambre-individuelle": 2,
      "item-nuit-dortoir": 0.5,
      "item-nuit-suite": 10,
      "item-outils-crochetage": 5,
      "item-petit-bouclier": 2,
      "item-pique": 5,
      "item-plaque-complete": 200,
      "item-potion": 10,
      "item-rapiere": 6,
      "item-ration": 4,
      "item-repas-viande": 1,
      "item-sac-a-dos": 1,
      "item-soupe-pain": 0.1,
      "item-stylet": 1,
      "item-tissu-matelasse": 2,
      "item-torche": 1 / 3,
      "item-torches-lot": 1,
      "item-vivelame": 15,
    };
    for (const [id, valeur] of Object.entries(prix)) {
      expect(SEED_ITEMS.find((o) => o.id === id)?.valeur, id).toBe(valeur);
    }
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
