import type { Choice, Condition, FlagValue, Scene } from "@/src/lib/rules/scenario/types";

function isTruthy(v: FlagValue | undefined): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Évalue une condition contre les flags. Absente = true. */
export function evaluateCondition(cond: Condition | undefined, flags: Record<string, FlagValue>): boolean {
  if (!cond) return true;
  switch (cond.type) {
    case "flag": {
      const v = flags[cond.flag];
      switch (cond.op) {
        case "estVrai": return isTruthy(v);
        case "estFaux": return !isTruthy(v);
        case "egal": return v === cond.valeur;
        case "different": return v !== cond.valeur;
      }
      break;
    }
    case "et": return cond.conditions.every((c) => evaluateCondition(c, flags));
    case "ou": return cond.conditions.some((c) => evaluateCondition(c, flags));
    case "non": return !evaluateCondition(cond.condition, flags);
  }
  return false;
}

/** Choix visibles selon les flags. */
export function availableChoices(scene: Scene, flags: Record<string, FlagValue>): Choice[] {
  return scene.choix.filter((c) => evaluateCondition(c.condition, flags));
}

/** Choix masqués (pour affichage MJ). */
export function lockedChoices(scene: Scene, flags: Record<string, FlagValue>): Choice[] {
  return scene.choix.filter((c) => !evaluateCondition(c.condition, flags));
}

/** petit helper : SI flag vrai. */
export function siFlag(flag: string): Condition {
  return { type: "flag", flag, op: "estVrai" };
}

export function describeCondition(cond: Condition | undefined): string {
  if (!cond) return "toujours";
  if (cond.type === "flag") {
    if (cond.op === "estVrai") return `SI ${cond.flag}`;
    if (cond.op === "estFaux") return `SI NON ${cond.flag}`;
    return `SI ${cond.flag} ${cond.op === "egal" ? "=" : "≠"} ${String(cond.valeur)}`;
  }
  if (cond.type === "et") return cond.conditions.map(describeCondition).join(" ET ");
  if (cond.type === "ou") return cond.conditions.map(describeCondition).join(" OU ");
  return `NON (${describeCondition(cond.condition)})`;
}
