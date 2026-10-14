import { describe, expect, it } from "vitest";
import {
  ARMURE_MODULE_VERS_NOM,
  CATEGORIE_MARTIALE_VERS_FAMILLE,
  DEGAT_MODULE_VERS_DEGAT,
  categoriesMartialesConnues,
  mapperDegatModule,
  mapperFamilleModule,
  nomArmureModule,
} from "@/src/lib/rules/equipementModule";
import { ARME_FAMILLE_KEYS } from "@/src/lib/rules/world/types";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { itemSchema } from "@/src/lib/data/validation";
import { parseDiceExpression, substituerStats } from "@/src/lib/rules/dice/roller";

const FAMILLES: Record<string, string[]> = {
  epees: ["longSword", "shortSword", "bastardSword", "greatSword"],
  estoc: ["swiftblade", "rapier"],
  dagues: ["dagger", "stiletto", "throwingKnife"],
  haches: ["axe", "greatAxe", "throwingAxe"],
  jet: ["javelin", "sling"],
  lances: ["pike", "spear", "lance"],
  masses: ["mace", "hammer", "flail", "greatFlail"],
  gourdins: ["club"],
  batons: ["staff", "ironStaff"],
  arcs: ["shortBow", "longBow"],
  arbaletes: ["lightCrossbow", "heavyCrossbow", "handCrossbow"],
  poudre: ["musket", "handCannon"],
  "mains-nues": ["unarmed"],
};

describe("correspondances module Foundry -> familles conservées", () => {
  it("toutes les catégories martiales du module sont mappées", () => {
    const attendues = Object.values(FAMILLES).flat();
    for (const cat of attendues) {
      expect(mapperFamilleModule(cat)).not.toBeNull();
    }
    expect(categoriesMartialesConnues()).toHaveLength(attendues.length);
    expect(mapperFamilleModule("inconnue")).toBeNull();
    // Familles cibles toutes valides.
    for (const f of Object.values(CATEGORIE_MARTIALE_VERS_FAMILLE)) {
      expect(ARME_FAMILLE_KEYS).toContain(f);
    }
  });

  it("types de dégâts et armures mappés, inconnus -> null", () => {
    expect(DEGAT_MODULE_VERS_DEGAT).toMatchObject({ piercing: "perforant", slashing: "tranchant", impact: "contondant", magic: "autre" });
    expect(mapperDegatModule("zzz")).toBeNull();
    expect(nomArmureModule("chainMail")).toBe("Cotte de mailles");
    expect(nomArmureModule("smallShield")).toBe("Petit bouclier");
    expect(nomArmureModule("zzz")).toBeNull();
    expect(Object.keys(ARMURE_MODULE_VERS_NOM)).toHaveLength(9);
  });

  it("nouveaux seeds du module : ids uniques, schéma valide, dégâts lançables", () => {
    const ids = SEED_ITEMS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    const caracs = { FOR: 2, AGI: 2 };
    for (const o of SEED_ITEMS) {
      expect(() => itemSchema.parse(o), `${o.id} : schéma invalide`).not.toThrow();
      if (o.categorie === "arme") {
        for (const f of o.familles ?? []) {
          expect(ARME_FAMILLE_KEYS, `${o.id} : famille inconnue`).toContain(f);
        }
        expect(() => parseDiceExpression(substituerStats(o.degats ?? "1d6", caracs)), `${o.id} : dégâts invalides`).not.toThrow();
      }
    }
  });
});
