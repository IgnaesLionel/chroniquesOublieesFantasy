import { describe, expect, it } from "vitest";
import type { CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import type { AttackDef, Character } from "@/src/lib/rules/types";
import type { ArmeFamille } from "@/src/lib/rules/world/types";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import { resolveAttack, resynchroniserDepuisFiche } from "@/src/lib/rules/combat/attack";
import { participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { fixedRng } from "@/src/lib/rules/dice/roller";

function arme(id: string, nom: string, familles: ArmeFamille[]): AttackDef {
  return { id, nom, bonus: 6, degats: "1d8+3", familles };
}

function combattant(nom: string, opts: Partial<CombatParticipant> & { attaques: AttackDef[] }): CombatParticipant {
  return {
    instanceId: `c-${nom}`, templateId: "fiche", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 18, initMod: 1, initiative: null,
    effets: [], sorts: [], capacites: [], niveau: 1, ressources: {}, statut: "actif",
    ...opts,
  };
}

function creerEtat(a: CombatParticipant, defensesCible = 10): CombatState {
  return createCombat([a, combattant("Mur", { attaques: [arme("epee", "Épée", ["epees"])], defense: defensesCible })]);
}

describe("maître d'armes : prédilection, Science du critique, Spécialisation", () => {
  it("prédilection : +1 attaque auto (journal « prédilection »)", () => {
    const a = combattant("G", {
      attaques: [arme("hache", "Hache", ["haches"])],
      famillePredilection: "haches",
      capacites: ["Armes de prédilection"],
    });
    const s = creerEtat(a, 10);
    const [atk, def] = s.participants.map((p) => p.instanceId);
    // Jet 3 : sans prédilection 3+6 = 9 < 10 raté ; avec 3+7 = 10 touché.
    const sansFamille = { ...a, famillePredilection: undefined };
    const s2 = creerEtat(sansFamille, 10);
    const [atk2, def2] = s2.participants.map((p) => p.instanceId);
    const sans = resolveAttack(s2, atk2, def2, "hache", fixedRng([0.1, 0.5]));
    expect(sans.resolution.touche).toBe(false);
    const avec = resolveAttack(s, atk, def, "hache", fixedRng([0.1, 0.5]));
    expect(avec.resolution.touche).toBe(true);
    expect(avec.state.log.some((l) => l.message.includes("(+1 prédilection)"))).toBe(true);
  });

  it("prédilection : pas de +1 si la famille ne matche pas (épée, prédilection haches)", () => {
    const a = combattant("G", {
      attaques: [arme("epee", "Épée", ["epees"])],
      famillePredilection: "haches",
      capacites: ["Armes de prédilection"],
    });
    const s = creerEtat(a, 10);
    const [atk, def] = s.participants.map((p) => p.instanceId);
    const r = resolveAttack(s, atk, def, "epee", fixedRng([0.1, 0.5]));
    expect(r.resolution.touche).toBe(false);
    expect(r.state.log.some((l) => l.message.includes("(+1 prédilection)"))).toBe(false);
  });

  it("prédilection : aucun bonus sur attaque de sort (pas d'arme)", () => {
    const elle = { id: "s1", nom: "Nova", type: "offensif" as const, degats: "1d6", bonus: 5, cout: { ressource: "mana", montant: 0 } };
    const a = combattant("S", {
      sorts: [elle],
      attaques: [], // l'attaque du sort est construite à la main pour le test
      famillePredilection: "haches",
      capacites: ["Armes de prédilection"],
    });
    // attaque de sort : id "sort:" (non arme) → pas de prédilection.
    a.attaques = [{ id: "sort:s1", nom: "✦ Nova", bonus: 5, degats: "1d6" }];
    const s = creerEtat(a, 6);
    const [atk, def] = s.participants.map((p) => p.instanceId);
    // 3+5 = 8 < 6 ? non : 8 ≥ 6 touché — comparer le total : sans bonus prédilection il vaut 8 exact.
    const r = resolveAttack(s, atk, def, "sort:s1", fixedRng([0.1, 0.5]));
    expect(r.resolution.jetTotal).toBe(8);
  });

  it("Science du critique : 19 touche-critique avec l'arme de prédilection (auto)", () => {
    const a = combattant("G", {
      attaques: [arme("hache", "Hache", ["haches"])],
      famillePredilection: "haches",
      capacites: ["Science du critique"],
    });
    const s = creerEtat(a, 1); // déf très bas : le 19 passe la défense même sans critique
    const [atk, def] = s.participants.map((p) => p.instanceId);
    // 19 >= 19 : critique. 1d8 : 5 → (5+3+3)×2 = 22.
    const r = resolveAttack(s, atk, def, "hache", fixedRng([0.9, 0.5, 0.5]));
    expect(r.resolution.critique).toBe(true);
    // Spécialisation absent de la fiche : (5+3)×2 = 16.
    expect(r.resolution.degatsTotal).toBe(16);
  });

  it("Science du critique : 19 ne critique pas sans match de prédilection", () => {
    const a = combattant("G", {
      attaques: [arme("epee", "Épée", ["epees"])],
      famillePredilection: "haches",
      capacites: ["Science du critique"],
    });
    const s = creerEtat(a, 1);
    const [atk, def] = s.participants.map((p) => p.instanceId);
    const r = resolveAttack(s, atk, def, "epee", fixedRng([0.9, 0.5]));
    expect(r.resolution.critique).toBe(false);
  });

  it("Spécialisation : +N DM auto avec la prédilection, doublé en critique", () => {
    const a = combattant("G", {
      attaques: [arme("hache", "Hache", ["haches"])],
      famillePredilection: "haches",
      capacites: ["Spécialisation", "Science du critique"],
      bonusSpecialisation: 3,
    });
    const s = creerEtat(a, 15);
    const [atk, def] = s.participants.map((p) => p.instanceId);
    // Touché simple : jet 3+6+1 = 10 ≥ 10? déf 15 → prenons jet 19 sans critique d'arme : déjà critique.
    // Simple touché : 15+6+1 = 22 ≥ 15, DM 1d8(5)+3+3 = 11, non critique (15 < 19? 15 >= 19 non).
    const r = resolveAttack(s, atk, def, "hache", fixedRng([0.72, 0.5]));
    expect(r.resolution.critique).toBe(false);
    expect(r.resolution.degatsTotal).toBe(11);
    expect(r.state.log.some((l) => l.message.includes("Spécialisation"))).toBe(true);
    // Critique : 19 → (5+3+3)×2 = 22.
    const r2 = resolveAttack(s, atk, def, "hache", fixedRng([0.9, 0.5]));
    expect(r2.resolution.critique).toBe(true);
    expect(r2.resolution.degatsTotal).toBe(22);
  });

  it("fabrique + resync : champs de la fiche suivis en combat", () => {
    const fiche: Character = {
      kind: "personnage", id: "f1", nom: "Guerrier", classe: "Guerrier", profil: "Guerrier",
      famille: "Combattant", peuple: "Humain", niveau: 3, pvMax: 30, pv: 30, defense: 16, initMod: 1,
      attaques: [], effets: [], sorts: [], capacites: ["Armes de prédilection", "Spécialisation"],
      caracteristiques: { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 },
      ressources: {}, inventaire: [],
      famillePredilection: "haches", bonusSpecialisation: 2,
    } as unknown as Character;
    const p = participantFromCharacter(fiche);
    expect(p.famillePredilection).toBe("haches");
    expect(p.bonusSpecialisation).toBe(2);
    // Changer la famille sur la fiche puis resync : le participant suit.
    fiche.famillePredilection = "epees";
    fiche.bonusSpecialisation = 4;
    const frais = participantFromCharacter(fiche);
    const r = resynchroniserDepuisFiche(p, frais);
    expect(r.modifie).toBe(true);
    expect(r.participant.famillePredilection).toBe("epees");
    expect(r.participant.bonusSpecialisation).toBe(4);
  });
});
