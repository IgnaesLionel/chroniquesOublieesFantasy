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

/** Libellé exact de ce que le moteur applique pour chaque clé (règles → Règles). */
export function decrireModificateurs(mods: Record<string, number>): string[] {
  const lignes: string[] = [];
  const push = (cle: string, texte: (v: number) => string) => {
    const v = mods[cle];
    if (typeof v === "number" && v !== 0) lignes.push(texte(v));
  };
  push("attaque", (v) => `${v > 0 ? "+" : ""}${v} aux jets d'attaque`);
  push("attaqueDistance", (v) => `${v > 0 ? "+" : ""}${v} aux attaques à distance (en plus)`);
  push("defense", (v) => `${v > 0 ? "+" : ""}${v} en DEF`);
  push("pvParTour", (v) => `${v > 0 ? "+" : ""}${v} PV au début de son tour`);
  if ((mods["empecheAgir"] ?? 0) > 0) lignes.push("ne peut pas agir (tour sauté)");
  if ((mods["inciblable"] ?? 0) > 0) lignes.push("inciblable (attaques extérieures impossibles)");
  if ((mods["moribond"] ?? 0) > 0) lignes.push("moribond (décès au prochain tour sauf libération/soin)");
  if ((mods["protection"] ?? 0) > 0) lignes.push("protection : bonus consommé à la prochaine attaque subie");
  if ((mods["paralyse"] ?? 0) > 0) lignes.push("touché automatiquement, critique subi");
  if ((mods["deBonus"] ?? 0) > 0) lignes.push("dé bonus (2d20, garder le meilleur)");
  if ((mods["deMalus"] ?? 0) > 0) lignes.push("dé malus (2d20, garder le pire)");
  if ((mods["pasDeDeplacement"] ?? 0) > 0) lignes.push("pas de déplacement (MJ)");
  if ((mods["actionUnique"] ?? 0) > 0) lignes.push("une seule action par round (MJ)");
  if ((mods["ripostePosture"] ?? 0) > 0) lignes.push("posture de riposte (MJ : riposte immédiate si attaqué au contact, 1/round)");
  if (typeof mods["deplacementMax"] === "number") lignes.push(`déplacement max ${mods["deplacementMax"]} m par action de mouvement (MJ)`);
  if (typeof mods["seuilCrit"] === "number") lignes.push(`critique dès ${mods["seuilCrit"]} naturel`);
  if ((mods["parade"] ?? 0) > 0) lignes.push("parade (test opposé, capacité)");
  if ((mods["absorption"] ?? 0) > 0) lignes.push("absorption de sort (capacité)");
  for (const cle of Object.keys(mods).sort()) {
    if (["attaque", "attaqueDistance", "defense", "pvParTour", "empecheAgir", "inciblable", "moribond", "protection", "paralyse", "deBonus", "deMalus", "pasDeDeplacement", "actionUnique", "ripostePosture", "deplacementMax", "seuilCrit", "parade", "absorption"].includes(cle)) continue;
    lignes.push(`${cle} ${mods[cle]}`);
  }
  return lignes;
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
 * Marque un effet avec le tour de pose (manche + index dans l'ordre
 * d'initiative). À appeler à chaque fois qu'un effet entre en combat, pour
 * que la fin de tour ne le consomme pas le tour même où il a été appliqué.
 */
export function marquerPose(
  effet: ActiveEffect,
  manche: number,
  tourIndex: number
): ActiveEffect {
  return { ...effet, pose: { manche, tourIndex } };
}

/**
 * Dégâts/soins par tour dus au début du tour du porteur (ex: Saignement),
 * SANS décrémenter les durées : celles-ci sont consommées à la FIN du tour
 * du porteur (voir decrementerFinDeTour), pour qu'un effet "1 tour" couvre
 * tout le tour de sa cible avant d'expirer.
 */
export function pvParTourTotal(effets: ActiveEffect[]): number {
  return effets.reduce((sum, e) => sum + (e.modificateurs["pvParTour"] ?? 0), 0);
}

/**
 * Tick de FIN de tour du porteur : décrémente les durées et retourne les
 * effets restants + expirés. Un effet posé pendant le tour qui se termine
 * (même manche, même index) n'est pas décrémenté : il vient d'être appliqué
 * et doit encore couvrir un tour complet. Le marqueur de pose est nettoyé
 * au premier traitement (utile ou non ensuite).
 */
export function decrementerFinDeTour(
  effets: ActiveEffect[],
  finManche: number,
  finTourIndex: number
): { restants: ActiveEffect[]; expires: ActiveEffect[] } {
  const restants: ActiveEffect[] = [];
  const expires: ActiveEffect[] = [];
  for (const e of effets) {
    const { pose, ...sansPose } = e;
    const frais = pose != null && pose.manche === finManche && pose.tourIndex === finTourIndex;
    if (frais) {
      restants.push(sansPose);
      continue;
    }
    if (e.toursRestants === null) {
      restants.push(sansPose);
    } else {
      const r = e.toursRestants - 1;
      if (r <= 0) expires.push({ ...sansPose, toursRestants: 0 });
      else restants.push({ ...sansPose, toursRestants: r });
    }
  }
  return { restants, expires };
}

/**
 * Tick au début du tour du propriétaire : dégâts/soins par tour + décrément.
 * Retourne effets restants, variation PV et effets expirés.
 *
 * Historique : décrémentait aussi les durées, ce qui faisait expirer un
 * malus "1 tour" AVANT que sa cible ne joue (posé par le sorcier, consommé
 * dès l'arrivée du tour de l'ennemi). Conservé pour compatibilité (tests,
 * usages hors nextTurn) — le moteur de combat utilise désormais
 * pvParTourTotal (début de tour) + decrementerFinDeTour (fin de tour).
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
