import { describe, expect, it } from "vitest";
import {
  analyserCsv,
  creerEntree,
  dupliquerEntree,
  dupliquerTable,
  exporterEntreesCsv,
  idUnique,
  identifiantLisible,
  importerEntreesCsv,
  importerEntreesJson,
} from "@/src/lib/npcgen/operations";
import { SEED_ENTRIES, SEED_TABLES } from "@/src/lib/npcgen/seeds";
import { TABLE_IDS, type ReferenceEntry } from "@/src/lib/npcgen/types";

const tableEspeces = SEED_TABLES.find((t) => t.id === TABLE_IDS.especes)!;
const tableLieux = SEED_TABLES.find((t) => t.id === TABLE_IDS.lieux)!;

describe("opérations de référence", () => {
  it("génère des identifiants lisibles et uniques", () => {
    expect(identifiantLisible("  Élève-mage de la Tour  ")).toBe("eleve-mage-de-la-tour");
    expect(idUnique("abc", [])).toBe("abc");
    expect(idUnique("abc", [{ id: "abc" }, { id: "abc-2" }])).toBe("abc-3");
  });

  it("crée une entrée nettoyée et propre au MJ", () => {
    const entree = creerEntree(
      {
        tableId: TABLE_IDS.especes,
        valeur: "  Homme-lézard  ",
        description: "  Peuple des marais  ",
        tags: ["marais"],
        poids: -4,
      },
      SEED_ENTRIES
    );
    expect(entree.id).toBe("especes-homme-lezard");
    expect(entree.valeur).toBe("Homme-lézard");
    expect(entree.description).toBe("Peuple des marais");
    expect(entree.poids).toBe(0);
    expect(entree.source).toBe("mj");
    expect(entree.createdAt).not.toBe("");
  });

  it("duplique une entrée et une table sans collision", () => {
    const source = SEED_ENTRIES.find((e) => e.tableId === TABLE_IDS.especes)!;
    const copie = dupliquerEntree(source, SEED_ENTRIES);
    expect(copie.id).not.toBe(source.id);
    expect(copie.valeur).toBe(`${source.valeur} (copie)`);
    expect(copie.source).toBe("mj");

    const table = dupliquerTable(tableEspeces, SEED_TABLES);
    expect(table.id).toBe(`${tableEspeces.id}-copie`);
    expect(table.nom).toContain("(copie)");
  });

  it("analyse un CSV avec guillemets, virgules et retours à la ligne", () => {
    const lignes = analyserCsv('a,b,c\r\n"un, deux","il a dit ""oui""","ligne\nsuivante"\r\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toEqual(["un, deux", 'il a dit "oui"', "ligne\nsuivante"]);
  });

  it("exporte puis réimporte les entrées sans perte", () => {
    const entrees: ReferenceEntry[] = [
      {
        ...SEED_ENTRIES.find((e) => e.tableId === TABLE_IDS.lieux)!,
        id: "lieux-test-export",
        valeur: "Le pont, à l'aube",
        description: "Une brume grasse monte de l'eau.",
        tags: ["pont", "aube"],
        poids: 7,
        conditions: { tagsRequis: ["pont"] },
        meta: { code: "pont" },
      },
    ];
    const csv = exporterEntreesCsv(entrees);
    const resultat = importerEntreesCsv(csv, tableLieux.id, SEED_TABLES, []);
    expect(resultat.erreurs).toEqual([]);
    expect(resultat.entrees).toHaveLength(1);
    const relue = resultat.entrees[0];
    expect(relue.valeur).toBe("Le pont, à l'aube");
    expect(relue.description).toBe("Une brume grasse monte de l'eau.");
    expect(relue.tags).toEqual(["pont", "aube"]);
    expect(relue.poids).toBe(7);
    expect(relue.conditions).toEqual({ tagsRequis: ["pont"] });
    expect(relue.meta).toEqual({ code: "pont" });
  });

  it("importe un CSV en signalant les lignes invalides", () => {
    const csv = [
      "valeur,tags,poids,actif",
      "Valeur sans table,,10,1",
      ",sans-valeur,10,1",
      "Valeur valide,\"port;mer\",5,non",
    ].join("\n");
    const resultat = importerEntreesCsv(csv, TABLE_IDS.lieux, SEED_TABLES, []);
    expect(resultat.entrees).toHaveLength(2);
    expect(resultat.erreurs).toHaveLength(1);
    expect(resultat.erreurs[0]).toContain("valeur vide");
    expect(resultat.entrees[1].actif).toBe(false);
    expect(resultat.entrees[1].tags).toEqual(["port", "mer"]);
  });

  it("importe un JSON partiel et rejette les entrées invalides", () => {
    const resultat = importerEntreesJson(
      {
        entrees: [
          { tableId: TABLE_IDS.especes, valeur: "Elfe des brumes", tags: ["brume"], poids: 4 },
          { tableId: "table_inconnue", valeur: "Perdu" },
          { tableId: TABLE_IDS.lieux, valeur: "" },
        ],
      },
      SEED_TABLES,
      SEED_ENTRIES
    );
    expect(resultat.entrees).toHaveLength(1);
    expect(resultat.entrees[0].valeur).toBe("Elfe des brumes");
    expect(resultat.entrees[0].tags).toEqual(["brume"]);
    expect(resultat.erreurs).toHaveLength(2);
    expect(resultat.erreurs.some((e) => e.includes("table_inconnue"))).toBe(true);
  });

  it("refuse un format JSON inconnu", () => {
    const resultat = importerEntreesJson({ tables: [] }, SEED_TABLES, SEED_ENTRIES);
    expect(resultat.entrees).toEqual([]);
    expect(resultat.erreurs[0]).toContain("Format attendu");
  });
});
