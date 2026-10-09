import { describe, expect, it } from "vitest";
import { fixedRng, parseDiceExpression, rollDiceExpression, rollDie } from "@/src/lib/rules/dice/roller";

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
