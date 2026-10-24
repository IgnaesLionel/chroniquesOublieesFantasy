import { parseDiceExpression, rollDiceExpression, resoudreFormuleSort, substituerDesEvolutifs, substituerStats, dureeEffetSort, type Rng } from "@/src/lib/rules/dice/roller";
import { canAct, createEffect, getModifier, marquerPose, attaqueInterdite } from "@/src/lib/rules/effects/effects";
import { cibleEspeceAcceptee, estVivant } from "@/src/lib/rules/categories";
import { niveauMinRang, normaliserNomCapacite } from "@/src/lib/rules/creation";
import { ARME_FAMILLES } from "@/src/lib/rules/world/types";
import { drType, niveauAttaque, rangVoieBouclier } from "@/src/lib/rules/personnage";
import { CAPACITES } from "@/src/lib/data/capacites";
import {
  CLE_MINEURE,
  CLE_PHENIX,
  CLE_RETABLISSEMENT,
  VOIE_SOINS,
  dejaUtiliseAujourdhui,
  lancerMajeure,
  lancerMineure,
  nbRang3AutresVoiesPretre,
  nbRang5VoiesPretre,
  patientsMaxRetablissement,
  quotaMineureParJour,
  rangVoieSoins,
  usagesMineureRestants,
  type PorteurSoins,
} from "@/src/lib/rules/soins";
import {
  CARACS_LOUP,
  CARACS_LOUP_ALPHA,
  bonusDefTactiques,
  estAlpha,
  facteurLienEmpathique,
  rangVoieCompagnon,
} from "@/src/lib/rules/compagnon";
import type { ActiveEffect, AttackDef, Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import type {
  AttackResolution,
  AttaqueGratuite,
  Camp,
  CombatOptions,
  CombatParticipant,
  CombatState,
  SortAbsorbe,
  TypeAttaqueGratuite,
} from "@/src/lib/rules/combat/types";
import { DEFAULT_COMBAT_OPTIONS, LABEL_ATTAQUE_GRATUITE } from "@/src/lib/rules/combat/types";
import { composantesAttaque, seuilDefense } from "@/src/lib/rules/combat/touche";

function stamp(): string {
  return new Date().toISOString();
}

/** Niveau effectif pour les dés évolutifs (°) : plancher niv. 1. */
function niveauEffectif(p: { niveau?: number } | null | undefined): number {
  return Math.max(1, Math.floor(p?.niveau ?? 1));
}

/** CHA effectif (modificateur COF, défaut 0) : participant (caracs) ou fiche (caracteristiques). */
function chaEffectif(p: { caracs?: Record<string, number>; caracteristiques?: Record<string, number> } | null | undefined): number {
  return p?.caracs?.CHA ?? p?.caracteristiques?.CHA ?? 0;
}

/** Porteur voie des soins depuis un participant (talents + sorts). */
function porteurDeParticipant(p: Pick<CombatParticipant, "capacites" | "sorts">): PorteurSoins {
  return { capacites: p.capacites ?? [], sorts: (p.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })) };
}

/** Porteur voie des soins depuis une fiche. */
function porteurDeFiche(c: Pick<Character, "capacites" | "sorts">): PorteurSoins {
  return { capacites: c.capacites ?? [], sorts: (c.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })) };
}

/** Nom de sort normalisé (quota journalier / comparaisons). */
function cleSort(nom: string): string {
  return normaliserNomCapacite(nom);
}

/**
 * Soin effectif d'un sort de la Voie des soins (LDB) :
 * - mineure : 1d4° + CHA (quota journalier rang + rang 3 hors soins) ;
 * - majeure / rétablissement : 3d4° + CHA + 1d4° par rang 5 en voie de prêtre.
 * Les autres soins (barde, druide...) gardent leur formule `soin` (dés
 * évolutifs + caracs substitués, sans bonus prêtre).
 */
function lancerSoinVoieSoins(
  sort: Sort,
  lanceur: Pick<CombatParticipant, "capacites" | "sorts" | "niveau" | "caracs">,
  rng: Rng
): { total: number; details: number[]; expression: string } | null {
  if (!sort.soin) return null;
  const q = cleSort(sort.nom);
  const cha = chaEffectif(lanceur);
  const niv = niveauEffectif(lanceur);
  const estVoieSoins = (sort as Sort).voie === VOIE_SOINS;
  if (q === CLE_MINEURE && estVoieSoins) {
    const r = lancerMineure(cha, niv, rng);
    return { total: r.total, details: r.details, expression: `1d4°+CHA(${cha})` };
  }
  if ((q === "récupération majeure" || q === CLE_RETABLISSEMENT) && estVoieSoins) {
    const n5 = nbRang5VoiesPretre(porteurDeParticipant(lanceur));
    const r = lancerMajeure(cha, n5, niv, rng);
    return {
      total: r.total,
      details: r.details,
      expression: `3d4°+CHA(${cha})${n5 > 0 ? `+${n5}d4°(R5)` : ""}`,
    };
  }
  // Autres soins : dés évolutifs + caracs (ex: barde, druide).
  const expr = substituerStats(substituerDesEvolutifs(sort.soin, niv), lanceur.caracs ?? {});
  const roll = rollDiceExpression(parseDiceExpression(expr), rng);
  return { total: Math.max(0, roll.total), details: roll.rolls, expression: expr };
}

/** Même calcul depuis une fiche (hors combat). */
function lancerSoinVoieSoinsFiche(
  sort: Sort,
  lanceur: Character,
  rng: Rng
): { total: number; details: number[]; expression: string } | null {
  if (!sort.soin) return null;
  const q = cleSort(sort.nom);
  const cha = chaEffectif(lanceur);
  const niv = Math.max(1, Math.floor(lanceur.niveau));
  const estVoieSoins = (sort as Sort).voie === VOIE_SOINS;
  if (q === CLE_MINEURE && estVoieSoins) {
    const r = lancerMineure(cha, niv, rng);
    return { total: r.total, details: r.details, expression: `1d4°+CHA(${cha})` };
  }
  if ((q === "récupération majeure" || q === CLE_RETABLISSEMENT) && estVoieSoins) {
    const n5 = nbRang5VoiesPretre(porteurDeFiche(lanceur));
    const r = lancerMajeure(cha, n5, niv, rng);
    return {
      total: r.total,
      details: r.details,
      expression: `3d4°+CHA(${cha})${n5 > 0 ? `+${n5}d4°(R5)` : ""}`,
    };
  }
  const expr = substituerStats(
    substituerDesEvolutifs(sort.soin, niv),
    lanceur.caracteristiques ?? {}
  );
  const roll = rollDiceExpression(parseDiceExpression(expr), rng);
  return { total: Math.max(0, roll.total), details: roll.rolls, expression: expr };
}

/**
 * Quota journalier d'un sort de soins (voie des soins) :
 * - mineure : rang soins + nb rang 3 hors soins ;
 * - rétablissement / phénix : 1/jour.
 * Les autres sorts : aucun quota (null). Exporté pour les panneaux (affichage restants).
 */
export function quotaJournalierSoin(
  sort: Sort,
  porteur: PorteurSoins
): { quota: number; utilises: number; restants: number; raison: string } | null {
  const q = cleSort(sort.nom);
  if (q === CLE_MINEURE) {
    const quota = quotaMineureParJour(porteur);
    return {
      quota,
      utilises: 0,
      restants: quota,
      raison: `Récupération mineure : rang soins ${rangVoieSoins(porteur)} + ${nbRang3AutresVoiesPretre(porteur)} rang 3 hors soins = ${quota}/jour`,
    };
  }
  if (q === CLE_RETABLISSEMENT || q === CLE_PHENIX) {
    return { quota: 1, utilises: 0, restants: 1, raison: `${q} : 1/jour` };
  }
  return null;
}

/** Quota mineure applicable ? Seulement pour la vraie voie des soins (voie renseignée
 * ou rang connu). Les homebrews sans voie ni rang ne sont pas bloqués (compat tests/MJ). */
function quotaMineureApplicable(sort: Sort, porteur: PorteurSoins): boolean {
  if (cleSort(sort.nom) !== CLE_MINEURE) return false;
  if (sort.voie === VOIE_SOINS) return true;
  if (quotaMineureParJour(porteur) > 0) return true;
  return false;
}
function incrementerJournalier(
  usages: Record<string, number> | undefined,
  cle: string
): Record<string, number> {
  return { ...(usages ?? {}), [cle]: (usages?.[cle] ?? 0) + 1 };
}

/**
 * Règle de table LDB (soins magiques en combat) : une cible ne bénéficie
 * normalement que d'un seul soin magique par combat. Le moteur bloque le 2e
 * soin (sort ou capacité à `soin`/`soinFixe`) sauf `outrepasser` MJ.
 */
function exigerSoinMagiqueUnique(
  cible: Pick<CombatParticipant, "nom" | "soinMagiqueRecu">,
  soinTotal: number,
  outrepasser?: boolean
): void {
  if (soinTotal <= 0) return;
  if (outrepasser) return;
  if (cible.soinMagiqueRecu) {
    throw new Error(
      `${cible.nom} a déjà reçu un soin magique ce combat (1/combat, MJ : outrepasser si règle de table contraire).`
    );
  }
}

/** Applique dégâts (plancher 0). KO si pv 0. Mort gérée manuellement / Phase 5. */
export function applyDamage(state: CombatState, targetId: string, amount: number, rng: Rng = Math.random): CombatState {
  const participants = state.participants.map((p) =>
    p.instanceId === targetId
      ? { ...p, pv: Math.max(0, p.pv - Math.max(0, amount)), statut: p.pv - Math.max(0, amount) <= 0 ? ("ko" as const) : p.statut }
      : p
  );
  return appliquerPhenixAutomatique(checkEnd({ ...state, participants }), rng);
}

/** Soin (plafond pvMax). Réactive un KO si pv > 0. */
export function applyHeal(state: CombatState, targetId: string, amount: number): CombatState {
  const participants = state.participants.map((p) => {
    if (p.instanceId !== targetId) return p;
    const pv = Math.min(p.pvMax, p.pv + Math.max(0, amount));
    return { ...p, pv, statut: pv > 0 ? ("actif" as const) : p.statut };
  });
  return checkEnd({ ...state, participants });
}

export function checkEnd(state: CombatState): CombatState {
  const pjVivants = state.participants.some((p) => p.camp === "pj" && p.statut === "actif");
  const monstresVivants = state.participants.some((p) => p.camp === "monstre" && p.statut === "actif");
  const hasPJ = state.participants.some((p) => p.camp === "pj");
  const hasMonstres = state.participants.some((p) => p.camp === "monstre");

  let termine = false;
  let gagnant: Camp | "egalite" | null = null;
  if (hasPJ && hasMonstres) {
    if (!pjVivants && !monstresVivants) {
      termine = true;
      gagnant = "egalite";
    } else if (!monstresVivants) {
      termine = true;
      gagnant = "pj";
    } else if (!pjVivants) {
      termine = true;
      gagnant = "monstre";
    }
  }
  if (termine && !state.termine) {
    return {
      ...state,
      termine,
      gagnant,
      log: [...state.log, { id: `log-${Date.now()}`, at: stamp(), manche: state.manche, message: `Combat terminé — ${gagnant === "pj" ? "victoire des PJ" : gagnant === "monstre" ? "victoire des monstres" : "égalité"}.` }],
    };
  }
  return { ...state, termine, gagnant: termine ? gagnant : null };
}

/**
 * Construit l'effet au toucher : jet de sauvegarde éventuel (CON 10 du Pied :
 * réussi = pas d'effet, les dégâts restent), dégâts par tour (dés évolutifs
 * substitués au niveau de l'attaquant : Saignements...),
 * modificateurs supplémentaires.
 */
export function creerEffetTouche(
  attaque: { effetTouche?: { cle: string; duree: number | null; degatsParTour?: string; mods?: Record<string, number>; sauvegarde?: { carac: string; difficulte: number; moitieDM?: boolean } } },
  attaquantNom: string,
  cible: Pick<CombatParticipant, "nom" | "caracs">,
  rng: Rng = Math.random,
  niveau = 1,
  caracs: Record<string, number> = {}
): { effet: ActiveEffect | null; saveLog: string | null; saveReussi: boolean | null } {
  const spec = attaque.effetTouche;
  if (!spec) return { effet: null, saveLog: null, saveReussi: null };
  let saveLog: string | null = null;
  let saveReussi: boolean | null = null;
  if (spec.sauvegarde) {
    const sv = spec.sauvegarde;
    // Carac inconnue : pas de 0 silencieux — estimation explicite (MJ).
    const caracConnue = cible.caracs != null && sv.carac in cible.caracs;
    const bonusCarac = cible.caracs?.[sv.carac] ?? 0;
    const jetS = Math.floor(rng() * 20) + 1;
    const totalS = jetS + bonusCarac;
    const reussi = totalS >= sv.difficulte;
    saveReussi = reussi;
    const detailCarac = !caracConnue
      ? " (carac inconnue : +0 par défaut — MJ)"
      : bonusCarac !== 0
        ? ` (${bonusCarac > 0 ? "+" : ""}${bonusCarac})`
        : "";
    saveLog = `${cible.nom} : test de ${sv.carac} ${jetS}${detailCarac} = ${totalS} vs diff ${sv.difficulte} → ${reussi ? (spec.sauvegarde?.moitieDM ? "moitié des DM" : `pas de ${spec.cle}`) : spec.cle}`;
    if (reussi) return { effet: null, saveLog, saveReussi };
  }
  const mods: Record<string, number> = { ...(spec.mods ?? {}) };
  if (spec.degatsParTour) {
    const dot = rollDiceExpression(parseDiceExpression(substituerStats(substituerDesEvolutifs(spec.degatsParTour, niveau), caracs)), rng);
    mods["pvParTour"] = -Math.max(0, dot.total);
  }
  return {
    effet: { ...createEffect(spec.cle, { dureeTours: spec.duree, source: attaquantNom }), modificateurs: mods },
    saveLog,
    saveReussi,
  };
}

/**
 * Attaque conditionnée par les PV du lanceur : utilisable seulement quand
 * pv <= pvMax × seuilPv (ex. 0.5 = à la moitié des PV ou moins).
 */
export function seuilPvRespecte(
  p: { pv: number; pvMax: number },
  attaque: { seuilPv?: number }
): boolean {
  if (attaque.seuilPv == null) return true;
  return p.pv <= p.pvMax * attaque.seuilPv;
}

/** Raison du blocage « seuil de PV » (null = usage autorisé). */
export function raisonSeuilPv(
  p: { pv: number; pvMax: number },
  attaque: { nom: string; seuilPv?: number }
): string | null {
  if (seuilPvRespecte(p, attaque)) return null;
  const pct = Math.round((attaque.seuilPv as number) * 100);
  return `${attaque.nom} : seulement à ${pct} % des PV ou moins (${p.pv}/${p.pvMax} PV)`;
}

/** Raison du blocage « cible vivante » (null = usage autorisé). */
export function raisonExigeVivant(
  attaque: { nom: string; exigeVivant?: boolean },
  cible: { nom?: string; camp?: string; categories?: string[] } | null | undefined
): string | null {
  if (!attaque.exigeVivant || !cible) return null;
  if (estVivant(cible)) return null;
  return `${attaque.nom} : cible non vivante (${cible.nom ?? "?"})`;
}

/**
 * Résout une attaque complète : limites -> coûts (mana + PV) ->
 * jet d'attaque (dé bonus/malus) -> dégâts -> PV -> effet -> vol de vie.
 * Toucher par défaut : 1d20 + bonus >= défense (les tests opposés COF sont
 * approximés par ce seuil ; voir page Règles).
 * Dé bonus = 2d20 garder le meilleur, dé malus = garder le pire (annulation
 * mutuelle). Touche auto (Rituel) : sans jet.
 */
export function resolveAttack(
  state: CombatState,
  attackerId: string,
  targetId: string,
  attackId: string,
  rng: Rng = Math.random,
  options: CombatOptions = DEFAULT_COMBAT_OPTIONS,
  attaqueOpts: AttaqueOpts = {},
  paiement: PaiementSort = {}
): { state: CombatState; resolution: AttackResolution } {
  const attaquant = state.participants.find((p) => p.instanceId === attackerId);
  const cible = state.participants.find((p) => p.instanceId === targetId);
  if (!attaquant) throw new Error("Attaquant introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  const attaque = attaquant.attaques.find((a) => a.id === attackId) ?? attaquant.attaques[0];
  if (!attaque) throw new Error(`${attaquant.nom} n'a aucune attaque.`);
  if (!canAct(attaquant.effets)) throw new Error(`${attaquant.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const sort = sortDeAttaque(attaquant, attaque.id);
  if (sort) {
    const lim = etatLimite(attaquant, sort, targetId);
    if (!lim.ok) throw new Error(`${attaquant.nom} : ${lim.raison}.`);
  }
  // Restriction d'espèce (ex: Destruction du mal -> morts-vivants uniquement) :
  // sur une autre espèce, touché ou non, le sort ne fait ni dégâts ni effet.
  const especeCibleOk = cibleEspeceAcceptee(sort, cible);
  // Cible vivante exigée (ex: Pied dans la tombe) : refusé (MJ).
  if (sort?.exigeVivant && !estVivant(cible)) {
    throw new Error(`${sort.nom} : cible non vivante (${cible.nom}) — capacité inapplicable.`);
  }
  // Taille maximale (ex: Ensevelissement, moyenne ou moins ; MJ pour le reste).
  if (sort?.tailleMax && !tailleAcceptee(cible.taille, sort.tailleMax)) {
    throw new Error(`${sort.nom} : ${cible.nom} est trop grand (${cible.taille ?? "?"}, max ${sort.tailleMax} — MJ).`);
  }
  // Enseveli : inciblable par les attaques extérieures.
  if (getModifier(cible.effets, "inciblable") > 0) {
    throw new Error(`${cible.nom} est enseveli : inciblable (MJ).`);
  }
  // Effroi : interdit d'attaquer la source de l'aura (test de SAG raté).
  if (attaqueInterdite(attaquant.effets, targetId)) {
    throw new Error(`${attaquant.nom} est sous Effroi : ne peut pas attaquer ${cible.nom} (MJ).`);
  }
  // Usage conditionné aux PV du lanceur (ex. Baiser du vampire : à moitié ou moins).
  const raisonPv = raisonSeuilPv(attaquant, attaque);
  if (raisonPv) {
    throw new Error(`${raisonPv} (MJ).`);
  }
  // Cible vivante exigée (ex. Vampirisation) : refusée sur morts-vivants et
  // construits (même règle que les sorts avec exigeVivant).
  const raisonVivant = raisonExigeVivant(attaque, cible);
  if (raisonVivant) {
    throw new Error(`${raisonVivant} — capacité inapplicable (MJ).`);
  }

  // Coûts avant le jet (le sacrifice est perdu même en cas d'échec).
  // Sautés si déjà payés (résolution groupée multi-cibles).
  let s = state;
  if (sort && !paiement.dejaPaye) s = payerCoutSort(s, attackerId, sort, paiement, rng).state;
  if (sort?.coutPV && !paiement.dejaPaye) s = applyCoutPV(s, attackerId, sort.coutPV, rng, niveauEffectif(attaquant)).state;

  // Décomposition partagée avec l'affichage de la chance de toucher
  // (touche.ts) : mêmes chiffres dans l'interface et dans le moteur.
  const situationAttaque = composantesAttaque(attaquant, attaque, {
    modAttaque: attaqueOpts.modAttaque,
    bonusOverride: attaqueOpts.bonusOverride,
    arme: estAttaqueArme(attaque),
    distance: estAttaqueDistance(attaque),
  });
  const modAttaque = situationAttaque.modEffets;
  // Aveuglé : −5 supplémentaire aux attaques à distance (−10 au total).
  const modDistance = situationAttaque.modDistance;
  const modDefense = getModifier(cible.effets, "defense");
  const bonusBase = situationAttaque.base;
  // Maître d'armes : la prédilection de la fiche couvre cette attaque ?
  // (+1 attaque, Science du critique 19-20, Spécialisation +N DM — auto).
  const matchPredilection = situationAttaque.predilection > 0;
  const bonusPredilection = situationAttaque.predilection;
  const bonusEffectif = situationAttaque.bonus;
  // Attaque assurée : DM divisés (après le critique, plancher entier).
  const diviseDM = attaqueOpts.diviseDM && attaqueOpts.diviseDM > 1 ? Math.floor(attaqueOpts.diviseDM) : 1;
  // Difficulté fixe du sort (ex: Saignements diff 10+CON de la cible) :
  // remplace le seuil de DEF (le jet garde son bonus). Sinon : DEF + effets.
  const difficulteSort = sort?.difficulteAttaque
    ? { formule: sort.difficulteAttaque, seuil: resoudreFormuleSort(sort.difficulteAttaque, cible.caracs ?? {}) }
    : null;
  const defenseEffective = difficulteSort ? difficulteSort.seuil : seuilDefense(cible);
  // Dés évolutifs (°) résolus au niveau de l'attaquant (d4 1-5 ... d12 15+).
  const nivAttaquant = niveauEffectif(attaquant);
  const degatsExpr = substituerDesEvolutifs(attaqueOpts.degatsOverride ?? attaque.degats, nivAttaquant);

  // Dé bonus / malus (effets + coups spéciaux : Puissante, Parfaite).
  const aBonus = getModifier(attaquant.effets, "deBonus") > 0 || attaqueOpts.deBonus === true;
  const aMalus = getModifier(attaquant.effets, "deMalus") > 0 || attaqueOpts.deMalus === true;
  const avantage = aBonus && !aMalus ? ("bonus" as const) : !aBonus && aMalus ? ("malus" as const) : null;
  const d1 = Math.floor(rng() * 20) + 1;
  let jetNaturel = d1;
  let jetSecondaire: number | null = null;
  if (avantage && !attaque.toucheAuto) {
    const d2 = Math.floor(rng() * 20) + 1;
    // Secondaire = le dé écarté (l'autre est gardé).
    if (avantage === "bonus") {
      jetNaturel = Math.max(d1, d2);
      jetSecondaire = Math.min(d1, d2);
    } else {
      jetNaturel = Math.min(d1, d2);
      jetSecondaire = Math.max(d1, d2);
    }
  }
  const jetTotal = jetNaturel + bonusEffectif;
  const critOpts = options.critique;
  // Test opposé d'attaque magique (ex: Pied, Ensevelissement) : d20 + magie
  // du lanceur contre d20 + magie de la cible (bonusEffectif garde les mods
  // du lanceur ; la cible applique ses dés bonus/malus). Attaquant gagne
  // les égalités. Dés de la cible lancés uniquement ici (séquences RNG
  // des autres sorts inchangées).
  const opposeMagique = sort?.testOppose === "magique" && !attaque.toucheAuto;
  const bonusMagiqueCible = cible.bonusMagique ?? niveauAttaque(cible.niveau) + (cible.caracs?.VOL ?? 0);
  const cDesBonus = opposeMagique && getModifier(cible.effets, "deBonus") > 0;
  const cDesMalus = opposeMagique && getModifier(cible.effets, "deMalus") > 0;
  const avantageCible = cDesBonus && !cDesMalus ? ("bonus" as const) : !cDesBonus && cDesMalus ? ("malus" as const) : null;
  let jetDefNaturel = 0;
  let jetDefSecondaire: number | null = null;
  let jetDefTotal = 0;
  if (opposeMagique) {
    const dd1 = Math.floor(rng() * 20) + 1;
    jetDefNaturel = dd1;
    if (avantageCible) {
      const dd2 = Math.floor(rng() * 20) + 1;
      if (avantageCible === "bonus") {
        jetDefNaturel = Math.max(dd1, dd2);
        jetDefSecondaire = Math.min(dd1, dd2);
      } else {
        jetDefNaturel = Math.min(dd1, dd2);
        jetDefSecondaire = Math.max(dd1, dd2);
      }
    }
    jetDefTotal = jetDefNaturel + bonusMagiqueCible;
  }

  let touche: boolean;
  let critique = false;
  // Seuil de critique : effets posés (effet "Critique 19-20", secours MJ) ;
  // AUTO maître d'armes : Science du critique connue + arme de prédilection.
  const seuils = attaquant.effets
    .map((e) => e.modificateurs["seuilCrit"])
    .filter((v): v is number => typeof v === "number");
  const critiqueAuto = matchPredilection && talentConnu(attaquant, "Science du critique");
  const seuilCrit = Math.min(...(seuils.length ? seuils : [20]), critiqueAuto ? 19 : 20);
  if (attaque.toucheAuto) {
    touche = true;
  } else if (critOpts.nat1EchecAuto && jetNaturel === 1) {
    touche = false;
  } else if (critOpts.nat20ToucheAuto && jetNaturel >= seuilCrit) {
    touche = true;
    critique = true;
  } else if (opposeMagique) {
    touche = jetTotal >= jetDefTotal;
  } else {
    touche = jetTotal >= defenseEffective;
  }
  // Paralysé : touché automatiquement et subit un critique (LDB).
  const cibleParalysee = !attaque.toucheAuto && getModifier(cible.effets, "paralyse") > 0;
  let paralyseLog: string | null = null;
  if (cibleParalysee) {
    touche = true;
    critique = true;
    paralyseLog = `${cible.nom} est paralysé : touché automatiquement (critique)`;
  }

  // Parade / absorption (Guerrier, bouclier requis) : test opposé sur attaque
  // réussie (contact ou distance, pas les touches auto).
  // Parade : bonus d'attaque au contact réel (bonusOppositionContact).
  // Absorption : remplace la parade contre un sort (stance Parade requise) ;
  // zones : autres cibles affectées (voir frapperZone).
  let pare = false;
  let absorbe: SortAbsorbe | null = null;
  let paradeLog: string | null = null;
  const sortAttaque = sortDeAttaque(attaquant, attaque.id);
  if (touche && !attaque.toucheAuto) {
    const veutParer = getModifier(cible.effets, "parade") > 0;
    const veutAbsorber = !!sortAttaque && veutParer && getModifier(cible.effets, "absorption") > 0;
    if (veutParer || veutAbsorber) {
      const { bonus: bonusParade, avantage: avantageParade } = bonusOppositionContact(cible);
      const dp1 = Math.floor(rng() * 20) + 1;
      let jetP = dp1;
      let jetPSecondaire: number | null = null;
      if (avantageParade) {
        const dp2 = Math.floor(rng() * 20) + 1;
        if (avantageParade === "bonus") {
          jetP = Math.max(dp1, dp2);
          jetPSecondaire = Math.min(dp1, dp2);
        } else {
          jetP = Math.min(dp1, dp2);
          jetPSecondaire = Math.max(dp1, dp2);
        }
      }
      const detail = avantageParade && jetPSecondaire != null
        ? `${dp1}, ${jetPSecondaire} (dé ${avantageParade} -> ${jetP})+`
        : `${jetP}+`;
      if (jetP + bonusParade >= jetTotal) {
        pare = true;
        if (veutAbsorber && sortAttaque) {
          absorbe = {
            nom: sortAttaque.nom,
            bonus: attaque.bonus,
            degats: attaque.degats,
            effetCle: sortAttaque.effetCle,
            effetDuree: dureeEffetSort(sortAttaque.effetDuree, attaquant.caracs ?? {}),
            effetDegats: sortAttaque.effetDegats,
            effetMods: sortAttaque.effetMods,
            zone: sortAttaque.zone,
          };
          paradeLog = `${cible.nom} absorbe ${sortAttaque.nom} (${detail}${bonusParade}=${jetP + bonusParade} vs ${jetTotal}) — Renvoi possible via Capacités`;
        } else {
          paradeLog = `${cible.nom} pare l'attaque de ${attaquant.nom} (${detail}${bonusParade}=${jetP + bonusParade} vs ${jetTotal}) !`;
        }
      } else {
        paradeLog = `${cible.nom} rate sa parade (${detail}${bonusParade}=${jetP + bonusParade} vs ${jetTotal}).`;
      }
    }
  }

  // Double peine (Rôdeur) : 2e touche même cible même round = +1d4° (une fois).
  const precedent = attaquant.dernierCoup;
  const doublePeineDeclenchee: boolean =
    ((touche || attaque.toucheAuto) &&
      !pare &&
      talentConnu(attaquant, "Double peine") &&
      !!precedent &&
      precedent.cibleId === targetId &&
      precedent.manche === s.manche &&
      !precedent.enchaine) === true;

  // Tactiques de meute (Rôdeur) : le loup gagne +1d4° auto quand il frappe
  // la même cible que son maître durant la même manche (mémoire du maître).
  let tactiquesDeclenchee = false;
  let tactiquesMaitre: string | null = null;
  if ((touche || attaque.toucheAuto) && !pare && estLoupCompagnon(attaquant)) {
    const maitre = trouverMaitreLoup(s.participants, attaquant);
    if (maitre && talentConnu(maitre, "Tactiques de meute")) {
      const mem = maitre.dernierCoup;
      if (mem && mem.cibleId === targetId && mem.manche === s.manche) {
        tactiquesDeclenchee = true;
        tactiquesMaitre = maitre.nom;
      }
    }
  }

  // Dégâts : normaux si touché non paré, moitié si raté (Briser), 0 sinon.
  // Bonus manuels et dés bonus (Puissante, Parfaite, spécialisation, Double peine) doublés en critique.
  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  let moitie = false;
  let bonusLog: string | null = null;
  let doublePeineLog: string | null = null;
  let tactiquesLog: string | null = null;
  if ((touche || attaque.toucheAuto) && !pare && especeCibleOk) {
    const expr = parseDiceExpression(degatsExpr);
    const roll = rollDiceExpression(expr, rng);
    degatsDetails = [...roll.rolls];
    degatsTotal = roll.total;
    const bonusDetails: string[] = [];
    for (const d of attaqueOpts.degatsBonus ?? []) {
      const b = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs(d, nivAttaquant)), rng);
      degatsDetails = [...degatsDetails, ...b.rolls];
      degatsTotal += Math.max(0, b.total);
      bonusDetails.push(d);
    }
    if (doublePeineDeclenchee) {
      const b = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs("1d4°", nivAttaquant)), rng);
      degatsDetails = [...degatsDetails, ...b.rolls];
      degatsTotal += Math.max(0, b.total);
      doublePeineLog = `Double peine : +${Math.max(0, b.total)} DM [${b.rolls.join(", ")}] (2e touche)`;
    }
    if (tactiquesDeclenchee) {
      const b = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs("1d4°", nivAttaquant)), rng);
      degatsDetails = [...degatsDetails, ...b.rolls];
      degatsTotal += Math.max(0, b.total);
      tactiquesLog = `Tactiques de meute : +${Math.max(0, b.total)} DM [${b.rolls.join(", ")}] (même cible que ${tactiquesMaitre})`;
    }
    if (attaqueOpts.bonusDM) degatsTotal += attaqueOpts.bonusDM;
    // Archer émérite (Rôdeur) : +PER aux DM à l'arc, permanent, sans activation.
    const bonusEmerite = talentConnu(attaquant, "Archer émérite") && (attaque.familles ?? []).includes("arcs")
      ? (attaquant.caracs?.PER ?? 0)
      : 0;
    if (bonusEmerite) degatsTotal += bonusEmerite;
    // Maître d'armes : Spécialisation (+N DM fixes, fiche) avec la prédilection.
    const bonusSpecialisation = matchPredilection && talentConnu(attaquant, "Spécialisation")
      ? Math.min(6, Math.max(0, attaquant.bonusSpecialisation ?? 0))
      : 0;
    if (bonusSpecialisation) degatsTotal += bonusSpecialisation;
    if (bonusDetails.length > 0 || attaqueOpts.bonusDM || bonusEmerite || bonusSpecialisation) {
      const parties = [...bonusDetails, ...(attaqueOpts.bonusDM ? [`${attaqueOpts.bonusDM}`] : []), ...(bonusEmerite ? [`${bonusEmerite} (Archer émérite)`] : []), ...(bonusSpecialisation ? [`${bonusSpecialisation} (Spécialisation)`] : [])];
      bonusLog = `+${parties.join(" + ")}${bonusDetails.length > 0 || attaqueOpts.bonusDM ? " (coup spécial)" : ""}`;
    }
    degatsTotal = degatsTotal * (critique ? critOpts.multiplicateur : 1);
    if (diviseDM > 1 && degatsTotal > 0) degatsTotal = Math.floor(degatsTotal / diviseDM);
  } else if (attaque.demiDegatsSiRate && especeCibleOk) {
    const roll = rollDiceExpression(parseDiceExpression(degatsExpr), rng);
    degatsDetails = roll.rolls;
    degatsTotal = Math.floor(roll.total / 2);
    moitie = degatsTotal > 0;
  }

  const toucheVraie = touche || attaque.toucheAuto === true;
  // Effet au toucher (sauf parade/absorption, espèce ciblée) : sauvegarde, dots, modificateurs.
  // Tamponné au tour de pose pour n'être consommé qu'à la fin d'un tour complet.
  const { effet: effetToucheBrut, saveLog, saveReussi } = toucheVraie && !pare && especeCibleOk
    ? creerEffetTouche(attaque, attaquant.nom, cible, rng, nivAttaquant, attaquant.caracs ?? {})
    : { effet: null, saveLog: null, saveReussi: null };
  // Sauvegarde réussie avec moitié DM (ex: Explosion de feu) : dégâts divisés par 2.
  let moitieSaveLog: string | null = null;
  if (saveReussi === true && attaque.effetTouche?.sauvegarde?.moitieDM === true && degatsTotal > 0) {
    degatsTotal = Math.floor(degatsTotal / 2);
    moitieSaveLog = `Moitié des DM (sauvegarde ${attaque.effetTouche.sauvegarde.carac} réussie)`;
  }
  const effetTouche = effetToucheBrut ? marquerPose(effetToucheBrut, s.manche, s.tourIndex) : null;
  const effetSuppBrut = toucheVraie && !pare && especeCibleOk && attaqueOpts.effetSupp
    ? createEffect(attaqueOpts.effetSupp.cle, { dureeTours: attaqueOpts.effetSupp.duree, source: attaquant.nom })
    : null;
  const effetSupp = effetSuppBrut ? marquerPose(effetSuppBrut, s.manche, s.tourIndex) : null;

  const pvAvant = cible.pv;
  const pvApres = Math.max(0, pvAvant - degatsTotal);
  const cibleTombe = pvAvant > 0 && pvApres === 0;

  // Vol de vie (Baiser, Succube) : le lanceur récupère les DM infligés.
  let volLog: string | null = null;
  let pvLanceurApres: number | null = null;

  // Protection (Protéger un allié) : bonus appliqué au jet ci-dessus,
  // consommée à la première attaque visée (touche ou non).
  const cibleAvant = s.participants.find((p) => p.instanceId === targetId);
  const protEffet = cibleAvant?.effets.find((e) => (e.modificateurs["protection"] ?? 0) > 0);
  let participants = s.participants.map((p) => {
    if (p.instanceId === attackerId) {
      let q = p;
      // Tentatives (limiteCombat) au lancer ; par-cible au touché (ci-dessous).
      if (sort && !sort.limiteParCible) q = enregistrerUsage(q, sort.id);
      // Mémoire dernier coup : touche réussie non parée (Double peine 2e touche,
      // Tactiques de meute loup/même cible). `enchaine` ne sert qu'à Double peine.
      if ((touche || attaque.toucheAuto) && !pare) {
        const suitDouble = talentConnu(q, "Double peine");
        q = { ...q, dernierCoup: { cibleId: targetId, manche: s.manche, enchaine: suitDouble ? doublePeineDeclenchee : false } };
      }
      return q;
    }
    if (p.instanceId === targetId) {
      // Parade/absorption réussie : stance consommée (un usage), éventuel sort stocké.
      const pvFinal = pare ? pvAvant : pvApres;
      let effets = pare
        ? p.effets.filter((e) => !(e.modificateurs["parade"] > 0) && !(e.modificateurs["absorption"] > 0))
        : p.effets;
      if (protEffet) effets = effets.filter((e) => e.id !== protEffet.id);
      if (effetTouche && !pare) effets = [...effets, effetTouche];
      if (effetSupp && !pare) effets = [...effets, effetSupp];
      return {
        ...p,
        pv: pvFinal,
        statut: pvFinal <= 0 ? ("ko" as const) : p.statut,
        effets,
        ...(absorbe ? { sortAbsorbe: absorbe } : {}),
      };
    }
    return p;
  });
  if (toucheVraie && !pare && sort?.limiteParCible) {
    participants = participants.map((p) =>
      p.instanceId === attackerId ? enregistrerUsage(p, sort.id, targetId) : p
    );
  }
  if (toucheVraie && attaque.volDeVie && degatsTotal > 0) {
    const lanceurEtat = participants.find((p) => p.instanceId === attackerId)!;
    pvLanceurApres = Math.min(lanceurEtat.pvMax, lanceurEtat.pv + degatsTotal);
    volLog = `${attaquant.nom} récupère ${Math.min(degatsTotal, lanceurEtat.pvMax - lanceurEtat.pv)} PV (vol de vie) : ${lanceurEtat.pv} -> ${pvLanceurApres} PV`;
    participants = participants.map((p) =>
      p.instanceId === attackerId
        ? { ...p, pv: pvLanceurApres as number, statut: (pvLanceurApres as number) > 0 ? ("actif" as const) : p.statut }
        : p
    );
  }

  // Sang mordant (sorcier) : 1d4° d'acide à qui blesse le porteur au contact.
  // Dé évolutif au niveau du porteur. Sorts et distance exclus (MJ).
  let sangLog: string | null = null;
  let sangDegats = 0;
  let pvAttaquantApresSang: number | null = null;
  if (toucheVraie && !pare && especeCibleOk && degatsTotal > 0 && estAttaqueContact(attaque, !!sort) && aSangMordant(cible)) {
    const rip = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs("1d4°", niveauEffectif(cible))), rng);
    sangDegats = Math.max(0, rip.total);
    const attEtat = participants.find((p) => p.instanceId === attackerId)!;
    pvAttaquantApresSang = Math.max(0, attEtat.pv - sangDegats);
    sangLog = `Sang mordant : +${sangDegats} DM d'acide à ${attaquant.nom} [${rip.rolls.join(", ")}] (contact) : ${attEtat.pv} -> ${pvAttaquantApresSang} PV`;
    participants = participants.map((p) =>
      p.instanceId === attackerId
        ? { ...p, pv: pvAttaquantApresSang as number, statut: (pvAttaquantApresSang as number) > 0 ? p.statut : ("ko" as const) }
        : p
    );
  }

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("atk"), at: stamp(), manche: s.manche, message: `${attaquant.nom} attaque ${cible.nom} (${attaque.nom})` });
  if (attaque.toucheAuto) {
    log.push({ id: id("jet"), at: stamp(), manche: s.manche, message: `Automatique (sans jet, ${attaque.nom})` });
  } else {
    const des = avantage && jetSecondaire != null ? `${d1}, ${jetSecondaire} (dé ${avantage} -> ${jetNaturel}) + ` : `${jetNaturel} + `;
    log.push({ id: id("jet"), at: stamp(), manche: s.manche, message: `Jet : ${des}${bonusBase}${modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque})` : ""}${modDistance !== 0 ? ` (${modDistance} à distance)` : ""}${bonusPredilection ? " (+1 prédilection)" : ""} = ${jetTotal}` });
  }
  if (opposeMagique) {
    const desC = avantageCible && jetDefSecondaire != null ? `${jetDefNaturel}, ${jetDefSecondaire} (dé ${avantageCible} -> ${jetDefNaturel}) + ` : `${jetDefNaturel} + `;
    log.push({ id: id("oppose"), at: stamp(), manche: s.manche, message: `Test opposé magique : ${jetTotal} (${jetNaturel}+${bonusEffectif}) vs ${jetDefTotal} (${desC}${bonusMagiqueCible})` });
  } else if (difficulteSort) {
    log.push({ id: id("dif"), at: stamp(), manche: s.manche, message: `Difficulté ${difficulteSort.formule} pour ${cible.nom} : ${difficulteSort.seuil}` });
  } else {
    log.push({ id: id("def"), at: stamp(), manche: s.manche, message: `Défense ${cible.nom} : ${cible.defense}${modDefense !== 0 ? ` (${modDefense > 0 ? "+" : ""}${modDefense} effets)` : ""}` });
  }
  log.push({ id: id("hit"), at: stamp(), manche: s.manche, message: toucheVraie ? (critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ" });
  if (attaqueOpts.tactique) {
    const label = { assuree: "Assurée (+5 en attaque, DM/2)", precise: "Précise (−3 en attaque, +1d4° DM)", violente: "Violente (−7 en attaque, +2d4° DM)" }[attaqueOpts.tactique];
    log.push({ id: id("tac"), at: stamp(), manche: s.manche, message: `Option tactique : ${label}` });
  }
  if (paralyseLog) log.push({ id: id("paral"), at: stamp(), manche: s.manche, message: paralyseLog });
  if (paradeLog) log.push({ id: id("par"), at: stamp(), manche: s.manche, message: paradeLog });
  if (protEffet) log.push({ id: id("prot"), at: stamp(), manche: s.manche, message: `${cible.nom} : protection consommée (+${protEffet.modificateurs["defense"] ?? 0} DEF contre cette attaque).` });
  // Attaques gratuites (G) : signaux automatiques (chips sur la ligne du
  // porteur dans la grille) ; le lancer réel reste une attaque normale du
  // moteur appelée par la page avec l'en-tête "(G, hors tour)". Teigneux est
  // posé manuellement par le MJ (bouton ⚔+ ; Rempart : AGI+2/manche).
  const signauxGratuites: { id: string; g: AttaqueGratuite }[] = [];
  if (!toucheVraie && estAttaqueArme(attaque) && cible.statut === "actif" && talentConnu(cible, "Riposte")) {
    log.push({ id: id("rip"), at: stamp(), manche: s.manche, message: `Riposte (G) : ${cible.nom} peut riposter contre ${attaquant.nom} (attaque au contact uniquement, 1/round)` });
    if (attaqueGratuiteDisponible(cible, "riposte", s.manche)) {
      signauxGratuites.push({ id: cible.instanceId, g: { type: "riposte", de: attaquant.instanceId, manche: s.manche } });
    }
  }
  // Enchaînement (G) : le porteur réduit un adversaire à 0 PV au contact ->
  // attaque gratuite sur un autre adversaire (cascade, non plafonnée).
  if (cibleTombe && estAttaqueContact(attaque, !!sort) && talentConnu(attaquant, "Enchaînement")) {
    signauxGratuites.push({ id: attaquant.instanceId, g: { type: "enchainement", manche: s.manche } });
  }
  // Piqûre de rappel (G) : un adversaire au contact qui attaque un autre ->
  // signal pour le porteur (1/round ; cible ≠ porteur, attaquant ≠ porteur).
  if (attaquant.camp !== cible.camp) {
    const porteur = participants.find(
      (p) =>
        p.camp === cible.camp &&
        p.instanceId !== cible.instanceId &&
        p.instanceId !== attaquant.instanceId &&
        p.statut === "actif" &&
        talentConnu(p, "Piqûre de rappel") &&
        attaqueGratuiteDisponible(p, "rappel", s.manche)
    );
    if (porteur) {
      signauxGratuites.push({ id: porteur.instanceId, g: { type: "rappel", de: attaquant.instanceId, manche: s.manche } });
    }
  }
  const participantsAvecSignaux =
    signauxGratuites.length > 0
      ? participants.map((p) => {
          const ajouts = signauxGratuites.filter((x) => x.id === p.instanceId).map((x) => x.g);
          if (ajouts.length === 0) return p;
          const liste = [...(p.attaquesGratuites ?? [])];
          for (const g of ajouts) {
            if (!liste.some((x) => x.type === g.type && x.de === g.de && !x.lancee)) liste.push(g);
          }
          return { ...p, attaquesGratuites: liste };
        })
      : participants;
  if (!toucheVraie && estAttaqueArme(attaque) && talentConnu(attaquant, "Attaque à suivre") && !talentConnu(attaquant, "Droite-gauche")) {
    log.push({ id: id("suivre"), at: stamp(), manche: s.manche, message: `Attaque à suivre (G) : ${attaquant.nom} peut attaquer de la 2e main (dague, hachette, épée courte, 1/round — MJ)` });
  }
  if ((toucheVraie || moitie) && !pare) {
    log.push({ id: id("dmg"), at: stamp(), manche: s.manche, message: `Dégâts : ${degatsExpr}${bonusLog ? ` ${bonusLog}` : ""} -> [${degatsDetails.join(", ")}] = ${degatsTotal}${diviseDM > 1 ? ` (divisés par ${diviseDM})` : ""}${moitie ? " (moitié, raté)" : ""}` });
    if (doublePeineLog) log.push({ id: id("dbl"), at: stamp(), manche: s.manche, message: doublePeineLog });
    if (tactiquesLog) log.push({ id: id("tac-meute"), at: stamp(), manche: s.manche, message: tactiquesLog });
    log.push({ id: id("pv"), at: stamp(), manche: s.manche, message: `${cible.nom} : ${pvAvant} -> ${pvApres} PV` });
    if (effetTouche) log.push({ id: id("eff"), at: stamp(), manche: s.manche, message: `Effet "${effetTouche.nom}" (${effetTouche.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
    if (saveLog) log.push({ id: id("save"), at: stamp(), manche: s.manche, message: saveLog });
    if (effetSupp) log.push({ id: id("sueff"), at: stamp(), manche: s.manche, message: `Effet "${effetSupp.nom}" (${effetSupp.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
    if (volLog) log.push({ id: id("vol"), at: stamp(), manche: s.manche, message: volLog });
    if (moitieSaveLog) log.push({ id: id("moi"), at: stamp(), manche: s.manche, message: moitieSaveLog });
    if (sangLog) log.push({ id: id("sang"), at: stamp(), manche: s.manche, message: sangLog });
    if (cibleTombe) log.push({ id: id("ko"), at: stamp(), manche: s.manche, message: `${cible.nom} est hors combat` });
  }
  if (toucheVraie && !pare && !especeCibleOk) {
    log.push({ id: id("imm"), at: stamp(), manche: s.manche, message: `Sans effet : ${cible.nom} n'est pas un ${(sort?.cibleEspeces ?? []).join("/")} (${attaque.nom} : espèce non ciblée).` });
  }

  const resolution: AttackResolution = {
    attaquantId: attackerId, attaquantNom: attaquant.nom, cibleId: targetId, cibleNom: cible.nom,
    attaqueNom: attaque.nom, jetNaturel, jetSecondaire, desAvantage: avantage, toucheAuto: attaque.toucheAuto,
    jetTotal, defenseCible: opposeMagique ? jetDefTotal : defenseEffective,
    touche: toucheVraie, critique, degatsDetails, degatsTotal, pvAvant, pvApres, cibleTombe,
    sangMordant: sangLog ? { degats: sangDegats, pvAttaquantApres: pvAttaquantApresSang as number } : null,
  };

  return { state: appliquerPhenixAutomatique(checkEnd({ ...s, participants: participantsAvecSignaux, log }), rng), resolution };
}

/**
 * Dépense 1 point de chance après un jet manqué : +10 au total.
 * Règle COF V2 : après avoir vu le résultat, sur tout test — y compris un
 * 1 naturel (le +10 peut transformer l'échec en touche). Le PC est dépensé
 * même si le total reste insuffisant. Pas de critique sur un rattrapage.
 */
export function depenserChanceApresCoup(
  state: CombatState,
  attackerId: string,
  targetId: string,
  attackId: string,
  last: AttackResolution,
  rng: Rng = Math.random
): { state: CombatState; resolution: AttackResolution } {
  const attaquant = state.participants.find((p) => p.instanceId === attackerId);
  const cible = state.participants.find((p) => p.instanceId === targetId);
  if (!attaquant) throw new Error("Attaquant introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  const attaque = attaquant.attaques.find((a) => a.id === attackId);
  if (!attaque) throw new Error("Attaque introuvable.");
  const chance = attaquant.ressources["chance"];
  if (!chance || chance.actuel < 1) throw new Error(`${attaquant.nom} n'a plus de point de chance.`);
  if (!canAct(attaquant.effets)) throw new Error(`${attaquant.nom} ne peut pas agir (Étourdi/Immobilisé).`);

  const modDefense = getModifier(cible.effets, "defense");
  const sortChance = sortDeAttaque(attaquant, attaque.id);
  const seuilChance = sortChance?.difficulteAttaque
    ? resoudreFormuleSort(sortChance.difficulteAttaque, cible.caracs ?? {})
    : null;
  const defenseEffective = seuilChance ?? cible.defense + modDefense;
  const jetTotal = last.jetTotal + 10;
  const touche = jetTotal >= defenseEffective;
  // Restriction d'espèce : pas de contournement via la chance.
  const especeCibleOk = cibleEspeceAcceptee(sortChance, cible);

  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  if (touche && especeCibleOk) {
    const roll = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs(attaque.degats, niveauEffectif(attaquant))), rng);
    degatsDetails = roll.rolls;
    degatsTotal = roll.total;
    // Archer émérite : +PER permanent, même sur un jet rattrapé.
    if (talentConnu(attaquant, "Archer émérite") && (attaque.familles ?? []).includes("arcs")) {
      degatsTotal += attaquant.caracs?.PER ?? 0;
    }
  }

  const pvAvant = cible.pv;
  const pvApres = Math.max(0, pvAvant - degatsTotal);
  const cibleTombe = pvAvant > 0 && pvApres === 0;

  const { effet: effetToucheBrut, saveLog } = touche && especeCibleOk
    ? creerEffetTouche(attaque, attaquant.nom, cible, rng, niveauEffectif(attaquant), attaquant.caracs ?? {})
    : { effet: null, saveLog: null };
  const effetTouche = effetToucheBrut ? marquerPose(effetToucheBrut, state.manche, state.tourIndex) : null;

  let volChanceLog: string | null = null;
  const participants = state.participants.map((p) => {
    if (p.instanceId === attackerId) {
      let q: CombatParticipant = { ...p, ressources: { ...p.ressources, chance: { ...chance, actuel: chance.actuel - 1 } } };
      if (touche && attaque.volDeVie && degatsTotal > 0) {
        const gain = Math.min(degatsTotal, q.pvMax - q.pv);
        const pvApresVol = Math.min(q.pvMax, q.pv + degatsTotal);
        volChanceLog = `${attaquant.nom} récupère ${gain} PV (vol de vie) : ${q.pv} -> ${pvApresVol} PV`;
        q = { ...q, pv: pvApresVol, statut: pvApresVol > 0 ? ("actif" as const) : q.statut };
      }
      if (touche && sortChance?.limiteParCible) q = enregistrerUsage(q, sortChance.id, targetId);
      return q;
    }
    if (p.instanceId === targetId) {
      return {
        ...p,
        pv: pvApres,
        statut: pvApres <= 0 ? ("ko" as const) : p.statut,
        effets: effetTouche ? [...p.effets, effetTouche] : p.effets,
      };
    }
    return p;
  });

  const id = (s: string) => `${s}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({ id: id("pc"), at: stamp(), manche: state.manche, message: `🍀 ${attaquant.nom} dépense 1 PC : ${last.jetTotal} + 10 = ${jetTotal}` });
  log.push({ id: id("pchit"), at: stamp(), manche: state.manche, message: touche ? "TOUCHÉ (rattrapé)" : "MANQUÉ (malgré la chance)" });
  if (touche) {
    log.push({ id: id("pcdmg"), at: stamp(), manche: state.manche, message: `Dégâts : ${attaque.degats} -> [${degatsDetails.join(", ")}] = ${degatsTotal}` });
    log.push({ id: id("pcpv"), at: stamp(), manche: state.manche, message: `${cible.nom} : ${pvAvant} -> ${pvApres} PV` });
    if (effetTouche) log.push({ id: id("pceff"), at: stamp(), manche: state.manche, message: `Effet "${effetTouche.nom}" (${effetTouche.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
    if (saveLog) log.push({ id: id("pcsave"), at: stamp(), manche: state.manche, message: saveLog });
    if (volChanceLog) log.push({ id: id("pcvol"), at: stamp(), manche: state.manche, message: volChanceLog });
    if (cibleTombe) log.push({ id: id("pcko"), at: stamp(), manche: state.manche, message: `${cible.nom} est hors combat` });
    if (!especeCibleOk) log.push({ id: id("pcimm"), at: stamp(), manche: state.manche, message: `Sans effet : ${cible.nom} n'est pas un ${(sortChance?.cibleEspeces ?? []).join("/")} (${attaque.nom} : espèce non ciblée).` });
  }

  const resolution: AttackResolution = {
    ...last,
    jetTotal,
    defenseCible: defenseEffective,
    touche,
    critique: false,
    degatsDetails,
    degatsTotal,
    pvAvant,
    pvApres,
    cibleTombe,
  };

  return { state: appliquerPhenixAutomatique(checkEnd({ ...state, participants, log }), rng), resolution };
}

/**
 * Renvoie un sort absorbé contre son expéditeur (Renvoi de sort, Guerrier,
 * bouclier requis) : rejoue l'attaque stockée sans coût — le lanceur subit
 * les effets de sa propre attaque — puis oublie le sort (qu'il touche ou non).
 * Zones : rejouées en mono-cible contre le lanceur (MJ au cas par cas).
 */
export function renvoyerSort(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  rng: Rng = Math.random
): { state: CombatState; resolution: AttackResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const abs = lanceur.sortAbsorbe;
  if (!abs) throw new Error(`${lanceur.nom} : aucun sort absorbé à renvoyer.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  exigeBouclier(lanceur);

  const tmpId = `renvoi-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  const tmp: AttackDef = {
    id: tmpId,
    nom: `Renvoi (${abs.nom})`,
    bonus: abs.bonus,
    degats: abs.degats,
    effetTouche: abs.effetCle
      ? { cle: abs.effetCle, duree: abs.effetDuree ?? null, degatsParTour: abs.effetDegats, mods: abs.effetMods }
      : undefined,
  };
  const avec = {
    ...state,
    participants: state.participants.map((p) =>
      p.instanceId === lanceurId ? { ...p, attaques: [...p.attaques, tmp] } : p
    ),
  };
  const { state: apres, resolution } = resolveAttack(avec, lanceurId, cibleId, tmpId, rng);
  const nettoye = apres.participants.map((p) =>
    p.instanceId === lanceurId
      ? { ...p, attaques: p.attaques.filter((a) => a.id !== tmpId), sortAbsorbe: undefined }
      : p
  );
  return { state: { ...apres, participants: nettoye }, resolution };
}

/**
 * Paie le coût d'un sort (ex: 2 mana). Lève si ressource insuffisante.
 * Sans coût ou ressource absente (monstres) : ne fait rien.
 */
export function applySpellCost(state: CombatState, lanceurId: string, sort: Sort): CombatState {
  return payerCoutSort(state, lanceurId, sort).state;
}

/** Mode de lancement : incantation classique (mana) ou brûlure de mana (PV). */
export type ModePaiementSort = "mana" | "brulure";

export interface PaiementSort {
  /** Incantation classique (mana) ou brûlure de mana (PV). Défaut : "mana". */
  mode?: ModePaiementSort;
  /** Concentration accrue : sort (A) à −2 PM, lancé en action limitée (L). */
  concentration?: boolean;
  /** Coûts déjà payés (résolution groupée : frapperCibles paie une fois). */
  dejaPaye?: boolean;
  /**
   * Outrepasse MJ de la règle de table "1 soin magique / cible / combat".
   * À cocher quand la table joue sans cette limite.
   */
  outrepasserSoin?: boolean;
}

export interface CoutSortEffectif {
  /** PM à payer après concentration (plancher 0). */
  pm: number;
  /** Coût avant concentration (rang). */
  base: number;
  /** Vrai si la concentration s'applique (sort d'attaque). */
  concentre: boolean;
}

/**
 * Coût effectif d'un sort : la concentration accrue réduit de 2 PM
 * (plancher 0) les sorts nécessitant une action d'attaque (A), qui deviennent
 * des actions limitées (L). Les sorts (L/M/G) — et ceux sans action d'attaque
 * — gardent le coût de leur rang, non réductible.
 */
export function coutEffectifSort(sort: Sort, opts: PaiementSort = {}): CoutSortEffectif {
  const base = sort.cout?.montant ?? 0;
  if (opts.concentration) {
    if (sort.concentrationInterdite) {
      throw new Error(`${sort.nom} : rituel, la concentration accrue est interdite.`);
    }
    const action = sort.action ?? "attaque";
    if (action !== "attaque") {
      throw new Error(`${sort.nom} : la concentration accrue exige un sort d'attaque (A).`);
    }
    if (base <= 0) return { pm: 0, base, concentre: false };
    return { pm: Math.max(0, base - 2), base, concentre: true };
  }
  return { pm: base, base, concentre: false };
}

export interface PaiementSortEffectue {
  mode: "mana" | "brulure";
  /** PM facturés (après concentration). */
  pm: number;
  /** PV perdus par brûlure (0 en incantation). */
  pvBrules: number;
  /** Détail des DR lancés. */
  detailsBrulure: number[];
  concentre: boolean;
}

/**
 * Paie le coût d'un sort en combat, selon le mode de lancement :
 * - incantation classique : PM déduits (lève si insuffisants) ;
 * - brûlure de mana : à 0 PM, 1 DR par PM en PV perdus (sans RD, KO possible),
 *   jamais pour lancer un sort de soins.
 * Journalisé dans tous les cas. La brûlure peut terminer le combat (KO du
 * lanceur) : checkEnd appliqué.
 */
export function payerCoutSort(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  opts: PaiementSort = {},
  rng: Rng = Math.random
): { state: CombatState; paiement: PaiementSortEffectue } {
  const { pm, base, concentre } = coutEffectifSort(sort, opts);
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const logConcentration = (log: CombatState["log"], nom: string) => {
    if (concentre) {
      log.push({ id: id("conc"), at: stamp(), manche: state.manche, message: `${nom} se concentre pour ${sort.nom} (action limitée) : ${base} → ${pm} PM.` });
    }
  };
  if (pm <= 0) {
    if (!concentre) return { state, paiement: { mode: "mana", pm: 0, pvBrules: 0, detailsBrulure: [], concentre: false } };
    const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
    const log = [...state.log];
    if (lanceur) logConcentration(log, lanceur.nom);
    return { state: { ...state, log }, paiement: { mode: "mana", pm: 0, pvBrules: 0, detailsBrulure: [], concentre } };
  }
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if ((opts.mode ?? "mana") === "brulure") {
    if (sort.soin) throw new Error(`${sort.nom} : la brûlure de mana ne peut pas lancer un sort de soins.`);
    const mana = lanceur.ressources[sort.cout!.ressource];
    if ((mana?.actuel ?? 0) !== 0) {
      throw new Error(`${lanceur.nom} : la brûlure de mana exige d'être à 0 ${sort.cout!.ressource} (${mana?.actuel ?? 0} restant).`);
    }
    const dr = lanceur.deRecuperation;
    if (!dr) throw new Error(`${lanceur.nom} : pas de dé de récupération pour la brûlure de mana.`);
    const roll = rollDiceExpression(parseDiceExpression(`${pm}${dr}`), rng);
    const pvBrules = Math.max(0, roll.total);
    const pv = Math.max(0, lanceur.pv - pvBrules);
    const participants = state.participants.map((p) =>
      p.instanceId === lanceurId
        ? { ...p, pv, statut: pv <= 0 ? ("ko" as const) : p.statut }
        : p
    );
    const log = [...state.log];
    logConcentration(log, lanceur.nom);
    log.push({ id: id("brul"), at: stamp(), manche: state.manche, message: `${lanceur.nom} brûle sa mana (${pm} PM → [${roll.rolls.join(", ")}] = ${pvBrules} PV, DR ${dr}) : ${lanceur.pv} → ${pv} PV` });
    if (pv <= 0 && lanceur.statut === "actif") {
      log.push({ id: id("brulko"), at: stamp(), manche: state.manche, message: `${lanceur.nom} est hors combat` });
    }
    return {
      state: appliquerPhenixAutomatique(checkEnd({ ...state, participants, log }), rng),
      paiement: { mode: "brulure", pm, pvBrules, detailsBrulure: roll.rolls, concentre },
    };
  }
  const res = lanceur.ressources[sort.cout!.ressource];
  if (!res) return { state, paiement: { mode: "mana", pm, pvBrules: 0, detailsBrulure: [], concentre } };
  if (res.actuel < pm) {
    throw new Error(`${lanceur.nom} : ${sort.cout!.ressource} insuffisant (${res.actuel}/${pm}) pour ${sort.nom}.`);
  }
  const log = [...state.log];
  logConcentration(log, lanceur.nom);
  log.push({ id: id("mana"), at: stamp(), manche: state.manche, message: `${lanceur.nom} dépense ${pm} ${sort.cout!.ressource} (${sort.nom}).` });
  return {
    state: {
      ...state,
      participants: state.participants.map((p) =>
        p.instanceId === lanceurId
          ? { ...p, ressources: { ...p.ressources, [sort.cout!.ressource]: { ...res, actuel: res.actuel - pm } } }
          : p
      ),
      log,
    },
    paiement: { mode: "mana", pm, pvBrules: 0, detailsBrulure: [], concentre },
  };
}

export interface CapaciteResolution {
  lanceurNom: string;
  cibleNom: string;
  talentNom: string;
  effetNom: string | null;
  soinTotal?: number;
}

/**
 * Applique la fin de combat aux fiches (bouton "Appliquer aux fiches") :
 * PV + actuels mana/chance du participant, plafonnés aux max de la fiche,
 * + compteurs journaliers (mineure, phénix...), + PV du loup compagnon
 * (persistés sur la fiche maître, soignable hors combat ensuite).
 * Monstres, invocations et PJ sans fiche : ignorés. Rien d'autre ne change
 * (ni max, ni talents, ni sorts, ni effets).
 */
export function appliquerResultatsCombat(
  fiches: Character[],
  participants: CombatParticipant[]
): Character[] {
  const maitreDe = (loup: CombatParticipant): string | null => {
    const direct = participants.find((x) => x.instanceId === loup.compagnonDe);
    if (direct && direct.templateId) return direct.templateId;
    const m = /^compagnon:loup:(.+)$/.exec(loup.templateId ?? "");
    if (m) return m[1];
    const n = /^loup( alpha)? \((.+)\)$/i.exec((loup.nom ?? "").trim());
    if (n) {
      const parNom = participants.find((x) => x.nom === n[2] && x.instanceId !== loup.instanceId);
      if (parNom) return parNom.templateId;
    }
    return null;
  };
  return fiches.map((c) => {
    const p = participants.find((x) => x.camp === "pj" && x.templateId === c.id);
    const loup = participants.find(
      (x) => (x.templateId?.startsWith("compagnon:loup") || x.compagnonDe) && maitreDe(x) === c.id
    );
    if (!p && !loup) return c;
    const ressources = { ...c.ressources };
    if (p) {
      for (const cle of ["mana", "chance"] as const) {
        const cur = ressources[cle];
        const pc = p.ressources[cle];
        if (cur && pc) ressources[cle] = { ...cur, actuel: Math.max(0, Math.min(cur.max, pc.actuel)) };
      }
    }
    const usagesJournaliers = p?.usagesJournaliers
      ? { ...(c.usagesJournaliers ?? {}), ...p.usagesJournaliers }
      : c.usagesJournaliers;
    return {
      ...c,
      ...(p ? { pv: Math.max(0, Math.min(c.pvMax, p.pv)) } : {}),
      ressources,
      ...(usagesJournaliers ? { usagesJournaliers } : {}),
      ...(loup ? { compagnon: { pv: Math.max(0, loup.pv) } } : {}),
    };
  });
}

/**
 * Remise à zéro des quotas journaliers (repos long, nouvelle journée) :
 * efface les compteurs 1/jour et quotas mineure/phénix/rétablissement.
 */
export function reinitialiserQuotidiens<T extends { usagesJournaliers?: Record<string, number> }>(c: T): T {
  if (!c.usagesJournaliers || Object.keys(c.usagesJournaliers).length === 0) return c;
  return { ...c, usagesJournaliers: {} };
}

export interface ResyncResult {
  participant: CombatParticipant;
  /** Noms des attaques apparues depuis la fiche. */
  nouvelles: string[];
  /** Mention "mana a → b" si le max a changé, sinon "". */
  manaInfo: string;
  /** Faux si déjà à jour (aucune écriture, aucun log). */
  modifie: boolean;
}

/**
 * Resynchronise un participant PJ depuis sa fiche fraîche : attaques, sorts,
 * talents, bonus magique, niveau, caracs, max mana/chance (dépensé conservé
 * via reporterRessource). État volatile intact : PV, PV max, DEF, effets,
 * statut, usages, initiative, attaques temporaires (sort-tmp:),
 * compteurs journaliers (max fiche/combat) et soin magique reçu.
 * Utilisée par le bouton ↻ et par la resynchronisation automatique du combat.
 */
export function resynchroniserDepuisFiche(
  cible: CombatParticipant,
  frais: CombatParticipant
): ResyncResult {
  // Attaques accordées en cours de combat (sort-tmp:) conservées.
  const gardees = cible.attaques.filter((a) => a.id.startsWith("sort-tmp:"));
  const attaques = [...frais.attaques.filter((a) => !gardees.some((g) => g.id === a.id)), ...gardees];
  const nouvelles = frais.attaques.filter((a) => !cible.attaques.some((x) => x.id === a.id)).map((a) => a.nom);
  const ressources = { ...cible.ressources };
  for (const cle of ["mana", "chance"] as const) {
    const report = reporterRessource(cible.ressources[cle], frais.ressources[cle]);
    if (report) ressources[cle] = report;
  }
  // Journaliers : max(fiche, combat) — on ne perd jamais un usage en combat.
  const clesJournalieres = new Set([
    ...Object.keys(cible.usagesJournaliers ?? {}),
    ...Object.keys(frais.usagesJournaliers ?? {}),
  ]);
  let usagesJournaliers: CombatParticipant["usagesJournaliers"] = undefined;
  if (clesJournalieres.size > 0) {
    usagesJournaliers = {};
    for (const k of clesJournalieres) {
      usagesJournaliers[k] = Math.max(cible.usagesJournaliers?.[k] ?? 0, frais.usagesJournaliers?.[k] ?? 0);
    }
  }
  const manaInfo =
    cible.ressources["mana"] && frais.ressources["mana"] && frais.ressources["mana"].max !== cible.ressources["mana"].max
      ? `, mana ${cible.ressources["mana"].max} → ${frais.ressources["mana"].max}`
      : "";
  const participant: CombatParticipant = {
    ...cible,
    attaques,
    sorts: frais.sorts,
    capacites: frais.capacites,
    bonusMagique: frais.bonusMagique,
    bouclierBonus: frais.bouclierBonus ?? null,
    niveau: frais.niveau,
    caracs: frais.caracs,
    ressources,
    deRecuperation: frais.deRecuperation,
    famillePredilection: frais.famillePredilection,
    bonusSpecialisation: frais.bonusSpecialisation,
    ...(usagesJournaliers ? { usagesJournaliers } : {}),
  };
  const cleStructurelle = (p: CombatParticipant) =>
    JSON.stringify({
      attaques: p.attaques,
      sorts: p.sorts,
      capacites: p.capacites,
      bonusMagique: p.bonusMagique,
      bouclierBonus: p.bouclierBonus ?? null,
      niveau: p.niveau,
      caracs: p.caracs,
      ressources: p.ressources,
      deRecuperation: p.deRecuperation,
      famillePredilection: p.famillePredilection ?? null,
      bonusSpecialisation: p.bonusSpecialisation ?? 0,
      usagesJournaliers: p.usagesJournaliers ?? {},
    });
  return { participant, nouvelles, manaInfo, modifie: cleStructurelle(cible) !== cleStructurelle(participant) };
}

/**
 * Reporte le max d'une ressource (mana, chance) de la fiche vers le
 * participant de combat, en conservant les points déjà dépensés :
 * dépensé = ancienMax - ancienActuel, nouvelActuel = nouveauMax - dépensé.
 * Ex. mana 1/1 intact + fiche à 6 → 6/6 ; mana 0/1 (1 dépensé) + fiche à 6 → 5/6.
 */
export function reporterRessource(
  ancienne: { max: number; actuel: number } | undefined,
  fiche: { max: number; actuel: number } | undefined
): { max: number; actuel: number } | undefined {
  if (!fiche) return ancienne;
  if (!ancienne) return { ...fiche };
  const depense = Math.max(0, ancienne.max - ancienne.actuel);
  return { max: fiche.max, actuel: Math.max(0, Math.min(fiche.max, fiche.max - depense)) };
}

/**
 * Ajustements au moment de l'attaque (coups spéciaux du Guerrier/Rôdeur, bonus MJ).
 * Puissante (A) = dé malus + 2d4°, (L) = +3d4° ; Parfaite / Flèche DM = dé bonus + 1d4° ;
 * modificateur manuel (prédilection +1, Double/Circulaire −2...), +DM manuel.
 */
export interface AttaqueOpts {
  /** Modificateur manuel au jet (ex: +1 prédilection, −2 Double). */
  modAttaque?: number;
  /** Bonus DM manuel (ex: +1 spécialisation). */
  bonusDM?: number;
  /** Dés de DM supplémentaires (ex: ["2d4°"], Puissante). */
  degatsBonus?: string[];
  /** Désavantage sur ce jet (ex: Puissante). */
  deMalus?: boolean;
  /** Avantage sur ce jet (ex: Parfaite). */
  deBonus?: boolean;
  /** Effet supplémentaire au toucher (ex: Flèche statut {cle: "aveugle", duree: 1}). */
  effetSupp?: { cle: string; duree: number | null };
  /** Divise les DM (ex: Attaque assurée = 2). Appliqué après le critique. */
  diviseDM?: number;
  /** Option tactique (A) : assurée / précise / violente — journalisée, jamais sur attaque magique. */
  tactique?: "assuree" | "precise" | "violente";
  /** Remplace le bonus au jet (ex: Attaque éclair = niv+AGI). */
  bonusOverride?: number;
  /** Remplace les dégâts (ex: Attaque éclair = dés de l'arme + AGI). */
  degatsOverride?: string;
}

/** Tirets unifiés (livre "Droite‑gauche" vs saisie) pour comparer les talents. */
function cleTalent(nom: string): string {
  return normaliserNomCapacite(nom).replace(/[‑–—]/g, "-");
}

/** Le participant connaît-il ce talent (insensible casse/tirets) ? */
export function talentConnu(p: Pick<CombatParticipant, "capacites">, nom: string): boolean {
  const q = cleTalent(nom);
  return (p.capacites ?? []).some((t) => cleTalent(t) === q);
}

/**
 * Attaques gratuites (G, hors tour) — Riposte, Piqûre de rappel, Teigneux,
 * Enchaînement (voir AttaqueGratuite). Le signal vit sur le participant
 * (`attaquesGratuites`) ; le lancer réel est une attaque normale du moteur.
 * Quota 1/round par type (sauf Enchaînement, cascade) ; Rempart : Teigneux
 * jusqu'à AGI+2 fois / manche (plancher 1).
 */
export function attaqueGratuiteDisponible(
  p: CombatParticipant,
  type: TypeAttaqueGratuite,
  manche: number
): boolean {
  if (type === "enchainement") return true;
  const limite =
    type === "teigneux" && talentConnu(p, "Rempart") ? Math.max(1, (p.caracs?.AGI ?? 0) + 2) : 1;
  const utilisees = (p.attaquesGratuites ?? []).filter((g) => g.type === type && g.lancee === manche).length;
  return utilisees < limite;
}

/** Pose un signal d'attaque gratuite (doublon en attente ignoré). */
export function signalerAttaqueGratuite(
  state: CombatState,
  participantId: string,
  type: TypeAttaqueGratuite,
  de?: string
): CombatState {
  return {
    ...state,
    participants: state.participants.map((p) => {
      if (p.instanceId !== participantId) return p;
      const liste = p.attaquesGratuites ?? [];
      if (liste.some((g) => g.type === type && g.de === de && !g.lancee)) return p;
      return { ...p, attaquesGratuites: [...liste, { type, ...(de ? { de } : {}), manche: state.manche }] };
    }),
  };
}

/** Marque comme lancé (consommé : compte pour le 1/round de la manche). */
export function marquerAttaqueGratuiteLancee(state: CombatState, participantId: string, g: AttaqueGratuite): CombatState {
  return {
    ...state,
    participants: state.participants.map((p) => {
      if (p.instanceId !== participantId || p.attaquesGratuites === undefined) return p;
      return {
        ...p,
        attaquesGratuites: p.attaquesGratuites.map((x) =>
          x.type === g.type && x.de === g.de && x.manche === g.manche ? { ...x, lancee: state.manche } : x
        ),
      };
    }),
  };
}

/** Écarte un signal (lancement consommé par la voie du MJ, ou annulation). */
export function ecarterAttaqueGratuite(state: CombatState, participantId: string, g: AttaqueGratuite): CombatState {
  return {
    ...state,
    participants: state.participants.map((p) => {
      if (p.instanceId !== participantId || p.attaquesGratuites === undefined) return p;
      return {
        ...p,
        attaquesGratuites: p.attaquesGratuites.filter(
          (x) => !(x.type === g.type && x.de === g.de && x.manche === g.manche)
        ),
      };
    }),
  };
}

/** Ce participant est-il un loup compagnon (staging, appel, ou repli nom) ? */
export function estLoupCompagnon(p: Pick<CombatParticipant, "templateId" | "nom" | "compagnonDe">): boolean {
  if (p.compagnonDe) return true;
  if (p.templateId?.startsWith("compagnon:loup")) return true;
  return /^loup( alpha)? \(.+\)$/i.test((p.nom ?? "").trim());
}

/**
 * Proposition Travail d'équipe au moment d'attaquer (panneau Attaque) :
 * le loup dont le maître a le talent gagne un dé bonus s'il est au contact
 * (adjacence déclarée par le MJ, case à cocher). Null si non applicable
 * (pas un loup, maître introuvable/sans talent, dé bonus déjà actif).
 * Pur et testable ; le panneau n'a plus qu'à afficher la case.
 */
export function propositionTravailEquipe(
  participants: CombatParticipant[],
  attackerId: string | null
): { maitreNom: string } | null {
  const attacker = participants.find((p) => p.instanceId === attackerId);
  if (!attacker || !estLoupCompagnon(attacker)) return null;
  const maitre = trouverMaitreLoup(participants, attacker);
  if (!maitre) return null;
  if (!(maitre.capacites ?? []).some((t) => normaliserNomCapacite(t) === normaliserNomCapacite("Travail d'équipe"))) {
    return null;
  }
  if (getModifier(attacker.effets, "deBonus") > 0) return null;
  return { maitreNom: maitre.nom };
}

/**
 * Maître rôdeur d'un loup en combat : lien `compagnonDe` d'abord, sinon
 * templateId `compagnon:loup:<templateId du maître>`, sinon nom `Loup (Nom)`.
 */
export function trouverMaitreLoup(
  participants: CombatParticipant[],
  loup: Pick<CombatParticipant, "instanceId" | "templateId" | "nom" | "compagnonDe">
): CombatParticipant | undefined {
  if (loup.compagnonDe) {
    const direct = participants.find((p) => p.instanceId === loup.compagnonDe);
    if (direct) return direct;
  }
  const m = /^compagnon:loup:(.+)$/.exec(loup.templateId ?? "");
  if (m) {
    const parTemplate = participants.find((p) => p.templateId === m[1] && p.instanceId !== loup.instanceId);
    if (parTemplate) return parTemplate;
  }
  const n = /^loup( alpha)? \((.+)\)$/i.exec((loup.nom ?? "").trim());
  if (n) {
    const parNom = participants.find((p) => p.nom === n[2] && p.instanceId !== loup.instanceId);
    if (parNom) return parNom;
  }
  return undefined;
}

/** Attaque d'arme (ni sort, ni accordée, ni renvoi, ni invocation) ? */
export function estAttaqueArme(attaque: { id: string }): boolean {
  return (
    !attaque.id.startsWith("sort:") &&
    !attaque.id.startsWith("sort-tmp:") &&
    !attaque.id.startsWith("renvoi") &&
    attaque.id !== "inv-attaque"
  );
}

/** Le porteur a-t-il du Sang mordant actif (sang acide du sorcier) ? */
function aSangMordant(cible: Pick<CombatParticipant, "effets">): boolean {
  return (cible.effets ?? []).some((e) => normaliserNomCapacite(e.nom) === "sang mordant");
}

const FAMILLES_DISTANCE: Set<string> = new Set(ARME_FAMILLES.filter((f) => f.degat === "distance").map((f) => f.key));

/**
 * Attaque au contact ? Sorts exclus (portées variables, MJ au cas par cas) ;
 * sans familles = contact (attaques naturelles des monstres).
 */
export function estAttaqueContact(attaque: { id: string; familles?: string[] }, estSort: boolean): boolean {
  if (estSort || !estAttaqueArme(attaque)) return false;
  const f = attaque.familles ?? [];
  if (f.length === 0) return true;
  return !f.some((x) => FAMILLES_DISTANCE.has(x));
}

/** Échelle des tailles (bestiaire) : Ensevelissement = moyenne ou moins. */
const TAILLES_ORDRE: Record<string, number> = {
  "Minuscule": 0, "Très petite": 1, "Petite": 2, "Moyenne": 3,
  "Grande": 4, "Énorme": 5, "Colossale": 6,
};

/** Taille compatible (inconnue ou hors échelle = compatible, au MJ) ? */
export function tailleAcceptee(taille: string | undefined, max: string): boolean {
  if (taille == null || !(taille in TAILLES_ORDRE) || !(max in TAILLES_ORDRE)) return true;
  return TAILLES_ORDRE[taille] <= TAILLES_ORDRE[max];
}

/**
 * Attaque à distance (arme de famille à distance, ex: arcs) ?
 * Sorts exclus : tests d'attaque magique (−5 de l'aveuglé, sorts exigeant
 * la vue interdits — MJ), pas des attaques à distance (−10).
 */
export function estAttaqueDistance(attaque: { id: string; familles?: string[] }): boolean {
  if (!estAttaqueArme(attaque)) return false;
  return (attaque.familles ?? []).some((x) => FAMILLES_DISTANCE.has(x));
}

export interface OppositionContact {
  /** Bonus d'attaque au contact réel : niveau + max(FOR,AGI) + arme + mods. */
  bonus: number;
  /** Dé bonus/malus des effets (annulation mutuelle), pour le test opposé. */
  avantage: "bonus" | "malus" | null;
}

/**
 * Bonus d'opposition au contact (Parer, Absorber) : réutilise le bonus
 * d'attaque au contact réel — niveau + max(FOR,AGI, substitution) + arme +
 * modificateurs d'effets. Armes d'inventaire (bonus partiel) : niv + habileté
 * + bonus d'arme ; attaques naturelles/accordées (bonus complet) : tel quel ;
 * à défaut : niveau + habileté.
 */
export function bonusOppositionContact(
  p: Pick<CombatParticipant, "attaques" | "effets" | "niveau" | "caracs">
): OppositionContact {
  const contacts = p.attaques.filter((a) => estAttaqueArme(a) && estAttaqueContact(a, false));
  const niv = niveauEffectif(p);
  const habilete = Math.max(p.caracs?.FOR ?? 0, p.caracs?.AGI ?? 0);
  const items = contacts.filter((a) => a.id.startsWith("item:"));
  const autres = contacts.filter((a) => !a.id.startsWith("item:"));
  const candItem = items.length > 0 ? niv + habilete + Math.max(...items.map((a) => a.bonus)) : Number.NEGATIVE_INFINITY;
  const candAutre = autres.length > 0 ? Math.max(...autres.map((a) => a.bonus)) : Number.NEGATIVE_INFINITY;
  const bonus = Math.max(candItem, candAutre, niv + habilete) + getModifier(p.effets, "attaque");
  const aBonus = getModifier(p.effets, "deBonus") > 0;
  const aMalus = getModifier(p.effets, "deMalus") > 0;
  return { bonus, avantage: aBonus && !aMalus ? "bonus" : !aBonus && aMalus ? "malus" : null };
}

/** Sort à l'origine d'une attaque "sort:<id>" (armes : indéfini). */
export function sortDeAttaque(attaquant: CombatParticipant, attackId: string): Sort | undefined {
  if (!attackId.startsWith("sort:")) return undefined;
  return attaquant.sorts.find((x) => `sort:${x.id}` === attackId);
}

export interface UsagesSort {
  n: number;
  cibles: string[];
}

/** Usages d'un sort ce combat (défaut : vierge). */
export function lireUsages(p: CombatParticipant, sortId: string): UsagesSort {
  return p.usagesSorts?.[sortId] ?? { n: 0, cibles: [] };
}

/**
 * Limite d'usage atteinte ? limiteCombat = tentatives (ex: Ensevelissement
 * 1/combat) ; limiteParCible = touchés par cible (ex: Malédiction, Briser).
 */
export function etatLimite(
  p: CombatParticipant,
  sort: Sort,
  cibleId?: string
): { ok: boolean; raison?: string } {
  const u = lireUsages(p, sort.id);
  if (sort.limiteCombat != null && !sort.limiteParCible && u.n >= sort.limiteCombat) {
    return { ok: false, raison: `${sort.nom} : limite ${sort.limiteCombat}/combat atteinte` };
  }
  if (sort.limiteParCible && cibleId && u.cibles.includes(cibleId)) {
    return { ok: false, raison: `${sort.nom} : cible déjà affectée ce combat` };
  }
  return { ok: true };
}

function enregistrerUsage(p: CombatParticipant, sortId: string, cibleId?: string): CombatParticipant {  const u = lireUsages(p, sortId);
  return {
    ...p,
    usagesSorts: {
      ...(p.usagesSorts ?? {}),
      [sortId]: {
        n: u.n + 1,
        cibles: cibleId && !u.cibles.includes(cibleId) ? [...u.cibles, cibleId] : u.cibles,
      },
    },
  };
}

/**
 * Paie un sacrifice de PV (ex: "1d4°", Pacte démoniaque — dés évolutifs
 * résolus au niveau du lanceur). Plancher 0 (KO possible). Journalisé.
 */
export function applyCoutPV(
  state: CombatState,
  lanceurId: string,
  expr: string,
  rng: Rng = Math.random,
  niveau = 1
): { state: CombatState; pvPerdus: number; details: number[] } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const roll = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs(expr, niveau)), rng);
  const pvPerdus = Math.max(0, roll.total);
  const pv = Math.max(0, lanceur.pv - pvPerdus);
  const participants = state.participants.map((p) =>
    p.instanceId === lanceurId
      ? { ...p, pv, statut: pv <= 0 ? ("ko" as const) : p.statut }
      : p
  );
  const log = [
    ...state.log,
    {
      id: `pv-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      at: stamp(),
      manche: state.manche,
      message: `${lanceur.nom} sacrifie ${pvPerdus} PV (${expr} -> [${roll.rolls.join(", ")}]) : ${lanceur.pv} -> ${pv} PV`,
    },
  ];
  if (pv <= 0 && lanceur.statut === "actif") {
    log.push({ id: `pvko-${Date.now()}`, at: stamp(), manche: state.manche, message: `${lanceur.nom} est hors combat` });
  }
  return { state: appliquerPhenixAutomatique(checkEnd({ ...state, participants, log }), rng), pvPerdus, details: roll.rolls };
}

/** Talents de la Voie du bouclier : bouclier manié requis (Protéger, Parer, Absorber, Renvoi). */
export function exigeBouclier(p: CombatParticipant): void {
  if (p.bouclierBonus == null) throw new Error(`${p.nom} : bouclier requis (Voie du bouclier).`);
}

function estTalentBouclier(talentNom: string): boolean {
  const q = normaliserNomCapacite(talentNom);
  return ["Protéger un allié", "Parer un coup", "Absorber un sort", "Renvoi de sort"].some(
    (t) => normaliserNomCapacite(t) === q
  );
}

/**
 * Protéger un allié (Guerrier, G) : accorde à un allié actif le modificateur
 * de DEF du bouclier contre la PROCHAINE attaque qui le vise (1/round,
 * annoncée avant le résultat — la DEF s'applique au jet puis l'effet est
 * consommé dans resolveAttack). Le guerrier conserve son propre bonus.
 * Allié au contact (adjacent) : au MJ (pas de positions suivies).
 * Surpris : pas d'action (canAct).
 */
export function protegerAllie(
  state: CombatState,
  lanceurId: string,
  cibleId: string
): { state: CombatState; resolution: CapaciteResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  exigeBouclier(lanceur);
  if (cible.statut !== "actif") throw new Error(`${cible.nom} est hors combat.`);
  if (cible.effets.some((e) => (e.modificateurs["protection"] ?? 0) > 0)) {
    throw new Error(`${cible.nom} est déjà protégé contre la prochaine attaque (1/round).`);
  }
  const bonus = lanceur.bouclierBonus ?? 0;
  const effet = marquerPose(
    createEffect("protection", {
      dureeTours: 1,
      source: lanceur.nom,
      modificateurs: { defense: bonus, protection: 1 },
      description: `Mod. DEF du bouclier (+${bonus}) contre la prochaine attaque (1/round, allié au contact — MJ).`,
    }),
    state.manche,
    state.tourIndex
  );
  const participants = state.participants.map((p) =>
    p.instanceId === cibleId ? { ...p, effets: [...p.effets, effet] } : p
  );
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({ id: id("prot"), at: stamp(), manche: state.manche, message: `${lanceur.nom} protège ${cible.nom} (+${bonus} DEF, bouclier, contre la prochaine attaque).` });
  return {
    state: { ...state, participants, log },
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom,
      talentNom: "Protéger un allié", effetNom: effet.nom, soinTotal: 0,
    },
  };
}

/**
 * Utilise un talent connu sur une cible : paie le sacrifice de PV éventuel
 * (Pacte démoniaque), applique le soin éventuel en dés (Increvable : 4d4°+CON
 * du lanceur), purge les états non permanents (Increvable), applique l'effet
 * éventuel (buff/debuff/DoT, avec modificateurs) et journalise dans tous les cas.
 * Pas de jet, pas de coût PM : le MJ arbitre le timing (ex. réaction)
 * et les actions (talents libres/passifs, (G) gratuit, géré en réel).
 * Règle de table soins : un 2e soin magique sur la même cible est refusé
 * sauf `outrepasserSoin` MJ. Vigueur divine : `modeVigueur` auto (purge
 * poison/maladie) ou test (jet d'attaque magique MJ, purge si réussi).
 */
export function utiliserCapacite(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  talentNom: string,
  opts: { effetCle?: string | null; dureeTours?: number | null; mods?: Record<string, number>; coutPV?: string; soin?: string; soinFixe?: number; nettoie?: boolean; outrepasserSoin?: boolean; modeVigueur?: "auto" | "test" } = {},
  rng: Rng = Math.random
): { state: CombatState; resolution: CapaciteResolution & { testMagique?: { jetLanceur: number; totalLanceur: number; jetCible: number | null; totalCible: number | null; reussi: boolean } | null } } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (!lanceur.capacites.includes(talentNom)) throw new Error(`${lanceur.nom} ne connaît pas « ${talentNom} ».`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  // Voie du bouclier : Protéger/Parer/Absorber/Renvoi exigent un bouclier manié.
  if (estTalentBouclier(talentNom)) exigeBouclier(lanceur);
  // Absorber remplace une parade déjà préparée (pas de posture autonome).
  if (
    normaliserNomCapacite(talentNom) === normaliserNomCapacite("Absorber un sort") &&
    getModifier(lanceur.effets, "parade") <= 0
  ) {
    throw new Error(`${lanceur.nom} : Absorber exige une parade préparée (Parer un coup).`);
  }

  let s = state;
  if (opts.coutPV) s = applyCoutPV(s, lanceurId, opts.coutPV, rng, niveauEffectif(lanceur)).state;

  const base = opts.effetCle
    ? createEffect(opts.effetCle, { dureeTours: opts.dureeTours ?? null, source: lanceur.nom })
    : null;
  const effetBrut = base ? { ...base, modificateurs: { ...base.modificateurs, ...(opts.mods ?? {}) } } : null;
  // Tamponné au tour de pose (consommé seulement à la fin d'un tour complet).
  const effet = effetBrut ? marquerPose(effetBrut, s.manche, s.tourIndex) : null;

  let soinDetails: number[] = [];
  let soinTotal = 0;
  let soinFixeLog: string | null = null;
  if (opts.soinFixe !== undefined) {
    // Montant saisi par le MJ (ex: Siphon = NC PV) : pas de jet.
    soinTotal = Math.max(0, Math.floor(opts.soinFixe));
    soinDetails = [soinTotal];
    soinFixeLog = `Soin (MJ) : +${soinTotal} PV`;
  } else if (opts.soin) {
    const lanceurApresCout = s.participants.find((p) => p.instanceId === lanceurId)!;
    const roll = rollDiceExpression(parseDiceExpression(substituerStats(substituerDesEvolutifs(opts.soin, niveauEffectif(lanceur)), lanceurApresCout.caracs ?? {})), rng);
    soinDetails = roll.rolls;
    soinTotal = Math.max(0, roll.total);
  }

  const estVigueur = normaliserNomCapacite(talentNom) === normaliserNomCapacite("Vigueur divine");
  // Vigueur divine : purge ciblée poison/maladie (pas tous les états).
  const purgerPoison = (effets: CombatParticipant["effets"]) =>
    effets.filter((e) => !/poison|empoison|maladie|saignement|fièvre|fievre/i.test(`${e.nom} ${e.description ?? ""}`));
  let testMagique: { jetLanceur: number; totalLanceur: number; jetCible: number | null; totalCible: number | null; reussi: boolean } | null = null;
  let purgeVigueur: CombatParticipant["effets"] | null = null;
  let purgeVigueurLog: string | null = null;
  if (estVigueur) {
    const mode = opts.modeVigueur ?? "auto";
    if (mode === "auto") {
      const avant = cible.effets.length;
      purgeVigueur = purgerPoison(cible.effets);
      const retires = avant - purgeVigueur.length;
      purgeVigueurLog =
        retires > 0
          ? `${cible.nom} : poison/maladie guéri (${retires} effet(s) purgé(s), rang+2 vs maladies/poisons — MJ)`
          : `${cible.nom} : aucun poison/maladie à purger (guérison auto, rang+2 vs maladies/poisons — MJ)`;
    } else {
      // Test d'attaque magique MJ (opposé si la cible a un bonus magique).
      const bonusL = lanceur.bonusMagique ?? niveauEffectif(lanceur);
      const bonusC = cible.bonusMagique ?? (cible.caracs ? niveauAttaque(cible.niveau) + (cible.caracs.VOL ?? 0) : null);
      const jetL = Math.floor(rng() * 20) + 1;
      const totalL = jetL + bonusL;
      let jetC: number | null = null;
      let totalC: number | null = null;
      let reussi: boolean;
      if (bonusC != null) {
        jetC = Math.floor(rng() * 20) + 1;
        totalC = jetC + bonusC;
        reussi = totalL >= totalC;
      } else {
        reussi = totalL >= 10;
      }
      testMagique = { jetLanceur: jetL, totalLanceur: totalL, jetCible: jetC, totalCible: totalC, reussi };
      if (reussi) {
        const avant = cible.effets.length;
        purgeVigueur = purgerPoison(cible.effets);
        purgeVigueurLog = `${cible.nom} : test magique ${totalL} vs ${totalC ?? 10} réussi — poison/maladie guéri (${avant - purgeVigueur.length} purgé(s))`;
      } else {
        purgeVigueur = [...cible.effets];
        purgeVigueurLog = `${cible.nom} : test magique ${totalL} vs ${totalC ?? 10} raté — infection surnaturelle résiste (MJ)`;
      }
    }
  }

  // Règle de table : un seul soin magique par cible et par combat.
  if (soinTotal > 0) exigerSoinMagiqueUnique(cible, soinTotal, opts.outrepasserSoin);

  const participants = s.participants.map((p) => {
    if (p.instanceId !== cibleId) return p;
    const gardes = purgeVigueur ?? (opts.nettoie ? p.effets.filter((e) => e.toursRestants === null) : p.effets);
    const pv = Math.min(p.pvMax, p.pv + soinTotal);
    return {
      ...p,
      pv,
      statut: pv > 0 ? ("actif" as const) : p.statut,
      effets: effet ? [...gardes, effet] : gardes,
      ...(soinTotal > 0 ? { soinMagiqueRecu: true } : {}),
    };
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("cap"), at: stamp(), manche: s.manche, message: `${lanceur.nom} utilise ${talentNom} sur ${cible.nom}` });
  if (soinTotal > 0) log.push({ id: id("csoin"), at: stamp(), manche: s.manche, message: soinFixeLog ?? `Soin : ${opts.soin} -> [${soinDetails.join(", ")}] = ${soinTotal}` });
  if (purgeVigueurLog) log.push({ id: id("cnet"), at: stamp(), manche: s.manche, message: purgeVigueurLog });
  else if (opts.nettoie) log.push({ id: id("cnet"), at: stamp(), manche: s.manche, message: `${cible.nom} : états non permanents purgés` });
  if (effet) log.push({ id: id("ceff"), at: stamp(), manche: s.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });

  return {
    state: { ...s, participants, log },
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, talentNom, effetNom: effet?.nom ?? null,
      soinTotal,
      ...(testMagique ? { testMagique } : {}),
    },
  };
}

export interface SortieEnseveliResolution {
  cibleNom: string;
  carac: "FOR" | "AGI";
  jetNaturel: number;
  aides: number;
  jetTotal: number;
  reussie: boolean;
}

/**
 * Tenter de sortir d'Ensevelissement : à son tour, action limitée (MJ),
 * test de FOR ou AGI (au choix) difficulté 15, +2 par aide qui creuse
 * (max +10). Réussite : effets d'ensevelissement retirés (libre).
 */
export function tenterSortieEnseveli(
  state: CombatState,
  cibleId: string,
  carac: "FOR" | "AGI" = "FOR",
  aides: number = 0,
  rng: Rng = Math.random
): { state: CombatState; resolution: SortieEnseveliResolution } {
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!cible) throw new Error("Cible introuvable.");
  if (cible.statut !== "actif") throw new Error(`${cible.nom} est hors combat.`);
  if (!cible.effets.some((e) => (e.modificateurs["inciblable"] ?? 0) > 0)) {
    throw new Error(`${cible.nom} n'est pas enseveli.`);
  }
  const bonusAides = Math.max(0, Math.min(5, Math.floor(aides))) * 2;
  const jetNaturel = Math.floor(rng() * 20) + 1;
  const jetTotal = jetNaturel + (cible.caracs?.[carac] ?? 0) + bonusAides;
  const reussie = jetTotal >= 15;
  const participants = state.participants.map((p) =>
    p.instanceId === cibleId && reussie
      ? { ...p, effets: p.effets.filter((e) => (e.modificateurs["inciblable"] ?? 0) <= 0) }
      : p
  );
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({
    id: id("sortie"), at: stamp(), manche: state.manche,
    message: `${cible.nom} tente de sortir (action limitée, ${carac}${bonusAides > 0 ? ` +${bonusAides} aides` : ""}) : ${jetNaturel}+${(cible.caracs?.[carac] ?? 0) + bonusAides} = ${jetTotal} vs 15 → ${reussie ? "LIBRE" : "toujours enseveli"}`,
  });
  return {
    state: { ...state, participants, log },
    resolution: { cibleNom: cible.nom, carac, jetNaturel, aides: bonusAides, jetTotal, reussie },
  };
}

export interface SoutienResolution {
  lanceurNom: string;
  cibleNom: string;
  sortNom: string;
  soinDetails: number[];
  soinTotal: number;
  pvAvant: number;
  pvApres: number;
  effetNom: string | null;
  /** Nom du serviteur invoqué / attaque accordée / zone frappée (le cas échéant). */
  invoque?: string | null;
}

export interface ZoneResolution {
  lanceurNom: string;
  sortNom: string;
  degatsTotal: number;
  touches: { cibleNom: string; pvAvant: number; pvApres: number; tombe: boolean }[];
}

export interface InvocationResolution {
  lanceurNom: string;
  sortNom: string;
  invoqueNom: string;
  pv: number;
}

/**
 * Invoque un serviteur (démon, zombie) : paie les coûts,
 * ajoute un participant au camp du lanceur (agit en fin d'ordre).
 */
export interface InvocationOpts {
  /** Profil du bestiaire à matérialiser (ex: Zombie) : prioritaire sur les stats numériques du sort. */
  modele?: MonsterTemplate;
  /** Serviteurs du même nom déjà contrôlés au-delà de ce nombre : refusé (ex: zombies max). */
  max?: number;
}

/**
 * Invoque un serviteur : paie les coûts, ajoute un participant au camp du
 * lanceur (agit en fin d'ordre). Profil bestiaire prioritaire (stats du
 * profil) ; sinon stats numériques du sort (démon...). max : contrôle
 * limité (ex: Animation des morts) — refusé au-delà.
 */
export function invoquer(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  rng: Rng = Math.random,
  paiement: PaiementSort = {},
  invocationOpts: InvocationOpts = {}
): { state: CombatState; resolution: InvocationResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const inv = sort.invocation;
  if (!inv) throw new Error(`${sort.nom} n'invoque rien.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const lim = etatLimite(lanceur, sort);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);

  let s = payerCoutSort(state, lanceurId, sort, paiement, rng).state;
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng, niveauEffectif(lanceur)).state;
  const lanceurApres = s.participants.find((p) => p.instanceId === lanceurId)!;

  if (invocationOpts.max != null) {
    const deja = s.participants.filter(
      (p) => p.invoque?.par === lanceurId && p.invoque?.espece === inv.nom && p.statut === "actif"
    ).length;
    if (deja >= invocationOpts.max) {
      throw new Error(`${lanceur.nom} contrôle déjà ${deja} ${inv.nom} (max ${invocationOpts.max}, MJ : cadavre requis).`);
    }
  }

  let frais: CombatParticipant;
  let resumeStats: string;
  if (invocationOpts.modele) {
    // Profil du bestiaire (ex: Zombie) : PV/DEF/attaques du profil.
    const [modele] = monsterInstances(invocationOpts.modele, 1);
    frais = {
      ...modele,
      instanceId: `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      templateId: `invocation:${sort.id}`,
      nom: `${inv.nom} (${lanceurApres.nom})`,
      camp: lanceurApres.camp,
      initiative: lanceurApres.initiative,
      niveau: lanceurApres.niveau,
      statut: "actif" as const,
      usagesSorts: {},
      invoque: { par: lanceurId, espece: inv.nom },
    };
    resumeStats = `${frais.pv}/${frais.pvMax} PV, Déf ${frais.defense} (profil ${invocationOpts.modele.nom})`;
  } else {
    if (inv.pvBase == null || inv.pvParNiveau == null || inv.defense == null || inv.bonusAttaque == null || !inv.degats) {
      throw new Error(`${sort.nom} : aucun profil à matérialiser (MJ : profil du bestiaire).`);
    }
    const pv = Math.max(1, inv.pvBase + inv.pvParNiveau * Math.max(1, Math.floor(lanceurApres.niveau)));
    const bonus = inv.bonusAttaque === "magique"
      ? (lanceurApres.bonusMagique ?? lanceurApres.niveau)
      : inv.bonusAttaque;
    frais = {
      instanceId: `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      templateId: `invocation:${sort.id}`,
      nom: `${inv.nom} (${lanceurApres.nom})`,
      camp: lanceurApres.camp,
      pvMax: pv,
      pv,
      defense: inv.defense,
      initMod: 0,
      initiative: inv.initiative ?? lanceurApres.initiative,
      attaques: [{ id: "inv-attaque", nom: `Contact (${inv.nom})`, bonus, degats: substituerDesEvolutifs(substituerStats(inv.degats, lanceurApres.caracs ?? {}), niveauEffectif(lanceurApres)) }],
      effets: [],
      sorts: [],
      capacites: [],
      niveau: lanceurApres.niveau,
      ressources: {},
      statut: "actif",
      usagesSorts: {},
      invoque: { par: lanceurId, espece: inv.nom },
    };
    resumeStats = `${pv} PV, Déf ${inv.defense}`;
  }
  const participants = [
    ...s.participants.map((p) =>
      p.instanceId === lanceurId ? enregistrerUsage(p, sort.id) : p
    ),
    frais,
  ];
  const log = [
    ...s.log,
    { id: `inv-${Date.now()}`, at: stamp(), manche: s.manche, message: `${lanceur.nom} invoque ${frais.nom} (${resumeStats}) — agit en fin d'ordre` },
  ];
  void rng;
  return {
    state: checkEnd({ ...s, participants, log }),
    resolution: { lanceurNom: lanceur.nom, sortNom: sort.nom, invoqueNom: frais.nom, pv: frais.pv },
  };
}

/** Malus du cadavre animé (Animer un cadavre) : -2 attaque / DEF / Initiative. */
export const MALUS_ANIMATION = 2;
/** NC maximal d'un cadavre animable (pouvoir « Animer un cadavre »). */
export const NC_MAX_ANIMATION = 2;

/**
 * Un monstre est-il un zombie ? « Animer un cadavre » (Sorcier, Shaman orc) ne
 * relève que des cadavres de zombies. Le bestiaire n'a pas de type « Zombie »
 * dédié (type = Créature/Animal/Humanoïde ; sous-catégorie = Mort-vivant, qui
 * couvre aussi squelettes, goules, vampires et ombres) : la famille zombie —
 * « Zombie humain », « Zombies coriaces », « Zombie ourhible »… — se reconnaît
 * au nom. Vaut pour un profil du bestiaire comme pour un participant.
 */
export function estZombie(m: { nom: string }): boolean {
  return /zombie/i.test(m.nom);
}

/**
 * Un profil du bestiaire est-il relevable (Animer un cadavre : zombie NC ≤ 2) ?
 * Mêmes règles que `estCadavre`, pour le sélecteur du panneau Capacités.
 */
export function profilAnimable(m: { nom: string; niveau: number }): boolean {
  return estZombie(m) && m.niveau <= NC_MAX_ANIMATION;
}

/**
 * Cadavre animable (Animer un cadavre) : cadavre de zombie hors combat, jamais
 * animé, de NC ≤ 2. Un PJ à 0 PV est inconscient (ko), pas un cadavre : seuls
 * les monstres hors combat — ou un statut « mort » explicite (enseveli) —
 * comptent. Utilisé par le moteur ET par le panneau Capacités (mêmes règles).
 */
export function estCadavre(
  p: Pick<CombatParticipant, "statut" | "camp" | "niveau" | "nom"> & { reanime?: { par: string } }
): boolean {
  if (p.statut === "actif") return false;
  if (p.statut !== "mort" && p.camp !== "monstre") return false;
  if (p.reanime) return false;
  return profilAnimable(p);
}

/** Résolution d'un « Animer un cadavre » (journal + tests). */
export interface AnimationResolution {
  lanceurNom: string;
  cadavreNom: string;
  cadavreId: string;
  /** Malus appliqué (attaque, DEF, Init) : 2. */
  malus: number;
  /** PV rendus au cadavre (plafond pvMax). */
  pv: number;
  defense: number;
  initiative: number | null;
}

/**
 * Relève un combattant en cadavre animé : rejoint le camp du lanceur, PV pleins,
 * profil conservé (attaques, caractéristiques, catégories) avec -2 en attaque,
 * en DEF et en Initiative. Les états non permanents du vivant (poison,
 * saignement...) ne suivent pas le cadavre (même purge que « nettoie »).
 * `reanime` marque le cadavre : vaincu à nouveau, il ne sera pas réanimable.
 */
function releverCadavre(
  base: CombatParticipant,
  lanceur: CombatParticipant,
  initiative: number | null
): CombatParticipant {
  return {
    ...base,
    camp: lanceur.camp,
    pv: base.pvMax,
    defense: base.defense - MALUS_ANIMATION,
    initMod: base.initMod - MALUS_ANIMATION,
    initiative,
    attaques: base.attaques.map((a) => ({ ...a, bonus: a.bonus - MALUS_ANIMATION })),
    effets: base.effets.filter((e) => e.toursRestants === null),
    statut: "actif" as const,
    reanime: { par: lanceur.instanceId },
  };
}

/**
 * Anime le cadavre d'un zombie hors combat (pouvoir de créature : Sorcier,
 * Shaman orc — « Animer un cadavre » ne relève que des zombies, NC ≤ 2) : le
 * cadavre rejoint le camp du lanceur et conserve son profil mais subit -2 en
 * attaque, en DEF et en Initiative (il reprend le combat à son initiative
 * courante, -2). Une fois vaincu à nouveau, il ne peut plus être réanimé
 * (`reanime`). Aucun jet, aucune position suivie : la portée de 10 m est
 * constatée par le MJ.
 */
export function animerCadavre(
  state: CombatState,
  lanceurId: string,
  cadavreId: string
): { state: CombatState; resolution: AnimationResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const cadavre = state.participants.find((p) => p.instanceId === cadavreId);
  if (!cadavre) throw new Error("Cadavre introuvable.");
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  if (cadavreId === lanceurId) throw new Error(`${lanceur.nom} ne peut pas s'animer lui-même.`);
  if (cadavre.statut === "actif") throw new Error(`${cadavre.nom} est encore en combat : il faut un cadavre (MJ).`);
  if (cadavre.reanime) throw new Error(`Le cadavre de ${cadavre.nom} a déjà été animé : non réanimable.`);
  if (cadavre.statut !== "mort" && cadavre.camp !== "monstre") {
    throw new Error(`${cadavre.nom} est inconscient (PJ), pas un cadavre — MJ.`);
  }
  if (!estZombie(cadavre)) {
    throw new Error(`${cadavre.nom} n'est pas un zombie : Animer un cadavre ne relève que des cadavres de zombies.`);
  }
  if (cadavre.niveau > NC_MAX_ANIMATION) {
    throw new Error(`${cadavre.nom} : NC ${cadavre.niveau} > ${NC_MAX_ANIMATION} — cadavre non animable.`);
  }
  const initiative = cadavre.initiative != null ? cadavre.initiative - MALUS_ANIMATION : null;
  const participants = state.participants.map((p) =>
    p.instanceId === cadavreId ? releverCadavre(p, lanceur, initiative) : p
  );
  const log = [
    ...state.log,
    {
      id: `anim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      at: stamp(),
      manche: state.manche,
      message: `${lanceur.nom} anime le cadavre de ${cadavre.nom} (NC ${cadavre.niveau}, -${MALUS_ANIMATION} attaque/DEF/Init, ${cadavre.pvMax} PV, Init ${initiative ?? "—"}) : il reprend le combat dans votre camp — s'il tombe à nouveau, il ne pourra plus être réanimé.`,
    },
  ];
  return {
    state: checkEnd({ ...state, participants, log }),
    resolution: {
      lanceurNom: lanceur.nom,
      cadavreNom: cadavre.nom,
      cadavreId,
      malus: MALUS_ANIMATION,
      pv: cadavre.pvMax,
      defense: cadavre.defense - MALUS_ANIMATION,
      initiative,
    },
  };
}

/**
 * Variante « profil du bestiaire » du même pouvoir : le MJ relève le cadavre
 * d'un zombie absent du combat (profil choisi, NC ≤ 2 — un corps trouvé sur
 * place). Le serviteur entre en jeu à la fin de l'ordre (comme une invocation)
 * et subit les mêmes -2 attaque/DEF/Init. Chaque relevé crée une nouvelle
 * instance : la règle « non réanimable » porte sur un cadavre donné, pas sur
 * l'espèce (le MJ décide s'il reste des corps de ce type).
 */
export function animerCadavreProfil(
  state: CombatState,
  lanceurId: string,
  modele: MonsterTemplate
): { state: CombatState; resolution: AnimationResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  if (!estZombie(modele)) {
    throw new Error(`${modele.nom} n'est pas un zombie : Animer un cadavre ne relève que des cadavres de zombies.`);
  }
  if (modele.niveau > NC_MAX_ANIMATION) {
    throw new Error(`${modele.nom} : NC ${modele.niveau} > ${NC_MAX_ANIMATION} — cadavre non animable.`);
  }
  const [base] = monsterInstances(modele, 1);
  const initiative = lanceur.initiative != null ? lanceur.initiative - MALUS_ANIMATION : null;
  const frais = releverCadavre(
    {
      ...base,
      instanceId: `anime-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      templateId: `anime:${modele.id}`,
    },
    lanceur,
    initiative
  );
  const participants = [...state.participants, frais];
  const log = [
    ...state.log,
    {
      id: `anim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      at: stamp(),
      manche: state.manche,
      message: `${lanceur.nom} anime le cadavre d'un ${modele.nom} (NC ${modele.niveau}, -${MALUS_ANIMATION} attaque/DEF/Init, ${frais.pv} PV) : il entre dans votre camp à la fin de l'ordre — s'il tombe à nouveau, il ne pourra plus être réanimé.`,
    },
  ];
  return {
    state: checkEnd({ ...state, participants, log }),
    resolution: {
      lanceurNom: lanceur.nom,
      cadavreNom: modele.nom,
      cadavreId: frais.instanceId,
      malus: MALUS_ANIMATION,
      pv: frais.pv,
      defense: frais.defense,
      initiative,
    },
  };
}

/**
 * Construit le compagnon loup permanent du rôdeur (talent Le loup) :
 * alpha si "Loup alpha" connu OU rang ≥ 4 dans la voie (le R4 EST alpha).
 * DRS : DEF 12 + rang DANS la voie du compagnon animal (+1 par rang 5 en voie
 * de rôdeur avec Tactiques de meute, voie incluse), PV niv×4, contact au bonus
 * magique du rôdeur (1d4+2, 1d4°+5 alpha), caracs officielles.
 * `pvConserve` : PV persistés de la fiche maître (staging + fin de combat) ;
 * sans lui le loup entre pleins. 0 = KO (fuite MJ, à soigner).
 * Le loup est un participant à part entière : ajouté en préparation de
 * combat, avec sa propre initiative (lancée ensuite). `compagnonDe` lie au
 * maître (Tactiques, Lien empathique). `surcharge` : variante MJ (ours...).
 */
export function construireLoupCompagnon(
  lanceur: CombatParticipant,
  opts: {
    instanceId?: string;
    templateId?: string;
    initMod?: number;
    initiative?: number | null;
    /**
     * PV conservés (staging : `maitre.compagnon.pv`, persistant entre combats).
     * Plafonnés au max recalculé ; absent = pleins. 0 = KO (fuite MJ, à soigner).
     */
    pvConserve?: number;
    /** Variante MJ (ex: ours) : écrase nom / dégâts / caracs / PV / DEF. */
    surcharge?: Partial<Pick<CombatParticipant, "nom" | "caracs" | "attaques" | "pv" | "pvMax" | "defense">>;
  } = {}
): CombatParticipant {
  if (!talentConnu(lanceur, "Le loup")) throw new Error(`${lanceur.nom} : pas de compagnon (Le loup).`);
  const porteur = {
    capacites: lanceur.capacites ?? [],
    sorts: (lanceur.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })),
  };
  const rangLoup = rangVoieCompagnon(porteur);
  const alpha = estAlpha(porteur);
  const rang5 = bonusDefTactiques(porteur);
  const niv = Math.max(1, Math.floor(lanceur.niveau));
  const pvMaxTheorique = niv * 4;
  const pvMax = opts.surcharge?.pvMax ?? pvMaxTheorique;
  const pvDemande = opts.surcharge?.pv ?? opts.pvConserve ?? pvMax;
  const pv = Math.max(0, Math.min(pvMax, Math.floor(pvDemande)));
  const defense = 12 + rangLoup + rang5;
  const bonus = lanceur.bonusMagique ?? niv;
  const nom = `${alpha ? "Loup alpha" : "Loup"} (${lanceur.nom})`;
  const caracs = { ...(alpha ? CARACS_LOUP_ALPHA : CARACS_LOUP) };
  return {
    instanceId: opts.instanceId ?? `loup-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    templateId: opts.templateId ?? "compagnon:loup",
    nom: opts.surcharge?.nom ?? nom,
    camp: lanceur.camp,
    pvMax,
    pv,
    defense: opts.surcharge?.defense ?? defense,
    initMod: opts.initMod ?? 0,
    initiative: opts.initiative !== undefined ? opts.initiative : lanceur.initiative,
    attaques: opts.surcharge?.attaques ?? [{ id: "loup-morsure", nom: "Morsure", bonus, degats: alpha ? substituerDesEvolutifs("1d4°+5", Math.max(1, Math.floor(lanceur.niveau))) : "1d4+2" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: niv,
    ressources: {},
    statut: pv <= 0 ? ("ko" as const) : ("actif" as const),
    usagesSorts: {},
    caracs: opts.surcharge?.caracs ?? caracs,
    compagnonDe: lanceur.instanceId,
  };
}

/**
 * Appel en cours de combat (repli MJ : le loup est normalement ajouté en
 * préparation via construireLoupCompagnon) : ajoute le loup en fin
 * d'ordre, au camp du lanceur.
 */
export function invoquerCompagnon(
  state: CombatState,
  lanceurId: string,
  rng: Rng = Math.random
): { state: CombatState; resolution: InvocationResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!talentConnu(lanceur, "Le loup")) throw new Error(`${lanceur.nom} : pas de compagnon (Le loup).`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const frais = {
    ...construireLoupCompagnon(lanceur, { templateId: `compagnon:loup:${lanceur.templateId}` }),
    compagnonDe: lanceurId,
  };
  const participants = [...state.participants, frais];
  const log = [
    ...state.log,
    { id: `loup-${Date.now()}`, at: stamp(), manche: state.manche, message: `${lanceur.nom} appelle ${frais.nom} (${frais.pv} PV, Déf ${frais.defense}) — agit en fin d'ordre` },
  ];
  void rng;
  return {
    state: checkEnd({ ...state, participants, log }),
    resolution: { lanceurNom: lanceur.nom, sortNom: "Le loup", invoqueNom: frais.nom, pv: frais.pv },
  };
}

export interface LienEmpathiqueResolution {
  rodeurNom: string;
  loupNom: string;
  pvDepenses: number;
  pvRendus: number;
  facteur: number;
  pvRodeurAvant: number;
  pvRodeurApres: number;
  pvLoupAvant: number;
  pvLoupApres: number;
}

/**
 * Lien empathique (Rôdeur, L) : télépathie + le rôdeur dépense ses propres PV
 * pour soigner son loup à distance, sans limite de quantité. 1 PV rôdeur =
 * 1 PV loup, 2 PV loup avec Tactiques de meute. Le rôdeur peut tomber à 0 PV.
 */
export function transfererVieAuLoup(
  state: CombatState,
  rodeurId: string,
  loupId: string,
  montant: number
): { state: CombatState; resolution: LienEmpathiqueResolution } {
  const rodeur = state.participants.find((p) => p.instanceId === rodeurId);
  const loup = state.participants.find((p) => p.instanceId === loupId);
  if (!rodeur) throw new Error("Rôdeur introuvable.");
  if (!loup) throw new Error("Loup introuvable.");
  if (!talentConnu(rodeur, "Le loup")) throw new Error(`${rodeur.nom} : pas de compagnon (Le loup).`);
  if (!talentConnu(rodeur, "Lien empathique")) {
    throw new Error(`${rodeur.nom} ne connaît pas « Lien empathique » (rang 3).`);
  }
  if (!estLoupCompagnon(loup)) throw new Error(`${loup.nom} n'est pas un loup compagnon.`);
  const maitre = trouverMaitreLoup(state.participants, loup);
  if (maitre && maitre.instanceId !== rodeurId) {
    throw new Error(`${loup.nom} est le compagnon de ${maitre.nom}, pas de ${rodeur.nom}.`);
  }
  if (!canAct(rodeur.effets)) throw new Error(`${rodeur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const n = Math.floor(montant);
  if (!Number.isFinite(n) || n < 1) throw new Error("Montant invalide : nombre entier de PV ≥ 1.");
  if (rodeur.pv < n) {
    throw new Error(`${rodeur.nom} : ${rodeur.pv} PV insuffisants pour en dépenser ${n}.`);
  }
  const porteur = {
    capacites: rodeur.capacites ?? [],
    sorts: (rodeur.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })),
  };
  const facteur = facteurLienEmpathique(porteur);
  const pvRendus = n * facteur;
  const pvRodeurAvant = rodeur.pv;
  const pvLoupAvant = loup.pv;
  const pvRodeurApres = Math.max(0, pvRodeurAvant - n);
  const pvLoupApres = Math.min(loup.pvMax, pvLoupAvant + pvRendus);
  const participants = state.participants.map((p) => {
    if (p.instanceId === rodeurId) {
      return { ...p, pv: pvRodeurApres, statut: pvRodeurApres <= 0 ? ("ko" as const) : p.statut };
    }
    if (p.instanceId === loupId) {
      return { ...p, pv: pvLoupApres, statut: pvLoupApres > 0 ? ("actif" as const) : p.statut };
    }
    return p;
  });
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({
    id: id("lien"), at: stamp(), manche: state.manche,
    message: `Lien empathique (L) : ${rodeur.nom} dépense ${n} PV (${pvRodeurAvant} → ${pvRodeurApres}) — ${loup.nom} +${pvLoupApres - pvLoupAvant} PV (${pvLoupAvant} → ${pvLoupApres}, ×${facteur}${facteur > 1 ? ", Tactiques" : ""})`,
  });
  if (pvRodeurApres <= 0 && rodeur.statut === "actif") {
    log.push({ id: id("linko"), at: stamp(), manche: state.manche, message: `${rodeur.nom} est hors combat` });
  }
  return {
    state: checkEnd({ ...state, participants, log }),
    resolution: {
      rodeurNom: rodeur.nom, loupNom: loup.nom,
      pvDepenses: n, pvRendus: pvLoupApres - pvLoupAvant, facteur,
      pvRodeurAvant, pvRodeurApres, pvLoupAvant, pvLoupApres,
    },
  };
}

/**
 * Frappe de zone (Armée des morts) : dégâts immédiats + effet de zone
 * (dégâts par tour lancés). 1 utilisation décomptée.
 * Cibles = tous les ennemis actifs par défaut ; le MJ peut ajuster
 * (ex: Explosion de feu inclut les alliés dans son rayon).
 */
export function frapperZone(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  rng: Rng = Math.random,
  paiement: PaiementSort = {},
  cibleIds?: string[]
): { state: CombatState; resolution: ZoneResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!sort.zone) throw new Error(`${sort.nom} n'est pas une frappe de zone.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const lim = etatLimite(lanceur, sort);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);

  let s = payerCoutSort(state, lanceurId, sort, paiement, rng).state;
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng, niveauEffectif(lanceur)).state;

  const nivLanceur = niveauEffectif(lanceur);
  let degatsTotal = 0;
  let degatsDetails: number[] = [];
  if (sort.degats) {
    const roll = rollDiceExpression(parseDiceExpression(substituerDesEvolutifs(sort.degats, nivLanceur)), rng);
    degatsDetails = roll.rolls;
    degatsTotal = Math.max(0, roll.total);
  }
  let dotParTour = 0;
  if (sort.effetDegats) {
    dotParTour = -Math.max(0, rollDiceExpression(parseDiceExpression(substituerDesEvolutifs(sort.effetDegats, nivLanceur)), rng).total);
  }
  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracs ?? {}, 1, nivLanceur), source: lanceur.nom })
    : null;
  const effetBrut = effetBase
    ? {
        ...effetBase,
        modificateurs: {
          ...effetBase.modificateurs,
          ...(sort.effetMods ?? {}),
          ...(dotParTour !== 0 ? { pvParTour: dotParTour } : {}),
        },
      }
    : null;
  // Même objet partagé entre les ennemis : un seul tampon de pose suffit.
  const effet = effetBrut ? marquerPose(effetBrut, s.manche, s.tourIndex) : null;

  const ennemis = new Set(
    cibleIds ??
      s.participants
        .filter((p) => p.statut === "actif" && p.camp !== lanceur.camp && p.instanceId !== lanceurId)
        .map((p) => p.instanceId)
  );
  // Ensevelis : inciblables même par les zones (épargnés, journalisés).
  const epargnes: string[] = [];
  for (const id of [...ennemis]) {
    const p = s.participants.find((x) => x.instanceId === id);
    if (p && getModifier(p.effets, "inciblable") > 0) {
      ennemis.delete(id);
      epargnes.push(p.nom);
    }
  }
  const touches: ZoneResolution["touches"] = [];
  // Défense au bouclier : −rang de voie aux DM de zone et souffles (bouclier
  // manié requis, sauf état surpris). 0 sinon.
  const reduit: { cibleNom: string; montant: number }[] = [];
  const absorbesZone: string[] = [];
  const participants = s.participants.map((p) => {
    if (p.instanceId === lanceurId) {
      return enregistrerUsage(p, sort.id);
    }
    if (!ennemis.has(p.instanceId)) return p;
    let dmZone = degatsTotal;
    let effetZone = effet;
    // Défense au bouclier : retranche le rang dans la voie.
    if (talentConnu(p, "Défense au bouclier") && p.bouclierBonus != null) {
      const surpris = (p.effets ?? []).some((e) => normaliserNomCapacite(e.nom) === "surpris");
      if (!surpris) {
        const red = Math.max(0, rangVoieBouclier(p.capacites, p.profil));
        if (red > 0 && dmZone > 0) {
          dmZone = Math.max(0, dmZone - red);
          reduit.push({ cibleNom: p.nom, montant: red });
        }
      }
    }
    // Absorption (parade préparée requise) : test contact opposé au jet du
    // sort (d20 + bonus magique du lanceur). Seul le guerrier est protégé,
    // les autres cibles sont affectées normalement ; sort stocké (Renvoi).
    let sortStocke: SortAbsorbe | null = null;
    if (
      getModifier(p.effets, "parade") > 0 &&
      getModifier(p.effets, "absorption") > 0
    ) {
      const { bonus: bonusAbs, avantage: avantageAbs } = bonusOppositionContact(p);
      const dl = Math.floor(rng() * 20) + 1;
      const diffSort = dl + (lanceur.bonusMagique ?? lanceur.niveau);
      const dp1 = Math.floor(rng() * 20) + 1;
      let jetP = dp1;
      if (avantageAbs) {
        const dp2 = Math.floor(rng() * 20) + 1;
        jetP = avantageAbs === "bonus" ? Math.max(dp1, dp2) : Math.min(dp1, dp2);
      }
      if (jetP + bonusAbs >= diffSort) {
        dmZone = 0;
        effetZone = null;
        sortStocke = {
          nom: sort.nom,
          bonus: sort.bonus ?? lanceur.bonusMagique ?? lanceur.niveau,
          degats: sort.degats ?? "1d1-1",
          effetCle: sort.effetCle,
          effetDuree: dureeEffetSort(sort.effetDuree, lanceur.caracs ?? {}, 1, niveauEffectif(lanceur)),
          effetDegats: sort.effetDegats,
          effetMods: sort.effetMods,
          zone: sort.zone,
        };
        absorbesZone.push(`${p.nom} absorbe ${sort.nom} (${jetP}+${bonusAbs}=${jetP + bonusAbs} vs ${diffSort}) — Renvoi possible via Capacités`);
      } else {
        absorbesZone.push(`${p.nom} rate son absorption (${jetP}+${bonusAbs}=${jetP + bonusAbs} vs ${diffSort}).`);
      }
    }
    const pvAvant = p.pv;
    const pvApres = Math.max(0, pvAvant - dmZone);
    touches.push({ cibleNom: p.nom, pvAvant, pvApres, tombe: pvAvant > 0 && pvApres === 0 });
    // Absorption réussie : stances consommées (comme la parade ciblée).
    const sansStances = sortStocke
      ? p.effets.filter((e) => !(e.modificateurs["parade"] > 0) && !(e.modificateurs["absorption"] > 0))
      : p.effets;
    return {
      ...p,
      pv: pvApres,
      statut: pvApres <= 0 ? ("ko" as const) : p.statut,
      effets: effetZone ? [...sansStances, effetZone] : sansStances,
      ...(sortStocke ? { sortAbsorbe: sortStocke } : {}),
    };
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("zone"), at: stamp(), manche: s.manche, message: `${lanceur.nom} déchaîne ${sort.nom} : ${degatsTotal} DM [${degatsDetails.join(", ")}] sur ${touches.length} cible(s)` });
  for (const n of epargnes) {
    log.push({ id: id("zepar"), at: stamp(), manche: s.manche, message: `${n} : enseveli, inciblable — épargné par la zone.` });
  }
  for (const r of reduit) {
    log.push({ id: id("zred"), at: stamp(), manche: s.manche, message: `${r.cibleNom} : Défense au bouclier −${r.montant} DM de zone.` });
  }
  for (const a of absorbesZone) {
    log.push({ id: id("zabs"), at: stamp(), manche: s.manche, message: a });
  }
  for (const t of touches) {
    log.push({ id: id("zpv"), at: stamp(), manche: s.manche, message: `${t.cibleNom} : ${t.pvAvant} -> ${t.pvApres} PV${effet ? ` + effet "${effet.nom}"` : ""}` });
    if (t.tombe) log.push({ id: id("zko"), at: stamp(), manche: s.manche, message: `${t.cibleNom} est hors combat` });
  }
  return {
    state: appliquerPhenixAutomatique(checkEnd({ ...s, participants, log }), rng),
    resolution: { lanceurNom: lanceur.nom, sortNom: sort.nom, degatsTotal, touches },
  };
}

/**
 * Sort multi-cibles (Arc de feu ×3, Appel de la foudre) : une résolution
 * complète par cible (jet, dégâts, effet, sauvegarde), coûts payés une fois.
 * Les limites sont vérifiées pour chaque cible avant de payer (échec rapide,
 * sans paiement partiel).
 */
export function frapperCibles(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  attackId: string,
  cibleIds: string[],
  rng: Rng = Math.random,
  options: CombatOptions = DEFAULT_COMBAT_OPTIONS,
  attaqueOpts: AttaqueOpts = {},
  paiement: PaiementSort = {}
): { state: CombatState; resolutions: AttackResolution[] } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  if (sort.zone) throw new Error(`${sort.nom} est une frappe de zone : utilisez la sélection de zone.`);
  const cibles = cibleIds.map((id) => {
    const c = state.participants.find((p) => p.instanceId === id);
    if (!c) throw new Error(`Cible introuvable (${id}).`);
    if (c.statut !== "actif" || id === lanceurId) throw new Error(`${c.nom} : cible invalide ou hors combat.`);
    if (getModifier(c.effets, "inciblable") > 0) throw new Error(`${c.nom} est enseveli : inciblable (MJ).`);
    if (sort.exigeVivant && !estVivant(c)) throw new Error(`${sort.nom} : cible non vivante (${c.nom}) — capacité inapplicable.`);
    if (sort.tailleMax && !tailleAcceptee(c.taille, sort.tailleMax)) {
      throw new Error(`${sort.nom} : ${c.nom} est trop grand (${c.taille ?? "?"} — MJ).`);
    }
    const lim = etatLimite(lanceur, sort, id);
    if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);
    return c;
  });
  if (cibles.length === 0) throw new Error("Aucune cible sélectionnée.");
  if (sort.ciblesMax != null && cibles.length > sort.ciblesMax) {
    throw new Error(`${sort.nom} : ${sort.ciblesMax} cibles au maximum.`);
  }

  let s = payerCoutSort(state, lanceurId, sort, paiement, rng).state;
  if (sort.coutPV) {
    const lv = s.participants.find((p) => p.instanceId === lanceurId)!;
    s = applyCoutPV(s, lanceurId, sort.coutPV, rng, niveauEffectif(lv)).state;
  }
  const paye = { ...paiement, dejaPaye: true };
  const resolutions: AttackResolution[] = [];
  for (const c of cibles) {
    const r = resolveAttack(s, lanceurId, c.instanceId, attackId, rng, options, attaqueOpts, paye);
    s = r.state;
    resolutions.push(r.resolution);
  }
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("multi"), at: stamp(), manche: s.manche, message: `${lanceur.nom} lance ${sort.nom} sur ${resolutions.length} cible(s) : ${resolutions.map((r) => `${r.cibleNom} (${r.touche ? `${r.degatsTotal} DM` : "manqué"})`).join(", ")}` });
  return { state: { ...s, log }, resolutions };
}

/**
 * Un sort est-il lançable à ce niveau ? Utilise le niveau minimum calculé
 * (gratuité Mage déduite) ou, à défaut, le rang (règle : niveau ≥ rang).
 */
export function sortUtilisable(
  niveau: number,
  sort: { niveauMin?: number; rang?: number; nom: string }
): { ok: boolean; raison?: string } {
  const min = sort.niveauMin ?? (sort.rang ? niveauMinRang(sort.rang) : 1);
  if (Math.max(1, Math.floor(niveau)) >= min) return { ok: true };
  return { ok: false, raison: `niveau ${min} requis` };
}

/**
 * Lance un sort défensif/utilitaire sur un allié (ou soi) : vérifie les limites, paie les coûts (mana + PV), applique le soin éventuel,
 * l'effet éventuel (+ modificateurs), l'attaque accordée (griffes, contact)
 * ou l'invocation (démon, zombie). Pas de jet d'attaque.
 * Voie des soins : mineure 1d4°+CHA (quota journalier), majeure 3d4°+CHA
 * +1d4° par rang 5 prêtre ; rétablissement = rituel hors combat (refusé ici).
 * Règle de table : 1 soin magique / cible / combat sauf outrepasserSoin MJ.
 */
export function castSoutien(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  sort: Sort,
  rng: Rng = Math.random,
  paiement: PaiementSort = {},
  invocation: InvocationOpts = {}
): { state: CombatState; resolution: SoutienResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (sort.type === "offensif") throw new Error(`${sort.nom} est offensif : utilisez une attaque.`);
  if (sort.rituelHorsCombat) {
    throw new Error(`${sort.nom} : rituel hors combat (10 min, patients au repos dans 5 m) — à lancer hors combat.`);
  }
  if (sort.invocation) {
    const r = invoquer(state, lanceurId, sort, rng, paiement, invocation);
    return {
      state: r.state,
      resolution: {
        lanceurNom: r.resolution.lanceurNom,
        cibleNom: r.resolution.invoqueNom,
        sortNom: r.resolution.sortNom,
        soinDetails: [],
        soinTotal: 0,
        pvAvant: r.resolution.pv,
        pvApres: r.resolution.pv,
        effetNom: null,
        invoque: r.resolution.invoqueNom,
      },
    };
  }
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const lim = etatLimite(lanceur, sort, cibleId);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);
  // Quota journalier voie des soins (mineure ; majeure sans quota, rétablissement refusé plus haut).
  const porteur = porteurDeParticipant(lanceur);
  if (quotaMineureApplicable(sort, porteur)) {
    const restants = usagesMineureRestants(porteur, lanceur.usagesJournaliers);
    if (restants <= 0) {
      const quota = quotaMineureParJour(porteur);
      const utilises = lanceur.usagesJournaliers?.[CLE_MINEURE] ?? 0;
      throw new Error(`${lanceur.nom} : Récupération mineure ${utilises}/${quota} aujourd'hui (rang soins ${rangVoieSoins(porteur)} + ${nbRang3AutresVoiesPretre(porteur)} rang 3 hors soins) — quota épuisé (repos pour récupérer).`);
    }
  }

  let s = payerCoutSort(state, lanceurId, sort, paiement, rng).state;
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng, niveauEffectif(lanceur)).state;

  let soinDetails: number[] = [];
  let soinTotal = 0;
  let soinExpression = sort.soin ?? "";
  if (sort.soin) {
    const lanceurFrais = s.participants.find((p) => p.instanceId === lanceurId)!;
    const calcule = lancerSoinVoieSoins(sort, lanceurFrais, rng);
    soinDetails = calcule?.details ?? [];
    soinTotal = calcule?.total ?? 0;
    soinExpression = calcule?.expression ?? sort.soin;
  }
  // Règle de table : 1 soin magique / cible / combat.
  if (soinTotal > 0) exigerSoinMagiqueUnique(cible, soinTotal, paiement.outrepasserSoin);
  const pvAvant = cible.pv;
  const pvApres = Math.min(cible.pvMax, pvAvant + soinTotal);
  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracs ?? {}, 1, niveauEffectif(lanceur)), source: lanceur.nom })
    : null;
  const effetBrut = effetBase
    ? { ...effetBase, modificateurs: { ...effetBase.modificateurs, ...(sort.effetMods ?? {}) } }
    : null;
  const effet = effetBrut ? marquerPose(effetBrut, s.manche, s.tourIndex) : null;
  // Attaque accordée (Beauté, Aspect) : ajoutée aux attaques de la cible.
  const lanceurApresCouts = s.participants.find((p) => p.instanceId === lanceurId)!;
  const attaqueTmp = sort.attaqueAccordee
    ? {
        id: `sort-tmp:${sort.id}`,
        nom: `✦ ${sort.attaqueAccordee.nom}`,
        bonus: sort.attaqueAccordee.bonus ?? lanceurApresCouts.bonusMagique ?? lanceurApresCouts.niveau,
        degats: substituerStats(substituerDesEvolutifs(sort.attaqueAccordee.degats, niveauEffectif(lanceurApresCouts)), lanceurApresCouts.caracs ?? {}),
        volDeVie: sort.attaqueAccordee.volDeVie,
      }
    : null;
  const accordee = attaqueTmp ? sort.attaqueAccordee!.nom : null;

  const participants = s.participants.map((p) => {
    // Lanceur et cible peuvent être le même (soutien sur soi) : cumuler.
    let q = p;
    if (p.instanceId === lanceurId) {
      q = enregistrerUsage(q, sort.id, sort.limiteParCible ? cibleId : undefined);
      if (quotaMineureApplicable(sort, porteurDeParticipant(lanceur))) {
        q = { ...q, usagesJournaliers: incrementerJournalier(q.usagesJournaliers, CLE_MINEURE) };
      }
    }
    if (p.instanceId === cibleId) {
      q = {
        ...q,
        pv: pvApres,
        statut: pvApres > 0 ? ("actif" as const) : q.statut,
        effets: effet ? [...q.effets, effet] : q.effets,
        attaques: attaqueTmp ? [...q.attaques.filter((x) => x.id !== attaqueTmp.id), attaqueTmp] : q.attaques,
        ...(soinTotal > 0 ? { soinMagiqueRecu: true } : {}),
      };
    }
    return q;
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("sort"), at: stamp(), manche: s.manche, message: `${lanceur.nom} lance ${sort.nom} sur ${cible.nom}` });
  if (soinTotal > 0) log.push({ id: id("soin"), at: stamp(), manche: s.manche, message: `Soin : ${soinExpression} -> [${soinDetails.join(", ")}] = ${soinTotal} (${pvAvant} -> ${pvApres} PV)` });
  if (effet) log.push({ id: id("seff"), at: stamp(), manche: s.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
  if (accordee) log.push({ id: id("satk"), at: stamp(), manche: s.manche, message: `${cible.nom} gagne l'attaque "${attaqueTmp!.nom}" (${attaqueTmp!.degats})` });

  return {
    state: checkEnd({ ...s, participants, log }),
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, sortNom: sort.nom,
      soinDetails, soinTotal, pvAvant, pvApres, effetNom: effet?.nom ?? null,
      invoque: accordee,
    },
  };
}

/**
 * Phénix (Voie des soins R4) — déclencheur automatique LDB, 1/jour :
 * quand le prêtre tombe à 0 PV, il se relève aussitôt + onde unique
 * 2d4°+CHA aux alliés dans 20 m (positions non suivies : `cibleIds` = alliés
 * dans le rayon, choisis par le MJ ; défaut = tous les alliés du camp),
 * prêtre au double. Le prêtre repasse actif.
 * Jet unique, même montant pour tous (double pour le prêtre).
 */
export interface PhenixResolution {
  lanceurNom: string;
  montant: number;
  montantPretre: number;
  details: number[];
  soignes: { cibleNom: string; pvAvant: number; pvApres: number; pretre: boolean }[];
}

export function phenixDisponible(
  pretre: Pick<CombatParticipant, "capacites" | "usagesJournaliers">
): boolean {
  if (!pretre.capacites.some((t) => cleSort(t) === CLE_PHENIX)) return false;
  return !dejaUtiliseAujourdhui(CLE_PHENIX, pretre.usagesJournaliers);
}

export function declencherPhenix(
  state: CombatState,
  pretreId: string,
  rng: Rng = Math.random,
  cibleIds?: string[]
): { state: CombatState; resolution: PhenixResolution } {
  const pretre = state.participants.find((p) => p.instanceId === pretreId);
  if (!pretre) throw new Error("Prêtre introuvable.");
  if (!pretre.capacites.some((t) => cleSort(t) === CLE_PHENIX)) {
    throw new Error(`${pretre.nom} ne connaît pas Phénix.`);
  }
  if (pretre.pv > 0) throw new Error(`${pretre.nom} n'est pas à 0 PV (Phénix : déclencheur à 0 PV).`);
  if (dejaUtiliseAujourdhui(CLE_PHENIX, pretre.usagesJournaliers)) {
    throw new Error(`${pretre.nom} : Phénix déjà utilisé aujourd'hui (1/jour).`);
  }
  const cha = chaEffectif(pretre);
  const niv = niveauEffectif(pretre);
  const faces = (() => {
    const n = Math.max(1, Math.floor(niv));
    if (n >= 15) return 12;
    if (n >= 12) return 10;
    if (n >= 9) return 8;
    if (n >= 6) return 6;
    return 4;
  })();
  const details = [Math.floor(rng() * faces) + 1, Math.floor(rng() * faces) + 1];
  const montant = details[0] + details[1] + cha;
  const montantPretre = montant * 2;
  const cibles =
    cibleIds ??
    state.participants
      .filter((p) => p.camp === pretre.camp && p.instanceId !== pretreId)
      .map((p) => p.instanceId);
  const soignes: PhenixResolution["soignes"] = [];
  const participants = state.participants.map((p) => {
    if (p.instanceId === pretreId) {
      const pvAvant = p.pv;
      const pvApres = Math.min(p.pvMax, pvAvant + montantPretre);
      soignes.push({ cibleNom: p.nom, pvAvant, pvApres, pretre: true });
      return {
        ...p,
        pv: pvApres,
        statut: pvApres > 0 ? ("actif" as const) : p.statut,
        usagesJournaliers: incrementerJournalier(p.usagesJournaliers, CLE_PHENIX),
        soinMagiqueRecu: true,
      };
    }
    if (cibles.includes(p.instanceId)) {
      const pvAvant = p.pv;
      const pvApres = Math.min(p.pvMax, pvAvant + montant);
      soignes.push({ cibleNom: p.nom, pvAvant, pvApres, pretre: false });
      return {
        ...p,
        pv: pvApres,
        statut: pvApres > 0 ? ("actif" as const) : p.statut,
        soinMagiqueRecu: true,
      };
    }
    return p;
  });
  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({
    id: id("phenix"), at: stamp(), manche: state.manche,
    message: `Phénix : ${pretre.nom} se relève à 0 PV (1/jour) — onde 2d4°+CHA(${cha}) [${details.join(", ")}] = ${montant} aux alliés (${cibles.length}), ${montantPretre} au prêtre (double)`,
  });
  for (const s of soignes) {
    log.push({ id: id("phsoin"), at: stamp(), manche: state.manche, message: `${s.cibleNom} : ${s.pvAvant} -> ${s.pvApres} PV${s.pretre ? " (double)" : ""}` });
  }
  return {
    state: checkEnd({ ...state, participants, log }),
    resolution: { lanceurNom: pretre.nom, montant, montantPretre, details, soignes },
  };
}

/**
 * Balaye le combat après des dégâts : tout prêtre à 0 PV avec Phénix
 * disponible se relève aussitôt (même s'il n'a pas encore agi ce round).
 * À appeler après chaque application de dégâts (resolveAttack, zones...).
 * MJ : `cibleIdsParPretre` = alliés dans 20 m (défaut = tout le camp).
 */
export function appliquerPhenixAutomatique(
  state: CombatState,
  rng: Rng = Math.random,
  cibleIdsParPretre?: Record<string, string[]>
): CombatState {
  let s = state;
  for (const p of [...s.participants]) {
    const frais = s.participants.find((x) => x.instanceId === p.instanceId)!;
    if (frais.pv !== 0) continue;
    if (!frais.capacites.some((t) => cleSort(t) === CLE_PHENIX)) continue;
    if (dejaUtiliseAujourdhui(CLE_PHENIX, frais.usagesJournaliers)) continue;
    try {
      s = declencherPhenix(s, frais.instanceId, rng, cibleIdsParPretre?.[frais.instanceId]).state;
    } catch {
      // Quota/état incohérent : ne bloque pas la résolution des dégâts.
    }
  }
  return s;
}

/**
 * Un sort est-il lançable hors combat ?
 * Règle : hors combat il n'y a pas d'économie d'action (A/M/L ignorée).
 * Sont lançables les sorts défensifs et utilitaires, sauf les frappes de
 * zone (combat requis). Les invocations sont lançables avec avertissement :
 * cadavre valide + validation MJ (pas de participant ajouté hors combat).
 * Les sorts offensifs passent par un jet d'attaque : combat uniquement.
 */
export function sortLancableHorsCombat(sort: Sort): { ok: boolean; raison?: string; avertissement?: string } {
  if (sort.type === "offensif") {
    return { ok: false, raison: `${sort.nom} est offensif : à lancer en combat (attaque).` };
  }
  if (sort.zone) {
    return { ok: false, raison: `${sort.nom} est une frappe de zone : en combat uniquement.` };
  }
  if (sort.invocation) {
    return { ok: true, avertissement: `${sort.nom} invoque ${sort.invocation.nom} : cadavre valide requis, utilisation soumise à validation MJ (aucun serviteur ajouté hors combat).` };
  }
  return { ok: true };
}

export interface HorsCombatResolution {
  lanceurNom: string;
  cibleNom: string;
  sortNom: string;
  soinDetails: number[];
  soinTotal: number;
  pvAvant: number;
  pvApres: number;
  pvLanceurAvant: number;
  pvLanceurApres: number;
  effetNom: string | null;
  attaqueAccordee: string | null;
  manaPaye: number;
  pvSacrifie: number;
  /** PV perdus par brûlure de mana (0 en incantation). */
  pvBrules: number;
  /** Détail des DR lancés. */
  detailsBrulure: number[];
  /** Vrai si la concentration accrue a réduit le coût (−2 PM, sort A). */
  concentre: boolean;
  /** Serviteur à faire intervenir (invocation hors combat : MJ, cadavre requis). */
  invoque: string | null;
  /** Avertissement MJ (ex: invocation hors combat). */
  avertissement: string | null;
}

/**
 * Lance un sort de soutien hors combat (défensif/utilitaire non-zone) :
 * vérifie le niveau et le mana, paie les coûts (mana + PV), applique le
 * soin, l'effet et l'attaque accordée éventuels. Invocations : coûts payés,
 * serviteur au MJ (cadavre valide requis, aucun participant ajouté).
 * L'action DRS (attaque/mouvement/limitée) est ignorée : hors combat il
 * n'y a pas de limite d'action ni de mouvement. La concentration accrue
 * reste possible : le lanceur prend le temps de se concentrer (−2 PM,
 * plancher 0, sorts d'attaque (A) uniquement — comme en combat, rituels exclus).
 * Quotas journaliers voie des soins suivis (mineure, rétablissement 1/jour).
 * La brûlure de mana reste possible (à 0 PM, 1 DR par PM effectif, jamais
 * pour les soins). Sorts purement narratifs (Augure...) : coût payé, effet au MJ.
 * Rétablissement : passer par lancerRetablissement (multi-patients).
 */
export function lancerSortHorsCombat(
  lanceur: Character,
  cible: Character,
  sort: Sort,
  rng: Rng = Math.random,
  mode: ModePaiementSort = "mana",
  opts: { concentration?: boolean } = {}
): { lanceur: Character; cible: Character; resolution: HorsCombatResolution } {
  const lancable = sortLancableHorsCombat(sort);
  if (!lancable.ok) throw new Error(lancable.raison);
  if (cleSort(sort.nom) === CLE_RETABLISSEMENT) {
    throw new Error(
      `${sort.nom} : rituel multi-patients (1/jour, 10 min, jusqu'à CHA patients au repos dans 5 m) — utilisez le rituel Rétablissement, pas un soin mono-cible.`
    );
  }
  const niveau = sortUtilisable(lanceur.niveau, sort);
  if (!niveau.ok) throw new Error(`${sort.nom} : ${niveau.raison}.`);
  // Quota journalier voie des soins (mineure ; rétablissement via son rituel).
  if (quotaMineureApplicable(sort, porteurDeFiche(lanceur))) {
    const porteur = porteurDeFiche(lanceur);
    const restants = usagesMineureRestants(porteur, lanceur.usagesJournaliers);
    if (restants <= 0) {
      const quota = quotaMineureParJour(porteur);
      const utilises = lanceur.usagesJournaliers?.[CLE_MINEURE] ?? 0;
      throw new Error(
        `${lanceur.nom} : Récupération mineure ${utilises}/${quota} aujourd'hui (rang soins ${rangVoieSoins(porteur)} + ${nbRang3AutresVoiesPretre(porteur)} rang 3 hors soins) — quota épuisé (repos pour récupérer).`
      );
    }
  }

  const { pm: cout, concentre } = coutEffectifSort(sort, { concentration: opts.concentration });
  let manaPaye = 0;
  let pvBrules = 0;
  let detailsBrulure: number[] = [];
  let lanceurApres: Character;
  if (cout > 0 && mode === "brulure") {
    if (sort.soin) throw new Error(`${sort.nom} : la brûlure de mana ne peut pas lancer un sort de soins.`);
    const manaActuel = lanceur.ressources?.[sort.cout!.ressource]?.actuel ?? 0;
    if (manaActuel !== 0) {
      throw new Error(`${lanceur.nom} : la brûlure de mana exige d'être à 0 ${sort.cout!.ressource} (${manaActuel} restant).`);
    }
    const dr = lanceur.desRecuperation?.type ?? drType(lanceur.profil || lanceur.classe, lanceur.famille);
    const roll = rollDiceExpression(parseDiceExpression(`${cout}${dr}`), rng);
    pvBrules = Math.max(0, roll.total);
    detailsBrulure = roll.rolls;
    lanceurApres = { ...lanceur, pv: Math.max(0, lanceur.pv - pvBrules) };
  } else {
    if (cout > 0) {
      const res = lanceur.ressources?.[sort.cout!.ressource];
      const actuel = res?.actuel ?? 0;
      if (!res || actuel < cout) {
        throw new Error(`${lanceur.nom} : ${sort.cout!.ressource} insuffisant (${actuel}/${cout}) pour ${sort.nom}.`);
      }
    }
    manaPaye = cout;

    lanceurApres = cout > 0
      ? {
          ...lanceur,
          ressources: {
            ...lanceur.ressources,
            [sort.cout!.ressource]: { ...lanceur.ressources[sort.cout!.ressource], actuel: lanceur.ressources[sort.cout!.ressource].actuel - cout },
          },
        }
      : { ...lanceur };
  }

  let pvSacrifie = 0;
  if (sort.coutPV) {
    const roll = rollDiceExpression(parseDiceExpression(sort.coutPV), rng);
    pvSacrifie = Math.max(0, roll.total);
    lanceurApres = { ...lanceurApres, pv: Math.max(0, lanceurApres.pv - pvSacrifie) };
  }
  const pvLanceurAvant = lanceur.pv;
  const pvLanceurApresCouts = lanceurApres.pv;

  let soinDetails: number[] = [];
  let soinTotal = 0;
  let soinExpression = sort.soin ?? "";
  if (sort.soin) {
    const calcule = lancerSoinVoieSoinsFiche(sort, lanceurApres, rng);
    soinDetails = calcule?.details ?? [];
    soinTotal = calcule?.total ?? 0;
    soinExpression = calcule?.expression ?? sort.soin;
  }
  // Quota incrémenté après calcul (le coût est déjà payé ; un échec de soin ne rembourse pas).
  if (quotaMineureApplicable(sort, porteurDeFiche(lanceur))) {
    lanceurApres = { ...lanceurApres, usagesJournaliers: incrementerJournalier(lanceurApres.usagesJournaliers, CLE_MINEURE) };
  }
  const pvAvant = cible.pv;
  const pvApres = Math.min(cible.pvMax, pvAvant + soinTotal);

  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracteristiques ?? {}, 1, Math.max(1, Math.floor(lanceur.niveau))), source: lanceur.nom })
    : null;
  const effet = effetBase
    ? { ...effetBase, modificateurs: { ...effetBase.modificateurs, ...(sort.effetMods ?? {}) } }
    : null;

  const bonusMagique = niveauAttaque(lanceurApres.niveau) + (lanceurApres.caracteristiques?.VOL ?? 0);
  const attaqueTmp = sort.attaqueAccordee
    ? {
        id: `sort-tmp:${sort.id}`,
        nom: `✦ ${sort.attaqueAccordee.nom}`,
        bonus: sort.attaqueAccordee.bonus ?? bonusMagique,
        degats: substituerStats(substituerDesEvolutifs(sort.attaqueAccordee.degats, Math.max(1, Math.floor(lanceurApres.niveau))), lanceurApres.caracteristiques ?? {}),
        volDeVie: sort.attaqueAccordee.volDeVie,
      } satisfies AttackDef
    : null;

  const memePersonnage = lanceur.id === cible.id;
  if (memePersonnage) {
    // Soin appliqué après le sacrifice (même fiche).
    const pvFinal = Math.min(lanceurApres.pvMax, lanceurApres.pv + soinTotal);
    lanceurApres = {
      ...lanceurApres,
      pv: pvFinal,
      effets: effet ? [...(lanceurApres.effets ?? []), effet] : (lanceurApres.effets ?? []),
      attaques: attaqueTmp
        ? [...(lanceurApres.attaques ?? []).filter((x) => x.id !== attaqueTmp.id), attaqueTmp]
        : (lanceurApres.attaques ?? []),
    };
    const resolution: HorsCombatResolution = {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, sortNom: sort.nom,
      soinDetails, soinTotal, pvAvant, pvApres: pvFinal,
      pvLanceurAvant, pvLanceurApres: pvFinal,
      effetNom: effet?.nom ?? null,
      attaqueAccordee: attaqueTmp ? sort.attaqueAccordee!.nom : null,
      manaPaye, pvSacrifie, pvBrules, detailsBrulure, concentre,
      invoque: sort.invocation?.nom ?? null,
      avertissement: lancable.avertissement ?? null,
    };
    return { lanceur: lanceurApres, cible: lanceurApres, resolution };
  }

  const cibleApres: Character = {
    ...cible,
    pv: pvApres,
    effets: effet ? [...(cible.effets ?? []), effet] : (cible.effets ?? []),
    attaques: attaqueTmp
      ? [...(cible.attaques ?? []).filter((x) => x.id !== attaqueTmp.id), attaqueTmp]
      : (cible.attaques ?? []),
  };

  return {
    lanceur: lanceurApres,
    cible: cibleApres,
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, sortNom: sort.nom,
      soinDetails, soinTotal, pvAvant, pvApres,
      pvLanceurAvant, pvLanceurApres: pvLanceurApresCouts,
      effetNom: effet?.nom ?? null,
      attaqueAccordee: attaqueTmp ? sort.attaqueAccordee!.nom : null,
      manaPaye, pvSacrifie, pvBrules, detailsBrulure, concentre,
      invoque: sort.invocation?.nom ?? null,
      avertissement: [
        lancable.avertissement,
        soinExpression && soinExpression !== sort.soin ? `formule LDB : ${soinExpression}` : null,
      ].filter(Boolean).join(" · ") || null,
    },
  };
}

export interface RetablissementPatient {
  id: string;
  pvAvant: number;
  pvApres: number;
  soinTotal: number;
  soinDetails: number[];
}

export interface RetablissementResolution {
  lanceurNom: string;
  sortNom: string;
  patients: RetablissementPatient[];
  /** Jet par patient (politique : un jet de majeure par patient). */
  detailsParPatient: number[][];
  manaPaye: number;
  nbRang5: number;
  cha: number;
}

/**
 * Rétablissement (Voie des soins R5) — rituel hors combat LDB, 1/jour :
 * 10 minutes, patients au repos dans 5 m, une créature par point de CHA
 * (prêtre inclus). Chaque patient reçoit une Récupération majeure
 * (3d4°+CHA +1d4° par rang 5 en voie de prêtre), jet par patient.
 * En combat : refusé. Concentration : interdite. Brûlure : interdite (soin).
 * `patients` inclut le prêtre si soigné (passer sa fiche dans la liste).
 * Conditions `dureeMin` / `auRepos` / `rayonOk` validées côté MJ (cases UI).
 */
export function lancerRetablissement(
  lanceur: Character,
  patients: Character[],
  sort: Sort,
  rng: Rng = Math.random,
  opts: { dureeMin?: number; auRepos?: boolean; rayonOk?: boolean } = {}
): { lanceur: Character; patients: Character[]; resolution: RetablissementResolution } {
  if (cleSort(sort.nom) !== CLE_RETABLISSEMENT) {
    throw new Error(`${sort.nom} n'est pas un Rétablissement.`);
  }
  const niveau = sortUtilisable(lanceur.niveau, sort);
  if (!niveau.ok) throw new Error(`${sort.nom} : ${niveau.raison}.`);
  if (dejaUtiliseAujourdhui(CLE_RETABLISSEMENT, lanceur.usagesJournaliers)) {
    throw new Error(`${lanceur.nom} : Rétablissement déjà utilisé aujourd'hui (1/jour).`);
  }
  const cha = lanceur.caracteristiques?.CHA ?? 0;
  const max = patientsMaxRetablissement(cha);
  if (patients.length === 0) throw new Error("Rétablissement : aucun patient.");
  if (patients.length > max) {
    throw new Error(`Rétablissement : ${patients.length} patients pour CHA ${cha} (max ${max}, prêtre inclus).`);
  }
  if ((opts.dureeMin ?? 10) < 10) throw new Error("Rétablissement : rituel de 10 minutes requis (hors combat).");
  if (opts.auRepos === false) throw new Error("Rétablissement : patients au repos requis.");
  if (opts.rayonOk === false) throw new Error("Rétablissement : patients dans 5 m autour du prêtre requis.");
  const cout = sort.cout?.montant ?? 5;
  const res = lanceur.ressources?.[sort.cout?.ressource ?? "mana"];
  if (!res || res.actuel < cout) {
    throw new Error(`${lanceur.nom} : ${sort.cout?.ressource ?? "mana"} insuffisant (${res?.actuel ?? 0}/${cout}) pour ${sort.nom}.`);
  }
  const n5 = nbRang5VoiesPretre(porteurDeFiche(lanceur));
  const niv = Math.max(1, Math.floor(lanceur.niveau));
  let lanceurApres: Character = {
    ...lanceur,
    ressources: {
      ...lanceur.ressources,
      [(sort.cout?.ressource ?? "mana")]: { ...res, actuel: res.actuel - cout },
    },
    usagesJournaliers: incrementerJournalier(lanceur.usagesJournaliers, CLE_RETABLISSEMENT),
  };
  // Jet par patient (même formule majeure à chaque fois).
  const detailsParPatient: number[][] = [];
  const soins: { total: number; details: number[] }[] = [];
  for (let i = 0; i < patients.length; i++) {
    const r = lancerMajeure(cha, n5, niv, rng);
    detailsParPatient.push(r.details);
    soins.push({ total: r.total, details: r.details });
  }
  const parId = new Map(patients.map((p, i) => [p.id, { patient: p, soin: soins[i] }]));
  const patientsApres = patients.map((p) => {
    const soin = parId.get(p.id)!.soin;
    return { ...p, pv: Math.min(p.pvMax, p.pv + soin.total) };
  });
  // Si le prêtre est parmi les patients, synchroniser sa fiche (mana + PV).
  const idxPretre = patientsApres.findIndex((p) => p.id === lanceur.id);
  if (idxPretre >= 0) {
    const soinPretre = soins[idxPretre];
    lanceurApres = {
      ...lanceurApres,
      pv: Math.min(lanceurApres.pvMax, lanceurApres.pv + 0) , // PV déjà via patientsApres si inclus
    };
    // Fusion : PV du patient + mana/usages du lanceur après paiement.
    const patientMaj = patientsApres[idxPretre];
    lanceurApres = { ...patientMaj, ressources: lanceurApres.ressources, usagesJournaliers: lanceurApres.usagesJournaliers };
    patientsApres[idxPretre] = lanceurApres;
    void soinPretre;
  }
  const resolution: RetablissementResolution = {
    lanceurNom: lanceur.nom,
    sortNom: sort.nom,
    patients: patients.map((p, i) => ({
      id: p.id,
      pvAvant: p.pv,
      pvApres: patientsApres[i].pv,
      soinTotal: soins[i].total,
      soinDetails: soins[i].details,
    })),
    detailsParPatient,
    manaPaye: cout,
    nbRang5: n5,
    cha,
  };
  return { lanceur: lanceurApres, patients: patientsApres, resolution };
}
