// Voie du compagnon animal (Rôdeur) — aides LDB pures, sans React.
// Référence : capacites-aventurier.ts (Voie du compagnon animal R1-5),
// bestiaire/compagnon-loup(-alpha).md.

import { CAPACITES } from "@/src/lib/data/capacites";
import { normaliserNomCapacite, type Caracteristiques } from "@/src/lib/rules/personnage";
import type { Character } from "@/src/lib/rules/types";

/** Voie du compagnon animal (Rôdeur). */
export const VOIE_COMPAGNON_ANIMAL = "Voie du compagnon animal";

/** Caracs officielles du loup (compagnon rang 1). */
export const CARACS_LOUP: Caracteristiques = {
  AGI: 1, CON: 1, FOR: 2, PER: 2, CHA: -2, INT: -3, VOL: 2,
};

/** Caracs officielles du loup alpha (rang 4 : CON +3, FOR +5). */
export const CARACS_LOUP_ALPHA: Caracteristiques = {
  AGI: 1, CON: 3, FOR: 5, PER: 2, CHA: -2, INT: -3, VOL: 2,
};

export interface PorteurCompagnon {
  capacites?: string[];
  sorts?: { nom: string; voie?: string; rang?: number }[];
}

/** Tirets unifiés (livre "Droite‑gauche" vs saisie) pour comparer les talents. */
function cleTalentCompagnon(nom: string): string {
  return normaliserNomCapacite(nom).replace(/[‑–—]/g, "-");
}

/** Carte nom normalisé -> { voie, rang } pour le profil Rôdeur. */
let _carte: Map<string, { voie: string; rang: number }> | null = null;
function carteRodeur(): Map<string, { voie: string; rang: number }> {
  if (_carte) return _carte;
  _carte = new Map();
  for (const v of CAPACITES["Rôdeur"] ?? CAPACITES["Rodeur"] ?? []) {
    for (const c of v.capacites) {
      _carte.set(cleTalentCompagnon(c.nom), { voie: v.voie, rang: c.rang });
    }
  }
  return _carte;
}

/** Rangs connus dans la Voie du compagnon animal (talents ; pas de sorts à PM). */
export function rangsCompagnonConnus(porteur: PorteurCompagnon): number[] {
  const rangs: number[] = [];
  for (const nom of porteur.capacites ?? []) {
    const loc = carteRodeur().get(cleTalentCompagnon(nom));
    if (loc && loc.voie === VOIE_COMPAGNON_ANIMAL) rangs.push(loc.rang);
  }
  for (const s of porteur.sorts ?? []) {
    if (s.voie === VOIE_COMPAGNON_ANIMAL && s.rang) rangs.push(s.rang);
    else if (s.voie == null || s.voie === undefined) {
      const loc = carteRodeur().get(cleTalentCompagnon(s.nom));
      if (loc && loc.voie === VOIE_COMPAGNON_ANIMAL) rangs.push(loc.rang);
    }
  }
  return rangs;
}

/**
 * Rang dans la Voie du compagnon animal (base DEF du loup : 12 + ce rang).
 * Plancher 1 (Le loup connu mais voie illisible : MJ).
 */
export function rangVoieCompagnon(porteur: PorteurCompagnon): number {
  const rangs = rangsCompagnonConnus(porteur);
  if (rangs.length === 0) return 1;
  return Math.max(...rangs);
}

/** Le porteur connaît-il ce talent (insensible casse/tirets) ? */
export function connaitTalent(porteur: PorteurCompagnon, nom: string): boolean {
  const q = cleTalentCompagnon(nom);
  if ((porteur.capacites ?? []).some((t) => cleTalentCompagnon(t) === q)) return true;
  return (porteur.sorts ?? []).some((s) => cleTalentCompagnon(s.nom) === q);
}

/**
 * Nombre de rangs 5 dans les voies de Rôdeur (Tactiques de meute : +1 DEF
 * chacun au rôdeur ET au loup, voie du compagnon incluse).
 */
export function nbRang5VoiesRodeur(porteur: PorteurCompagnon): number {
  const voies = CAPACITES["Rôdeur"] ?? CAPACITES["Rodeur"] ?? [];
  const connus = new Set([
    ...(porteur.capacites ?? []).map((t) => cleTalentCompagnon(t)),
    ...(porteur.sorts ?? []).map((s) => cleTalentCompagnon(s.nom)),
  ]);
  let n = 0;
  for (const v of voies) {
    if (v.capacites.some((x) => x.rang === 5 && connus.has(cleTalentCompagnon(x.nom)))) n += 1;
  }
  return n;
}

/** Bonus DEF Tactiques (0 sans le talent) : commun rôdeur + loup. */
export function bonusDefTactiques(porteur: PorteurCompagnon): number {
  if (!connaitTalent(porteur, "Tactiques de meute")) return 0;
  return nbRang5VoiesRodeur(porteur);
}

/** Facteur Lien empathique : 1 PV rôdeur = 1 PV loup (2 avec Tactiques). */
export function facteurLienEmpathique(porteur: PorteurCompagnon): number {
  return connaitTalent(porteur, "Tactiques de meute") ? 2 : 1;
}

/**
 * Loup alpha ? Nom du talent OU rang ≥ 4 dans la voie (le R4 de cette voie
 * EST Loup alpha ; le R5 Tactiques le présuppose). Le repli rang couvre les
 * fiches éditées à la main ou les variantes de libellé.
 */
export function estAlpha(porteur: PorteurCompagnon): boolean {
  return connaitTalent(porteur, "Loup alpha") || rangVoieCompagnon(porteur) >= 4;
}

/** PV max du loup : niveau du rôdeur × 4. */
export function pvMaxLoup(niveau: number): number {
  return Math.max(1, Math.floor(niveau)) * 4;
}

/** DEF du loup : 12 + rang dans la voie + bonus Tactiques (voies Rôdeur, incluse). */
export function defenseLoup(porteur: PorteurCompagnon): number {
  return 12 + rangVoieCompagnon(porteur) + bonusDefTactiques(porteur);
}

/** La fiche maître a-t-elle un compagnon (talent Le loup) ? */
export function aUnLoup(maitre: Pick<Character, "capacites">): boolean {
  return (maitre.capacites ?? []).some((t) => cleTalentCompagnon(t) === "le loup");
}

/** Id stable de la pseudo-fiche loup dérivée d'un maître. */
export const PREFIXE_FICHE_LOUP = "compagnon-loup:";
export function idFicheLoup(maitreId: string): string {
  return `${PREFIXE_FICHE_LOUP}${maitreId}`;
}

/**
 * Pseudo-fiche du loup pour le hors combat (cible de soins, rituels...) :
 * personnage à part entière dérivé de la fiche maître (PV persistés via
 * `maitre.compagnon.pv`, sinon pleins). Null sans Le loup.
 * Jamais recalculée (pvMax loup = niv×4, pas la formule des familles).
 */
export function ficheLoup(maitre: Character): Character | null {
  if (!aUnLoup(maitre)) return null;
  const porteur: PorteurCompagnon = {
    capacites: maitre.capacites ?? [],
    sorts: (maitre.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })),
  };
  const alpha = estAlpha(porteur);
  const niv = Math.max(1, Math.floor(maitre.niveau));
  const pvMax = pvMaxLoup(niv);
  const stocke = maitre.compagnon?.pv;
  const pv = stocke == null ? pvMax : Math.max(0, Math.min(pvMax, Math.floor(stocke)));
  return {
    id: idFicheLoup(maitre.id),
    kind: "personnage",
    nom: `${alpha ? "Loup alpha" : "Loup"} (${maitre.nom})`,
    classe: "Loup",
    niveau: niv,
    pvMax,
    pv,
    defense: defenseLoup(porteur),
    initMod: maitre.initMod,
    caracteristiques: { ...(alpha ? CARACS_LOUP_ALPHA : CARACS_LOUP) },
    peuple: "Animal",
    famille: "Aventurier",
    profil: "Rôdeur",
    capacites: [],
    ressources: {
      mana: { max: 0, actuel: 0 },
      chance: { max: 0, actuel: 0 },
    },
    attaques: [],
    effets: [],
    inventaire: [],
    sorts: [],
    exemple: false,
  };
}
