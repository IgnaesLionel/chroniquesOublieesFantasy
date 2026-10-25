import { describe, expect, it } from "vitest";
import { retirerSexesObsoletes } from "@/src/lib/npcgen/migrations";
import { TABLE_IDS, type ReferenceEntry } from "@/src/lib/npcgen/types";

function entree(
  id: string,
  valeur: string,
  options: { tableId?: string; source?: ReferenceEntry["source"] } = {}
): ReferenceEntry {
  return {
    id,
    tableId: options.tableId ?? TABLE_IDS.sexes,
    valeur,
    tags: [],
    poids: 10,
    actif: true,
    conditions: {},
    meta: {},
    source: options.source ?? "graine",
    createdAt: "",
    updatedAt: "",
  };
}

describe("migration des sexes obsolètes", () => {
  it("retire non-binaire et inconnu des graines de sexe", () => {
    const entries = [
      entree("sexes-masculin", "masculin"),
      entree("sexes-feminin", "feminin"),
      entree("sexes-non-binaire", "non-binaire"),
      entree("sexes-inconnu", "inconnu"),
    ];
    expect(retirerSexesObsoletes(entries).map((e) => e.id)).toEqual([
      "sexes-masculin",
      "sexes-feminin",
    ]);
  });

  it("reconnaît les variantes accentuées ou espacées", () => {
    const entries = [entree("a", "Non binaire"), entree("b", "Inconnue")];
    expect(retirerSexesObsoletes(entries)).toHaveLength(0);
  });

  it("conserve les valeurs créées par le MJ ou hors de la table des sexes", () => {
    const entries = [
      entree("sexes-non-binaire", "non-binaire", { source: "mj" }),
      entree("sexes-inconnu", "inconnu", { source: "import" }),
      entree("autre", "inconnu", { tableId: TABLE_IDS.especes }),
    ];
    expect(retirerSexesObsoletes(entries)).toHaveLength(3);
  });
});
