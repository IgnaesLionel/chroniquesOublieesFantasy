// Bourse des personnages (pa / po / pp, 100 pa = 10 po = 1 pp).
// Pur TypeScript, sans React.
//
// La bourse garde les coupures (pas de conversion automatique) : un gain
// s'ajoute dans ses coupures, une dépense rend la monnaie en cassant les
// grosses coupures seulement si besoin. `consoliderBourse` regroupe vers
// le haut (150 pa → 1 pp, 5 po). Dépenser plus que le total = erreur.

import {
  convertirPa,
  formaterPa,
  VALEUR_PA,
  type UniteMonnaie,
} from "@/src/lib/rules/tresors";

export interface Bourse {
  pp: number;
  po: number;
  pa: number;
}

export const BOURSE_VIDE: Bourse = { pp: 0, po: 0, pa: 0 };

const clampPiece = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/** Bourse normalisée (coupures manquantes → 0, négatifs et décimaux exclus). */
export function normaliserBourse(input?: Partial<Bourse> | null): Bourse {
  return {
    pp: clampPiece(input?.pp),
    po: clampPiece(input?.po),
    pa: clampPiece(input?.pa),
  };
}

/** Total en pa (1 po = 10 pa, 1 pp = 100 pa). */
export function totalPaBourse(bourse: Partial<Bourse>): number {
  const b = normaliserBourse(bourse);
  return b.pp * VALEUR_PA.pp + b.po * VALEUR_PA.po + b.pa;
}

/** La bourse est-elle vide ? */
export function bourseVide(bourse: Partial<Bourse>): boolean {
  return totalPaBourse(bourse) === 0;
}

/** Ajoute un gain (par coupures, sans consolidation). */
export function ajouterBourse(bourse: Bourse, gain: Partial<Bourse>): Bourse {
  const b = normaliserBourse(bourse);
  const g = normaliserBourse(gain);
  return { pp: b.pp + g.pp, po: b.po + g.po, pa: b.pa + g.pa };
}

/**
 * Dépense un coût (par coupures) en rendant la monnaie : casse les grosses
 * coupures seulement si besoin (1 pp + 0 po + 0 pa − 50 pa → 0 pp + 0 po + 50 pa).
 * Fonds insuffisants = erreur (bourse inchangée).
 */
export function depenserBourse(bourse: Bourse, cout: Partial<Bourse>): Bourse {
  const b = normaliserBourse(bourse);
  const c = normaliserBourse(cout);
  if (totalPaBourse(b) < totalPaBourse(c)) {
    throw new Error(`Fonds insuffisants (${formaterPa(totalPaBourse(b))} pour ${formaterPa(totalPaBourse(c))}).`);
  }
  let { pp, po, pa } = b;
  while (pa < c.pa) {
    if (po > 0) {
      po -= 1;
      pa += VALEUR_PA.po;
    } else {
      pp -= 1;
      po += VALEUR_PA.pp / VALEUR_PA.po;
    }
  }
  pa -= c.pa;
  while (po < c.po) {
    pp -= 1;
    po += VALEUR_PA.pp / VALEUR_PA.po;
  }
  po -= c.po;
  pp -= c.pp;
  return { pp, po, pa };
}

/** Regroupe vers le haut (150 pa → 1 pp et 5 po). */
export function consoliderBourse(bourse: Partial<Bourse>): Bourse {
  const r = convertirPa(totalPaBourse(bourse));
  return { pp: r.pp, po: r.po, pa: r.pa };
}

export interface Partage {
  /** Part entière par bénéficiaire. */
  part: number;
  /** Reste non distribué. */
  reste: number;
}

/** Partage à parts égales (reste explicite, au MJ). */
export function partagerEgale(totalPa: number, nombre: number): Partage {
  const n = Math.max(0, Math.floor(nombre));
  if (n === 0) return { part: 0, reste: Math.max(0, Math.floor(totalPa)) };
  const part = Math.floor(Math.max(0, totalPa) / n);
  return { part, reste: Math.max(0, Math.floor(totalPa)) - part * n };
}

/** Ajuste une coupure de ±n (plancher 0 sur la coupure, sans rendre la monnaie). */
export function ajusterCoupure(bourse: Bourse, unite: UniteMonnaie, delta: number): Bourse {
  const b = normaliserBourse(bourse);
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return { ...b, [unite]: Math.max(0, b[unite] + d) };
}
