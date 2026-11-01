import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import { castSoutienGroupe } from "@/src/lib/rules/combat/attack";
import { dureeEffetSort } from "@/src/lib/rules/dice/roller";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { SEED_CHARACTERS, avecBenedictionAJour } from "@/src/lib/data/seeds";
import { completerSortsDepuisGrimoire } from "@/src/lib/rules/personnage";

function pretre(cha = 3): CombatParticipant {
  return {
    instanceId: "pretre", templateId: "pj", nom: "Isildeen", camp: "pj",
    pvMax: 30, pv: 30, defense: 13, initMod: 1, initiative: null,
    attaques: [], effets: [], sorts: [], capacites: [],
    niveau: 1, ressources: { mana: { max: 4, actuel: 4 } },
    statut: "actif", bonusMagique: 5,
    caracs: { AGI: 1, CON: 1, FOR: 0, PER: 1, CHA: cha, INT: 0, VOL: 2 },
  };
}

function allie(nom: string, statut: CombatParticipant["statut"] = "actif"): CombatParticipant {
  return {
    instanceId: `pj-${nom}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: statut === "mort" ? 0 : 40, defense: 15, initMod: 0, initiative: null,
    attaques: [], effets: [], sorts: [], capacites: [],
    niveau: 1, ressources: {}, statut,
  };
}

function ennemi(): CombatParticipant {
  return {
    instanceId: "gobelin", templateId: "m", nom: "Gobelin", camp: "monstre",
    pvMax: 8, pv: 8, defense: 15, initMod: 2, initiative: null,
    attaques: [], effets: [], sorts: [], capacites: [],
    niveau: 1, ressources: {}, statut: "actif",
  };
}

const benediction = SEED_SORTS.find((s) => s.id === "sort-benediction")!;

describe("Bénédiction (sort de groupe)", () => {
  it("grimoire : groupe + 1 minute = 6 tours (CHA minutes = CHA × 6)", () => {
    expect(benediction.ciblesAllies).toBe(true);
    expect(benediction.effetDuree).toBe("CHA*6");
    expect(dureeEffetSort(benediction.effetDuree, { CHA: 3 })).toBe(18);
    // Les autres sorts « CHA minutes » suivent la même règle de table.
    expect(SEED_SORTS.find((s) => s.id === "sort-arme-lumiere")!.effetDuree).toBe("CHA*6");
    expect(SEED_SORTS.find((s) => s.id === "sort-chant-heros")!.effetDuree).toBe("CHA*6");
  });

  it("un seul paiement, un effet par bénéficiaire, le prêtre inclus", () => {
    const p = pretre(3);
    const a = allie("Aria");
    const b = allie("Bran");
    const { state, resolutions } = castSoutienGroupe(createCombat([p, a, b, ennemi()]), p.instanceId, [p.instanceId, a.instanceId], benediction);

    const lanceur = state.participants.find((x) => x.instanceId === p.instanceId)!;
    expect(lanceur.ressources.mana.actuel).toBe(3); // 1 PM pour tout le groupe
    expect(lanceur.effets).toHaveLength(1);
    expect(lanceur.effets[0].nom).toBe("Bénédiction");
    expect(lanceur.effets[0].modificateurs.attaque).toBe(1);
    expect(lanceur.effets[0].toursRestants).toBe(18); // CHA 3 × 6 tours
    expect(state.participants.find((x) => x.instanceId === a.instanceId)!.effets[0].toursRestants).toBe(18);
    expect(state.participants.find((x) => x.instanceId === b.instanceId)!.effets).toHaveLength(0);
    // Deux effets distincts (chacun expire à la fin du tour de son porteur).
    expect(lanceur.effets[0].id).not.toBe(state.participants.find((x) => x.instanceId === a.instanceId)!.effets[0].id);
    expect(resolutions.map((r) => r.cibleNom)).toEqual(["Isildeen", "Aria"]);
    expect(state.log.some((l) => l.message.includes("Bénédiction sur Isildeen, Aria"))).toBe(true);
  });

  it("refuse un ennemi, un mort, une liste vide et un sort à cible unique", () => {
    const p = pretre();
    const s = createCombat([p, allie("Aria"), allie("Cadavre", "mort"), ennemi()]);
    expect(() => castSoutienGroupe(s, p.instanceId, [p.instanceId, "gobelin"], benediction)).toThrow(/allié/);
    expect(() => castSoutienGroupe(s, p.instanceId, ["pj-Cadavre"], benediction)).toThrow(/mort/);
    expect(() => castSoutienGroupe(s, p.instanceId, [], benediction)).toThrow(/Aucun bénéficiaire/);
    const mineure = SEED_SORTS.find((x) => x.id === "sort-recuperation-mineure")!;
    expect(() => castSoutienGroupe(s, p.instanceId, [p.instanceId], mineure)).toThrow(/améliorations/);
  });

  it("fiches existantes : durée ×10 (ou nulle) et drapeau de groupe réalignés", () => {
    const ancienne = { ...benediction, effetDuree: "CHA*10", ciblesAllies: undefined };
    const [corrigee] = completerSortsDepuisGrimoire([ancienne]);
    expect(corrigee.effetDuree).toBe("CHA*6");
    expect(corrigee.ciblesAllies).toBe(true);

    const isildeen = SEED_CHARACTERS.find((c) => c.id === "pj-pretre-elfe-haut")!;
    const sansDuree = {
      ...isildeen,
      sorts: isildeen.sorts.map((s) =>
        s.nom === "Bénédiction"
          ? { ...s, effetDuree: null, ciblesAllies: undefined, effetCle: "bonus-attaque" }
          : s
      ),
    };
    const [maj] = avecBenedictionAJour([sansDuree]);
    const beni = maj.sorts.find((s) => s.nom === "Bénédiction")!;
    expect(beni.effetDuree).toBe("CHA*6");
    expect(beni.ciblesAllies).toBe(true);
    expect(beni.effetCle).toBe("benediction");
    // Idempotent, et les autres sorts de la fiche ne bougent pas.
    expect(avecBenedictionAJour([maj])[0]).toBe(maj);
    expect(maj.sorts.filter((s) => s.nom !== "Bénédiction")).toEqual(sansDuree.sorts.filter((s) => s.nom !== "Bénédiction"));
  });
});
