import type { ActionDRS } from "@/src/lib/rules/types";

/** Aide courte affichée sous le type d'action sélectionné (combat). */
export const AIDE_ACTION: Record<ActionDRS, string> = {
  attaque: "Action d'attaque : le mouvement reste disponible.",
  mouvement: "Action de mouvement : l'action reste disponible.",
  limitee: "Action limitée : remplace l'action et le mouvement.",
  gratuite: "Action gratuite : ne consomme ni action ni mouvement.",
};

export const AIDE_PASSIF =
  "Aucune action déclarée : effet passif, réactif ou à arbitrer par le MJ.";

/** Texte d'aide pour un type d'action, y compris l'absence d'action (passif). */
export function aideAction(action?: ActionDRS | null): string {
  return action ? AIDE_ACTION[action] : AIDE_PASSIF;
}
