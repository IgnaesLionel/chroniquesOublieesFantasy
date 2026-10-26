"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { avecSousCategoriesGraines } from "@/src/lib/data/seeds";
import { useCharacters, useMonsters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { localStorageAdapter } from "@/src/lib/store/repository";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import type { Character, MonsterTemplate } from "@/src/lib/rules/types";
import type { AttackResolution, AttaqueGratuite, CombatParticipant, CombatState, TypeAttaqueGratuite } from "@/src/lib/rules/combat/types";
import { DEFAULT_COMBAT_OPTIONS, LABEL_ATTAQUE_GRATUITE } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives, addParticipantEffect, removeParticipantEffect } from "@/src/lib/rules/combat/initiative";
import { appliquerAurasDebutCombat } from "@/src/lib/rules/combat/auras";
import { AURAS_DEBUT_COMBAT } from "@/src/lib/data/auras-combat";
import { applyDamage, applyHeal, appliquerResultatsCombat, attaqueGratuiteDisponible, castSoutien, depenserChanceApresCoup, ecarterAttaqueGratuite, frapperCibles, frapperZone, marquerAttaqueGratuiteLancee, protegerAllie, renvoyerSort, resolveAttack, resoudrePhenixEnAttente, resynchroniserDepuisFiche, signalerAttaqueGratuite, tenterSortieEnseveli, animerCadavre, animerCadavreProfil, transfererVieAuLoup, utiliserCapacite, type AttaqueOpts, type PaiementSort } from "@/src/lib/rules/combat/attack";
import { construirePJCombat, rafraichirStaging, recibrerCible } from "@/src/lib/rules/combat/staging";
import { monsterInstances, participantFromCharacter, renommerDoublonsMonstres } from "@/src/lib/rules/combat/factory";
import {
  chargesRestantesObjet,
  lireParchemin,
  natureObjetCombat,
  soinPotion,
} from "@/src/lib/rules/combat/objets";
import { maxZombiesControles, normaliserNomCapacite, normaliserPersonnage } from "@/src/lib/rules/personnage";
import { createEffect } from "@/src/lib/rules/effects/effects";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { CombatTable } from "@/src/components/combat/CombatTable";
import { EquipementPanel } from "@/src/components/combat/EquipementPanel";
import { CombatLog } from "@/src/components/combat/CombatLog";
import { EffectsPanel } from "@/src/components/combat/EffectsPanel";
import { ActionPanel } from "@/src/components/combat/ActionPanel";
import { ActionEconomie } from "@/src/components/combat/ActionEconomie";
import { PopupPhenix } from "@/src/components/combat/PopupPhenix";
import { EncounterGenerator } from "@/src/components/encounters/EncounterGenerator";
import { stagingDepuisRencontre } from "@/src/lib/rules/combat/depuis-rencontre";
import type { SlotResolu } from "@/src/lib/encounters/types";
import { familleDuProfil, classeFamille } from "@/src/lib/ui/famille";
import { FamilleBadge, FamillePastille } from "@/src/components/ui/Famille";

export default function CombatPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement du combat.</p>}>
      <CombatInner />
    </Suspense>
  );
}

function CombatInner() {
  const searchParams = useSearchParams();
  const { items: characters, setItems: setCharacters } = useCharacters("combat");
  const { items: monsters } = useMonsters();
  // Même migration douce que le bestiaire : les monstres ajoutés au combat
  // portent leurs sous-catégories même si la sauvegarde locale est ancienne.
  // Panneau « Monstres » trié par NC croissant (puis nom) : retrouver un profil
  // de puissance d'un coup d'œil quand le bestiaire grossit. Copie avant tri —
  // avecSousCategoriesGraines peut renvoyer le tableau du store tel quel.
  const monstres = useMemo(
    () =>
      [...avecSousCategoriesGraines(monsters)].sort(
        (a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, "fr")
      ),
    [monsters]
  );
  // Regroupement par NC pour les volets : l'ordre du tri (NC puis nom) est
  // conservé à l'intérieur de chaque volet.
  const monstresParNc = useMemo(() => {
    const groupes = new Map<number, MonsterTemplate[]>();
    for (const m of monstres) {
      const g = groupes.get(m.niveau);
      if (g) g.push(m);
      else groupes.set(m.niveau, [m]);
    }
    return Array.from(groupes.entries()).sort((a, b) => a[0] - b[0]);
  }, [monstres]);
  const { catalogue } = useCatalogueObjets();

  const [staging, setStaging] = useState<CombatParticipant[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Volets du panneau Monstres (groupés par NC) : tous repliés par défaut =
  // menu lisible d'un coup d'œil, on ouvre le seul NC dont on a besoin.
  const [ncOuverts, setNcOuverts] = useState<Record<string, boolean>>({});
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [attackId, setAttackId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [last, setLast] = useState<AttackResolution | null>(null);
  const [lastAttaque, setLastAttaque] = useState<{ attackerId: string; targetId: string; attackId: string } | null>(null);
  const [termineMessage, setTermineMessage] = useState<string | null>(null);
  // État préjudiciable posé avant l'initiative (ex : surpris, aveuglé).
  const [etatCible, setEtatCible] = useState<string | null>(null);
  const [etatCle, setEtatCle] = useState("surpris");
  const [etatDuree, setEtatDuree] = useState("");
  // Préparation : générateur de rencontres ou composition manuelle. Le
  // générateur reste monté (masqué) pour ne pas perdre la rencontre affichée
  // quand le MJ bascule sur la composition manuelle.
  // Liens entrants : « ?vue=composition » ouvre la préparation manuelle
  // (bouton Combat de Partie, « + Combat » du Bestiaire, tuile Campagne).
  // Les autres entrées tombent sur le générateur, cœur de l'onglet fusionné.
  const [vuePrep, setVuePrep] = useState<"rencontres" | "manuel">(() =>
    searchParams.get("vue") === "composition" ? "manuel" : "rencontres"
  );
  const [infoConversion, setInfoConversion] = useState<string | null>(null);

  const active = combat ? getActive(combat) : null;
  /** Onde de Phénix en attente : une pop-up par prêtre déclencheur. */
  const phenixEnAttente = combat?.phenixEnAttente?.[0] ?? null;

  const pjNeufs = (c: Character): CombatParticipant[] => construirePJCombat(c, catalogue);
  /** Reconstruit les PJ depuis leurs fiches (staging et demarrage). */
  const stagingAJour = (liste: CombatParticipant[]): CombatParticipant[] =>
    rafraichirStaging(liste, characters, catalogue);
  const addPJ = (c: Character) => {
    setStaging((s) => [...s.filter((p) => p.templateId !== c.id && p.templateId !== `compagnon:loup:${c.id}`), ...pjNeufs(c)]);
  };
  /** Fiches pas encore dans la rencontre (loup compagnon compris dans le test via le PJ maître). */
  const pjManquants = characters.filter((c) => !staging.some((p) => p.templateId === c.id));
  /** Tout le groupe en un clic : ajoute les PJ manquants, sans écraser ceux déjà posés. */
  const addTousLesPJ = () =>
    setStaging((s) => [
      ...s,
      ...characters.filter((c) => !s.some((p) => p.templateId === c.id)).flatMap((c) => pjNeufs(c)),
    ]);
  const addMonsters = (m: MonsterTemplate) => {
    const n = Math.max(1, Math.min(12, quantities[m.id] ?? 1));
    // Renumérote sur tout le groupe : 3 ajouts ×1 du même type -> "#1..#3" (pas 3 homonymes).
    setStaging((s) => renommerDoublonsMonstres([...s, ...monsterInstances(m, n)]));
  };
  const removeStaging = (instanceId: string) =>
    setStaging((s) =>
      renommerDoublonsMonstres(s.filter((x) => x.instanceId !== instanceId && x.instanceId !== `compagnon-${instanceId}`))
    );

  /**
   * Rencontre générée -> préparation de combat. Le camp ennemi est remplacé
   * (pas empilé : régénérer puis reconvertir ne doit pas doubler les monstres),
   * les PJ déjà posés et leurs états initiaux sont conservés. On bascule sur la
   * composition manuelle pour que le MJ vérifie puis lance les initiatives.
   */
  const convertirEnCombat = (slots: SlotResolu[]) => {
    const total = slots.reduce((n, s) => n + Math.max(1, Math.floor(s.quantite)), 0);
    const pj = staging.filter((p) => p.camp === "pj").length;
    setStaging((s) => stagingDepuisRencontre(s, slots));
    setVuePrep("manuel");
    setInfoConversion(
      `Rencontre convertie : ${total} créature(s).${
        pj > 0
          ? ` ${pj} PJ conservé(s) dans la préparation.`
          : " Ajoutez vos PJ (panneau Personnages) avant de lancer les initiatives."
      }`
    );
  };

  const resyncStaging = () => setStaging((s) => stagingAJour(s));
  /** Pose un état pré-combat (conservé au resync et au lancement). */
  const appliquerEtatStaging = () => {
    const cible = staging.find((p) => p.instanceId === etatCible) ?? staging[0];
    if (!cible) return;
    const tpl = EFFECT_CATALOG.find((t) => t.key === etatCle);
    const duree = etatDuree.trim() === "" ? (tpl?.dureeDefaut ?? null) : Number(etatDuree);
    if (!Number.isFinite(duree as number) && duree !== null) return;
    if (typeof duree === "number" && duree < 1) return;
    const effet = createEffect(etatCle, { dureeTours: duree, source: "Pré-combat" });
    setStaging((s) => s.map((p) => (p.instanceId === cible.instanceId ? { ...p, effets: [...p.effets, effet] } : p)));
  };
  const retirerEtatStaging = (instanceId: string, effetId: string) =>
    setStaging((s) =>
      s.map((p) => (p.instanceId === instanceId ? { ...p, effets: p.effets.filter((e) => e.id !== effetId) } : p))
    );
  const start = () => {
    if (staging.length < 2) return;
    const frais = stagingAJour(staging);
    setStaging(frais);
    setInfoConversion(null);
    // Auras de début de combat (ex. Effroi) : test avant tout tour, quel que
    // soit l'ordre d'initiative (donc même si le monstre n'agit pas en premier).
    const rolled = appliquerAurasDebutCombat(rollInitiatives(createCombat(frais)));
    setCombat(rolled);
    const premier = rolled.participants[rolled.tourIndex]?.instanceId ?? null;
    setAttackerId(premier);
    setTargetId(recibrerCible(rolled, premier, null));
    setAttackId(null);
    setLast(null);
    setTermineMessage(null);
  };

  /**
   * Terminer : écrit les résultats vers les fiches (PV + mana/chance actuels,
   * plafonnés aux max) puis retour à la préparation. Le groupe (staging) est
   * conservé pour enchaîner ; "Annuler rencontre" vide sans écrire.
   * L'écriture est synchrone (useLocalCollection persiste aussitôt) : les
   * fiches restent à jour même en changeant de page immédiatement après.
   */
  const terminer = () => {
    if (!combat) return;
    const pvAvant = new Map(characters.map((c) => [c.id, c.pv]));
    const manaAvant = new Map(
      characters.map((c) => [c.id, c.ressources?.mana?.actuel ?? null])
    );
    const chanceAvant = new Map(
      characters.map((c) => [c.id, c.ressources?.chance?.actuel ?? null])
    );
    const next = appliquerResultatsCombat(characters, combat.participants);
    const loupDe = (ficheId: string) => {
      const maitre = combat!.participants.find((x) => x.camp === "pj" && x.templateId === ficheId);
      return combat!.participants.find(
        (x) =>
          x.templateId === `compagnon:loup:${ficheId}` ||
          (maitre != null && x.compagnonDe === maitre.instanceId)
      );
    };
    const nomsDoublons = new Set(
      next.filter((c, i) => next.findIndex((x) => x.nom === c.nom) !== i).map((c) => c.nom)
    );
    const lignes = next
      .filter((c) => combat.participants.some((x) => x.camp === "pj" && x.templateId === c.id))
      .map((c) => {
        const morceaux = [`${c.nom} : ${pvAvant.get(c.id) ?? "?"} → ${c.pv} PV`];
        const manaA = manaAvant.get(c.id);
        const manaN = c.ressources?.mana?.actuel;
        if (manaA != null && manaN != null && manaA !== manaN) morceaux.push(`mana ${manaA} → ${manaN}`);
        const chanceA = chanceAvant.get(c.id);
        const chanceN = c.ressources?.chance?.actuel;
        if (chanceA != null && chanceN != null && chanceA !== chanceN) morceaux.push(`chance ${chanceA} → ${chanceN}`);
        if (nomsDoublons.has(c.nom)) morceaux.push("⚠ nom en double : vérifiez chaque carte");
        const loup = loupDe(c.id);
        if (loup) {
          const avant = characters.find((x) => x.id === c.id)?.compagnon?.pv;
          morceaux.push(`🐺 ${loup.nom} : ${avant ?? "?"} → ${loup.pv} PV (persistés)`);
        }
        return morceaux.join(", ");
      });
    setCharacters(next);
    // Persistance immédiate dans le gestionnaire (avant tout démontage) :
    // setState seul ne survivrait pas à une navigation instantanée vers
    // Personnages, le hook refaisant la même écriture de son côté.
    // L'échec d'écriture est signalé (au lieu d'être silencieux) : sans lui,
    // la page Personnages recharge l'ancien stock et semble "ne pas suivre".
    let ecritureOk = true;
    try {
      localStorageAdapter.save(STORAGE_KEYS.characters, next);
    } catch {
      ecritureOk = false;
    }
    // Vérification par relecture aussitôt l'écriture faite : si le stockage
    // ne contient pas exactement ce qui vient d'être écrit, c'est qu'une autre
    // écriture l'a écrasé dans la foulée (ou que le stockage est illisible) —
    // l'écart est alors affiché au lieu d'être subi en silence plus loin.
    let verification = "";
    try {
      const relu = localStorageAdapter.load<Character[]>(STORAGE_KEYS.characters);
      if (!relu) {
        verification = " — ⚠ RELECTURE : stockage vide ou illisible juste après l'écriture";
      } else {
        const pjs = next.filter((c) =>
          combat.participants.some((x) => x.camp === "pj" && x.templateId === c.id)
        );
        const ecarts = pjs
          .map((c) => {
            const r = relu.find((x) => x.id === c.id);
            if (r && r.pv !== c.pv) return `${c.nom} : écrit ${c.pv}, relu ${r.pv}`;
            return null;
          })
          .filter((x): x is string => x != null);
        verification =
          ecarts.length > 0
            ? ` — ⚠ RELECTURE CONTRADICTOIRE (${ecarts.join(" ; ")}) — signalez ceci au dev`
            : ` — ✅ relecture OK (${location.host})`;
      }
    } catch {
      verification = " — ⚠ RELECTURE impossible (exception)";
    }
    setCombat(null);
    setLast(null);
    setLastAttaque(null);
    setTermineMessage(
      lignes.length > 0
        ? `Résultats appliqués aux fiches — ${lignes.join(" · ")}${ecritureOk ? verification : " — ⚠ écriture locale IMPOSSIBLE (stockage navigateur indisponible ou plein) : les fiches n'ont pas été persistées."}`
        : "Aucun PJ lié à une fiche — rien écrit."
    );
  };

  const rollAttack = (opts?: AttaqueOpts, paiement?: PaiementSort) => {
    if (!combat || !attackerId || !targetId) return;
    const atk = combat.participants.find((p) => p.instanceId === attackerId);
    const aid = attackId ?? atk?.attaques[0]?.id;
    if (!atk || !aid) return;
    const cbl = combat.participants.find((p) => p.instanceId === targetId);
    if (!cbl || cbl.statut !== "actif") {
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: "Cible invalide ou hors combat — re-sélectionnez la cible." }] } : c
      );
      return;
    }
    try {
      // Coûts (mana + PV) et limites vérifiés dans le moteur.
      const { state, resolution } = resolveAttack(combat, attackerId, targetId, aid, Math.random, DEFAULT_COMBAT_OPTIONS, opts, paiement);
      setCombat(state);
      setLast(resolution);
      setLastAttaque({ attackerId, targetId, attackId: aid });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  const rollMulti = (lanceurId: string, sortId: string, cibleIds: string[], opts?: AttaqueOpts, paiement?: PaiementSort) => {
    if (!combat) return;
    const atk = combat.participants.find((p) => p.instanceId === lanceurId);
    const sort = atk?.sorts.find((x) => `sort:${x.id}` === sortId);
    if (!atk || !sort) return;
    try {
      if (sort.zone) {
        const { state } = frapperZone(combat, lanceurId, sort, Math.random, paiement, cibleIds);
        setCombat(state);
        setLast(null);
      } else {
        const { state, resolutions } = frapperCibles(combat, lanceurId, sort, sortId, cibleIds, Math.random, DEFAULT_COMBAT_OPTIONS, opts, paiement);
        setCombat(state);
        const lastRes = resolutions[resolutions.length - 1];
        if (lastRes) {
          setLast(lastRes);
          setLastAttaque({ attackerId: lanceurId, targetId: lastRes.cibleId, attackId: sortId });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  /** Attaque gratuite (G, hors tour) — Riposte au raté adverse, Piqûre de
   * rappel (tiers attaqué), Teigneux (fuyard, signal posé par le MJ),
   * Enchaînement (adversaire réduit à 0 PV). Même moteur qu'une attaque
   * normale : resolveAttack (coûts, limites, effets) ; le signal est consommé
   * en amont (quota 1/round du type, Enchaînement cascade). Cible : le
   * fauteur du signal, sinon premier ennemi actif ; l'attaque tirée est la
   * première du participant (MJ : lancer à la main sinon). */
  const lancerAttaqueGratuite = (id: string, g: AttaqueGratuite) => {
    if (!combat) return;
    const atk = combat.participants.find((p) => p.instanceId === id);
    if (!atk) return;
    if (!attaqueGratuiteDisponible(atk, g.type, combat.manche)) {
      const raison = g.type === "teigneux" ? " (1/round ; Rempart : AGI+2, vérifier en fiche)" : " (1/round)";
      setCombat((c) =>
        c
          ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: `Attaque gratuite (${LABEL_ATTAQUE_GRATUITE[g.type]}) : déjà utilisée cette manche${raison}.` }] }
          : c
      );
      return;
    }
    const fauteur = g.de ? combat.participants.find((p) => p.instanceId === g.de) : undefined;
    const cble = fauteur?.statut === "actif" ? fauteur : combat.participants.find((p) => p.camp !== atk.camp && p.statut === "actif");
    if (!cble) {
      setCombat((c) =>
        c
          ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: "Attaque gratuite : aucune cible active." }] }
          : c
      );
      return;
    }
    const aid = atk.attaques[0]?.id;
    if (!aid) return;
    try {
      // Signal consommé avant la résolution ; en-tête journalisé en premier.
      const prepare = marquerAttaqueGratuiteLancee(
        {
          ...combat,
          log: [
            ...combat.log,
            { id: `g-${Date.now()}`, at: new Date().toISOString(), manche: combat.manche, message: `⚔ Attaque gratuite (${LABEL_ATTAQUE_GRATUITE[g.type]}) : ${atk.nom} frappe ${cble.nom} (G, hors tour${g.de ? "" : ", cible au MJ"})` },
          ],
        },
        id,
        g
      );
      const { state, resolution } = resolveAttack(prepare, id, cble.instanceId, aid, Math.random, DEFAULT_COMBAT_OPTIONS);
      setCombat(state);
      setLast(resolution);
      setLastAttaque({ attackerId: id, targetId: cble.instanceId, attackId: aid });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque gratuite impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  /** Écarte un signal d'attaque gratuite (lancement MJ à la main). */
  const ecarterGratuite = (id: string, g: AttaqueGratuite) => setCombat((c) => (c ? ecarterAttaqueGratuite(c, id, g) : c));
  /** Pose un signal Teigneux (G) : le MJ choisit le fuyard au moment du lancement. */
  const poserGratuite = (id: string, type: TypeAttaqueGratuite) => setCombat((c) => (c ? signalerAttaqueGratuite(c, id, type) : c));

  /** Attaque double (voie du combat R4, L, arme au contact) : deux résolutions
   * successives à −2 contre la même cible (−2 déjà dans opts, posé par le
   * panneau). Le second lancer saute si la cible est déjà tombée (règle MJ). */
  const rollDouble = (opts?: AttaqueOpts) => {
    if (!combat || !attackerId || !targetId) return;
    const atk = combat.participants.find((p) => p.instanceId === attackerId);
    const aid = attackId ?? atk?.attaques[0]?.id;
    const cbl = combat.participants.find((p) => p.instanceId === targetId);
    if (!atk || !aid || !cbl || cbl.statut !== "actif") {
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: "Cible invalide ou hors combat — re-sélectionnez la cible." }] } : c
      );
      return;
    }
    try {
      const optsEff: AttaqueOpts = { ...opts, modAttaque: (opts?.modAttaque ?? 0) - 2 };
      const s0: CombatState = {
        ...combat,
        log: [...combat.log, { id: `dbl-${Date.now()}`, at: new Date().toISOString(), manche: combat.manche, message: `⚔ Attaque double (L) : 2 lancers à −2 — ${atk.nom} → ${cbl.nom}` }],
      };
      const r1 = resolveAttack(s0, attackerId, targetId, aid, Math.random, DEFAULT_COMBAT_OPTIONS, optsEff);
      const cible1 = r1.state.participants.find((p) => p.instanceId === targetId);
      if (!cible1 || cible1.statut !== "actif") {
        setCombat(r1.state);
        setLast(r1.resolution);
        setLastAttaque({ attackerId, targetId, attackId: aid });
        return;
      }
      const r2 = resolveAttack(r1.state, attackerId, targetId, aid, Math.random, DEFAULT_COMBAT_OPTIONS, optsEff);
      setCombat(r2.state);
      setLast(r2.resolution);
      setLastAttaque({ attackerId, targetId, attackId: aid });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque double impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  /** Attaque circulaire (voie du combat R5, L) : une résolution à −2 par
   * ennemi pré-coché (contact validé par le MJ via la pop-up). Les cibles
   * tombées au fil des coups sont sautées ; le panneau pose le −2 dans opts. */
  const rollCirculaire = (lanceurId: string, cibleAttackId: string, cibleIds: string[], opts?: AttaqueOpts) => {
    if (!combat) return;
    const atk = combat.participants.find((p) => p.instanceId === lanceurId);
    const aid = cibleAttackId || atk?.attaques[0]?.id;
    if (!atk || !aid || cibleIds.length === 0) return;
    try {
      const optsEff: AttaqueOpts = { ...opts, modAttaque: (opts?.modAttaque ?? 0) - 2 };
      let s: CombatState = {
        ...combat,
        log: [...combat.log, { id: `cir-${Date.now()}`, at: new Date().toISOString(), manche: combat.manche, message: `⚔ Attaque circulaire (L) : 1 lancer à −2 par cible — ${atk.nom}` }],
      };
      let derniere: AttackResolution | null = null;
      for (const idCible of cibleIds) {
        const cible = s.participants.find((p) => p.instanceId === idCible);
        if (!cible || cible.statut !== "actif") continue;
        const r = resolveAttack(s, lanceurId, idCible, aid, Math.random, DEFAULT_COMBAT_OPTIONS, optsEff);
        s = r.state;
        derniere = r.resolution;
      }
      setCombat(s);
      if (derniere) {
        setLast(derniere);
        setLastAttaque({ attackerId: lanceurId, targetId: derniere.cibleId, attackId: aid });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque circulaire impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  const useChance = () => {
    if (!combat || !last || !lastAttaque) return;
    try {
      const { state, resolution } = depenserChanceApresCoup(combat, lastAttaque.attackerId, lastAttaque.targetId, lastAttaque.attackId, last);
      setCombat(state);
      setLast(resolution);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Chance impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  const syncIds = useMemo(() => {
    if (!combat) return [] as string[];
    return combat.participants
      .filter((p) => characters.some((c) => c.id === p.templateId))
      .map((p) => p.instanceId);
  }, [combat, characters]);

  /** Applique une fiche à son participant (bouton ↻) : même fusion que la resync auto, PV/effets/état conservés. */
  const appliquerFiche = (instanceId: string, cibleNom: string, fiche: Character) => {
    const frais = participantFromCharacter(normaliserPersonnage(fiche as unknown as Record<string, unknown>), catalogue);
    setCombat((c) => {
      if (!c) return c;
      const cible = c.participants.find((x) => x.instanceId === instanceId);
      if (!cible) return c;
      const r = resynchroniserDepuisFiche(cible, frais);
      const message = r.modifie
        ? `${cibleNom} resynchronisé depuis sa fiche (${r.participant.attaques.length} attaque(s)${r.nouvelles.length > 0 ? `, + ${r.nouvelles.join(", ")}` : ""}${r.manaInfo}).`
        : `${cibleNom} déjà à jour depuis sa fiche.`;
      return {
        ...c,
        participants: c.participants.map((x) => (x.instanceId === instanceId ? r.participant : x)),
        log: [...c.log, { id: `sync-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }],
      };
    });
    setAttackId(null);
  };

  /** Resync auto (sans clic) : toute fiche modifiée (sorts appris, niveau, mana max...) suit en combat ; PV, effets, usages et initiative intacts. Silencieux et pur (aucun log, aucun jet) : ne réécrit que si changement. En effet (pas pendant le rendu) : une mise à jour pendant le rendu serait jetée si le rendu est abandonné (rechargement à chaud, démontage), avec un état final incohérent. */
  const prevCharactersRef = useRef(characters);
  useEffect(() => {
    if (prevCharactersRef.current === characters) return;
    prevCharactersRef.current = characters;
    setCombat((c) => {
      if (!c || c.termine) return c;
      let modifie = false;
      const participants = c.participants.map((p) => {
        if (p.camp !== "pj") return p;
        const fiche = characters.find((x) => x.id === p.templateId);
        if (!fiche) return p;
        const frais = participantFromCharacter(normaliserPersonnage(fiche as unknown as Record<string, unknown>), catalogue);
        const r = resynchroniserDepuisFiche(p, frais);
        if (!r.modifie) return p;
        modifie = true;
        return r.participant;
      });
      return modifie ? { ...c, participants } : c;
    });
  }, [characters, catalogue]);

  /** Resynchronise un PJ depuis sa fiche (raccourci du bouton ↻). */
  const syncDepuisFiche = (instanceId: string) => {
    if (!combat) return;
    const cible = combat.participants.find((x) => x.instanceId === instanceId);
    const fiche = characters.find((x) => x.id === cible?.templateId);
    if (!cible || !fiche) {
      setCombat((x) => (x ? { ...x, log: [...x.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: x.manche, message: "Resynchronisation impossible : pas de fiche liée." }] } : x));
      return;
    }
    appliquerFiche(instanceId, cible.nom, fiche);
  };

  /** Équiper / déséquiper en combat (sortir du sac) : fiche + participant à jour aussitôt. */
  const toggleEquipe = (instanceId: string, itemId: string) => {
    const cible = combat?.participants.find((x) => x.instanceId === instanceId);
    const fiche = characters.find((x) => x.id === cible?.templateId);
    const entree = (fiche?.inventaire ?? []).find((x) => x.itemId === itemId);
    const item = catalogue.find((x) => x.id === itemId);
    if (!cible || !fiche || !entree || !item?.estArme) return;
    const updated: Character = { ...fiche, inventaire: (fiche.inventaire ?? []).map((x) => (x.itemId === itemId ? { ...x, equipe: !x.equipe } : x)) };
    setCharacters((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    appliquerFiche(instanceId, cible.nom, updated);
    setCombat((x) => (x ? { ...x, log: [...x.log, { id: `eq-${Date.now()}`, at: new Date().toISOString(), manche: x.manche, message: `${cible.nom} ${entree.equipe ? "rengaine" : "sort"} ${item.nom} (${entree.equipe ? "déséquipée" : "équipée"}).` }] } : x));
  };
  /**
   * Utilise une potion, un parchemin ou une baguette depuis l'inventaire.
   * Potion : soin automatique si son texte contient une formule de dés.
   * Parchemin : test de profil/rang/famille automatique ; consommé seulement si
   * le sort est lancé ou si l'échec atteint 10 points.
   * Baguette : action d'attaque, une charge est décrémentée par activation.
   */
  const utiliserObjet = (instanceId: string, itemId: string, cibleId: string) => {
    if (!combat) return;
    const acteur = combat.participants.find((p) => p.instanceId === instanceId);
    const fiche = characters.find((c) => c.id === acteur?.templateId);
    const entree = (fiche?.inventaire ?? []).find((e) => e.itemId === itemId);
    const item = catalogue.find((o) => o.id === itemId);
    const nature = item ? natureObjetCombat(item) : null;
    const cible = combat.participants.find((p) => p.instanceId === cibleId);
    if (!acteur || !fiche || !entree || entree.quantite <= 0 || !item || !nature || !cible) return;
    if (nature === "potion" ? cible.statut === "mort" : cible.statut !== "actif") return;

    const chargesAvant =
      nature === "baguette" ? chargesRestantesObjet(entree, item) : null;
    if (nature === "baguette" && chargesAvant === 0) return;

    let state = combat;
    let message = "";
    let consommer = nature === "potion";
    let chargesApres: number | null = null;
    if (nature === "potion") {
      const aSoiMeme = acteur.instanceId === cible.instanceId;
      message = `${acteur.nom} ${aSoiMeme ? "boit" : `fait boire à ${cible.nom}`} ${item.nom}`;
      const soin = soinPotion(item, fiche.niveau, fiche.caracteristiques ?? {});
      if (soin && soin.total > 0) {
        const pvAvant = cible.pv;
        state = applyHeal(state, cible.instanceId, soin.total);
        const pvApres = state.participants.find((p) => p.instanceId === cible.instanceId)?.pv ?? pvAvant;
        message += ` : ${soin.expression} -> [${soin.details.join(", ")}] = ${soin.total} PV (${pvAvant} -> ${pvApres} PV)`;
      } else {
        message += " (effet au MJ)";
      }
    } else if (nature === "parchemin") {
      const lecture = lireParchemin(item, {
        profil: (fiche.profil ?? "").trim() || fiche.classe,
        famille: fiche.famille,
        sorts: fiche.sorts ?? [],
        niveau: fiche.niveau,
        bonusMagique: acteur.bonusMagique,
        caracs: acteur.caracs ?? fiche.caracteristiques ?? {},
      });
      message = `${acteur.nom} lit ${item.nom} (action limitée). ${lecture.message}`;
      consommer = lecture.consomme;
    } else {
      chargesApres = chargesAvant != null ? Math.max(0, chargesAvant - 1) : null;
      message = `${acteur.nom} active ${item.nom} (action d'attaque)`;
      if (chargesAvant != null && chargesApres != null) {
        message += ` : ${chargesAvant} -> ${chargesApres} charge${chargesApres > 1 ? "s" : ""}`;
      } else {
        message += " (charges non suivies : à gérer par le MJ)";
      }
    }

    state = {
      ...state,
      log: [
        ...state.log,
        { id: `obj-${Date.now()}`, at: new Date().toISOString(), manche: state.manche, message },
      ],
    };
    setCombat(state);
    setLast(null);

    if (consommer) {
      const inventaire = fiche.inventaire
        .map((e) => (e.itemId === itemId ? { ...e, quantite: e.quantite - 1 } : e))
        .filter((e) => e.quantite > 0);
      setCharacters((prev) =>
        prev.map((c) => (c.id === fiche.id ? { ...c, inventaire } : c))
      );
    } else if (nature === "baguette" && chargesApres != null) {
      const chargesFinales: number = chargesApres;
      const inventaire = fiche.inventaire.map((e) =>
        e.itemId === itemId ? { ...e, charges: chargesFinales } : e
      );
      setCharacters((prev) =>
        prev.map((c) => (c.id === fiche.id ? { ...c, inventaire } : c))
      );
    }
  };

  const selectedParticipant = combat?.participants.find((p) => p.instanceId === attackerId) ?? null;

  const opponentsOf = useMemo(() => {
    if (!combat || !attackerId) return [];
    const atk = combat.participants.find((p) => p.instanceId === attackerId);
    return combat.participants.filter((p) => p.statut === "actif" && p.instanceId !== attackerId && p.camp !== atk?.camp);
  }, [combat, attackerId]);

  if (!combat) {
    const pjPoses = staging.filter((p) => p.camp === "pj").length;
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Combat — préparation</h1>
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800" role="tablist" aria-label="Préparation">
            <button
              role="tab"
              aria-selected={vuePrep === "rencontres"}
              onClick={() => setVuePrep("rencontres")}
              className={`px-3 py-1.5 rounded text-sm font-semibold ${
                vuePrep === "rencontres" ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              🧭 Rencontres
            </button>
            <button
              role="tab"
              aria-selected={vuePrep === "manuel"}
              onClick={() => setVuePrep("manuel")}
              className={`px-3 py-1.5 rounded text-sm font-semibold ${
                vuePrep === "manuel" ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              ⚔ Composition{staging.length > 0 ? ` (${staging.length})` : ""}
            </button>
          </div>
        </div>
        {infoConversion && (
          <div className="rounded-lg border border-sky-700 bg-sky-950/40 p-3 text-sm text-sky-200">
            {infoConversion}
            <button onClick={() => setInfoConversion(null)} className="ml-2 text-sky-400" aria-label="Masquer">
              ✕
            </button>
          </div>
        )}
        {termineMessage && (
          <div className="rounded-lg border border-green-700 bg-green-900/40 p-3 text-sm text-green-200">
            ✅ {termineMessage}
            <div className="text-xs text-green-300/70 mt-1">Vérifiez l&apos;onglet Personnages : les PV affichés sont à jour.</div>
          </div>
        )}
        {/* Le générateur reste monté : basculer sur la composition manuelle ne
            doit pas effacer la rencontre affichée (graine, variantes, verrous). */}
        <div className={vuePrep === "rencontres" ? "" : "hidden"}>
          <EncounterGenerator integre onConvertirEnCombat={convertirEnCombat} />
        </div>
        <div className={vuePrep === "manuel" ? "space-y-4" : "hidden"}>
        {staging.length > 0 && pjPoses === 0 && (
          <p className="text-sm text-amber-300/90">
            La rencontre ne contient que des adversaires : ajoutez au moins un PJ (panneau Personnages) pour lancer les initiatives.
          </p>
        )}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-bold text-sm uppercase text-zinc-400 mb-2">Rencontre ({staging.length})</h2>
          {staging.length === 0 && <p className="text-sm text-zinc-500">Ajoutez PJ + monstres. Ex : 4 PJ + Gobelin ×4. Un état initial (surpris, aveuglé…) se pose ci-dessous avant l&apos;initiative.</p>}
          <div className="flex flex-wrap gap-2">
            {staging.map((p) => {
              const nbSorts = p.attaques.filter((a) => a.id.startsWith("sort:")).length;
              return (
                <span key={p.instanceId} className="text-xs px-2 py-1 rounded bg-zinc-800" title={`${p.attaques.length} attaque(s) (${p.attaques.map((a) => a.nom).join(", ") || "aucune"}) dont ${nbSorts} sort(s)}`}>
                  {p.camp === "pj" && <FamillePastille famille={familleDuProfil(p.profil)} className="mr-1.5" />}
                  {p.templateId.startsWith("compagnon:loup") ? "🐺 " : ""}{p.nom} <span className="text-zinc-500">⚔{p.attaques.length}{nbSorts > 0 ? ` ✦${nbSorts}` : ""}</span>{p.bouclierBonus != null && <span className="text-sky-300" title={`Bouclier manié (+${p.bouclierBonus} DEF)`}> 🛡+{p.bouclierBonus}</span>} <button onClick={() => removeStaging(p.instanceId)} className="text-red-400 ml-1">✕</button>
                </span>
              );
            })}
          </div>
          {staging.some((p) => p.effets.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {staging.flatMap((p) =>
                p.effets.map((e) => (
                  <span key={e.id} className="text-xs px-2 py-1 rounded bg-red-950 border border-red-800 text-red-200" title={e.description}>
                    {p.nom} : {e.nom} ({e.toursRestants ?? "∞"})
                    <button onClick={() => retirerEtatStaging(p.instanceId, e.id)} className="ml-1.5 text-red-400">✕</button>
                  </span>
                ))
              )}
            </div>
          )}
          {staging.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <select id="combat-etat-cible" name="etatCible" value={staging.find((p) => p.instanceId === etatCible)?.instanceId ?? staging[0].instanceId} onChange={(e) => setEtatCible(e.target.value)} title="Participant subissant l'état initial" className="bg-zinc-800 rounded px-2 py-1.5 text-xs">
                {staging.map((p) => (
                  <option key={p.instanceId} value={p.instanceId}>{p.nom}</option>
                ))}
              </select>
              <select id="combat-etat-cle" name="etatCle" value={etatCle} onChange={(e) => setEtatCle(e.target.value)} title="État préjudiciable initial (avant l'initiative)" className="bg-zinc-800 rounded px-2 py-1.5 text-xs">
                {EFFECT_CATALOG.map((t) => (
                  <option key={t.key} value={t.key}>{t.nom} ({t.dureeDefaut ?? "∞"})</option>
                ))}
              </select>
              <input id="combat-etat-duree" name="etatDuree" value={etatDuree} onChange={(e) => setEtatDuree(e.target.value)} placeholder={EFFECT_CATALOG.find((t) => t.key === etatCle)?.dureeDefaut != null ? String(EFFECT_CATALOG.find((t) => t.key === etatCle)?.dureeDefaut) : "∞"} title="Durée en tours (vide = défaut)" className="w-14 bg-zinc-800 rounded px-2 py-1.5 text-xs text-center" />
              <button onClick={appliquerEtatStaging} className="px-3 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-xs font-semibold">
                + État initial
              </button>
            </div>
          )}
          {(() => {
            const cible = staging.find((p) => p.instanceId === etatCible) ?? staging[0];
            const aEquipe = !!cible && (cible.capacites ?? []).some((t) => normaliserNomCapacite(t) === normaliserNomCapacite("Travail d'équipe"));
            const loupPresent = !!cible && staging.some((p) =>
              (p.templateId.startsWith("compagnon:loup") || p.compagnonDe === cible.instanceId) && p.camp === cible.camp
            );
            if (etatCle !== "surpris" || !aEquipe || !loupPresent || !cible) return null;
            return (
              <p className="text-xs text-amber-300/90 mt-2">
                🐺 Travail d&apos;équipe : {cible.nom} a droit à un dé bonus au test pour éviter la surprise (vigilance, loup au contact — test manuel MJ).
              </p>
            );
          })()}
          {(() => {
            const actives = AURAS_DEBUT_COMBAT.filter((a) =>
              staging.some((p) =>
                (p.capacites ?? []).some((t) => normaliserNomCapacite(t) === normaliserNomCapacite(a.capacite))
              )
            );
            if (actives.length === 0) return null;
            return (
              <p className="text-xs text-amber-300/90 mt-2">
                🌀 Au lancement —{" "}
                {actives
                  .map(
                    (a) =>
                      `${a.capacite} : chaque adversaire fait un test de ${a.statNom} difficulté ${a.difficulte} (échec : ${a.effetNom}, ne peut pas attaquer l'utilisateur pendant ${a.dureeDe} tours).`
                  )
                  .join(" ")}
              </p>
            );
          })()}
          <div className="flex gap-2 mt-3">
            <button onClick={resyncStaging} title="Reconstruit chaque PJ depuis sa fiche (attaques, sorts, talents, loup)" className="px-4 py-2 rounded bg-zinc-800 text-sm">↻ Actualiser</button>
            <button onClick={() => setStaging([])} className="px-4 py-2 rounded bg-zinc-800 text-sm">Vider</button>
            <button onClick={start} disabled={staging.length < 2} className="flex-1 py-2.5 rounded bg-amber-400 text-black font-bold disabled:opacity-40">
              Lancer les initiatives ({staging.length})
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm uppercase text-zinc-400">Personnages</h2>
              <button
                onClick={addTousLesPJ}
                disabled={pjManquants.length === 0}
                title={pjManquants.length === 0 ? "Tous les personnages sont déjà dans la rencontre" : `Ajoute en un clic ${pjManquants.length} personnage(s) : ${pjManquants.map((c) => c.nom).join(", ")}`}
                className="px-3 py-1 rounded bg-blue-900 text-xs font-semibold hover:bg-blue-800 disabled:opacity-40 disabled:cursor-default"
              >
                + Tous ({characters.length})
              </button>
            </div>
            {characters.map((c) => (
              <div key={c.id} className={`flex justify-between items-center text-sm py-1 border-b border-zinc-800/50 fam-rail ${classeFamille(familleDuProfil(c.profil || c.classe))}`}>
                <span>{c.nom} <FamilleBadge famille={familleDuProfil(c.profil || c.classe)} className="mx-1" /> <span className="text-zinc-500">({c.pv}/{c.pvMax})</span></span>
                <button onClick={() => addPJ(c)} className="px-2.5 py-1 rounded bg-blue-900 text-xs hover:bg-blue-800">+ Ajouter</button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm uppercase text-zinc-400">Monstres par NC (quantité puis ajouter)</h2>
              <button
                onClick={() => {
                  const toutOuvrir = monstresParNc.some(([n]) => !ncOuverts[String(n)]);
                  setNcOuverts(Object.fromEntries(monstresParNc.map(([n]) => [String(n), toutOuvrir])));
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                title="Ouvrir ou replier tous les volets NC"
              >
                {monstresParNc.some(([n]) => !ncOuverts[String(n)]) ? "Tout ouvrir" : "Tout fermer"}
              </button>
            </div>
            {monstresParNc.map(([niveau, liste]) => {
              const cle = String(niveau);
              const ouvert = !!ncOuverts[cle];
              return (
                <div key={cle}>
                  <button
                    onClick={() => setNcOuverts((s) => ({ ...s, [cle]: !s[cle] }))}
                    aria-expanded={ouvert}
                    className="w-full flex items-center justify-between gap-2 text-sm font-semibold px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700"
                  >
                    <span className="text-zinc-200">{ouvert ? "▼" : "▶"} NC {cle}</span>
                    <span className="text-zinc-400 text-xs">{liste.length} monstre(s)</span>
                  </button>
                  {ouvert && (
                    <div className="mt-1 space-y-0.5">
                      {liste.map((m) => (
                        <div key={m.id} className="flex justify-between items-center text-sm py-1 px-1 border-b border-zinc-800/50 gap-2">
                          <span className="flex-1">{m.nom} <span className="text-zinc-500">({m.pv} PV)</span></span>
                          <input
                            id={`combat-quantite-${m.id}`}
                            name={`quantite-${m.id}`}
                            type="number" min={1} max={12} value={quantities[m.id] ?? 1}
                            onChange={(e) => setQuantities((q) => ({ ...q, [m.id]: Number(e.target.value) }))}
                            className="w-14 bg-zinc-800 rounded px-1.5 py-1 text-center"
                          />
                          <button onClick={() => addMonsters(m)} className="px-2.5 py-1 rounded bg-red-900 text-xs hover:bg-red-800">+ Ajouter</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-4 text-center font-bold text-lg border ${combat.termine ? "bg-green-900/40 border-green-700" : `bg-amber-400 text-black fam-rail ${classeFamille(familleDuProfil(active?.profil))}`}`}>
        {combat.termine
          ? `COMBAT TERMINÉ — ${combat.gagnant === "pj" ? "victoire des PJ" : combat.gagnant === "monstre" ? "victoire des monstres" : "égalité"}`
          : `TOUR : ${active?.nom?.toUpperCase() ?? "—"} — manche ${combat.manche}`}
      </div>

      {active && !combat.termine && (
        <div className="rounded-lg border border-amber-400/50 bg-zinc-900 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center">
          <span className="font-bold text-amber-300">{active.nom}</span>
          <FamilleBadge famille={active.camp === "pj" ? familleDuProfil(active.profil) : null} />
          <span className="font-mono">{active.pv}/{active.pvMax} PV · Déf {active.defense}</span>
          <span className="text-zinc-400">{active.attaques.map((a) => `${a.nom} +${a.bonus} (${a.degats})`).join(" · ")}</span>
          {active.effets.length > 0 && (
            <span className="text-violet-300">✦ {active.effets.map((e) => `${e.nom} (${e.toursRestants ?? "∞"})`).join(", ")}</span>
          )}
          <ActionEconomie compact className="ml-auto" />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => {
          setCombat((c) => (c ? prevTurn(c) : c));
          setLast(null);
          setLastAttaque(null);
        }} className="flex-1 min-w-28 py-2.5 rounded bg-zinc-800 font-semibold hover:bg-zinc-700">◀ Précédent</button>
        <button
          onClick={() => setCombat((c) => {
            if (!c) return c;
            const n = nextTurn(c);
            const suivant = n.participants[n.tourIndex]?.instanceId ?? null;
            setAttackerId(suivant);
            setTargetId(recibrerCible(n, suivant, targetId));
            setLast(null);
            setLastAttaque(null);
            return n;
          })}
          className="flex-[2] min-w-40 py-2.5 rounded bg-amber-400 text-black font-bold hover:bg-amber-300"
        >
          Tour suivant ▶
        </button>
        <button
          onClick={terminer}
          title="Écrit les PV/mana/chance vers les fiches puis retour à la préparation"
          className="flex-1 min-w-28 py-2.5 rounded bg-zinc-800 font-semibold hover:bg-zinc-700"
        >
          Terminer
        </button>
        <button onClick={() => { setCombat(null); setStaging([]); setLast(null); setLastAttaque(null); setTermineMessage("Rencontre annulée — fiches inchangées (les PV du combat ont été jetés)."); }} title="Abandonne la rencontre sans écrire vers les fiches" className="px-4 py-2.5 rounded bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          Annuler rencontre
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          <CombatTable
            combat={combat}
            attackerId={attackerId}
            syncIds={syncIds}
            onSync={syncDepuisFiche}
            onGratuite={lancerAttaqueGratuite}
            onEffaceGratuite={ecarterGratuite}
            onAjouteGratuite={poserGratuite}
            onSelectAttacker={(id) => {
              setAttackerId(id);
              setAttackId(null);
              const others = combat.participants.filter((p) => p.instanceId !== id && p.statut === "actif");
              const atk = combat.participants.find((p) => p.instanceId === id);
              const foes = others.filter((p) => p.camp !== atk?.camp);
              setTargetId((foes[0] ?? others[0])?.instanceId ?? null);
            }}
            onHit={(id, n) => setCombat((c) => (c ? applyDamage(c, id, n) : c))}
            onHeal={(id, n) => setCombat((c) => (c ? applyHeal(c, id, n) : c))}
          />
          <CombatLog log={combat.log} />
        </div>
        <div className="space-y-3">
          <ActionPanel
            participants={combat.participants}
            attackerId={attackerId}
            attackId={attackId ?? combat.participants.find((p) => p.instanceId === attackerId)?.attaques[0]?.id ?? null}
            targetId={targetId}
            last={last}
            onAttacker={(id) => {
              setAttackerId(id);
              setAttackId(null);
              if (combat) setTargetId(recibrerCible(combat, id, targetId));
            }}
            onAttack={(id) => setAttackId(id)}
            onTarget={(id) => setTargetId(id)}
            onRoll={rollAttack}
            onMulti={(lanceurId, sortId, cibleIds, opts, paiement) => rollMulti(lanceurId, sortId, cibleIds, opts, paiement)}
            onDouble={() => rollDouble()}
            onMultiArmes={(lanceurId, attackIdSel, cibleIds, opts) => rollCirculaire(lanceurId, attackIdSel, cibleIds, opts)}
            onChance={useChance}
            onRenvoiImmediat={() => {
              if (!combat || !last?.absorption) return;
              try {
                // Cible forcée par le moteur : le lanceur d'origine du sort.
                const { state } = renvoyerSort(combat, last.cibleId, last.attaquantId);
                setCombat(state);
                setLast(null);
                setLastAttaque(null);
              } catch (e) {
                const message = e instanceof Error ? e.message : "Renvoi impossible.";
                setCombat((c) =>
                  c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
                );
              }
            }}
            onLogMJ={(message) => {
              setCombat((c) =>
                c ? { ...c, log: [...c.log, { id: `mj-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
              );
            }}
            onCastSoutien={(lanceurId, cibleId, sort, paiement) => {
              try {
                // Invocation sur profil bestiaire (ex: Zombie) + contrôle max.
                const modele = sort.invocation?.modeleNom
                  ? monsters.find((m) => m.nom === sort.invocation!.modeleNom)
                  : undefined;
                if (sort.invocation?.modeleNom && !modele) {
                  throw new Error(`${sort.invocation.modeleNom} : profil introuvable au bestiaire (MJ).`);
                }
                const fiche = characters.find((c) => {
                  const part = combat?.participants.find((p) => p.instanceId === lanceurId);
                  return part && c.id === part.templateId;
                });
                const max = sort.id === "sort-animation-morts" && fiche
                  ? maxZombiesControles(fiche.capacites)
                  : undefined;
                const invocation = sort.invocation ? { modele, max } : undefined;
                // Frappe de zone (Armée des morts) : tous les ennemis.
                const { state } = sort.zone
                  ? frapperZone(combat, lanceurId, sort, undefined, paiement)
                  : castSoutien(combat, lanceurId, cibleId, sort, undefined, paiement, invocation);
                setCombat(state);
                setLast(null);
              } catch (e) {
                const message = e instanceof Error ? e.message : "Sort impossible.";
                setCombat((c) =>
                  c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
                );
              }
            }}
            onUtiliserCapacite={(lanceurId, cibleId, talentNom, opts) => {
              try {
                if (opts.actionSpeciale === "lien-empathique") {
                  if (opts.lienMontant == null) throw new Error("Lien empathique : saisissez les PV à dépenser.");
                  const { state } = transfererVieAuLoup(combat, lanceurId, cibleId, opts.lienMontant);
                  setCombat(state);
                  setLast(null);
                  return;
                }
                if (opts.actionSpeciale === "animer") {
                  // Cadavre choisi dans le panneau : créature hors combat
                  // relevée sur place (NC ≤ 2) ou profil du bestiaire (cadavre
                  // trouvé sur place, entré en jeu à la fin de l'ordre).
                  const modele = opts.profilId ? monstres.find((m) => m.id === opts.profilId) : undefined;
                  if (opts.profilId && !modele) throw new Error("Profil introuvable au bestiaire (MJ).");
                  const { state } = modele
                    ? animerCadavreProfil(combat, lanceurId, modele)
                    : animerCadavre(combat, lanceurId, cibleId);
                  setCombat(state);
                  setLast(null);
                  return;
                }
                const { state } = opts.actionSpeciale === "renvoi"
                  ? renvoyerSort(combat, lanceurId, cibleId)
                  : opts.actionSpeciale === "proteger"
                    ? protegerAllie(combat, lanceurId, cibleId)
                    : utiliserCapacite(combat, lanceurId, cibleId, talentNom, {
                      effetCle: opts.effetCle,
                      dureeTours: opts.dureeTours,
                      mods: opts.mods,
                      coutPV: opts.coutPV,
                      soin: opts.soin,
                      soinFixe: opts.soinFixe,
                      nettoie: opts.nettoie,
                      outrepasserSoin: (opts as { outrepasserSoin?: boolean }).outrepasserSoin,
                      modeVigueur: (opts as { modeVigueur?: "auto" | "test" }).modeVigueur,
                    });
                setCombat(state);
                setLast(null);
              } catch (e) {
                const message = e instanceof Error ? e.message : "Capacité impossible.";
                setCombat((c) =>
                  c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
                );
              }
            }}
            onTactique={(cibleId, cle, duree) =>
              setCombat((c) => (c ? addParticipantEffect(c, cibleId, createEffect(cle, { dureeTours: duree, source: "Tactique" })) : c))
            }
            profils={monstres}
            characters={characters}
            catalogue={catalogue}
            onUtiliserObjet={utiliserObjet}
          />
          <EquipementPanel
            participants={combat.participants}
            lanceurId={attackerId}
            characters={characters}
            catalogue={catalogue}
            onToggle={toggleEquipe}
          />
          <EffectsPanel
            participants={combat.participants}
            participant={selectedParticipant}
            onAdd={(cibleId, key, duree) =>
              setCombat((c) => (c ? addParticipantEffect(c, cibleId, createEffect(key, { dureeTours: duree })) : c))
            }
            onRemove={(effetId) =>
              setCombat((c) => (c && attackerId ? removeParticipantEffect(c, attackerId, effetId) : c))
            }
            onSortie={(cibleId, carac, aides) =>
              setCombat((c) => {
                if (!c) return c;
                try {
                  return tenterSortieEnseveli(c, cibleId, carac, aides, Math.random).state;
                } catch (e) {
                  const message = e instanceof Error ? e.message : "Sortie impossible.";
                  return { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] };
                }
              })
            }
          />
          {opponentsOf.length > 0 && attackerId && (
            <div className="text-xs text-zinc-500">Cibles suggérées : {opponentsOf.map((p) => (
              <span key={p.instanceId} className="mr-2 whitespace-nowrap">
                {p.camp === "pj" && <FamillePastille famille={familleDuProfil(p.profil)} className="mr-1" />}{p.nom}
              </span>
            ))}</div>
          )}
        </div>
      </div>
      {phenixEnAttente && (
        <PopupPhenix
          key={phenixEnAttente.pretreId}
          attente={phenixEnAttente}
          participants={combat.participants}
          onValider={(cibleIds) =>
            setCombat((c) =>
              c ? resoudrePhenixEnAttente(c, phenixEnAttente.pretreId, cibleIds).state : c
            )
          }
        />
      )}
    </div>
  );
}
