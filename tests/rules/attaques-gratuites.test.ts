import { describe, expect, it } from "vitest";
import type { CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import type { AttackDef } from "@/src/lib/rules/types";
import type { ArmeFamille } from "@/src/lib/rules/world/types";
import { createCombat, nextTurn } from "@/src/lib/rules/combat/initiative";
import {
  attaqueGratuiteDisponible,
  ecarterAttaqueGratuite,
  marquerAttaqueGratuiteLancee,
  resolveAttack,
  signalerAttaqueGratuite,
} from "@/src/lib/rules/combat/attack";
import { fixedRng } from "@/src/lib/rules/dice/roller";

function arme(id: string, nom: string, familles?: ArmeFamille[]): AttackDef {
  return familles ? { id, nom, bonus: 6, degats: "1d8+3", familles } : { id, nom, bonus: 6, degats: "1d8+3" };
}

function combattant(nom: string, opts: Partial<CombatParticipant> = {}): CombatParticipant {
  return {
    instanceId: `c-${nom}`, templateId: "fiche", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 18, initMod: 1, initiative: null,
    attaques: [arme("epee", "Épée")], effets: [], sorts: [], capacites: [], niveau: 1,
    ressources: {}, statut: "actif",
    ...opts,
  };
}

describe("attaques gratuites (G) : signaux et quotas", () => {
  it("Riposte : un raté d'arme arme le signal sur la cible (1/round dispo)", () => {
    // attaque en faute = taureau
    const s = createCombat([
      combattant("Taureau"),
      combattant("Tank", { defense: 30, capacites: ["Riposte"] }),
    ]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const { state } = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.5])); // 3+6 < 30 raté
    const cible = state.participants.find((p) => p.instanceId === t)!;
    expect(cible.attaquesGratuites).toEqual([{ type: "riposte", de: a, manche: s.manche }]);
    expect(state.log.some((l) => l.message.includes("Riposte (G)"))).toBe(true);
    // L'attaquant n'a pas de signal ; dispo des deux côtés côté porteur.
    expect(state.participants.find((p) => p.instanceId === a)!.attaquesGratuites).toBeUndefined();
    expect(attaqueGratuiteDisponible(cible, "riposte", s.manche)).toBe(true);
  });

  it("Riposte : pas de signal si le type a déjà servi cette manche coute", () => {
    const s0 = createCombat([
      combattant("Taureau"),
      combattant("Tank", { defense: 30, capacites: ["Riposte"] }),
    ]);
    const [a, t] = s0.participants.map((p) => p.instanceId);
    const s = {
      ...s0,
      participants: s0.participants.map((p) =>
        p.instanceId === t
          ? { ...p, attaquesGratuites: [{ type: "riposte" as const, de: a, manche: s0.manche, lancee: s0.manche }] }
          : p
      ),
    } as CombatState;
    const { state } = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.5]));
    const cible = state.participants.find((p) => p.instanceId === t)!;
    expect(cible.attaquesGratuites).toHaveLength(1); // pas de doublon/ajout
    // Nouvelle manche : re-disponible (1/round).
    expect(attaqueGratuiteDisponible(cible, "riposte", s0.manche + 1)).toBe(true);
  });

  it("marquer puis écarter : un consommé bloque, un écarté libère", () => {
    const s = createCombat([combattant("A"), combattant("B")]);
    const id = s.participants[0].instanceId;
    const s1 = signalerAttaqueGratuite(s, id, "teigneux");
    expect(s1.participants[0].attaquesGratuites).toHaveLength(1);
    // Doublon en attente : ignoré.
    const s2 = signalerAttaqueGratuite(s1, id, "teigneux");
    expect(s2.participants[0].attaquesGratuites).toHaveLength(1);
    // Lancement : compte pour le 1/round Teigneux.
    const s3 = marquerAttaqueGratuiteLancee(s2, id, s2.participants[0].attaquesGratuites![0]);
    expect(attaqueGratuiteDisponible(s3.participants[0], "teigneux", s.manche)).toBe(false);
    // Écart (annulation MJ) : libère le signal, ne compte plus rien.
    const s4 = ecarterAttaqueGratuite(s3, id, s3.participants[0].attaquesGratuites![0]);
    expect(s4.participants[0].attaquesGratuites).toHaveLength(0);
  });

  it("Piqûre de rappel : signal du tiers quand un autre est visé, pas si lui-même", () => {
    const s0 = createCombat([
      combattant("Cha", { camp: "monstre" }),
      combattant("Mur", { defense: 30 }),
      combattant("Piq", { capacites: ["Piqûre de rappel"] }),
    ]);
    const cha = s0.participants.find((p) => p.nom === "Cha")!.instanceId;
    const mur = s0.participants.find((p) => p.nom === "Mur")!.instanceId;
    const piq = s0.participants.find((p) => p.nom === "Piq")!.instanceId;
    expect(piq).not.toBe(mur);
    // Cha attaque Mur : Piq (même camp, autre) garde un signal sur Cha.
    const r1 = resolveAttack(s0, cha, mur, "epee", fixedRng([0.1, 0.5]));
    const piq1 = r1.state.participants.find((p) => p.nom === "Piq")!;
    expect(piq1.attaquesGratuites).toEqual([{ type: "rappel", de: cha, manche: s0.manche }]);
    // Cha vise directement Piq : pas de signal.
    const r2 = resolveAttack(s0, cha, piq, "epee", fixedRng([0.1, 0.5]));
    expect(r2.state.participants.find((p) => p.nom === "Piq")!.attaquesGratuites).toBeUndefined();
  });

  it("Piqûre de rappel : 1/round — une seule signalisation par manche, pas de doublon", () => {
    const s0 = createCombat([
      combattant("Cha", { camp: "monstre" }),
      combattant("Mur", { defense: 30 }),
      combattant("Piq", { capacites: ["Piqûre de rappel"] }),
    ]);
    const cha = s0.participants.find((p) => p.nom === "Cha")!.instanceId;
    const mur = s0.participants.find((p) => p.nom === "Mur")!.instanceId;
    const r1 = resolveAttack(s0, cha, mur, "epee", fixedRng([0.1, 0.5]));
    // Cha attaque encore : signal Piq déjà en attente -> pas de doublon.
    const r2 = resolveAttack(r1.state, cha, mur, "epee", fixedRng([0.1, 0.5]));
    expect(r2.state.participants.find((p) => p.nom === "Piq")!.attaquesGratuites).toHaveLength(1);
  });

  it("Enchaînement : chute à 0 PV au contact -> signal d'attaque gratuite", () => {
    const s = createCombat([
      combattant("E", {
        capacites: ["Enchaînement"],
        attaques: [{ id: "hache", nom: "Hache", bonus: 6, degats: "1d8+3" }],
      }),
      combattant("Gob", { camp: "monstre", pv: 2, pvMax: 2, defense: 1 }),
      combattant("Gob2", { camp: "monstre", pv: 40, pvMax: 40, defense: 30 }),
    ]);
    const [e, gob, ] = s.participants.map((p) => p.instanceId);
    // 3+6 = 9 ≥ 1 touché ; 1d8+3 : 5+3 = 8 -> 2 PV - 8 = hors combat.
    const r = resolveAttack(s, e, gob, "hache", fixedRng([0.5, 0.5]));
    expect(r.resolution.cibleTombe).toBe(true);
    expect(r.state.participants.find((p) => p.instanceId === e)!.attaquesGratuites).toEqual([
      { type: "enchainement", manche: s.manche },
    ]);
    // Rempart : Teigneux × AGI+2 (plancher 1) ; Enchaînement non plafonné.
    const mur = combattant("R", { capacites: ["Rempart"], caracs: { AGI: 3 } });
    expect(attaqueGratuiteDisponible(mur, "teigneux", 3)).toBe(true);
    const quatre = [0, 1, 2, 3].map((n) => ({ type: "teigneux" as const, manche: 3, lancee: 3, n }));
    (mur as CombatParticipant & { attaquesGratuites?: unknown }).attaquesGratuites = quatre;
    expect(attaqueGratuiteDisponible(mur, "teigneux", 3)).toBe(true); // AGI 3 -> limite 5 : 4/5 utilisés
    (mur as CombatParticipant & { attaquesGratuites?: unknown }).attaquesGratuites = [...quatre, { type: "teigneux" as const, manche: 3, lancee: 3 }];
    expect(attaqueGratuiteDisponible(mur, "teigneux", 3)).toBe(false);
    const sansRempart = combattant("T", { capacites: ["Teigneux"] });
    expect(attaqueGratuiteDisponible(
      { ...sansRempart, attaquesGratuites: [{ type: "teigneux", manche: 3, lancee: 3 }] } as CombatParticipant,
      "teigneux",
      3
    )).toBe(false);
  });

  it("nextTurn : les marques consommées des manches passées sont purgées", () => {
    const s0 = createCombat([combattant("A"), combattant("B")]);
    const id = s0.participants[0].instanceId;
    // Consommé en manche 1, signal reste affiché en ✓ au fil de la manche 2.
    const s1 = marquerAttaqueGratuiteLancee(
      signalerAttaqueGratuite(s0, id, "riposte"),
      id,
      { type: "riposte", manche: 1 }
    );
    expect(s1.participants[0].attaquesGratuites![0].lancee).toBe(1);
    const t1 = nextTurn(s1); // tour de B, toujours manche 1
    expect(t1.manche).toBe(1);
    expect(t1.participants[0].attaquesGratuites).toHaveLength(1);
    const t2 = nextTurn(t1); // retour à A : manche 2 -> purge
    expect(t2.manche).toBe(2);
    expect(t2.participants[0].attaquesGratuites).toHaveLength(0);
  });
});
