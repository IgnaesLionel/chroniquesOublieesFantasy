// Générateur pseudo-aléatoire déterministe du moteur de rencontres.
// Aucun accès à Math.random : une graine suffit à reproduire une proposition.
// (algorithme mulberry32, domaine public, adapté aux tests et à la calibration)

export type Rng = () => number;

/** Graine entière (32 bits) -> générateur reproductible dans [0, 1). */
export function mulberry32(graine: number): Rng {
  let a = Math.floor(graine) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine stable à partir d'un texte (thème, options, etc.). */
export function graineDepuisTexte(texte: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Tirage uniforme dans [0, max). */
export function entier(rng: Rng, max: number): number {
  return Math.floor(rng() * Math.max(1, max));
}

/** Tirage uniforme dans [min, max] inclus. */
export function entierEntre(rng: Rng, min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  if (b <= a) return a;
  return a + entier(rng, b - a + 1);
}

/** Élément au hasard (null si la liste est vide). */
export function choix<T>(rng: Rng, liste: T[]): T | null {
  if (liste.length === 0) return null;
  return liste[entier(rng, liste.length)];
}

/** Tirage pondéré : les poids <= 0 sont ignorés. */
export function choixPondere<T>(rng: Rng, liste: T[], poids: (element: T) => number): T | null {
  if (liste.length === 0) return null;
  let total = 0;
  const cumuls: number[] = [];
  for (const e of liste) {
    total += Math.max(0, poids(e));
    cumuls.push(total);
  }
  if (total <= 0) return liste[entier(rng, liste.length)];
  const t = rng() * total;
  for (let i = 0; i < cumuls.length; i++) {
    if (t < cumuls[i]) return liste[i];
  }
  return liste[liste.length - 1];
}

/** Mélange de Fisher-Yates (copie). */
export function melanger<T>(rng: Rng, liste: T[]): T[] {
  const out = [...liste];
  for (let i = out.length - 1; i > 0; i--) {
    const j = entier(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
