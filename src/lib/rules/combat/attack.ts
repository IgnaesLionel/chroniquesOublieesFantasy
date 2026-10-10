import { parseDiceExpression, rollDiceExpression, type Rng } from "@/src/lib/rules/dice/roller";
import { canAct, createEffect, getModifier } from "@/src/lib/rules/effects/effects";
import { niveauMinRang } from "@/src/lib/rules/creation";
import type { Sort } from "@/src/lib/rules/types";
import type {
  AttackResolution,
  Camp,
  CombatOptions,
  CombatState,
} from "@/src/lib/rules/combat/types";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";

function stamp(): string {
  return new Date().toISOString();
}

/** Applique dégâts (plancher 0). KO si pv 0. Mort gérée manuellement / Phase 5. */
export function applyDamage(state: CombatState, targetId: string, amount: number): CombatState {
  const participants = state.participants.map((p) =>
    p.instanceId === targetId
      ? { ...p, pv: Math.max(0, p.pv - Math.max(0, amount)), statut: p.pv - Math.max(0, amount) <= 0 ? ("ko" as const) : p.statut }
      : p
  );
  return checkEnd({ ...state, participants });
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
 * Résout une attaque complète : jet d'attaque -> touche ? -> dégâts -> PV.
 * Règle de toucher par défaut : 1d20 + bonus >= défense.
 * TODO_RULE COF V2 : confirmer critique / échec auto (options).
 */
export function resolveAttack(
  state: CombatState,
  attackerId: string,
  targetId: string,
  attackId: string,
  rng: Rng = Math.random,
  options: CombatOptions = DEFAULT_COMBAT_OPTIONS
): { state: CombatState; resolution: AttackResolution } {
  const attaquant = state.participants.find((p) => p.instanceId === attackerId);
  const cible = state.participants.find((p) => p.instanceId === targetId);
  if (!attaquant) throw new Error("Attaquant introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  const attaque = attaquant.attaques.find((a) => a.id === attackId) ?? attaquant.attaques[0];
  if (!attaque) throw new Error(`${attaquant.nom} n'a aucune attaque.`);
  if (!canAct(attaquant.effets)) throw new Error(`${attaquant.nom} ne peut pas agir (Étourdi/Immobilisé).`);

  const modAttaque = getModifier(attaquant.effets, "attaque");
  const modDefense = getModifier(cible.effets, "defense");
  const bonusEffectif = attaque.bonus + modAttaque;
  const defenseEffective = cible.defense + modDefense;

  const jetNaturel = Math.floor(rng() * 20) + 1;
  const jetTotal = jetNaturel + bonusEffectif;
  const critOpts = options.critique;

  let touche: boolean;
  let critique = false;
  if (critOpts.nat1EchecAuto && jetNaturel === 1) {
    touche = false;
  } else if (critOpts.nat20ToucheAuto && jetNaturel === 20) {
    touche = true;
    critique = true;
  } else {
    touche = jetTotal >= defenseEffective;
  }

  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  if (touche) {
    const expr = parseDiceExpression(attaque.degats);
    const roll = rollDiceExpression(expr, rng);
    degatsDetails = roll.rolls;
    degatsTotal = roll.total * (critique ? critOpts.multiplicateur : 1);
  }

  const pvAvant = cible.pv;
  const pvApres = Math.max(0, pvAvant - degatsTotal);
  const cibleTombe = pvAvant > 0 && pvApres === 0;

  // Effet au toucher (arme empoisonnée, sort de feu...) appliqué si TOUCHÉ.
  const effetTouche = touche && attaque.effetTouche
    ? createEffect(attaque.effetTouche.cle, { dureeTours: attaque.effetTouche.duree, source: attaquant.nom })
    : null;

  const participants = state.participants.map((p) =>
    p.instanceId === targetId
      ? {
          ...p,
          pv: pvApres,
          statut: pvApres <= 0 ? ("ko" as const) : p.statut,
          effets: effetTouche ? [...p.effets, effetTouche] : p.effets,
        }
      : p
  );

  const id = (s: string) => `${s}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({ id: id("atk"), at: stamp(), manche: state.manche, message: `${attaquant.nom} attaque ${cible.nom} (${attaque.nom})` });
  log.push({ id: id("jet"), at: stamp(), manche: state.manche, message: `Jet : ${jetNaturel} + ${attaque.bonus}${modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque} effets)` : ""} = ${jetTotal}` });
  log.push({ id: id("def"), at: stamp(), manche: state.manche, message: `Défense ${cible.nom} : ${cible.defense}${modDefense !== 0 ? ` (${modDefense > 0 ? "+" : ""}${modDefense} effets)` : ""}` });
  log.push({ id: id("hit"), at: stamp(), manche: state.manche, message: touche ? (critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ" });
  if (touche) {
    log.push({ id: id("dmg"), at: stamp(), manche: state.manche, message: `Dégâts : ${attaque.degats} -> [${degatsDetails.join(", ")}] = ${degatsTotal}` });
    log.push({ id: id("pv"), at: stamp(), manche: state.manche, message: `${cible.nom} : ${pvAvant} -> ${pvApres} PV` });
    if (effetTouche) log.push({ id: id("eff"), at: stamp(), manche: state.manche, message: `Effet "${effetTouche.nom}" (${effetTouche.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
    if (cibleTombe) log.push({ id: id("ko"), at: stamp(), manche: state.manche, message: `${cible.nom} est hors combat` });
  }

  const resolution: AttackResolution = {
    attaquantId: attackerId, attaquantNom: attaquant.nom, cibleId: targetId, cibleNom: cible.nom,
    attaqueNom: attaque.nom, jetNaturel, jetTotal, defenseCible: defenseEffective,
    touche, critique, degatsDetails, degatsTotal, pvAvant, pvApres, cibleTombe,
  };

  return { state: checkEnd({ ...state, participants, log }), resolution };
}

/**
 * Paie le coût d'un sort (ex: 2 mana). Lève si ressource insuffisante.
 * Sans coût ou ressource absente (monstres) : ne fait rien.
 */
export function applySpellCost(state: CombatState, lanceurId: string, sort: Sort): CombatState {
  if (!sort.cout || sort.cout.montant <= 0) return state;
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const res = lanceur.ressources[sort.cout.ressource];
  if (!res) return state;
  if (res.actuel < sort.cout.montant) {
    throw new Error(`${lanceur.nom} : ${sort.cout.ressource} insuffisant (${res.actuel}/${sort.cout.montant}) pour ${sort.nom}.`);
  }
  return {
    ...state,
    participants: state.participants.map((p) =>
      p.instanceId === lanceurId
        ? { ...p, ressources: { ...p.ressources, [sort.cout!.ressource]: { ...res, actuel: res.actuel - sort.cout!.montant } } }
        : p
    ),
    log: [...state.log, { id: `mana-${Date.now()}`, at: stamp(), manche: state.manche, message: `${lanceur.nom} dépense ${sort.cout.montant} ${sort.cout.ressource} (${sort.nom}).` }],
  };
}

export interface CapaciteResolution {
  lanceurNom: string;
  cibleNom: string;
  talentNom: string;
  effetNom: string | null;
}

/**
 * Utilise un talent connu sur une cible : applique l'effet éventuel
 * (buff/debuff/DoT du catalogue) et journalise dans tous les cas.
 * Pas de jet, pas de coût : le MJ arbitre le timing (ex. réaction).
 */
export function utiliserCapacite(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  talentNom: string,
  opts: { effetCle?: string | null; dureeTours?: number | null } = {}
): { state: CombatState; resolution: CapaciteResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (!lanceur.capacites.includes(talentNom)) throw new Error(`${lanceur.nom} ne connaît pas « ${talentNom} ».`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);

  const effet = opts.effetCle
    ? createEffect(opts.effetCle, { dureeTours: opts.dureeTours ?? null, source: lanceur.nom })
    : null;

  const participants = state.participants.map((p) =>
    p.instanceId === cibleId ? { ...p, effets: effet ? [...p.effets, effet] : p.effets } : p
  );

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...state.log];
  log.push({ id: id("cap"), at: stamp(), manche: state.manche, message: `${lanceur.nom} utilise ${talentNom} sur ${cible.nom}` });
  if (effet) log.push({ id: id("ceff"), at: stamp(), manche: state.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });

  return {
    state: { ...state, participants, log },
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, talentNom, effetNom: effet?.nom ?? null,
    },
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
 * Lance un sort défensif/utilitaire sur un allié (ou soi) : paie le coût,
 * applique le soin éventuel puis l'effet éventuel. Pas de jet d'attaque.
 */
export function castSoutien(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  sort: Sort,
  rng: Rng = Math.random
): { state: CombatState; resolution: SoutienResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (sort.type === "offensif") throw new Error(`${sort.nom} est offensif : utilisez une attaque.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);

  let s = applySpellCost(state, lanceurId, sort);

  let soinDetails: number[] = [];
  let soinTotal = 0;
  if (sort.soin) {
    const roll = rollDiceExpression(parseDiceExpression(sort.soin), rng);
    soinDetails = roll.rolls;
    soinTotal = roll.total;
  }
  const pvAvant = cible.pv;
  const pvApres = Math.min(cible.pvMax, pvAvant + soinTotal);
  const effet = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: sort.effetDuree ?? null, source: lanceur.nom })
    : null;

  const participants = s.participants.map((p) =>
    p.instanceId === cibleId
      ? {
          ...p,
          pv: pvApres,
          statut: pvApres > 0 ? ("actif" as const) : p.statut,
          effets: effet ? [...p.effets, effet] : p.effets,
        }
      : p
  );

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("sort"), at: stamp(), manche: s.manche, message: `${lanceur.nom} lance ${sort.nom} sur ${cible.nom}` });
  if (soinTotal > 0) log.push({ id: id("soin"), at: stamp(), manche: s.manche, message: `Soin : ${sort.soin} -> [${soinDetails.join(", ")}] = ${soinTotal} (${pvAvant} -> ${pvApres} PV)` });
  if (effet) log.push({ id: id("seff"), at: stamp(), manche: s.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });

  return {
    state: checkEnd({ ...s, participants, log }),
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, sortNom: sort.nom,
      soinDetails, soinTotal, pvAvant, pvApres, effetNom: effet?.nom ?? null,
    },
  };
}
