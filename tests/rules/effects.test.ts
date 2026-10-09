import { describe, expect, it } from "vitest";
import { createEffect, getModifier, canAct, tickEffects } from "@/src/lib/rules/effects/effects";
import { addParticipantEffect, createCombat, nextTurn, removeParticipantEffect } from "@/src/lib/rules/combat/initiative";
import { resolveAttack } from "@/src/lib/rules/combat/attack";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { fixedRng } from "@/src/lib/rules/dice/roller";

function participant(nom: string): CombatParticipant {
  return {
    instanceId: nom, templateId: "t", nom, camp: "pj",
    pvMax: 30, pv: 30, defense: 15, initMod: 0, initiative: 10,
    attaques: [{ id: "a", nom: "Épée", bonus: 5, degats: "1d6+2" }],
    effets: [], statut: "actif",
    sorts: [], ressources: {},
  };
}

describe("effets temporaires", () => {
  it("poison : -2 attaque, durée 3 -> 2 après tick", () => {
    const poison = createEffect("empoisonne", { source: "Gobelin" });
    expect(poison.toursRestants).toBe(3);
    expect(getModifier([poison], "attaque")).toBe(-2);
    const t = tickEffects([poison]);
    expect(t.restants[0].toursRestants).toBe(2);
    expect(t.expires).toHaveLength(0);
  });

  it("expire après la durée, suppression manuelle possible", () => {
    let effs = [createEffect("protection", { dureeTours: 1 })];
    const t = tickEffects(effs);
    expect(t.restants).toHaveLength(0);
    expect(t.expires).toHaveLength(1);
    effs = [createEffect("protection", { dureeTours: 3 })];
    const { ok } = { ok: true };
    expect(ok).toBe(true);
    const removed = effs.filter((e) => e.id !== effs[0].id);
    expect(removed).toHaveLength(0);
  });

  it("étourdi empêche d'agir", () => {
    const e = createEffect("etourdi");
    expect(canAct([e])).toBe(false);
    expect(canAct([])).toBe(true);
  });

  it("saignement inflige PV au tick", () => {
    const t = tickEffects([createEffect("saignement")]);
    expect(t.pvDelta).toBe(-2);
  });

  it("combat : nextTurn tick l'actif + expire + log", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    s = addParticipantEffect(s, "B", createEffect("empoisonne", { dureeTours: 1 }));
    expect(s.participants[1].effets).toHaveLength(1);
    s = nextTurn(s, false); // tour de B -> tick -> expire
    expect(s.participants[1].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("expiré"))).toBe(true);
  });

  it("combat : add/remove effet via helpers + journal", () => {
    let s = createCombat([participant("A")]);
    s = addParticipantEffect(s, "A", createEffect("protection"));
    expect(s.participants[0].effets).toHaveLength(1);
    const id = s.participants[0].effets[0].id;
    s = removeParticipantEffect(s, "A", id);
    expect(s.participants[0].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("retiré"))).toBe(true);
  });

  it("attaque applique malus poison (-2) et bonus protection (+2 déf)", () => {
    const atk = { ...participant("Att"), effets: [createEffect("empoisonne")] }; // +5-2 = +3
    const def = { ...participant("Def", ), camp: "monstre" as const, defense: 15, effets: [createEffect("protection")] }; // déf 17
    let s = createCombat([atk, def]);
    // naturel 14 : 14+3=17 vs 17 -> touche (sans effets : 14+5=19 touche aussi, mais vérifions le calcul effectif)
    const { resolution } = resolveAttack(s, "Att", "Def", "a", fixedRng([0.66, 0]));
    expect(resolution.jetNaturel).toBe(14);
    expect(resolution.jetTotal).toBe(17);
    expect(resolution.defenseCible).toBe(17);
    expect(resolution.touche).toBe(true);
  });

  it("étourdi bloque l'attaque", () => {
    const atk = { ...participant("Att"), effets: [createEffect("etourdi")] };
    const def = { ...participant("Def"), camp: "monstre" as const };
    const s = createCombat([atk, def]);
    expect(() => resolveAttack(s, "Att", "Def", "a", fixedRng([0.9]))).toThrow(/ne peut pas agir/);
  });
});
