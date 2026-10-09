// Moteur de dés pur : aucune dépendance React / DOM.
// RNG injectable pour tests déterministes.

export type Rng = () => number;

export interface DiceExpression {
  count: number;
  sides: number;
  modifier: number;
  /** Expression normalisée, ex: "2d6+3" */
  normalized: string;
}

export interface DiceRollResult {
  expression: DiceExpression;
  rolls: number[];
  modifier: number;
  total: number;
  /** Somme des dés sans modificateur */
  subtotal: number;
}

const DICE_RE = /^\s*(?:(\d*)\s*[dD]\s*(\d+))\s*([+-]\s*\d+)?\s*$/;

export function parseDiceExpression(input: string): DiceExpression {
  const m = DICE_RE.exec(input);
  if (!m) throw new Error(`Expression invalide : "${input}" (attendu : 1d20, 2d6+3, 1d8+2)`);
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const modifier = m[3] ? Number(m[3].replace(/\s+/g, "")) : 0;

  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Nombre de dés entre 1 et 100.");
  if (!Number.isInteger(sides) || sides < 1 || sides > 100)
    throw new Error("Nombre de faces entre 1 et 100.");
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 1000)
    throw new Error("Modificateur invalide.");

  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return { count, sides, modifier, normalized: `${count}d${sides}${sign}` };
}

export function rollDie(sides: number, rng: Rng = Math.random): number {
  if (sides < 1) throw new Error("Dé invalide.");
  return Math.floor(rng() * sides) + 1;
}

export function rollDiceExpression(input: string | DiceExpression, rng: Rng = Math.random): DiceRollResult {
  const expression = typeof input === "string" ? parseDiceExpression(input) : input;
  const rolls: number[] = [];
  for (let i = 0; i < expression.count; i++) rolls.push(rollDie(expression.sides, rng));
  const subtotal = rolls.reduce((a, b) => a + b, 0);
  return { expression, rolls, modifier: expression.modifier, subtotal, total: subtotal + expression.modifier };
}

/** RNG déterministe pour tests : cycle sur une séquence de valeurs [0,1). */
export function fixedRng(sequence: number[]): Rng {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}
