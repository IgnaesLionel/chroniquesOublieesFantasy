import { describe, expect, it } from "vitest";
import { actionDeAttaque } from "@/src/lib/rules/combat/attack";
import { attaqueFromItem } from "@/src/lib/rules/combat/factory";
import type { Item } from "@/src/lib/rules/world/types";
import { aideAction } from "@/src/lib/ui/actions";

describe("aide économie d'action (combat)", () => {
  it("explique A, M, L, G et l'absence d'action", () => {
    expect(aideAction("attaque")).toContain("mouvement");
    expect(aideAction("mouvement")).toContain("action");
    expect(aideAction("limitee")).toContain("remplace");
    expect(aideAction("gratuite")).toContain("ne consomme");
    expect(aideAction()).toContain("MJ");
  });

  it("force A pour toutes les armes, même avec un marqueur ancien", () => {
    expect(actionDeAttaque({ id: "item:epee", action: "mouvement" })).toBe("attaque");
    expect(actionDeAttaque({ id: "morsure" })).toBe("attaque");
  });

  it("convertit une arme d'inventaire en attaque A", () => {
    const epee: Item = {
      id: "epee",
      nom: "Épée",
      categorie: "arme",
      quantite: 1,
      estArme: true,
      degats: "1d8",
      exemple: false,
    };
    expect(attaqueFromItem(epee)).toMatchObject({ action: "attaque" });
  });

  it("conserve le type d'action des sorts", () => {
    expect(actionDeAttaque({ id: "sort:feu", action: "limitee" })).toBe("limitee");
    expect(actionDeAttaque({ id: "sort:feu" }, { action: "gratuite" })).toBe("gratuite");
  });
});
