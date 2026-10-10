import { parseDiceExpression, rollDiceExpression, substituerStats, type Rng } from "@/src/lib/rules/dice/roller";
import { canAct, createEffect, getModifier } from "@/src/lib/rules/effects/effects";
import { niveauMinRang } from "@/src/lib/rules/creation";
import type { ActionDRS, Sort } from "@/src/lib/rules/types";
import type {
  AttackResolution,
  Camp,
  CombatOptions,
  CombatParticipant,
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
 * Résout une attaque complète : budget -> limites -> coûts (mana + PV) ->
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
  options: CombatOptions = DEFAULT_COMBAT_OPTIONS
): { state: CombatState; resolution: AttackResolution } {
  const attaquant = state.participants.find((p) => p.instanceId === attackerId);
  const cible = state.participants.find((p) => p.instanceId === targetId);
  if (!attaquant) throw new Error("Attaquant introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  const attaque = attaquant.attaques.find((a) => a.id === attackId) ?? attaquant.attaques[0];
  if (!attaque) throw new Error(`${attaquant.nom} n'a aucune attaque.`);
  if (!canAct(attaquant.effets)) throw new Error(`${attaquant.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const action = actionDeAttaque(attaque);
  const budget = budgetOk(attaquant, action);
  if (!budget.ok) throw new Error(`${attaquant.nom} : ${budget.raison}.`);
  const sort = sortDeAttaque(attaquant, attaque.id);
  if (sort) {
    const lim = etatLimite(attaquant, sort, targetId);
    if (!lim.ok) throw new Error(`${attaquant.nom} : ${lim.raison}.`);
  }

  // Coûts avant le jet (le sacrifice est perdu même en cas d'échec).
  let s = state;
  if (sort) s = applySpellCost(s, attackerId, sort);
  if (sort?.coutPV) s = applyCoutPV(s, attackerId, sort.coutPV, rng).state;

  const modAttaque = getModifier(attaquant.effets, "attaque");
  const modDefense = getModifier(cible.effets, "defense");
  const bonusEffectif = attaque.bonus + modAttaque;
  const defenseEffective = cible.defense + modDefense;

  // Dé bonus / malus (ex: Malédiction) : 2d20, garder meilleur / pire.
  const aBonus = getModifier(attaquant.effets, "deBonus") > 0;
  const aMalus = getModifier(attaquant.effets, "deMalus") > 0;
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

  let touche: boolean;
  let critique = false;
  if (attaque.toucheAuto) {
    touche = true;
  } else if (critOpts.nat1EchecAuto && jetNaturel === 1) {
    touche = false;
  } else if (critOpts.nat20ToucheAuto && jetNaturel === 20) {
    touche = true;
    critique = true;
  } else {
    touche = jetTotal >= defenseEffective;
  }

  // Dégâts : normaux si touché, moitié si raté (Briser), 0 sinon.
  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  let moitie = false;
  if (touche || attaque.toucheAuto) {
    const expr = parseDiceExpression(attaque.degats);
    const roll = rollDiceExpression(expr, rng);
    degatsDetails = roll.rolls;
    degatsTotal = roll.total * (critique ? critOpts.multiplicateur : 1);
  } else if (attaque.demiDegatsSiRate) {
    const roll = rollDiceExpression(parseDiceExpression(attaque.degats), rng);
    degatsDetails = roll.rolls;
    degatsTotal = Math.floor(roll.total / 2);
    moitie = degatsTotal > 0;
  }

  const toucheVraie = touche || attaque.toucheAuto === true;
  // Effet au toucher : dégâts par tour lancés (Saignements...) + modificateurs.
  let effetTouche = null as ReturnType<typeof createEffect> | null;
  if (toucheVraie && attaque.effetTouche) {
    const mods: Record<string, number> = { ...(attaque.effetTouche.mods ?? {}) };
    if (attaque.effetTouche.degatsParTour) {
      const dot = rollDiceExpression(parseDiceExpression(attaque.effetTouche.degatsParTour), rng);
      mods["pvParTour"] = -Math.max(0, dot.total);
    }
    effetTouche = {
      ...createEffect(attaque.effetTouche.cle, { dureeTours: attaque.effetTouche.duree, source: attaquant.nom }),
      modificateurs: mods,
    };
  }

  const pvAvant = cible.pv;
  const pvApres = Math.max(0, pvAvant - degatsTotal);
  const cibleTombe = pvAvant > 0 && pvApres === 0;

  // Vol de vie (Baiser, Succube) : le lanceur récupère les DM infligés.
  let volLog: string | null = null;
  let pvLanceurApres: number | null = null;

  let participants = s.participants.map((p) => {
    if (p.instanceId === attackerId) {
      let q = consommerBudget(p, action);
      // Tentatives (limiteCombat) au lancer ; par-cible au touché (ci-dessous).
      if (sort && !sort.limiteParCible) q = enregistrerUsage(q, sort.id);
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
  if (toucheVraie && sort?.limiteParCible) {
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

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("atk"), at: stamp(), manche: s.manche, message: `${attaquant.nom} attaque ${cible.nom} (${attaque.nom})` });
  if (attaque.toucheAuto) {
    log.push({ id: id("jet"), at: stamp(), manche: s.manche, message: `Automatique (sans jet, ${attaque.nom})` });
  } else {
    const des = avantage && jetSecondaire != null ? `${d1}, ${jetSecondaire} (dé ${avantage} -> ${jetNaturel}) + ` : `${jetNaturel} + `;
    log.push({ id: id("jet"), at: stamp(), manche: s.manche, message: `Jet : ${des}${attaque.bonus}${modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque} effets)` : ""} = ${jetTotal}` });
  }
  log.push({ id: id("def"), at: stamp(), manche: s.manche, message: `Défense ${cible.nom} : ${cible.defense}${modDefense !== 0 ? ` (${modDefense > 0 ? "+" : ""}${modDefense} effets)` : ""}` });
  log.push({ id: id("hit"), at: stamp(), manche: s.manche, message: toucheVraie ? (critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ" });
  if (toucheVraie || moitie) {
    log.push({ id: id("dmg"), at: stamp(), manche: s.manche, message: `Dégâts : ${attaque.degats} -> [${degatsDetails.join(", ")}] = ${degatsTotal}${moitie ? " (moitié, raté)" : ""}` });
    log.push({ id: id("pv"), at: stamp(), manche: s.manche, message: `${cible.nom} : ${pvAvant} -> ${pvApres} PV` });
    if (effetTouche) log.push({ id: id("eff"), at: stamp(), manche: s.manche, message: `Effet "${effetTouche.nom}" (${effetTouche.toursRestants ?? "∞"} tours) sur ${cible.nom}` });
    if (volLog) log.push({ id: id("vol"), at: stamp(), manche: s.manche, message: volLog });
    if (cibleTombe) log.push({ id: id("ko"), at: stamp(), manche: s.manche, message: `${cible.nom} est hors combat` });
  }

  const resolution: AttackResolution = {
    attaquantId: attackerId, attaquantNom: attaquant.nom, cibleId: targetId, cibleNom: cible.nom,
    attaqueNom: attaque.nom, jetNaturel, jetSecondaire, desAvantage: avantage, toucheAuto: attaque.toucheAuto,
    jetTotal, defenseCible: defenseEffective,
    touche: toucheVraie, critique, degatsDetails, degatsTotal, pvAvant, pvApres, cibleTombe,
  };

  return { state: checkEnd({ ...s, participants, log }), resolution };
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
  const defenseEffective = cible.defense + modDefense;
  const jetTotal = last.jetTotal + 10;
  const touche = jetTotal >= defenseEffective;

  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  if (touche) {
    const roll = rollDiceExpression(parseDiceExpression(attaque.degats), rng);
    degatsDetails = roll.rolls;
    degatsTotal = roll.total;
  }

  const pvAvant = cible.pv;
  const pvApres = Math.max(0, pvAvant - degatsTotal);
  const cibleTombe = pvAvant > 0 && pvApres === 0;

  let effetTouche = null as ReturnType<typeof createEffect> | null;
  if (touche && attaque.effetTouche) {
    const mods: Record<string, number> = { ...(attaque.effetTouche.mods ?? {}) };
    if (attaque.effetTouche.degatsParTour) {
      const dot = rollDiceExpression(parseDiceExpression(attaque.effetTouche.degatsParTour), rng);
      mods["pvParTour"] = -Math.max(0, dot.total);
    }
    effetTouche = {
      ...createEffect(attaque.effetTouche.cle, { dureeTours: attaque.effetTouche.duree, source: attaquant.nom }),
      modificateurs: mods,
    };
  }
  const sortChance = sortDeAttaque(attaquant, attaque.id);

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
    if (volChanceLog) log.push({ id: id("pcvol"), at: stamp(), manche: state.manche, message: volChanceLog });
    if (cibleTombe) log.push({ id: id("pcko"), at: stamp(), manche: state.manche, message: `${cible.nom} est hors combat` });
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

/** Action consommée par une attaque (défaut : attaque). */
export function actionDeAttaque(attaque: { action?: ActionDRS }): ActionDRS {
  return attaque.action ?? "attaque";
}

/**
 * Économie d'actions COF V2 : 1 action (A) + 1 mouvement (M) par tour,
 * ou 1 action limitée (L) qui consomme le tour complet. (G) = gratuit.
 * Sans budget (compat) : illimité.
 */
export function budgetOk(p: CombatParticipant, action: ActionDRS | undefined): { ok: boolean; raison?: string } {
  const b = p.budget;
  const a = action ?? "attaque";
  if (!b) return { ok: true };
  if (a === "gratuite") return { ok: true };
  if (a === "limitee") {
    return b.action && b.mouvement
      ? { ok: true }
      : { ok: false, raison: "tour déjà entamé (une limitée exige le tour complet)" };
  }
  if (a === "attaque") return b.action ? { ok: true } : { ok: false, raison: "action déjà utilisée ce tour" };
  return b.mouvement ? { ok: true } : { ok: false, raison: "mouvement déjà utilisé ce tour" };
}

/** Consomme le budget (lève si insuffisant). Sans budget : participant inchangé. */
export function consommerBudget(p: CombatParticipant, action: ActionDRS | undefined): CombatParticipant {
  const b = p.budget;
  const a = action ?? "attaque";
  if (!b) return p;
  const v = budgetOk(p, a);
  if (!v.ok) throw new Error(`${p.nom} : ${v.raison}.`);
  if (a === "gratuite") return p;
  if (a === "limitee") return { ...p, budget: { action: false, mouvement: false } };
  if (a === "attaque") return { ...p, budget: { ...b, action: false } };
  return { ...p, budget: { ...b, mouvement: false } };
}

/** Budget plein (début de tour). */
export function budgetPlein(): { action: boolean; mouvement: boolean } {
  return { action: true, mouvement: true };
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

function enregistrerUsage(p: CombatParticipant, sortId: string, cibleId?: string): CombatParticipant {
  const u = lireUsages(p, sortId);
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
 * Paie un sacrifice de PV (ex: "1d4°", Pacte démoniaque). Plancher 0
 * (KO possible, règles de dégâts). Journalisé.
 */
export function applyCoutPV(
  state: CombatState,
  lanceurId: string,
  expr: string,
  rng: Rng = Math.random
): { state: CombatState; pvPerdus: number; details: number[] } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const roll = rollDiceExpression(parseDiceExpression(expr), rng);
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
  return { state: checkEnd({ ...state, participants, log }), pvPerdus, details: roll.rolls };
}

/**
 * Utilise un talent connu sur une cible : paie le sacrifice de PV éventuel
 * (Pacte démoniaque), applique l'effet éventuel (buff/debuff/DoT, avec
 * modificateurs) et journalise dans tous les cas.
 * Pas de jet, pas de coût PM : le MJ arbitre le timing (ex. réaction).
 * Pas de budget d'action (talents libres/passifs, (G) gratuit).
 */
export function utiliserCapacite(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  talentNom: string,
  opts: { effetCle?: string | null; dureeTours?: number | null; mods?: Record<string, number>; coutPV?: string } = {},
  rng: Rng = Math.random
): { state: CombatState; resolution: CapaciteResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (!lanceur.capacites.includes(talentNom)) throw new Error(`${lanceur.nom} ne connaît pas « ${talentNom} ».`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);

  let s = state;
  if (opts.coutPV) s = applyCoutPV(s, lanceurId, opts.coutPV, rng).state;

  const base = opts.effetCle
    ? createEffect(opts.effetCle, { dureeTours: opts.dureeTours ?? null, source: lanceur.nom })
    : null;
  const effet = base ? { ...base, modificateurs: { ...base.modificateurs, ...(opts.mods ?? {}) } } : null;

  const participants = s.participants.map((p) =>
    p.instanceId === cibleId ? { ...p, effets: effet ? [...p.effets, effet] : p.effets } : p
  );

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("cap"), at: stamp(), manche: s.manche, message: `${lanceur.nom} utilise ${talentNom} sur ${cible.nom}` });
  if (effet) log.push({ id: id("ceff"), at: stamp(), manche: s.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });

  return {
    state: { ...s, participants, log },
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
 * Invoque un serviteur (démon, zombie) : paie les coûts, consomme le budget,
 * ajoute un participant au camp du lanceur (agit en fin d'ordre).
 */
export function invoquer(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  rng: Rng = Math.random
): { state: CombatState; resolution: InvocationResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  const inv = sort.invocation;
  if (!inv) throw new Error(`${sort.nom} n'invoque rien.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const budget = budgetOk(lanceur, sort.action);
  if (!budget.ok) throw new Error(`${lanceur.nom} : ${budget.raison}.`);
  const lim = etatLimite(lanceur, sort);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);

  let s = applySpellCost(state, lanceurId, sort);
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng).state;
  const lanceurApres = s.participants.find((p) => p.instanceId === lanceurId)!;

  const pv = Math.max(1, inv.pvBase + inv.pvParNiveau * Math.max(1, Math.floor(lanceurApres.niveau)));
  const bonus = inv.bonusAttaque === "magique"
    ? (lanceurApres.bonusMagique ?? lanceurApres.niveau)
    : inv.bonusAttaque;
  const frais: CombatParticipant = {
    instanceId: `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    templateId: `invocation:${sort.id}`,
    nom: `${inv.nom} (${lanceurApres.nom})`,
    camp: lanceurApres.camp,
    pvMax: pv,
    pv,
    defense: inv.defense,
    initMod: 0,
    initiative: inv.initiative ?? lanceurApres.initiative,
    attaques: [{ id: "inv-attaque", nom: `Contact (${inv.nom})`, bonus, degats: inv.degats }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: lanceurApres.niveau,
    ressources: {},
    statut: "actif",
    budget: budgetPlein(),
    usagesSorts: {},
  };
  const participants = [
    ...s.participants.map((p) =>
      p.instanceId === lanceurId ? enregistrerUsage(consommerBudget(p, sort.action), sort.id) : p
    ),
    frais,
  ];
  const log = [
    ...s.log,
    { id: `inv-${Date.now()}`, at: stamp(), manche: s.manche, message: `${lanceur.nom} invoque ${frais.nom} (${pv} PV, Déf ${inv.defense}) — agit en fin d'ordre` },
  ];
  void rng;
  return {
    state: checkEnd({ ...s, participants, log }),
    resolution: { lanceurNom: lanceur.nom, sortNom: sort.nom, invoqueNom: frais.nom, pv },
  };
}

/**
 * Frappe de zone (Armée des morts) : dégâts immédiats à tous les ennemis
 * actifs + effet de zone (dégâts par tour lancés). 1 utilisation décomptée.
 */
export function frapperZone(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  rng: Rng = Math.random
): { state: CombatState; resolution: ZoneResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!sort.zone) throw new Error(`${sort.nom} n'est pas une frappe de zone.`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);
  const budget = budgetOk(lanceur, sort.action);
  if (!budget.ok) throw new Error(`${lanceur.nom} : ${budget.raison}.`);
  const lim = etatLimite(lanceur, sort);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);

  let s = applySpellCost(state, lanceurId, sort);
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng).state;

  let degatsTotal = 0;
  let degatsDetails: number[] = [];
  if (sort.degats) {
    const roll = rollDiceExpression(parseDiceExpression(sort.degats), rng);
    degatsDetails = roll.rolls;
    degatsTotal = Math.max(0, roll.total);
  }
  let dotParTour = 0;
  if (sort.effetDegats) {
    dotParTour = -Math.max(0, rollDiceExpression(parseDiceExpression(sort.effetDegats), rng).total);
  }
  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: sort.effetDuree ?? null, source: lanceur.nom })
    : null;
  const effet = effetBase
    ? {
        ...effetBase,
        modificateurs: {
          ...effetBase.modificateurs,
          ...(sort.effetMods ?? {}),
          ...(dotParTour !== 0 ? { pvParTour: dotParTour } : {}),
        },
      }
    : null;

  const ennemis = new Set(
    s.participants
      .filter((p) => p.statut === "actif" && p.camp !== lanceur.camp && p.instanceId !== lanceurId)
      .map((p) => p.instanceId)
  );
  const touches: ZoneResolution["touches"] = [];
  const participants = s.participants.map((p) => {
    if (p.instanceId === lanceurId) {
      return enregistrerUsage(consommerBudget(p, sort.action), sort.id);
    }
    if (!ennemis.has(p.instanceId)) return p;
    const pvAvant = p.pv;
    const pvApres = Math.max(0, pvAvant - degatsTotal);
    touches.push({ cibleNom: p.nom, pvAvant, pvApres, tombe: pvAvant > 0 && pvApres === 0 });
    return {
      ...p,
      pv: pvApres,
      statut: pvApres <= 0 ? ("ko" as const) : p.statut,
      effets: effet ? [...p.effets, effet] : p.effets,
    };
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("zone"), at: stamp(), manche: s.manche, message: `${lanceur.nom} déchaîne ${sort.nom} : ${degatsTotal} DM [${degatsDetails.join(", ")}] sur ${touches.length} ennemi(s)` });
  for (const t of touches) {
    log.push({ id: id("zpv"), at: stamp(), manche: s.manche, message: `${t.cibleNom} : ${t.pvAvant} -> ${t.pvApres} PV${effet ? ` + effet "${effet.nom}"` : ""}` });
    if (t.tombe) log.push({ id: id("zko"), at: stamp(), manche: s.manche, message: `${t.cibleNom} est hors combat` });
  }
  return {
    state: checkEnd({ ...s, participants, log }),
    resolution: { lanceurNom: lanceur.nom, sortNom: sort.nom, degatsTotal, touches },
  };
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
 * Lance un sort défensif/utilitaire sur un allié (ou soi) : vérifie le budget
 * et les limites, paie les coûts (mana + PV), applique le soin éventuel,
 * l'effet éventuel (+ modificateurs), l'attaque accordée (griffes, contact)
 * ou l'invocation (démon, zombie). Pas de jet d'attaque.
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
  if (sort.invocation) {
    const r = invoquer(state, lanceurId, sort, rng);
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
  const budget = budgetOk(lanceur, sort.action);
  if (!budget.ok) throw new Error(`${lanceur.nom} : ${budget.raison}.`);
  const lim = etatLimite(lanceur, sort, cibleId);
  if (!lim.ok) throw new Error(`${lanceur.nom} : ${lim.raison}.`);

  let s = applySpellCost(state, lanceurId, sort);
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng).state;

  let soinDetails: number[] = [];
  let soinTotal = 0;
  if (sort.soin) {
    const roll = rollDiceExpression(parseDiceExpression(sort.soin), rng);
    soinDetails = roll.rolls;
    soinTotal = roll.total;
  }
  const pvAvant = cible.pv;
  const pvApres = Math.min(cible.pvMax, pvAvant + soinTotal);
  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: sort.effetDuree ?? null, source: lanceur.nom })
    : null;
  const effet = effetBase
    ? { ...effetBase, modificateurs: { ...effetBase.modificateurs, ...(sort.effetMods ?? {}) } }
    : null;
  // Attaque accordée (Beauté, Aspect) : ajoutée aux attaques de la cible.
  const lanceurApresCouts = s.participants.find((p) => p.instanceId === lanceurId)!;
  const attaqueTmp = sort.attaqueAccordee
    ? {
        id: `sort-tmp:${sort.id}`,
        nom: `✦ ${sort.attaqueAccordee.nom}`,
        bonus: sort.attaqueAccordee.bonus ?? lanceurApresCouts.bonusMagique ?? lanceurApresCouts.niveau,
        degats: substituerStats(sort.attaqueAccordee.degats, lanceurApresCouts.caracs ?? {}),
        volDeVie: sort.attaqueAccordee.volDeVie,
      }
    : null;
  const accordee = attaqueTmp ? sort.attaqueAccordee!.nom : null;

  const participants = s.participants.map((p) => {
    // Lanceur et cible peuvent être le même (soutien sur soi) : cumuler.
    let q = p;
    if (p.instanceId === lanceurId) {
      q = consommerBudget(q, sort.action);
      q = enregistrerUsage(q, sort.id, sort.limiteParCible ? cibleId : undefined);
    }
    if (p.instanceId === cibleId) {
      q = {
        ...q,
        pv: pvApres,
        statut: pvApres > 0 ? ("actif" as const) : q.statut,
        effets: effet ? [...q.effets, effet] : q.effets,
        attaques: attaqueTmp ? [...q.attaques.filter((x) => x.id !== attaqueTmp.id), attaqueTmp] : q.attaques,
      };
    }
    return q;
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("sort"), at: stamp(), manche: s.manche, message: `${lanceur.nom} lance ${sort.nom} sur ${cible.nom}` });
  if (soinTotal > 0) log.push({ id: id("soin"), at: stamp(), manche: s.manche, message: `Soin : ${sort.soin} -> [${soinDetails.join(", ")}] = ${soinTotal} (${pvAvant} -> ${pvApres} PV)` });
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
