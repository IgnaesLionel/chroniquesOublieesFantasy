import { describe, expect, it } from "vitest";
import { capacitesCreature, texteCapaciteLisible } from "@/src/lib/rules/combat/fiche-creature";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";

describe("fiche de créature en combat", () => {
  it("Aigle commun : Vol rapide et Emporter dans les airs, sans doublon ni suffixe", () => {
    const [aigle] = monsterInstances(SEED_MONSTERS.find((m) => m.id === "notion-nc-0-5-aigle")!, 1);
    const capacites = capacitesCreature(aigle);
    const noms = capacites.map((c) => c.nom);
    expect(noms).toContain("Vol rapide");
    expect(noms).toContain("Emporter dans les airs");
    // « Soutenir » n'a pas de détail sur la fiche : enrichi par le catalogue partagé.
    expect(noms).toContain("Soutenir");
    // Doublons « (Capacité) » fusionnés.
    expect(new Set(noms).size).toBe(noms.length);
    expect(noms.some((n) => /\(capacité\)/i.test(n))).toBe(false);
    // Textes de référence du catalogue, nettoyés des images Notion.
    const vol = capacites.find((c) => c.nom === "Vol rapide")!;
    expect(vol.origine).toBe("partagee");
    expect(vol.texte).toMatch(/action de mouvement supplémentaire/i);
    const emporter = capacites.find((c) => c.nom === "Emporter dans les airs")!;
    expect(emporter.texte).toMatch(/minuscule/i);
    for (const c of capacites) {
      expect(c.texte ?? "").not.toMatch(/\.\/images\//);
    }
  });

  it("description de fiche nettoyée (images retirées), nom sans « (Capacité) »", () => {
    const capacites = capacitesCreature({
      capacites: [],
      capacitesDetails: [
        {
          nom: "Emporter dans les airs (Capacité)",
          description:
            "La créature peut emporter une victime.\n- `./images/img-3.webp` (Emporter dans les airs)\n- Fin.",
        },
      ],
    });
    expect(capacites).toHaveLength(1);
    expect(capacites[0].nom).toBe("Emporter dans les airs");
    expect(capacites[0].origine).toBe("fiche");
    expect(capacites[0].texte).toBe("La créature peut emporter une victime.\n- Fin.");
  });

  it("capacités en double (nom libre + détail) fusionnées, ordre du bestiaire conservé", () => {
    const capacites = capacitesCreature({
      capacitesPartagees: ["vol-rapide"],
      capacitesDetails: [{ nom: "Vol rapide (Capacité)", description: "Texte de fiche." }],
      capacites: ["Soutenir", "Vol rapide", "Vol rapide (Capacité)"],
    });
    expect(capacites.map((c) => c.nom)).toEqual(["Vol rapide", "Soutenir"]);
  });

  it("aucune capacité : liste vide", () => {
    expect(capacitesCreature({ capacites: [] })).toEqual([]);
  });

  it("texte sans image : inchangé ; lignes d'images seules supprimées", () => {
    expect(texteCapaciteLisible("Ligne utile.\n\n- `./images/img-1.webp` (profil)\nSuite.")).toBe("Ligne utile.\nSuite.");
  });
});
