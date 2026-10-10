import { describe, expect, it } from "vitest";
import { fixedRng, parseDiceExpression, rollDiceExpression, rollDie, substituerDeEvolutif, substituerStats } from "@/src/lib/rules/dice/roller";

describe("moteur de dés", () => {
  it("parse les expressions de base", () => {
    expect(parseDiceExpression("1d20")).toMatchObject({ count: 1, sides: 20, modifier: 0 });
    expect(parseDiceExpression("d20").count).toBe(1);
    expect(parseDiceExpression("1d20+5")).toMatchObject({ count: 1, sides: 20, modifier: 5 });
    expect(parseDiceExpression("2d6+3")).toMatchObject({ count: 2, sides: 6, modifier: 3 });
    expect(parseDiceExpression("1d8-2").modifier).toBe(-2);
  });

  it("rejette les expressions invalides", () => {
    expect(() => parseDiceExpression("zzz")).toThrow();
    expect(() => parseDiceExpression("0d6")).toThrow();
    expect(() => parseDiceExpression("2d0")).toThrow();
  });

  it("d1 accepté (dégâts plats importés : 1 = 1d1, 0 = 1d1-1)", () => {
    expect(parseDiceExpression("1d1")).toMatchObject({ count: 1, sides: 1, modifier: 0 });
    expect(rollDiceExpression("1d1", fixedRng([0.99])).total).toBe(1);
    expect(rollDiceExpression("1d1-1", fixedRng([0])).total).toBe(0);
  });

  it("dés explosifs (°) : relance unique au max", () => {
    expect(parseDiceExpression("1d4°")).toMatchObject({ count: 1, sides: 4, modifier: 0, explosif: true, normalized: "1d4°" });
    expect(parseDiceExpression("2d6").explosif).toBe(false);
    expect(parseDiceExpression("1d4°+2").normalized).toBe("1d4°+2");
    // Exemple livre : 4 puis 3 = 7.
    const r = rollDiceExpression("1d4°", fixedRng([0.99, 0.5]));
    expect(r.rolls).toEqual([4, 3]);
    expect(r.total).toBe(7);
    // Relance unique : 4 puis 4 = 8, pas de 3e jet.
    const r2 = rollDiceExpression("1d4°", fixedRng([0.99, 0.99, 0.5]));
    expect(r2.rolls).toEqual([4, 4]);
    expect(r2.total).toBe(8);
    // Pas de max : pas de relance.
    expect(rollDiceExpression("1d4°", fixedRng([0.5])).total).toBe(3);
    // 2d4° : chaque dé au max explose une fois.
    const r3 = rollDiceExpression("2d4°", fixedRng([0.99, 0.1, 0.99, 0.1]));
    expect(r3.rolls).toEqual([4, 1, 4, 1]);
    expect(r3.total).toBe(10);
  });

  it("substituerStats remplace les caracs (INT ajouté à la fin)", () => {
    expect(substituerStats("1d4°+INT", { INT: 2 })).toBe("1d4°+2");
    expect(substituerStats("2d6+3", { INT: 2 })).toBe("2d6+3");
    expect(substituerStats("1d4°+INT", {})).toBe("1d4°+0");
    expect(substituerStats("1d6+int", { int: 2 })).toBe("1d6+int"); // minuscules ignorées
    expect(parseDiceExpression(substituerStats("1d4°+INT", { INT: 2 })).normalized).toBe("1d4°+2");
  });

  it("substituerDeEvolutif remplace dE par le dé du niveau", () => {
    expect(substituerDeEvolutif("1dE+1", 6)).toBe("1d6+1");
    expect(substituerDeEvolutif("2dE", 8)).toBe("2d8");
    expect(substituerDeEvolutif("1dE", 4)).toBe("1d4");
    expect(substituerDeEvolutif("1d6+2", 12)).toBe("1d6+2");
    expect(parseDiceExpression(substituerDeEvolutif("1dE+1", 6)).normalized).toBe("1d6+1");
  });

  it("roll déterministe avec RNG injecté", () => {
    // rng 0 -> face 1 ; rng 0.999 -> face max
    expect(rollDie(20, () => 0)).toBe(1);
    expect(rollDie(20, () => 0.9999)).toBe(20);
  });

  it("calcule subtotal + bonus + total", () => {
    // fixedRng([0]) -> chaque dé = 1
    const r = rollDiceExpression("2d6+3", fixedRng([0]));
    expect(r.rolls).toEqual([1, 1]);
    expect(r.subtotal).toBe(2);
    expect(r.total).toBe(5);
  });

  it("détail 1d20+6 type fiche MJ", () => {
    // Pour obtenir 14 sur d20 : rng tel que floor(r*20)+1 = 14 -> r in [0.65, 0.70)
    const r = rollDiceExpression("1d20+6", fixedRng([0.66]));
    expect(r.rolls[0]).toBe(14);
    expect(r.total).toBe(20);
  });
});
