// Voie des soins (Prêtre) — aides LDB pures, sans React.
// Référence : capacites-mystique.ts (Voie des soins R1-5), sorts.ts (grimoire).

import { CAPACITES } from "@/src/lib/data/capacites";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";
import {
  deEvolutif,
  type Rng,
} from "@/src/lib/rules/dice/roller";

/** Les 5 voies de prêtre (D R S) : bonus rang 3 / rang 5 comptés dessus. */
export const VOIES_PRETRE = [
  "Voie de la foi",
  "Voie de la guerre sainte",
  "Voie de la prière",
  "Voie des soins",
  "Voie de la spiritualité",
] as const;

export const VOIE_SOINS = "Voie des soins";

/** Clés journalières (normalisées) : mineure, phénix, rétablissement. */
export const CLE_MINEURE = "récupération mineure";
export const CLE_PHENIX = "phénix";
export const CLE_RETABLISSEMENT = "rétablissement";
export const CLE_VIGUEUR = "vigueur divine";
export const CLE_MAJEURE = "récupération majeure";

export interface PorteurSoins {
  capacites?: string[];
  sorts?: { nom: string; voie?: string; rang?: number }[];
}

/** Carte nom normalisé -> { voie, rang } pour les 5 voies de prêtre. */
function cartePretre(): Map<string, { voie: string; rang: number }> {
  const map = new Map<string, { voie: string; rang: number }>();
  for (const v of CAPACITES["Prêtre"] ?? []) {
    if (!(VOIES_PRETRE as readonly string[]).includes(v.voie)) continue;
    for (const c of v.capacites) {
      map.set(normaliserNomCapacite(c.nom), { voie: v.voie, rang: c.rang });
    }
  }
  return map;
}

let _carte: Map<string, { voie: string; rang: number }> | null = null;
function carte(): Map<string, { voie: string; rang: number }> {
  if (!_carte) _carte = cartePretre();
  return _carte;
}

/** Rangs connus par voie de prêtre (talents + sorts, par nom normalisé). */
export function rangsPretreConnus(porteur: PorteurSoins): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  const ajoute = (voie: string, rang: number) => {
    if (!voie || !rang) return;
    if (!(VOIES_PRETRE as readonly string[]).includes(voie)) return;
    if (!map.has(voie)) map.set(voie, new Set());
    map.get(voie)!.add(rang);
  };
  for (const nom of porteur.capacites ?? []) {
    const loc = carte().get(normaliserNomCapacite(nom));
    if (loc) ajoute(loc.voie, loc.rang);
  }
  for (const s of porteur.sorts ?? []) {
    if (s.voie && s.rang) ajoute(s.voie, s.rang);
    else {
      // Sort copié sans voie/rang (vieille fiche) : repli via le nom.
      const loc = carte().get(normaliserNomCapacite(s.nom));
      if (loc) ajoute(loc.voie, loc.rang);
    }
  }
  return map;
}

/** Rang atteint dans la Voie des soins (0 si inconnue). */
export function rangVoieSoins(porteur: PorteurSoins): number {
  const set = rangsPretreConnus(porteur).get(VOIE_SOINS);
  if (!set || set.size === 0) return 0;
  return Math.max(...set);
}

/** Nombre de voies de prêtre AUTRES que soins avec rang 3 atteint (+1 usage mineure chacune). */
export function nbRang3AutresVoiesPretre(porteur: PorteurSoins): number {
  const map = rangsPretreConnus(porteur);
  let n = 0;
  for (const v of VOIES_PRETRE) {
    if (v === VOIE_SOINS) continue;
    if (map.get(v)?.has(3)) n += 1;
  }
  return n;
}

/** Nombre de voies de prêtre avec rang 5 atteint (+1d4° chacune sur majeure/rétablissement). */
export function nbRang5VoiesPretre(porteur: PorteurSoins): number {
  const map = rangsPretreConnus(porteur);
  let n = 0;
  for (const v of VOIES_PRETRE) {
    if (map.get(v)?.has(5)) n += 1;
  }
  return n;
}

/** Usages journaliers de Récupération mineure : rang soins + 1 par rang 3 hors soins. */
export function quotaMineureParJour(porteur: PorteurSoins): number {
  return Math.max(0, rangVoieSoins(porteur) + nbRang3AutresVoiesPretre(porteur));
}

/** Usages restants aujourd'hui (0 si quota épuisé). */
export function usagesMineureRestants(
  porteur: PorteurSoins,
  usagesJournaliers?: Record<string, number>
): number {
  const quota = quotaMineureParJour(porteur);
  const utilises = usagesJournaliers?.[CLE_MINEURE] ?? 0;
  return Math.max(0, quota - utilises);
}

/** Phénix / Rétablissement : 1/jour. Vrai si déjà utilisé aujourd'hui. */
export function dejaUtiliseAujourdhui(
  cle: string,
  usagesJournaliers?: Record<string, number>
): boolean {
  return (usagesJournaliers?.[cle] ?? 0) >= 1;
}

export interface LancerSoinPretre {
  total: number;
  details: number[];
  /** Dés de base lancés (sans CHA ni bonus rang 5). */
  detailsBase: number[];
  /** Dés bonus rang 5 (1d évolutif chacun). */
  detailsBonusRang5: number[];
  cha: number;
  nbBonusRang5: number;
  expression: string;
}

/**
 * Lance un soin de prêtre : base (1d4° mineure, 3d4° majeure) + CHA + 1d4° par
 * rang 5 en voie de prêtre (majeure/rétablissement ; 0 pour mineure).
 * Dés évolutifs au niveau du lanceur (d4 1-5, d6 6-8, d8 9-11, d10 12-14, d12 15+).
 */
export function lancerSoinPretre(
  baseDes: "1d4°" | "3d4°",
  cha: number,
  nbBonusRang5: number,
  niveau: number,
  rng: Rng = Math.random
): LancerSoinPretre {
  const niv = Math.max(1, Math.floor(niveau));
  const faces = deEvolutif(niv);
  const compteBase = baseDes === "1d4°" ? 1 : 3;
  const detailsBase: number[] = [];
  for (let i = 0; i < compteBase; i++) {
    detailsBase.push(Math.floor(rng() * faces) + 1);
  }
  const detailsBonusRang5: number[] = [];
  for (let i = 0; i < Math.max(0, nbBonusRang5); i++) {
    detailsBonusRang5.push(Math.floor(rng() * faces) + 1);
  }
  const total =
    detailsBase.reduce((a, b) => a + b, 0) +
    detailsBonusRang5.reduce((a, b) => a + b, 0) +
    cha;
  const expression =
    `${compteBase}d${faces}+CHA` +
    (nbBonusRang5 > 0 ? `+${nbBonusRang5}d${faces}(R5)` : "");
  return {
    total: Math.max(0, total),
    details: [...detailsBase, ...detailsBonusRang5],
    detailsBase,
    detailsBonusRang5,
    cha,
    nbBonusRang5: Math.max(0, nbBonusRang5),
    expression,
  };
}

/** Soin mineure : 1d4° + CHA, sans bonus rang 5. */
export function lancerMineure(cha: number, niveau: number, rng: Rng = Math.random): LancerSoinPretre {
  return lancerSoinPretre("1d4°", cha, 0, niveau, rng);
}

/** Soin majeure / rétablissement : 3d4° + CHA + 1d4° par rang 5 en voie de prêtre. */
export function lancerMajeure(
  cha: number,
  nbRang5: number,
  niveau: number,
  rng: Rng = Math.random
): LancerSoinPretre {
  return lancerSoinPretre("3d4°", cha, nbRang5, niveau, rng);
}

/** Patients max du Rétablissement : une créature par point de CHA (modificateur, min 1). */
export function patientsMaxRetablissement(cha: number): number {
  return Math.max(1, Math.floor(cha));
}

/** Nom normalisé d'un sort/talent (clé journalière / comparaison). */
export function cleSoin(nom: string): string {
  return normaliserNomCapacite(nom);
}

/** Ce sort est-il un soin de la Voie des soins (mineure/majeure/rétablissement) ? */
export function estSoinVoieSoins(nom: string): boolean {
  const q = normaliserNomCapacite(nom);
  return (
    q === CLE_MINEURE ||
    q === CLE_MAJEURE ||
    q === CLE_RETABLISSEMENT
  );
}
