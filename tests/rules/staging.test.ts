import { describe, expect, it } from "vitest";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import { rafraichirStaging, recibrerCible } from "@/src/lib/rules/combat/staging";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";

function pjInstance(id: string, nom: string, camp: "pj" | "monstre" = "pj") {
  return {
    instanceId: id,
    templateId: id,
    nom,
    camp,
    pvMax: 10,
    pv: 10,
    defense: 12,
    initMod: 0,
    initiative: null as number | null,
    attaques: [],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 1,
    ressources: {},
    statut: "actif" as const,
  };
}

describe("staging combat", () => {
  it("rafraichirStaging conserve les monstres, reconstruit les PJ", () => {
    const fiche = SEED_CHARACTERS[0];
    const liste = [
      { ...pjInstance("x", "Gob", "monstre"), templateId: "gob" },
      { ...pjInstance("y", fiche.nom, "pj"), templateId: fiche.id },
    ];
    const next = rafraichirStaging(liste as never, [fiche], []);
    expect(next[0].nom).toBe("Gob");
    expect(next[1].templateId).toBe(fiche.id);
  });

  it("recibrerCible garde la cible valide, sinon priorise l'ennemi", () => {
    const s = createCombat([
      pjInstance("a", "A", "pj"),
      pjInstance("b", "B", "pj"),
      pjInstance("m", "M", "monstre"),
    ]);
    expect(recibrerCible(s, "a", "m")).toBe("m");
    // Ancien attaquant invalide -> premier ennemi du nouvel attaquant.
    expect(recibrerCible(s, "m", "m")).toBe("a");
    expect(recibrerCible(s, "a", "zzz")).toBe("m");
  });
});
