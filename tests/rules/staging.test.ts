import { describe, expect, it } from "vitest";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import { rafraichirStaging, recibrerCible } from "@/src/lib/rules/combat/staging";
import { createEffect } from "@/src/lib/rules/effects/effects";
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

  it("rafraichirStaging conserve les états pré-combat posés avant l'initiative", () => {
    const fiche = SEED_CHARACTERS[0];
    const surpris = createEffect("surpris", { source: "Pré-combat" });
    const liste = [
      { ...pjInstance("y", fiche.nom, "pj"), templateId: fiche.id, effets: [surpris] },
    ];
    const next = rafraichirStaging(liste as never, [fiche], []);
    const pj = next.find((p: { templateId: string }) => p.templateId === fiche.id)!;
    expect(pj.effets.map((e: { nom: string }) => e.nom)).toContain("Surpris");
    expect(pj.effets[0].modificateurs).toMatchObject({ empecheAgir: 1, defense: -5 });
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
