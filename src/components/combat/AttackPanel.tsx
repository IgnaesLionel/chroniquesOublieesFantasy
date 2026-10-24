"use client";
import { useState } from "react";
import type { AttackResolution, CombatParticipant } from "@/src/lib/rules/combat/types";
import { canAct, getModifier, attaqueInterdite } from "@/src/lib/rules/effects/effects";
import { etatLimite, sortUtilisable, estAttaqueContact, estAttaqueArme, estAttaqueDistance, estLoupCompagnon, trouverMaitreLoup, propositionTravailEquipe, raisonSeuilPv, raisonExigeVivant, type AttaqueOpts, type PaiementSort } from "@/src/lib/rules/combat/attack";
import { composantesAttaque, probabiliteToucher, seuilDefense } from "@/src/lib/rules/combat/touche";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";
import { labelFamilleArme } from "@/src/lib/rules/world/types";
import { PopupValidationMJ, type QuestionMJ } from "@/src/components/combat/PopupValidationMJ";
import { mjFiltrerAValider } from "@/src/lib/ui/validations-mj";
import { familleDuProfil, familleDuSort, classeFamille } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

/** Lettre d'action COF : Attaque (A) + Mouvement (M) par tour, ou Limitée (L). */
const LETTRE_ACTION: Record<string, string> = { attaque: "A", mouvement: "M", limitee: "L", gratuite: "G" };

interface Props {
  participants: CombatParticipant[];
  attackerId: string | null;
  attackId: string | null;
  targetId: string | null;
  last: AttackResolution | null;
  onAttack: (id: string) => void;
  onTarget: (id: string) => void;
  onRoll: (opts?: AttaqueOpts, paiement?: PaiementSort) => void;
  onChance: () => void;
  /** Posture tactique (défenses, riposte, soutenir) : appliquée sans jet. */
  onTactique: (cibleId: string, cle: string, duree: number | null) => void;
  /** Lancement multi-cibles / zone (sinon repli mono-cible). */
  onMulti?: (attackerId: string, attackId: string, cibleIds: string[], opts?: AttaqueOpts, paiement?: PaiementSort) => void;
  /** Attaque double (L, arme au contact) : 2 résolutions à −2, même cible (page). */
  onDouble?: () => void;
  /** Attaque circulaire (L) : 1 résolution à −2 par cible armée cochée (page). */
  onMultiArmes?: (attackerId: string, attackId: string, cibleIds: string[], opts?: AttaqueOpts) => void;
  /** Trace « MJ a validé » au journal de combat. */
  onLogMJ?: (message: string) => void;
}

export function AttackPanel({ participants, attackerId, attackId, targetId, last, onAttack, onTarget, onRoll, onChance, onMulti, onDouble, onMultiArmes, onTactique, onLogMJ }: Props) {
  const attacker = participants.find((p) => p.instanceId === attackerId) ?? null;
  const vivants = participants.filter((p) => p.statut === "actif");
  /** Cible courante (badge de famille/camp à côté du libellé « Cible »). */
  const cibleSel = participants.find((p) => p.instanceId === targetId) ?? null;
  const bloque = attacker !== null && !canAct(attacker.effets);
  const modAttaque = attacker ? getModifier(attacker.effets, "attaque") : 0;
  const [puissante, setPuissante] = useState(false);
  const [variante, setVariante] = useState<"A" | "L">("A");
  const [parfaite, setParfaite] = useState(false);
  const [mille, setMille] = useState(false);
  const [varianteMille, setVarianteMille] = useState<"A" | "L">("A");
  const [fleche, setFleche] = useState(false);
  const [modeFleche, setModeFleche] = useState<"dm" | "statut">("dm");
  const [statutFleche, setStatutFleche] = useState("aveugle");
  const [eclair, setEclair] = useState(false);
  const [double, setDouble] = useState(false);
  const [circulaire, setCirculaire] = useState(false);
  const [equipeContact, setEquipeContact] = useState(false);
  const [mod, setMod] = useState("");
  const [dm, setDm] = useState("");
  const [cibles, setCibles] = useState<string[] | null>(null);
  /** Questions MJ en attente (pop-up ouverte) : bloque la résolution. */
  const [attenteMj, setAttenteMj] = useState<QuestionMJ[] | null>(null);
  // Sort sélectionné : zone et multi-cibles affichent des cases à cocher.
  const selIdTop = attackId ?? attacker?.attaques[0]?.id;
  const selAttaqueTop = attacker?.attaques.find((x) => x.id === selIdTop);
  const selSortTop = attacker && selAttaqueTop && selAttaqueTop.id.startsWith("sort:")
    ? attacker.sorts.find((x) => `sort:${x.id}` === selAttaqueTop.id)
    : undefined;
  const estZoneTop = !!selSortTop?.zone;
  const maxCibles = selSortTop?.ciblesMax ?? null;
  const estMultiTop = !!selSortTop && !estZoneTop && ((maxCibles ?? 1) > 1 || !!selSortTop.ciblesLibres);
  // Options tactiques (assurée/précise/violente) : armes uniquement, jamais sur attaque magique.
  const estMagiqueTop = !!selAttaqueTop?.id.startsWith("sort:");
  const talents = new Set((attacker?.capacites ?? []).map(normaliserNomCapacite));
  const connaitPuissante = talents.has(normaliserNomCapacite("Attaque puissante"));
  const connaitParfaite = talents.has(normaliserNomCapacite("Attaque parfaite"));
  const connaitMille = talents.has(normaliserNomCapacite("Dans le mille"));
  const connaitFleche = talents.has(normaliserNomCapacite("Flèche de mort"));
  const connaitEclair = talents.has(normaliserNomCapacite("Attaque éclair"));
  // Voie du combat (R4/R5) : Double attaque et Attaque circulaire, armes au
  // contact (estAttaqueContact exclut déjà les sorts et les armes à distance).
  const connaitDoubleArme = talents.has(normaliserNomCapacite("Double attaque"));
  const connaitCirculaireArme = talents.has(normaliserNomCapacite("Attaque circulaire"));
  const armeContact = !!selAttaqueTop && estAttaqueContact(selAttaqueTop, !!selSortTop);
  const proposeDouble = connaitDoubleArme && armeContact;
  const proposeCirculaire = connaitCirculaireArme && armeContact;
  const choixMultiples = (!!onMulti && (estZoneTop || estMultiTop)) || (circulaire && proposeCirculaire && !!onMultiArmes);
  const ennemisTop = (attacker ? participants.filter((p) => p.statut === "actif" && p.camp !== attacker.camp && p.instanceId !== attacker.instanceId) : []).map((p) => p.instanceId);
  // Pré-sélection : ennemis (plafonnée pour ×N). null = auto ; réinitialisée
  // à chaque attaquant/attaque (état dérivé au rendu, pas d'effet).
  const defautCibles = maxCibles != null ? ennemisTop.slice(0, maxCibles) : ennemisTop;
  const ciblesAffichees = cibles ?? defautCibles;
  const cleSelection = `${attackerId}|${selIdTop}`;
  const [cleMemorisee, setCleMemorisee] = useState(cleSelection);
  if (cleMemorisee !== cleSelection) {
    setCleMemorisee(cleSelection);
    setCibles(null);
    setEquipeContact(false);
    setDouble(false);
    setCirculaire(false);
    setAttenteMj(null);
  }
  const [modeLancement, setModeLancement] = useState<"mana" | "brulure">("mana");
  const [concentration, setConcentration] = useState(false);
  const [tactique, setTactique] = useState<"normale" | "assuree" | "precise" | "violente" | "defense-partielle" | "defense-totale" | "riposte" | "soutenir">("normale");
  // Travail d'équipe (Rôdeur) : si l'attaquant est le loup et son maître a le
  // talent, proposer le dé bonus (adjacence déclarée par le MJ, pas de positions suivies).
  // Trois cas affichés : proposition (talent OK), astuce R2 (sans talent),
  // diagnostic (maître introuvable : staging à reconstruire).
  const loupAttaquant = attacker && estLoupCompagnon(attacker) ? attacker : null;
  const maitreLoup = loupAttaquant ? trouverMaitreLoup(participants, loupAttaquant) : undefined;
  const maitreATalent = !!maitreLoup && (maitreLoup.capacites ?? []).some((t) => normaliserNomCapacite(t) === normaliserNomCapacite("Travail d'équipe"));
  const deBonusActif = !!attacker && getModifier(attacker.effets, "deBonus") > 0;
  const propositionEquipe = propositionTravailEquipe(participants, attackerId);
  const proposeEquipe = propositionEquipe != null;
  const loupSansTalent = !!loupAttaquant && !!maitreLoup && !maitreATalent && !deBonusActif;
  const loupSansMaitre = !!loupAttaquant && !maitreLoup;
  const STATUTS_FLECHE = [
    { cle: "aveugle", nom: "Aveuglé" },
    { cle: "affaibli", nom: "Affaibli" },
    { cle: "ralenti", nom: "Ralenti" },
    { cle: "immobilise", nom: "Immobilisé" },
  ];
  /**
   * Chance de toucher pour une option tactique, calculée comme le moteur
   * (composantesAttaque / seuilDefense / probabiliteToucher) : d20 + bonus
   * contre la DEF de la cible, 1 naturel = échec, 20 naturel = touche (ou le
   * seuil de critique : 19-20 avec Science du critique), dé bonus/malus inclus.
   * null quand la notion n'a pas de sens : multi-cibles, test opposé magique,
   * difficulté fixe de sort (formule non résolue ici).
   */
  const chanceToucher = (option: "normale" | "assuree" | "precise" | "violente"): number | null => {
    if (!attacker || !selAttaqueTop || choixMultiples) return null;
    if (!cibleSel || cibleSel.statut !== "actif") return null;
    if (selSortTop?.testOppose === "magique" || selSortTop?.difficulteAttaque) return null;
    if (selAttaqueTop.toucheAuto) return 1;
    if (getModifier(cibleSel.effets, "paralyse") > 0) return 1;
    const modTactique = option === "assuree" ? 5 : option === "precise" ? -3 : option === "violente" ? -7 : 0;
    const modManuel = mod.trim() !== "" && Number.isFinite(Number(mod)) ? Number(mod) : 0;
    const situation = composantesAttaque(attacker, selAttaqueTop, {
      modAttaque:
        modManuel +
        modTactique +
        (double && proposeDouble ? -2 : 0) +
        (circulaire && proposeCirculaire ? -2 : 0),
      bonusOverride: eclair && connaitEclair ? attacker.niveau + (attacker.caracs?.AGI ?? 0) : undefined,
      arme: estAttaqueArme(selAttaqueTop),
      distance: estAttaqueDistance(selAttaqueTop),
    });
    const aBonus =
      getModifier(attacker.effets, "deBonus") > 0 ||
      (parfaite && connaitParfaite) ||
      (fleche && connaitFleche) ||
      (equipeContact && proposeEquipe);
    const aMalus =
      getModifier(attacker.effets, "deMalus") > 0 || (puissante && connaitPuissante) || (mille && connaitMille);
    const avantage = aBonus && !aMalus ? ("bonus" as const) : !aBonus && aMalus ? ("malus" as const) : null;
    const seuils = attacker.effets
      .map((e) => e.modificateurs["seuilCrit"])
      .filter((v): v is number => typeof v === "number");
    const critiqueAuto = situation.predilection > 0 && talents.has(normaliserNomCapacite("Science du critique"));
    const seuilCrit = Math.min(...(seuils.length ? seuils : [20]), critiqueAuto ? 19 : 20);
    return probabiliteToucher(situation.bonus, seuilDefense(cibleSel), avantage, seuilCrit);
  };
  const chanceAffichee = chanceToucher("normale") != null;
  const pourcent = (p: number) => `${Math.round(p * 100)} %`;
  const tonChance = (p: number) => (p >= 0.75 ? "text-green-400" : p >= 0.4 ? "text-amber-300" : "text-red-400");
  const lancer = (force = false) => {
    const opts: AttaqueOpts = {};
    const modN = Number(mod);
    if (mod.trim() !== "" && Number.isFinite(modN) && modN !== 0) opts.modAttaque = modN;
    const dmN = Number(dm);
    if (dm.trim() !== "" && Number.isFinite(dmN) && dmN !== 0) opts.bonusDM = dmN;
    if (puissante && connaitPuissante) {
      opts.deMalus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), variante === "L" ? "3d4°" : "2d4°"];
    }
    if (parfaite && connaitParfaite) {
      opts.deBonus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), "1d4°"];
    }
    if (mille && connaitMille) {
      opts.deMalus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), varianteMille === "L" ? "3d4°" : "2d4°"];
    }
    if (fleche && connaitFleche) {
      opts.deBonus = true;
      if (modeFleche === "dm") opts.degatsBonus = [...(opts.degatsBonus ?? []), "1d4°"];
      else opts.effetSupp = { cle: statutFleche, duree: 1 };
    }
    if (equipeContact && proposeEquipe) {
      opts.deBonus = true;
    }
    if (eclair && connaitEclair && attacker) {
      const agi = attacker.caracs?.AGI ?? 0;
      opts.bonusOverride = attacker.niveau + agi;
      const courante = attacker.attaques.find((x) => x.id === (attackId ?? attacker.attaques[0]?.id));
      const des = courante?.degats.match(/^(\d*d\d+°?)(.*)$/);
      if (courante && des) opts.degatsOverride = `${des[1]}+${agi}`;
    }
    // Voie du combat : Double (2 attaques à −2) et Circulaire (1 à −2 par
    // cible) — armes au contact ; le −2 est passé aux résolutions de la page.
    if (double && connaitDoubleArme) opts.modAttaque = (opts.modAttaque ?? 0) - 2;
    if (circulaire && connaitCirculaireArme) opts.modAttaque = (opts.modAttaque ?? 0) - 2;
    // Mode de lancement du sort (incantation / brûlure + concentration éventuelle).
    const selAttaque = attacker?.attaques.find((x) => x.id === (attackId ?? attacker?.attaques[0]?.id));
    const selSort = attacker && selAttaque && selAttaque.id.startsWith("sort:")
      ? attacker.sorts.find((x) => `sort:${x.id}` === selAttaque.id)
      : undefined;
    const selCout = selSort?.cout?.montant ?? 0;
    const concOk = !!selSort && (selSort.action ?? "attaque") === "attaque" && selCout > 0 && concentration;
    const coutEff = concOk ? Math.max(0, selCout - 2) : selCout;
    const burnOk = !!selSort && !selSort.soin && coutEff > 0 && (attacker?.ressources["mana"]?.actuel ?? 0) === 0
      && !!attacker?.deRecuperation && modeLancement === "brulure";
    // Option tactique : armes au contact ou à distance pour les attaques,
    // jamais sur attaque magique. Défenses, riposte (self-buff) et soutenir
    // (un allié) : postures appliquées sans jet.
    const tactiqueEff = (tactique === "assuree" || tactique === "precise" || tactique === "violente") && selSort ? "normale" : tactique;
    // Validation MJ (pop-up) : l'arme n'a portée/contact/zone pas suivies par
    // le moteur. Toute condition (Parfaite = arme de prédilection, Flèche de
    // mort = NC inférieur, Éclair = déplacement, Soutenir = au contact, zone
    // de sort, question propre au sort `questionMJ`) est constatée ici, puis
    // journalisée. L'option « ne plus redemander » saute la pop-up.
    const questionsActives: QuestionMJ[] = [
      ...(parfaite && connaitParfaite ? [{ cle: "att:parfaite", question: "Attaque parfaite : l'arme en main est-elle votre arme de prédilection ?" }] : []),
      ...(fleche && connaitFleche ? [{ cle: "att:fleche", question: "Flèche de mort : la cible est-elle d'un NC strictement inférieur au vôtre ?" }] : []),
      ...(eclair && connaitEclair ? [{ cle: "att:eclair", question: "Attaque éclair : le déplacement jusqu'à la cible est-il possible (≤ 10 m, +10 m au rang 5) ?" }] : []),
      ...(double && connaitDoubleArme ? [{ cle: "att:double", question: "Attaque double : les deux coups sont-ils portés au contact de la cible ?" }] : []),
      ...(circulaire && connaitCirculaireArme ? [{ cle: "att:circ", question: "Attaque circulaire : tous les ennemis cochés sont-ils au contact ?" }] : []),
      ...(tactiqueEff === "soutenir" && attacker ? [{ cle: "att:soutenir", question: "Soutenir un allié : l'allié est-il au contact de son adversaire ?" }] : []),
      ...(selSort ? (selSort.questionMJ
        ? [{ cle: `sort:${selSort.id}`, question: selSort.questionMJ }]
        : (choixMultiples && (estZoneTop || estMultiTop)) ? [{ cle: "att:zone", question: "Zone / cibles multiples : les placements dans l'aire (allies compris) sont-ils validés ?" }] : []) : []),
    ];
    const questions = mjFiltrerAValider(questionsActives);
    if (questions.length > 0 && !force) {
      setAttenteMj(questions);
      return;
    }
    if (questionsActives.length > 0) {
      const contexte = tactiqueEff === "soutenir" ? "Soutenir un allié" : (selAttaque?.nom ?? "attaque");
      onLogMJ?.(`⚖️ MJ validé — ⚔️ ${contexte} (${attacker?.nom ?? ""}) : ${questionsActives.map((q) => q.question).join(" / ")}`);
    }
    if (tactiqueEff === "assuree") {
      opts.modAttaque = (opts.modAttaque ?? 0) + 5;
      opts.diviseDM = 2;
      opts.tactique = "assuree";
    } else if (tactiqueEff === "precise") {
      opts.modAttaque = (opts.modAttaque ?? 0) - 3;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), "1d4°"];
      opts.tactique = "precise";
    } else if (tactiqueEff === "violente") {
      opts.modAttaque = (opts.modAttaque ?? 0) - 7;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), "2d4°"];
      opts.tactique = "violente";
    }
    // Postures : sans jet, journalisées comme effets 1 round.
    if ((tactiqueEff === "defense-partielle" || tactiqueEff === "defense-totale") && attacker) {
      onTactique(attacker.instanceId, tactiqueEff, 1);
      setTactique("normale");
      return;
    }
    if (tactiqueEff === "riposte" && attacker) {
      onTactique(attacker.instanceId, "riposte-posture", 1);
      setTactique("normale");
      return;
    }
    if (tactiqueEff === "soutenir" && attacker) {
      const cible = participants.find((p) => p.instanceId === targetId);
      if (!cible || cible.instanceId === attacker.instanceId || cible.camp !== attacker.camp || cible.statut !== "actif") return;
      onTactique(cible.instanceId, "soutien-tactique", 1);
      setTactique("normale");
      return;
    }
    const paiement: PaiementSort = {
      mode: burnOk ? "brulure" : "mana",
      concentration: concOk,
    };
    // Voie du combat : cases Double / Circulaire (armes au contact, sans
    // paiement de sort) — la page enchaîne les résolutions à −2.
    if (double && connaitDoubleArme && onDouble && !circulaire) {
      onDouble();
      return;
    }
    if (circulaire && connaitCirculaireArme && onMultiArmes && attacker) {
      onMultiArmes(attacker.instanceId, selAttaque?.id ?? "", ciblesAffichees, opts);
      return;
    }
    if (choixMultiples && attacker) {
      onMulti!(attacker.instanceId, selAttaque?.id ?? "", ciblesAffichees, opts, paiement);
      return;
    }
    onRoll(opts, paiement);
  };
  const basculerCible = (id: string) => {
    setCibles((prev) => {
      const base = prev ?? defautCibles;
      if (base.includes(id)) return base.filter((x) => x !== id);
      if (maxCibles != null && base.length >= maxCibles) return base;
      return [...base, id];
    });
  };

  return (
    <div className="rounded-lg border border-red-900 bg-zinc-900 p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase text-red-300">⚔️ Attaque</h2>
      {attacker && (() => {
        const mana = attacker.ressources["mana"];
        const selId = attackId ?? attacker.attaques[0]?.id;
        const selAttaque = attacker.attaques.find((x) => x.id === selId);
        const selSort = selAttaque && selAttaque.id.startsWith("sort:")
          ? attacker.sorts.find((x) => `sort:${x.id}` === selAttaque.id)
          : undefined;
        const coutBase = selSort?.cout?.montant ?? 0;
        const concPossible = !!selSort && (selSort.action ?? "attaque") === "attaque" && coutBase > 0;
        const concActive = concentration && concPossible;
        const coutEff = concActive ? Math.max(0, coutBase - 2) : coutBase;
        const raisonBrulure = (): string | null => {
          if (!selSort) return null;
          if (selSort.soin) return "brûlure interdite pour les soins";
          if (coutEff <= 0) return "brûlure inutile (coût 0)";
          if ((mana?.actuel ?? 0) !== 0) return "brûlure réservée au 0 mana";
          if (!attacker.deRecuperation) return "pas de dé de récupération";
          return null;
        };
        const burnPossible = !!selSort && raisonBrulure() === null;
        const burnActive = modeLancement === "brulure" && burnPossible;
        const info = (id: string) => {
          const attaque = attacker.attaques.find((x) => x.id === id);
          const sort = id.startsWith("sort:") ? attacker.sorts.find((x) => `sort:${x.id}` === id) : undefined;
          const cout = sort?.cout?.montant ?? 0;
          const raisons: string[] = [];
          const estSel = id === selId;
          const coutOptions = estSel && concActive ? Math.max(0, cout - 2) : cout;
          const burnOptions = estSel && burnActive;
          if (!burnOptions && (mana?.actuel ?? 0) < coutOptions) raisons.push("manque de mana");
          if (estSel && modeLancement === "brulure" && !burnActive && sort) {
            const r = raisonBrulure();
            if (r) raisons.push(r);
          }
          if (sort) {
            const u = sortUtilisable(attacker.niveau, sort);
            if (!u.ok && u.raison) raisons.push(u.raison);
            const lim = etatLimite(attacker, sort, targetId ?? undefined);
            if (!lim.ok && lim.raison) raisons.push(lim.raison);
          }
          // Attaque réservée à une réserve de PV (ex. Baiser du vampire : moitié ou moins).
          if (attaque) {
            const r = raisonSeuilPv(attacker, attaque);
            if (r) raisons.push(r);
          }
          // Attaque réservée aux créatures vivantes (ex. Vampirisation).
          if (attaque?.exigeVivant) {
            const cible = participants.find((p) => p.instanceId === targetId);
            const r = raisonExigeVivant(attaque, cible);
            if (r) raisons.push(r);
          }
          return { cout, raisons, sort, attaque };
        };
        return (
          <>
          <label className="block text-sm">Arme / sort
            {mana && <span className="ml-2 font-mono text-xs text-violet-300">mana {mana.actuel}/{mana.max}</span>}
            <select id="combat-attaque" name="attaque" value={attackId ?? attacker.attaques[0]?.id ?? ""} onChange={(e) => onAttack(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
              {attacker.attaques.map((a) => {
                const { cout, raisons, sort } = info(a.id);
                const jouable = raisons.length === 0;
                const lettre = LETTRE_ACTION[a.action ?? sort?.action ?? "attaque"] ?? "A";
                const tags = [
                  lettre,
                  a.degats === "1d1-1" ? "effet" : a.degats,
                  cout > 0 ? `${cout} PM` : "",
                  sort ? (familleDuSort(sort) ?? "") : "",
                  sort?.coutPV ? `${sort.coutPV} PV` : "",
                  a.volDeVie ? "vol" : "",
                  a.seuilPv != null ? `≤ ${Math.round(a.seuilPv * 100)} % PV` : "",
                  a.exigeVivant ? "cible vivante" : "",
                  sort?.limiteCombat != null && !sort.limiteParCible ? `1×${sort.limiteCombat}/combat` : "",
                  sort?.limiteParCible ? "1/combat/cible" : "",
                  sort?.zone ? "zone" : "",
                  sort?.ciblesMax != null && sort.ciblesMax > 1 ? `×${sort.ciblesMax} cibles` : "",
                  sort?.ciblesLibres ? "cibles multiples" : "",
                  a.toucheAuto ? "auto" : "",
                  sort?.cibleEspeces?.length ? `💀 ${sort.cibleEspeces.join("/")}` : "",
                ].filter(Boolean).join(" · ");
                return (
                  <option key={a.id} value={a.id} disabled={!jouable}>
                    {a.nom} +{a.bonus}{modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque} effets)` : ""} · {tags}{jouable ? "" : ` (${raisons.join(", ")})`}
                  </option>
                );
              })}
            </select>
          </label>
          {(() => {
            const fam = attacker.famillePredilection ?? null;
            if (!fam || !(selAttaque?.familles ?? []).includes(fam)) return null;
            const spec = Math.min(6, Math.max(0, attacker.bonusSpecialisation ?? 0));
            const connaitCritique = talents.has(normaliserNomCapacite("Science du critique"));
            const connaitSpec = talents.has(normaliserNomCapacite("Spécialisation"));
            return (
              <div className="text-xs text-amber-300 mt-1" title="Maître d'armes : bonus appliqués automatiquement à la résolution (plus rien à saisir en Mod./Bonus DM).">
                ◈ {labelFamilleArme(fam)} — prédilection : +1 attaque
                {connaitCritique ? " · critique 19-20" : ""}
                {connaitSpec && spec > 0 ? ` · Spécialisation +${spec} DM` : ""}
                {" (auto)"}
              </div>
            );
          })()}
          {selSort && coutBase > 0 && (
            <div className={`rounded border border-zinc-800 p-2 mt-1.5 space-y-1.5 text-sm fam-rail ${classeFamille(familleDuSort(selSort))}`}>
              <div className="text-xs uppercase text-zinc-500 font-bold">Lancement du sort <FamilleBadge famille={familleDuSort(selSort)} className="ml-1" /></div>
              <label className="flex items-center gap-2" title="Incantation classique : paie le coût en mana">
                <input type="radio" checked={modeLancement === "mana"} onChange={() => setModeLancement("mana")} />
                <span>Incantation ({coutEff} PM{concActive && coutEff !== coutBase ? `, concentré depuis ${coutBase}` : ""})</span>
              </label>
              <label className={`flex items-center gap-2 ${burnPossible ? "" : "opacity-40"}`} title={raisonBrulure() ?? `Brûlure de mana : paie en PV (1 ${attacker.deRecuperation ?? "DR"} par PM, sans RD, KO possible) — jamais pour les soins`}>
                <input type="radio" checked={modeLancement === "brulure"} disabled={!burnPossible} onChange={() => setModeLancement("brulure")} />
                <span>Brûlure de mana ({coutEff}{attacker.deRecuperation ?? "?"} de PV)</span>
              </label>
              {modeLancement === "brulure" && !burnPossible && raisonBrulure() && (
                <div className="text-xs text-amber-300/90">⚠ {raisonBrulure()}</div>
              )}
              {concPossible && (
                <label className="flex items-center gap-2" title="Sort (A) lancé en action limitée (L) : −2 PM. Le lanceur se prive de déplacement.">
                  <input type="checkbox" id="combat-concentration" name="concentration" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
                  <span>Concentration accrue (−2 PM → {Math.max(0, coutBase - 2)} PM, action L)</span>
                </label>
              )}
            </div>
          )}
          </>
        );
      })()}
      {attacker && attacker.attaques.length === 0 && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {attacker.nom} n&apos;a aucune attaque : équipez une arme ci-dessous (Équipement du sac) ou sur sa fiche, puis ↻ sur sa ligne.
        </div>
      )}
      {bloque && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {attacker?.nom} ne peut pas agir (Étourdi/Paralysé/Surpris) — retirez l&apos;effet ou passez son tour.
        </div>
      )}
      {proposeEquipe && (
        <div className="rounded border border-amber-700 bg-amber-950/40 p-2 text-sm space-y-1">
          <div className="text-xs uppercase text-amber-300 font-bold">🐺 Travail d&apos;équipe</div>
          <label className="flex items-center gap-2" title="Le loup est au contact du rôdeur (positions non suivies : à déclarer par le MJ). Le dé bonus du rôdeur aux tests de pistage et anti-surprise reste au MJ.">
            <input type="checkbox" id="combat-travail-equipe" name="travailEquipe" checked={equipeContact} onChange={(e) => setEquipeContact(e.target.checked)} />
            <span>Au contact de {propositionEquipe?.maitreNom} : dé bonus en attaque</span>
          </label>
        </div>
      )}
      {loupSansTalent && (
        <p className="text-xs text-zinc-500" title="Le dé bonus au contact vient de Travail d'équipe (R2 du Rôdeur, fiche Personnages). Le rôdeur garde son dé bonus de pistage/anti-surprise au MJ.">
          💡 Travail d&apos;équipe (R2) non connu : aucun dé bonus proposé. Le talent s&apos;apprend sur la fiche du rôdeur.
        </p>
      )}
      {loupSansMaitre && (
        <p className="text-xs text-red-400" title="Le loup n'est lié à aucun rôdeur du combat : retirez les participants et ré-ajoutez le PJ en préparation (ou ↻ Actualiser).">
          ⚠ Loup sans maître retrouvé : ré-ajoutez le rôdeur en préparation pour réparer le lien (Travail d&apos;équipe, Tactiques).
        </p>
      )}
      <label className="block text-sm">Cible{choixMultiples ? `s (${ciblesAffichees.length}${maxCibles != null ? `/${maxCibles}` : ""})` : ""}
        {!choixMultiples && cibleSel && <FamilleBadge famille={cibleSel.camp === "pj" ? familleDuProfil(cibleSel.profil) : null} className="ml-2" />}
        {choixMultiples ? (
          <div className="mt-1 space-y-1 max-h-40 overflow-auto rounded border border-zinc-800 p-2">
            {vivants.filter((p) => p.instanceId !== attackerId && getModifier(p.effets, "inciblable") <= 0 && !attaqueInterdite(attacker?.effets ?? [], p.instanceId)).map((p) => (
              <label key={p.instanceId} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  id={`combat-cible-${p.instanceId}`}
                  name={`cible-${p.instanceId}`}
                  type="checkbox"
                  checked={ciblesAffichees.includes(p.instanceId)}
                  disabled={!ciblesAffichees.includes(p.instanceId) && maxCibles != null && ciblesAffichees.length >= maxCibles}
                  onChange={() => basculerCible(p.instanceId)}
                />
                <span className="flex-1">{p.nom} <FamilleBadge famille={p.camp === "pj" ? familleDuProfil(p.profil) : null} /> — Déf {p.defense + getModifier(p.effets, "defense")} — {p.pv}/{p.pvMax} PV</span>
                {attacker && p.camp !== attacker.camp && <span className="text-xs text-red-400">ennemi</span>}
              </label>
            ))}
            <p className="text-xs text-zinc-500">Ennemis pré-cochés{estZoneTop ? " (alliés dans la zone : cochez-les, ex. Explosion de feu)" : ""}.</p>
          </div>
        ) : (
          <select id="combat-cible" name="cible" value={targetId ?? ""} onChange={(e) => onTarget(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            {vivants.filter((p) => p.instanceId !== attackerId && getModifier(p.effets, "inciblable") <= 0 && !attaqueInterdite(attacker?.effets ?? [], p.instanceId)).map((p) => (
              <option key={p.instanceId} value={p.instanceId}>{p.nom} — Déf {p.defense + getModifier(p.effets, "defense")} — {p.pv}/{p.pvMax} PV</option>
            ))}
          </select>
        )}
      </label>
      {vivants.some((p) => p.instanceId !== attackerId && getModifier(p.effets, "inciblable") > 0) && (
        <p className="text-xs text-zinc-500">Enseveli : inciblable, masqué des cibles (MJ).</p>
      )}
      {attacker && vivants.some((p) => attaqueInterdite(attacker.effets, p.instanceId)) && (
        <p className="text-xs text-amber-300/90" title="Effroi : test de SAG raté. Impossible d'attaquer la source de l'aura tant que l'effet dure.">
          😱 Effroi : cible protégée retirée de la liste ({vivants.filter((p) => attaqueInterdite(attacker.effets, p.instanceId)).map((p) => p.nom).join(", ")}).
        </p>
      )}
      {(connaitPuissante || connaitParfaite || connaitMille || connaitFleche || connaitEclair || proposeDouble || proposeCirculaire) && (
        <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
          <div className="text-xs uppercase text-zinc-500 font-bold">Coup spécial</div>
          {connaitPuissante && (
            <label className="flex items-center gap-2">
              <input type="checkbox" id="combat-puissante" name="puissante" checked={puissante} onChange={(e) => setPuissante(e.target.checked)} />
              <span>Puissante (dé malus, +{variante === "L" ? "3d4°" : "2d4°"})</span>
              <select value={variante} onChange={(e) => setVariante(e.target.value as "A" | "L")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="A">A</option>
                <option value="L">L</option>
              </select>
            </label>
          )}
          {connaitParfaite && (
            <label className="flex items-center gap-2" title="Arme de prédilection requise (MJ)">
              <input type="checkbox" id="combat-parfaite" name="parfaite" checked={parfaite} onChange={(e) => setParfaite(e.target.checked)} />
              <span>Parfaite (dé bonus, +1d4°)</span>
            </label>
          )}
          {connaitMille && (
            <label className="flex items-center gap-2">
              <input type="checkbox" id="combat-dans-le-mille" name="dansLeMille" checked={mille} onChange={(e) => setMille(e.target.checked)} />
              <span>Dans le mille (dé malus, +{varianteMille === "L" ? "3d4°" : "2d4°"})</span>
              <select value={varianteMille} onChange={(e) => setVarianteMille(e.target.value as "A" | "L")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="A">A</option>
                <option value="L">L</option>
              </select>
            </label>
          )}
          {connaitFleche && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2" title="NC inférieur au vôtre, 1/combat par état (MJ)">
                <input type="checkbox" id="combat-fleche-de-mort" name="flecheDeMort" checked={fleche} onChange={(e) => setFleche(e.target.checked)} />
                <span>Flèche de mort (dé bonus)</span>
              </label>
              <select value={modeFleche} onChange={(e) => setModeFleche(e.target.value as "dm" | "statut")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="dm">+1d4°</option>
                <option value="statut">état 1 round</option>
              </select>
              {modeFleche === "statut" && (
                <select value={statutFleche} onChange={(e) => setStatutFleche(e.target.value)} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                  {STATUTS_FLECHE.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
                </select>
              )}
            </div>
          )}
          {connaitEclair && (
            <label className="flex items-center gap-2" title="Bonus et DM à l'AGI au lieu de la FOR (+10 m au rang 5, MJ)">
              <input type="checkbox" id="combat-attaque-eclair" name="attaqueEclair" checked={eclair} onChange={(e) => setEclair(e.target.checked)} />
              <span>Attaque éclair (AGI)</span>
            </label>
          )}
          {proposeDouble && (
            <label className="flex items-center gap-2" title="Action limitée (L) : deux attaques au contact à −2 chacune, même cible — 2 résolutions successives (voie du combat R4)">
              <input
                id="combat-double-attaque"
                name="doubleAttaque"
                type="checkbox"
                checked={double}
                onChange={(e) => { setDouble(e.target.checked); if (e.target.checked) setCirculaire(false); }}
              />
              <span>Double attaque (L) : 2 attaques à −2</span>
            </label>
          )}
          {proposeCirculaire && (
            <label className="flex items-center gap-2" title="Action limitée (L) : une attaque à −2 par adversaire au contact — tous les ennemis pré-cochés, décochez au besoin (voie du combat R5)">
              <input
                id="combat-attaque-circulaire"
                name="attaqueCirculaire"
                type="checkbox"
                checked={circulaire}
                onChange={(e) => { setCirculaire(e.target.checked); if (e.target.checked) { setDouble(false); } }}
              />
              <span>Circulaire (L) : 1 attaque à −2 par ennemi au contact</span>
            </label>
          )}
        </div>
      )}
      <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
        <div className="text-xs uppercase text-zinc-500 font-bold">Option tactique{estMagiqueTop ? " — attaques indisponibles (magie)" : ""}</div>
        {( [["normale", "⚔️ Normale", "Attaque normale"], ["assuree", "🎯 Assurée (+5 en attaque, DM/2)", "Armes au contact ou à distance — jamais sur attaque magique"], ["precise", "🏹 Précise (−3 en attaque, +1d4° DM)", "Armes au contact ou à distance — jamais sur attaque magique"], ["violente", "💥 Violente (−7 en attaque, +2d4° DM)", "Armes au contact ou à distance — jamais sur attaque magique"], ["defense-partielle", "🛡️ Défense partielle (A, +3 DEF)", "Self-buff 1 round, sans jet : +3 DEF (générale)"], ["defense-totale", "🏰 Défense totale (L, +5 DEF)", "Self-buff 1 round, sans jet : +5 DEF (générale)"], ["riposte", "↩️ Riposte (L ou A, posture)", "Self-buff 1 round, sans jet : riposte immédiate si attaqué au contact (MJ)"], ["soutenir", "🤝 Soutenir un allié (L, +5)", "La cible (allié actif) gagne +5 en attaque au contact, sans jet"]] as const ).map(([v, label, aide]) => {
          const estAttaque = v === "assuree" || v === "precise" || v === "violente";
          const indisponible = estMagiqueTop && estAttaque;
          const valeur = estAttaque && estMagiqueTop ? "normale" : tactique;
          const optionAttaque =
            v === "normale" || v === "assuree" || v === "precise" || v === "violente" ? v : null;
          const chance = optionAttaque && !indisponible ? chanceToucher(optionAttaque) : null;
          return (
            <label key={v} className={`flex items-center gap-2 ${indisponible ? "opacity-40" : ""}`} title={v === "normale" ? "Attaque normale" : aide}>
              <input type="radio" id={`tactique-${v}`} name="option-tactique" checked={valeur === v} disabled={indisponible} onChange={() => setTactique(v)} />
              <span className="flex-1">
                {label}
                {chance != null && (
                  <span
                    className={`ml-1.5 font-mono font-bold ${tonChance(chance)}`}
                    title={`${pourcent(chance)} de toucher ${cibleSel?.nom ?? "la cible"} avec cette option (DEF et effets compris)`}
                  >
                    {pourcent(chance)}
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {chanceAffichee && (
          <p className="text-[11px] text-zinc-500">
            Chance de toucher : d20 + bonus ≥ DEF de la cible. 1 naturel = échec, 20 = touche
            (19-20 avec Science du critique).
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Mod. attaque<input id="combat-mod-attaque" name="modAttaque" value={mod} onChange={(e) => setMod(e.target.value)} placeholder="+1 / −2" title="Mod. manuel résiduel : prédilection +1 et Spécialisation +N DM sont automatiques, Double/Circulaire ont leur case" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
        <label className="block text-xs">Bonus DM<input id="combat-bonus-dm" name="bonusDm" value={dm} onChange={(e) => setDm(e.target.value)} placeholder="+1" title="Spécialisation +1…" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
      </div>
      <button
        onClick={() => lancer()}
        disabled={(() => {
          if (!attackerId || bloque) return true;
          const eff = (tactique === "assuree" || tactique === "precise" || tactique === "violente") && estMagiqueTop ? "normale" : tactique;
          if (eff === "defense-partielle" || eff === "defense-totale" || eff === "riposte") return false;
          if (eff === "soutenir") {
            const cible = participants.find((p) => p.instanceId === targetId);
            return !cible || cible.instanceId === attackerId || cible.camp !== attacker?.camp || cible.statut !== "actif";
          }
          if (choixMultiples) return ciblesAffichees.length === 0;
          return !targetId;
        })()}
        title={(() => {
          const eff = (tactique === "assuree" || tactique === "precise" || tactique === "violente") && estMagiqueTop ? "normale" : tactique;
          if (eff === "soutenir") return "Soutenir exige un allié actif ciblé (pas soi-même)";
          return undefined;
        })()}
        className="w-full py-2.5 rounded bg-red-600 hover:bg-red-500 font-bold disabled:opacity-40"
      >
        {(() => {
          const eff = (tactique === "assuree" || tactique === "precise" || tactique === "violente") && estMagiqueTop ? "normale" : tactique;
          if (choixMultiples && (eff === "normale" || eff === "assuree" || eff === "precise" || eff === "violente")) {
            return `⚔️ Lancer sur ${ciblesAffichees.length} cible${ciblesAffichees.length > 1 ? "s" : ""}`;
          }
          if (eff === "defense-partielle") return "🛡️ Défense partielle (+3 DEF)";
          if (eff === "defense-totale") return "🏰 Défense totale (+5 DEF)";
          if (eff === "riposte") return "↩️ Se mettre en riposte";
          if (eff === "soutenir") {
            const cible = participants.find((p) => p.instanceId === targetId);
            return cible ? `🤝 Soutenir ${cible.nom} (+5)` : "🤝 Soutenir un allié";
          }
          const chance = chanceToucher(eff);
          return chance == null ? "⚔️ Lancer l'attaque" : `⚔️ Lancer l'attaque — ${pourcent(chance)}`;
        })()}
      </button>
      {last && (
        <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-0.5">
          <div className="font-semibold">{last.attaquantNom} → {last.cibleNom} ({last.attaqueNom})</div>
          {last.toucheAuto ? (
            <div className="font-mono">Automatique (sans jet)</div>
          ) : (
            <div className="font-mono">
              Jet : {last.jetNaturel}{last.jetSecondaire != null ? ` (dé ${last.desAvantage} : ${last.jetNaturel}, ${last.jetSecondaire})` : ""} + {last.jetTotal - last.jetNaturel} = {last.jetTotal}
            </div>
          )}
          <div>Défense : {last.defenseCible}</div>
          <div className={`font-bold ${last.touche ? "text-green-400" : "text-red-400"}`}>
            → {last.touche ? (last.critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ"}
          </div>
          {!last.touche && (() => {
            const lanceur = participants.find((p) => p.instanceId === last.attaquantId);
            const pc = lanceur?.ressources["chance"]?.actuel ?? 0;
            return (
              <button
                onClick={onChance}
                disabled={pc < 1 || bloque}
                title={pc < 1 ? "Plus de point de chance" : "Dépenser 1 PC : +10 au jet, même sur un 1 naturel"}
                className="w-full mt-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40"
              >
                🍀 Chance +10 ({pc} PC)
              </button>
            );
          })()}
          {last.touche && (
            <>
              <div>Dégâts : [{last.degatsDetails.join(", ")}] = {last.degatsTotal}</div>
              <div className="font-mono">{last.cibleNom} : {last.pvAvant} → {last.pvApres} PV</div>
              {last.cibleTombe && <div className="text-red-400 font-bold">{last.cibleNom} est hors combat</div>}
            </>
          )}
        </div>
      )}
      {attenteMj && (
        <PopupValidationMJ
          titre={`Attaque — ${attacker?.nom ?? ""}`}
          questions={attenteMj}
          onValider={() => {
            setAttenteMj(null);
            lancer(true);
          }}
          onAnnuler={() => setAttenteMj(null)}
        />
      )}
    </div>
  );
}
