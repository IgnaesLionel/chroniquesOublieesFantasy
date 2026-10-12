// Moteur de dés pur : aucune dépendance React / DOM.
// RNG injectable pour tests déterministes.

export type Rng = () => number;

export interface DiceExpression {
  count: number;
  sides: number;
  modifier: number;
  /** Dé évolutif (notation °) : faces remplacées selon le niveau avant le lancer. */
  evolutif: boolean;
  /** Expression normalisée, ex: "2d6+3", "1d4°+2" */
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

const DICE_RE = /^\s*(?:(\d*)\s*[dD]\s*(\d+))\s*(°)?\s*([+-]\s*\d+)?\s*$/;

export function parseDiceExpression(input: string): DiceExpression {
  const m = DICE_RE.exec(input);
  if (!m) throw new Error(`Expression invalide : "${input}" (attendu : 1d20, 2d6+3, 1d8+2, 1d4°)`);
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const evolutif = m[3] === "°";
  const modifier = m[4] ? Number(m[4].replace(/\s+/g, "")) : 0;

  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Nombre de dés entre 1 et 100.");
  if (!Number.isInteger(sides) || sides < 1 || sides > 100)
    throw new Error("Nombre de faces entre 1 et 100.");
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 1000)
    throw new Error("Modificateur invalide.");

  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return { count, sides, modifier, evolutif, normalized: `${count}d${sides}${evolutif ? "°" : ""}${sign}` };
}

/** Remplace les caracs (INT, CHA, FOR...) par leurs valeurs : "1d4°+INT" + {INT:2} -> "1d4°+2". */
export function substituerStats(expr: string, caracs: Record<string, number> = {}): string {
  return expr.replace(/\b(AGI|CON|FOR|PER|CHA|INT|VOL)\b/g, (nom) => String(caracs[nom] ?? 0));
}

/** Remplace le dé évolutif (dE) par sa valeur au niveau donné : "1dE+1" niv. 9 -> "1d8+1". */
export function substituerDeEvolutif(expr: string, de: number): string {
  return expr.replace(/(\d*)[dD][eE]\b/g, (_, n: string) => `${n === "" ? 1 : n}d${de}`);
}

/**
 * Dé évolutif COF V2 (notation °) selon le niveau : d4 (niv. 1-5),
 * d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+). Plancher niv. 1.
 */
export function deEvolutif(niveau: number): number {
  const niv = Math.max(1, Math.floor(niveau));
  if (niv >= 15) return 12;
  if (niv >= 12) return 10;
  if (niv >= 9) return 8;
  if (niv >= 6) return 6;
  return 4;
}

/**
 * Remplace chaque dé évolutif ("2d4°", "1d4°+INT") par ses faces au niveau
 * donné ("2d6", "1d6+INT" au niv. 7). Idempotent (sans ° : inchangé).
 * Les caracs (+INT) et modificateurs sont conservés tels quels.
 */
export function substituerDesEvolutifs(expr: string, niveau: number): string {
  const de = deEvolutif(niveau);
  return expr.replace(/(\d*)\s*[dD]\s*(\d+)\s*°/g, (_, n: string) => `${n === "" ? 1 : n}d${de}`);
}

export function rollDie(sides: number, rng: Rng = Math.random): number {
  if (sides < 1) throw new Error("Dé invalide.");
  return Math.floor(rng() * sides) + 1;
}

export function rollDiceExpression(input: string | DiceExpression, rng: Rng = Math.random): DiceRollResult {
  const expression = typeof input === "string" ? parseDiceExpression(input) : input;
  const rolls: number[] = [];
  for (let i = 0; i < expression.count; i++) {
    rolls.push(rollDie(expression.sides, rng));
  }
  const subtotal = rolls.reduce((a, b) => a + b, 0);
  return { expression, rolls, modifier: expression.modifier, subtotal, total: subtotal + expression.modifier };
}

/** RNG déterministe pour tests : cycle sur une séquence de valeurs [0,1). */
export function fixedRng(sequence: number[]): Rng {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}
