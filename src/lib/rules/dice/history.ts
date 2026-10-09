import type { DiceRollResult } from "@/src/lib/rules/dice/roller";

export interface DiceHistoryEntry extends DiceRollResult {
  id: string;
  label?: string;
  at: string;
}

export function createHistoryEntry(result: DiceRollResult, label?: string): DiceHistoryEntry {
  return {
    ...result,
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    label,
    at: new Date().toISOString(),
  };
}

export function formatRoll(r: DiceRollResult, label?: string): string[] {
  const lines = [
    `${label ?? "Jet"} : ${r.expression.normalized}`,
    `d${r.expression.sides} : ${r.rolls.join(", ")}`,
    `Bonus : ${r.modifier >= 0 ? "+" : ""}${r.modifier}`,
    `Total : ${r.total}`,
  ];
  return lines;
}
