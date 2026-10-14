import { parseDiceExpression, rollDiceExpression, substituerDesEvolutifs, substituerStats, dureeEffetSort, type Rng } from "@/src/lib/rules/dice/roller";
import { canAct, createEffect, getModifier, marquerPose } from "@/src/lib/rules/effects/effects";
import { cibleEspeceAcceptee } from "@/src/lib/rules/categories";
import { niveauMinRang, normaliserNomCapacite } from "@/src/lib/rules/creation";
import { ARME_FAMILLES } from "@/src/lib/rules/world/types";
import { drType, niveauAttaque } from "@/src/lib/rules/personnage";
import { CAPACITES } from "@/src/lib/data/capacites";
import type { ActiveEffect, AttackDef, Character, Sort } from "@/src/lib/rules/types";
import type {
  AttackResolution,
  Camp,
  CombatOptions,
  CombatParticipant,
  CombatState,
  SortAbsorbe,
} from "@/src/lib/rules/combat/types";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";

function stamp(): string {
  return new Date().toISOString();
}

/** Niveau effectif pour les dés évolutifs (°) : plancher niv. 1. */
function niveauEffectif(p: { niveau?: number } | null | undefined): number {
  return Math.max(1, Math.floor(p?.niveau ?? 1));
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
    const bonusCarac = cible.caracs?.[sv.carac] ?? 0;
    const jetS = Math.floor(rng() * 20) + 1;
    const totalS = jetS + bonusCarac;
    const reussi = totalS >= sv.difficulte;
    saveReussi = reussi;
    saveLog = `${cible.nom} : test de ${sv.carac} ${jetS}${bonusCarac !== 0 ? ` (${bonusCarac > 0 ? "+" : ""}${bonusCarac})` : ""} = ${totalS} vs diff ${sv.difficulte} → ${reussi ? (spec.sauvegarde?.moitieDM ? "moitié des DM" : `pas de ${spec.cle}`) : spec.cle}`;
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

  // Coûts avant le jet (le sacrifice est perdu même en cas d'échec).
  // Sautés si déjà payés (résolution groupée multi-cibles).
  let s = state;
  if (sort && !paiement.dejaPaye) s = payerCoutSort(s, attackerId, sort, paiement, rng).state;
  if (sort?.coutPV && !paiement.dejaPaye) s = applyCoutPV(s, attackerId, sort.coutPV, rng, niveauEffectif(attaquant)).state;

  const modAttaque = getModifier(attaquant.effets, "attaque") + (attaqueOpts.modAttaque ?? 0);
  // Aveuglé : −5 supplémentaire aux attaques à distance (−10 au total).
  const modDistance = estAttaqueDistance(attaque) ? getModifier(attaquant.effets, "attaqueDistance") : 0;
  const modDefense = getModifier(cible.effets, "defense");
  const bonusBase = attaqueOpts.bonusOverride ?? attaque.bonus;
  const bonusEffectif = bonusBase + modAttaque + modDistance;
  const defenseEffective = cible.defense + modDefense;
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

  let touche: boolean;
  let critique = false;
  // Seuil de critique (Science du critique : 19 avec prédilection, MJ).
  const seuils = attaquant.effets
    .map((e) => e.modificateurs["seuilCrit"])
    .filter((v): v is number => typeof v === "number");
  const seuilCrit = seuils.length > 0 ? Math.min(...seuils) : 20;
  if (attaque.toucheAuto) {
    touche = true;
  } else if (critOpts.nat1EchecAuto && jetNaturel === 1) {
    touche = false;
  } else if (critOpts.nat20ToucheAuto && jetNaturel >= seuilCrit) {
    touche = true;
    critique = true;
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

  // Parade / absorption (Guerrier) : test opposé sur attaque réussie (jets purs,
  // pas les touches auto). Parade : tout sauf énorme/colossale (MJ : moitié).
  // Absorption : sorts uniquement, stocké pour un éventuel Renvoi.
  let pare = false;
  let absorbe: SortAbsorbe | null = null;
  let paradeLog: string | null = null;
  const sortAttaque = sortDeAttaque(attaquant, attaque.id);
  if (touche && !attaque.toucheAuto) {
    const veutParer = getModifier(cible.effets, "parade") > 0;
    const veutAbsorber = !!sortAttaque && getModifier(cible.effets, "absorption") > 0;
    if (veutParer || veutAbsorber) {
      const bonusParade = cible.niveau + Math.max(cible.caracs?.FOR ?? 0, cible.caracs?.AGI ?? 0);
      const jetP = Math.floor(rng() * 20) + 1;
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
          paradeLog = `${cible.nom} absorbe ${sortAttaque.nom} (${jetP}+${bonusParade}=${jetP + bonusParade} vs ${jetTotal}) — Renvoi possible via Capacités`;
        } else {
          paradeLog = `${cible.nom} pare l'attaque de ${attaquant.nom} (${jetP}+${bonusParade}=${jetP + bonusParade} vs ${jetTotal}) !`;
        }
      } else {
        paradeLog = `${cible.nom} rate sa parade (${jetP}+${bonusParade}=${jetP + bonusParade} vs ${jetTotal}).`;
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

  // Dégâts : normaux si touché non paré, moitié si raté (Briser), 0 sinon.
  // Bonus manuels et dés bonus (Puissante, Parfaite, spécialisation, Double peine) doublés en critique.
  let degatsDetails: number[] = [];
  let degatsTotal = 0;
  let moitie = false;
  let bonusLog: string | null = null;
  let doublePeineLog: string | null = null;
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
    if (attaqueOpts.bonusDM) degatsTotal += attaqueOpts.bonusDM;
    // Archer émérite (Rôdeur) : +PER aux DM à l’arc, permanent, sans activation.
    const bonusEmerite = talentConnu(attaquant, "Archer émérite") && (attaque.familles ?? []).includes("arcs")
      ? (attaquant.caracs?.PER ?? 0)
      : 0;
    if (bonusEmerite) degatsTotal += bonusEmerite;
    if (bonusDetails.length > 0 || attaqueOpts.bonusDM || bonusEmerite) {
      const parties = [...bonusDetails, ...(attaqueOpts.bonusDM ? [`${attaqueOpts.bonusDM}`] : []), ...(bonusEmerite ? [`${bonusEmerite} (Archer émérite)`] : [])];
      bonusLog = `+${parties.join(" + ")}${bonusDetails.length > 0 || attaqueOpts.bonusDM ? " (coup spécial)" : ""}`;
    }
    degatsTotal = degatsTotal * (critique ? critOpts.multiplicateur : 1);
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

  let participants = s.participants.map((p) => {
    if (p.instanceId === attackerId) {
      let q = p;
      // Tentatives (limiteCombat) au lancer ; par-cible au touché (ci-dessous).
      if (sort && !sort.limiteParCible) q = enregistrerUsage(q, sort.id);
      // Mémoire Double peine : touche réussie non parée.
      if (talentConnu(q, "Double peine") && (touche || attaque.toucheAuto) && !pare) {
        q = { ...q, dernierCoup: { cibleId: targetId, manche: s.manche, enchaine: doublePeineDeclenchee } };
      }
      return q;
    }
    if (p.instanceId === targetId) {
      // Parade/absorption réussie : stance consommée (un usage), éventuel sort stocké.
      const pvFinal = pare ? pvAvant : pvApres;
      let effets = pare
        ? p.effets.filter((e) => !(e.modificateurs["parade"] > 0) && !(e.modificateurs["absorption"] > 0))
        : p.effets;
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
    log.push({ id: id("jet"), at: stamp(), manche: s.manche, message: `Jet : ${des}${bonusBase}${modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque})` : ""}${modDistance !== 0 ? ` (${modDistance} à distance)` : ""} = ${jetTotal}` });
  }
  log.push({ id: id("def"), at: stamp(), manche: s.manche, message: `Défense ${cible.nom} : ${cible.defense}${modDefense !== 0 ? ` (${modDefense > 0 ? "+" : ""}${modDefense} effets)` : ""}` });
  log.push({ id: id("hit"), at: stamp(), manche: s.manche, message: toucheVraie ? (critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ" });
  if (paralyseLog) log.push({ id: id("paral"), at: stamp(), manche: s.manche, message: paralyseLog });
  if (paradeLog) log.push({ id: id("par"), at: stamp(), manche: s.manche, message: paradeLog });
  if (!toucheVraie && estAttaqueArme(attaque) && talentConnu(cible, "Riposte")) {
    log.push({ id: id("rip"), at: stamp(), manche: s.manche, message: `Riposte (G) : ${cible.nom} peut riposter contre ${attaquant.nom} (attaque au contact uniquement, 1/round — MJ : attaque manuelle)` });
  }
  if (!toucheVraie && estAttaqueArme(attaque) && talentConnu(attaquant, "Attaque à suivre") && !talentConnu(attaquant, "Droite-gauche")) {
    log.push({ id: id("suivre"), at: stamp(), manche: s.manche, message: `Attaque à suivre (G) : ${attaquant.nom} peut attaquer de la 2e main (dague, hachette, épée courte, 1/round — MJ)` });
  }
  if ((toucheVraie || moitie) && !pare) {
    log.push({ id: id("dmg"), at: stamp(), manche: s.manche, message: `Dégâts : ${degatsExpr}${bonusLog ? ` ${bonusLog}` : ""} -> [${degatsDetails.join(", ")}] = ${degatsTotal}${moitie ? " (moitié, raté)" : ""}` });
    if (doublePeineLog) log.push({ id: id("dbl"), at: stamp(), manche: s.manche, message: doublePeineLog });
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
    jetTotal, defenseCible: defenseEffective,
    touche: toucheVraie, critique, degatsDetails, degatsTotal, pvAvant, pvApres, cibleTombe,
    sangMordant: sangLog ? { degats: sangDegats, pvAttaquantApres: pvAttaquantApresSang as number } : null,
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
  const sortChance = sortDeAttaque(attaquant, attaque.id);
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

  return { state: checkEnd({ ...state, participants, log }), resolution };
}

/**
 * Renvoie un sort absorbé contre son expéditeur (Renvoi de sort, Guerrier) :
 * rejoue l'attaque stockée sans coût, puis oublie le sort (qu'il touche ou non).
 * Refusé contre les sorts de zone.
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
  if (abs.zone) throw new Error("Renvoi impossible contre les sorts de zone.");
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);

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
      state: checkEnd({ ...state, participants, log }),
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
 * PV + actuels mana/chance du participant, plafonnés aux max de la fiche.
 * Monstres, invocations et PJ sans fiche : ignorés. Rien d'autre ne change
 * (ni max, ni talents, ni sorts, ni effets).
 */
export function appliquerResultatsCombat(
  fiches: Character[],
  participants: CombatParticipant[]
): Character[] {
  return fiches.map((c) => {
    const p = participants.find((x) => x.camp === "pj" && x.templateId === c.id);
    if (!p) return c;
    const ressources = { ...c.ressources };
    for (const cle of ["mana", "chance"] as const) {
      const cur = ressources[cle];
      const pc = p.ressources[cle];
      if (cur && pc) ressources[cle] = { ...cur, actuel: Math.max(0, Math.min(cur.max, pc.actuel)) };
    }
    return { ...c, pv: Math.max(0, Math.min(c.pvMax, p.pv)), ressources };
  });
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
 * statut, usages, initiative, attaques temporaires (sort-tmp:).
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
    niveau: frais.niveau,
    caracs: frais.caracs,
    ressources,
    deRecuperation: frais.deRecuperation,
  };
  const cleStructurelle = (p: CombatParticipant) =>
    JSON.stringify({
      attaques: p.attaques,
      sorts: p.sorts,
      capacites: p.capacites,
      bonusMagique: p.bonusMagique,
      niveau: p.niveau,
      caracs: p.caracs,
      ressources: p.ressources,
      deRecuperation: p.deRecuperation,
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

/** Attaque d'arme (ni sort, ni accordée, ni renvoi, ni invocation) ? */
function estAttaqueArme(attaque: { id: string }): boolean {
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

/**
 * Attaque à distance (arme de famille à distance, ex: arcs) ?
 * Sorts exclus : tests d'attaque magique (−5 de l'aveuglé, sorts exigeant
 * la vue interdits — MJ), pas des attaques à distance (−10).
 */
export function estAttaqueDistance(attaque: { id: string; familles?: string[] }): boolean {
  if (!estAttaqueArme(attaque)) return false;
  return (attaque.familles ?? []).some((x) => FAMILLES_DISTANCE.has(x));
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
  return { state: checkEnd({ ...state, participants, log }), pvPerdus, details: roll.rolls };
}

/**
 * Utilise un talent connu sur une cible : paie le sacrifice de PV éventuel
 * (Pacte démoniaque), applique le soin éventuel en dés (Increvable : 4d4°+CON
 * du lanceur), purge les états non permanents (Increvable), applique l'effet
 * éventuel (buff/debuff/DoT, avec modificateurs) et journalise dans tous les cas.
 * Pas de jet, pas de coût PM : le MJ arbitre le timing (ex. réaction)
 * et les actions (talents libres/passifs, (G) gratuit, géré en réel).
 */
export function utiliserCapacite(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  talentNom: string,
  opts: { effetCle?: string | null; dureeTours?: number | null; mods?: Record<string, number>; coutPV?: string; soin?: string; soinFixe?: number; nettoie?: boolean } = {},
  rng: Rng = Math.random
): { state: CombatState; resolution: CapaciteResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (!lanceur.capacites.includes(talentNom)) throw new Error(`${lanceur.nom} ne connaît pas « ${talentNom} ».`);
  if (!canAct(lanceur.effets)) throw new Error(`${lanceur.nom} ne peut pas agir (Étourdi/Immobilisé).`);

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

  const participants = s.participants.map((p) => {
    if (p.instanceId !== cibleId) return p;
    const gardes = opts.nettoie ? p.effets.filter((e) => e.toursRestants === null) : p.effets;
    const pv = Math.min(p.pvMax, p.pv + soinTotal);
    return {
      ...p,
      pv,
      statut: pv > 0 ? ("actif" as const) : p.statut,
      effets: effet ? [...gardes, effet] : gardes,
    };
  });

  const id = (x: string) => `${x}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const log = [...s.log];
  log.push({ id: id("cap"), at: stamp(), manche: s.manche, message: `${lanceur.nom} utilise ${talentNom} sur ${cible.nom}` });
  if (soinTotal > 0) log.push({ id: id("csoin"), at: stamp(), manche: s.manche, message: soinFixeLog ?? `Soin : ${opts.soin} -> [${soinDetails.join(", ")}] = ${soinTotal}` });
  if (opts.nettoie) log.push({ id: id("cnet"), at: stamp(), manche: s.manche, message: `${cible.nom} : états non permanents purgés` });
  if (effet) log.push({ id: id("ceff"), at: stamp(), manche: s.manche, message: `Effet "${effet.nom}" (${effet.toursRestants ?? "∞"} tours) sur ${cible.nom}` });

  return {
    state: { ...s, participants, log },
    resolution: {
      lanceurNom: lanceur.nom, cibleNom: cible.nom, talentNom, effetNom: effet?.nom ?? null,
      soinTotal,
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
 * Invoque un serviteur (démon, zombie) : paie les coûts,
 * ajoute un participant au camp du lanceur (agit en fin d'ordre).
 */
export function invoquer(
  state: CombatState,
  lanceurId: string,
  sort: Sort,
  rng: Rng = Math.random,
  paiement: PaiementSort = {}
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
    attaques: [{ id: "inv-attaque", nom: `Contact (${inv.nom})`, bonus, degats: substituerDesEvolutifs(substituerStats(inv.degats, lanceurApres.caracs ?? {}), niveauEffectif(lanceurApres)) }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: lanceurApres.niveau,
    ressources: {},
    statut: "actif",
    usagesSorts: {},
  };
  const participants = [
    ...s.participants.map((p) =>
      p.instanceId === lanceurId ? enregistrerUsage(p, sort.id) : p
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
 * Construit le compagnon loup permanent du rôdeur (talent Le loup) :
 * loup ou alpha selon les talents connus. DRS : DEF 12+rang (+1 par rang 5
 * en voie avec Tactiques de meute), PV niv×4, contact au bonus magique
 * du rôdeur (1d4+2, 1d4°+5 alpha). Le loup est un participant à part
 * entière : ajouté en préparation de combat, avec sa propre initiative
 * (lancée ensuite).
 */
export function construireLoupCompagnon(
  lanceur: CombatParticipant,
  opts: { instanceId?: string; templateId?: string; initMod?: number; initiative?: number | null } = {}
): CombatParticipant {
  if (!talentConnu(lanceur, "Le loup")) throw new Error(`${lanceur.nom} : pas de compagnon (Le loup).`);
  const connus = new Set([
    ...(lanceur.capacites ?? []).map((x) => cleTalent(x)),
    ...(lanceur.sorts ?? []).map((x) => cleTalent(x.nom)),
  ]);
  const voies = (lanceur.profil && CAPACITES[lanceur.profil]) || [];
  const voieLoup = voies.find((v) => v.voie === "Voie du compagnon animal");
  const rangsLoup = (voieLoup?.capacites ?? [])
    .filter((x) => connus.has(cleTalent(x.nom)))
    .map((x) => x.rang);
  const rangLoup = Math.max(1, ...rangsLoup);
  const alpha = connus.has(cleTalent("Loup alpha"));
  let rang5 = 0;
  if (connus.has(cleTalent("Tactiques de meute"))) {
    for (const v of voies) {
      if (v.capacites.some((x) => x.rang === 5 && connus.has(cleTalent(x.nom)))) rang5 += 1;
    }
  }
  const niv = Math.max(1, Math.floor(lanceur.niveau));
  const pv = niv * 4;
  const defense = 12 + rangLoup + rang5;
  const bonus = lanceur.bonusMagique ?? niv;
  const nom = `${alpha ? "Loup alpha" : "Loup"} (${lanceur.nom})`;
  return {
    instanceId: opts.instanceId ?? `loup-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    templateId: opts.templateId ?? "compagnon:loup",
    nom,
    camp: lanceur.camp,
    pvMax: pv,
    pv,
    defense,
    initMod: opts.initMod ?? 0,
    initiative: opts.initiative !== undefined ? opts.initiative : lanceur.initiative,
    attaques: [{ id: "loup-morsure", nom: "Morsure", bonus, degats: alpha ? substituerDesEvolutifs("1d4°+5", Math.max(1, Math.floor(lanceur.niveau))) : "1d4+2" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: niv,
    ressources: {},
    statut: "actif",
    usagesSorts: {},
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
  const frais = construireLoupCompagnon(lanceur);
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
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracs ?? {}), source: lanceur.nom })
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
  const touches: ZoneResolution["touches"] = [];
  const participants = s.participants.map((p) => {
    if (p.instanceId === lanceurId) {
      return enregistrerUsage(p, sort.id);
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
  log.push({ id: id("zone"), at: stamp(), manche: s.manche, message: `${lanceur.nom} déchaîne ${sort.nom} : ${degatsTotal} DM [${degatsDetails.join(", ")}] sur ${touches.length} cible(s)` });
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
 */
export function castSoutien(
  state: CombatState,
  lanceurId: string,
  cibleId: string,
  sort: Sort,
  rng: Rng = Math.random,
  paiement: PaiementSort = {}
): { state: CombatState; resolution: SoutienResolution } {
  const lanceur = state.participants.find((p) => p.instanceId === lanceurId);
  const cible = state.participants.find((p) => p.instanceId === cibleId);
  if (!lanceur) throw new Error("Lanceur introuvable.");
  if (!cible) throw new Error("Cible introuvable.");
  if (sort.type === "offensif") throw new Error(`${sort.nom} est offensif : utilisez une attaque.`);
  if (sort.invocation) {
    const r = invoquer(state, lanceurId, sort, rng, paiement);
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

  let s = payerCoutSort(state, lanceurId, sort, paiement, rng).state;
  if (sort.coutPV) s = applyCoutPV(s, lanceurId, sort.coutPV, rng, niveauEffectif(lanceur)).state;

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
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracs ?? {}), source: lanceur.nom })
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

/**
 * Un sort est-il lançable hors combat ?
 * Règle : hors combat il n'y a pas d'économie d'action (A/M/L ignorée).
 * Sont lançables les sorts défensifs et utilitaires, sauf les frappes de
 * zone et les invocations (elles ajoutent un participant : combat requis).
 * Les sorts offensifs passent par un jet d'attaque : combat uniquement.
 */
export function sortLancableHorsCombat(sort: Sort): { ok: boolean; raison?: string } {
  if (sort.type === "offensif") {
    return { ok: false, raison: `${sort.nom} est offensif : à lancer en combat (attaque).` };
  }
  if (sort.zone) {
    return { ok: false, raison: `${sort.nom} est une frappe de zone : en combat uniquement.` };
  }
  if (sort.invocation) {
    return { ok: false, raison: `${sort.nom} invoque ${sort.invocation.nom} : en combat uniquement (MJ).` };
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
}

/**
 * Lance un sort de soutien hors combat (défensif/utilitaire non-zone,
 * non-invocation) : vérifie le niveau et le mana, paie les coûts
 * (mana + PV), applique le soin, l'effet et l'attaque accordée éventuels.
 * L'action DRS (attaque/mouvement/limitée) est ignorée : hors combat il
 * n'y a pas de limite d'action ni de mouvement. La concentration accrue
 * reste possible : le lanceur prend le temps de se concentrer (−2 PM,
 * plancher 0, sorts d'attaque (A) uniquement — comme en combat).
 * Les limites par combat (tentatives, par-cible) ne s'appliquent pas
 * hors combat (pas de compteur). La brûlure de mana reste possible (à 0 PM,
 * 1 DR par PM effectif, jamais pour les soins).
 * Sorts purement narratifs (Augure...) : coût payé, effet au MJ.
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
  const niveau = sortUtilisable(lanceur.niveau, sort);
  if (!niveau.ok) throw new Error(`${sort.nom} : ${niveau.raison}.`);

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
  if (sort.soin) {
    const roll = rollDiceExpression(parseDiceExpression(sort.soin), rng);
    soinDetails = roll.rolls;
    soinTotal = Math.max(0, roll.total);
  }
  const pvAvant = cible.pv;
  const pvApres = Math.min(cible.pvMax, pvAvant + soinTotal);

  const effetBase = sort.effetCle
    ? createEffect(sort.effetCle, { dureeTours: dureeEffetSort(sort.effetDuree, lanceur.caracteristiques ?? {}), source: lanceur.nom })
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
    },
  };
}
