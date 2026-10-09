import type { ActiveEffect } from "@/src/lib/rules/types";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";

let counter = 0;

export function createEffect(
  keyOrNom: string,
  opts: { dureeTours?: number | null; source?: string; modificateurs?: Record<string, number>; description?: string } = {}
): ActiveEffect {
  const tpl = EFFECT_CATALOG.find((t) => t.key === keyOrNom || t.nom === keyOrNom);
  const duree = opts.dureeTours !== undefined ? opts.dureeTours : tpl?.dureeDefaut ?? null;
  counter += 1;
  return {
    id: `eff-${Date.now().toString(36)}-${counter}`,
    nom: tpl?.nom ?? keyOrNom,
    description: opts.description ?? tpl?.description ?? "",
    dureeTours: duree,
    toursRestants: duree,
    modificateurs: opts.modificateurs ?? tpl?.modificateurs ?? {},
    source: opts.source,
  };
}

/** Somme des modificateurs d'une clé (ex: "attaque", "defense"). */
export function getModifier(effets: ActiveEffect[], cle: string): number {
  return effets.reduce((sum, e) => sum + (e.modificateurs[cle] ?? 0), 0);
}

export function canAct(effets: ActiveEffect[]): boolean {
  return getModifier(effets, "empecheAgir") <= 0;
}

export function addEffect(effets: ActiveEffect[], effet: ActiveEffect): ActiveEffect[] {
  return [...effets, effet];
}

export function removeEffect(effets: ActiveEffect[], effetId: string): ActiveEffect[] {
  return effets.filter((e) => e.id !== effetId);
}

/**
 * Tick au début du tour du propriétaire : dégâts/soins par tour + décrément.
 * Retourne effets restants, variation PV et effets expirés.
 */
export function tickEffects(effets: ActiveEffect[]): { restants: ActiveEffect[]; pvDelta: number; expires: ActiveEffect[] } {
  let pvDelta = 0;
  const restants: ActiveEffect[] = [];
  const expires: ActiveEffect[] = [];
  for (const e of effets) {
    pvDelta += e.modificateurs["pvParTour"] ?? 0;
    if (e.toursRestants === null) {
      restants.push(e);
    } else {
      const r = e.toursRestants - 1;
      if (r <= 0) expires.push({ ...e, toursRestants: 0 });
      else restants.push({ ...e, toursRestants: r });
    }
  }
  return { restants, pvDelta, expires };
}
