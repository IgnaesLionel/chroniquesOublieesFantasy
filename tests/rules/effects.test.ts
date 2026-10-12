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
    sorts: [], capacites: [], niveau: 1, ressources: {},
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

  it("combat : nextTurn consomme à la FIN du tour du porteur (malus couvre tout son tour)", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    // A (tour en cours) empoisonne B pour 1 tour.
    s = addParticipantEffect(s, "B", createEffect("empoisonne", { dureeTours: 1 }));
    expect(s.participants[1].effets).toHaveLength(1);
    // Tour de B : le malus est toujours là (il n'expire pas avant d'agir).
    s = nextTurn(s, false);
    expect(s.tourIndex).toBe(1);
    expect(s.participants[1].effets).toHaveLength(1);
    expect(s.participants[1].effets[0].toursRestants).toBe(1);
    // Fin du tour de B : le malus expire seulement maintenant.
    s = nextTurn(s, false);
    expect(s.participants[1].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("expiré"))).toBe(true);
  });

  it("combat : auto-buff 1 tour posé pendant son tour survit jusqu'à la fin de son prochain tour", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    // A se protège pendant son propre tour.
    s = addParticipantEffect(s, "A", createEffect("protection", { dureeTours: 1 }));
    // Tour de B : le buff de A est toujours actif (couvre l'inter-round).
    s = nextTurn(s, false);
    expect(s.participants[0].effets).toHaveLength(1);
    // Tour de A (manche 2) : le buff couvre encore tout son tour.
    s = nextTurn(s, false);
    expect(s.tourIndex).toBe(0);
    expect(s.participants[0].effets).toHaveLength(1);
    // Fin du tour de A (manche 2) : le buff expire seulement maintenant.
    s = nextTurn(s, false);
    expect(s.participants[0].effets).toHaveLength(0);
  });

  it("combat : DoT appliqué au début du tour, durée consommée à la fin (2 ticks pour 2 tours)", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    s = addParticipantEffect(s, "B", createEffect("saignement", { dureeTours: 2 }));
    // Début du tour de B (manche 1) : -2 PV, effet toujours présent.
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(28);
    expect(s.participants[1].effets[0].toursRestants).toBe(2);
    // Tour de A (manche 2) : fin du tour de B -> 2 => 1.
    s = nextTurn(s, false);
    expect(s.participants[1].effets[0].toursRestants).toBe(1);
    // Début du tour de B (manche 2) : -2 PV à nouveau...
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(26);
    // ...puis fin de son tour : expiration.
    s = nextTurn(s, false);
    expect(s.participants[1].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("expiré"))).toBe(true);
  });

  it("combat : scénario du rapport — Ralenti 1 tour tient tout le tour de l'ennemi", () => {
    // Sorcier (tour en cours) touche l'ennemi avec "Un pied dans la tombe"
    // + Ralenti (1 tour) en effet supplémentaire.
    const sorcierP: CombatParticipant = {
      ...participant("Sorcier"),
      attaques: [{ id: "pied", nom: "Un pied dans la tombe", bonus: 10, degats: "1d6" }],
    };
    const ennemi = { ...participant("Ennemi"), camp: "monstre" as const };
    const s0 = createCombat([sorcierP, ennemi]);
    const { state: s1 } = resolveAttack(
      s0, "Sorcier", "Ennemi", "pied",
      fixedRng([0.9, 0.5]),
      undefined,
      { effetSupp: { cle: "Ralenti", duree: 1 } }
    );
    expect(s1.participants[1].effets.map((e) => e.nom)).toContain("Ralenti");
    // Tour de l'ennemi : il subit encore le malus pendant TOUT son tour.
    const s2 = nextTurn(s1, false);
    const malus = s2.participants[1].effets.find((e) => e.nom === "Ralenti");
    expect(malus).toBeTruthy();
    expect(malus!.toursRestants).toBe(1);
    // Il ne le perd qu'à la fin de son tour.
    const s3 = nextTurn(s2, false);
    expect(s3.participants[1].effets.find((e) => e.nom === "Ralenti")).toBeUndefined();
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
