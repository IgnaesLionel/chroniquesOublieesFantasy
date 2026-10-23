// Évaluation analytique d'une rencontre.
//
// Deux couches sont volontairement séparées :
// 1. `nrBudget` : la table NC → Pm du DRS, ajustée au nombre de PJ. C'est la
//    seule partie « règle officielle » du budget.
// 2. `nrEstime` : ce budget, corrigé par un modèle tactique du logiciel
//    (offense/défense/contrôle/soutien, terrain, surprise, état, boss).
// L'écart `nrEstime − niveauEffectif` donne la difficulté estimée.
//
// Aucune valeur de créature n'est inventée ici : tout part des profils dérivés
// des fiches (roles.ts) et du profil de groupe (party.ts).

import type { MonsterTemplate } from "@/src/lib/rules/types";
import type {
  ConfigurationMoteur,
  ContexteRencontre,
  DifficulteRencontre,
  EvaluationRencontre,
  FacteurDifficulte,
  GroupePJ,
  ProfilCreature,
  SlotRencontre,
  SlotResolu,
} from "@/src/lib/encounters/types";
import {
  classerDifficulte,
  configurerMoteur,
  ciblePm,
  echellePm,
  FACTEURS_SURPRISE,
  nrPourPm,
  pmPourNc,
  probabiliteToucher,
  ratioVersCorrectionNr,
  TERRAINS,
} from "@/src/lib/encounters/rules";
import { cacheProfils, dprDepuisAttaques, profilDepuisCache } from "@/src/lib/encounters/roles";

/**
 * Rounds supposés pour convertir une régénération (PV/round) en PV effectifs.
 *
 * Hypothèse du logiciel : la durée réelle du combat dépend des PV effectifs
 * eux-mêmes (calcul circulaire). On borne donc la contribution de la
 * régénération à un nombre de rounds fixe et raisonnable.
 */
const ROUNDS_SOUTIEN = 6;

export interface OptionsEvaluation {
  groupe: GroupePJ;
  slots: SlotRencontre[];
  difficulte: DifficulteRencontre;
  contexte: ContexteRencontre;
  bestiaire: MonsterTemplate[];
  configuration?: Partial<ConfigurationMoteur>;
  /** Cache optionnel (génération) pour éviter de recalculer les profils. */
  profils?: Map<string, ProfilCreature>;
}

function poidsSort(tauxMana: number): number {
  // Un sort n'est pas lancé à chaque round : le poids dépend du mana restant.
  return 0.35 + 0.25 * Math.max(0, Math.min(1, tauxMana));
}

function dprAvecMalusEtRd(
  attaques: ProfilCreature["attaques"],
  defense: number,
  malusAttaque: number,
  rd: number,
  options: { tauxMana?: number; poidsLimitee?: number; bonusZone?: number } = {}
): number {
  const pSort = poidsSort(options.tauxMana ?? 1);
  const pLimitee = options.poidsLimitee ?? 0.35;
  const bonusZone = options.bonusZone ?? 1;
  const contribution = (a: ProfilCreature["attaques"][number]): number => {
    let poids = a.source === "sort" ? pSort : 1;
    if (a.zone) poids *= bonusZone;
    const bonus = a.bonus + malusAttaque;
    const touche = a.toucheAuto ? 1 : probabiliteToucher(bonus, defense);
    const brut = a.toucheAuto ? a.degatsMoyens : a.degatsMoyens * (1 + 1 / 20);
    const apresRd = Math.max(0, brut - rd * (a.toucheAuto ? 1 : touche));
    // Attaques indépendantes déclarées sur la fiche ("(2 attaques)") : chaque
    // frappe est un jet et des DM séparés dans le même tour.
    const nb = Math.max(1, a.multiplicite ?? 1);
    return apresRd * touche * poids * nb;
  };
  const dot = (a: ProfilCreature["attaques"][number]): number =>
    Math.max(0, a.degatsParTour - rd * 0.5) * 0.5;
  // Même règle que dprDepuisAttaques (DRS « Attaques ») : le mode de contact
  // et le mode à distance sont exclusifs ; les actions limitées restent
  // additives.
  let modeContact = 0;
  let modeDistance = 0;
  let additif = 0;
  for (const a of attaques) {
    if (a.limitee) additif += contribution(a) * pLimitee + dot(a);
    else if (a.distance) modeDistance += contribution(a) + dot(a);
    else modeContact += contribution(a) + dot(a);
  }
  return Math.max(modeContact, modeDistance) + additif;
}

/**
 * DPR d'un membre du groupe contre UNE créature.
 *
 * `rd` et `facteurDegatsSubis` doivent être ceux de la cible : un créature à
 * RD 5 divise quasiment par deux les dégâts d'une arme de 1d8+7. Une version
 * antérieure passait rd = 0 et ignorait les résistances, ce qui surestimait
 * l'offense du groupe face aux créatures résistantes — au point de présenter
 * comme « normal » une rencontre que la simulation donnait à 0 % de victoire.
 */
function dprMembre(
  membre: GroupePJ["membres"][number],
  defense: number,
  malus: number,
  rd = 0,
  facteurDegatsSubis = 1
): number {
  return (
    dprAvecMalusEtRd(membre.attaques, defense, malus, rd, {
      tauxMana: membre.tauxMana,
      poidsLimitee: 0.35,
    }) * facteurDegatsSubis
  );
}

function tauxToucheMembre(membre: GroupePJ["membres"][number], defense: number, malus: number): number {
  const liste = membre.attaques.filter((a) => !a.toucheAuto);
  if (liste.length === 0) return 1;
  const poids = liste.map((a) => Math.max(1, a.degatsMoyens));
  const total = poids.reduce((n, v) => n + v, 0);
  return liste.reduce((n, a, i) => n + probabiliteToucher(a.bonus + malus, defense) * poids[i], 0) / total;
}

function risquesEtTactiques(
  evaluation: {
    profiles: ProfilCreature[];
    pressionControleEnnemie: number;
    pressionControlePartie: number;
    nombreEnnemis: number;
    nombreBoss: number;
    party: GroupePJ;
    tauxToucheParti: number;
    dprParti: number;
    dprEnnemis: number;
    pmTotal: number;
    terrain: string;
  }
): { risques: string[]; tactiques: string[] } {
  const risques: string[] = [];
  const tactiques: string[] = [];
  const { profiles, party, nombreEnnemis, nombreBoss } = evaluation;
  const tireurs = profiles.filter((p) => p.roles.includes("tireur")).length;
  const soutiens = profiles.filter((p) => p.roles.includes("soutien")).length;
  const resistants = profiles.filter((p) => p.facteurDegatsSubis < 0.95 || p.rd > 0).length;
  const zones = profiles.filter((p) => p.attaques.some((a) => a.zone)).length;
  const sacDePv = profiles.length === 1 && nombreEnnemis === 1 && profiles[0].pvMax >= 80;

  if (nombreEnnemis >= 5) risques.push(`Nombre : ${nombreEnnemis} créatures, donc beaucoup d'actions et de cibles à gérer.`);
  if (nombreEnnemis > party.nombre * 2) risques.push("Supériorité numérique ennemie : les actions s'accumulent contre le groupe.");
  if (evaluation.pressionControleEnnemie >= 0.3) risques.push("Contrôle ennemi élevé : des tours de PJ peuvent être perdus (paralysie, peur, immobilisation…).");
  if (tireurs > 0 && evaluation.terrain !== "interieur") risques.push("Menace à distance : les tireurs ennemis peuvent cibler les PJ fragiles hors du contact.");
  if (soutiens > 0) risques.push("Soutien ennemi : soins, commandement ou buffs allongent le combat et favorisent l'usure.");
  if (resistants > 0) risques.push("Résistances / RD : les dégâts du groupe seront partiellement absorbés ; privilégier les sources adaptées.");
  if (zones > 0) risques.push("Attaques de zone probables : éviter le regroupement et étaler les lignes.");
  if (sacDePv) risques.push("Composition mono-cible : un seul gros profil, sensible au contrôle, au burst et à l'usure des ressources.");
  if (nombreBoss > 0) risques.push("Boss : la capacité-signature peut changer la donne ; ne pas le traiter comme un simple sac de PV.");
  if (evaluation.tauxToucheParti < 0.5) risques.push("Taux de touche faible : la DEF ennemie rend les attaques du groupe peu fiables.");
  if (evaluation.dprEnnemis > evaluation.dprParti * 1.25) risques.push("Pression offensive ennemie supérieure : le combat peut s'accélérer en leur faveur.");
  if (party.soinsDisponibles < party.pvTotal * 0.15) risques.push("Soins limités : les pertes de PV seront difficiles à récupérer dans le combat.");

  tactiques.push(
    nombreBoss > 0
      ? "Identifier le boss et sa mécanique : concentrer le contrôle et le burst, tout en gérant les soutiens."
      : "Prioriser les contrôleurs et les soutiens ennemis, puis réduire le nombre d'attaques adverses."
  );
  if (tireurs > 0) tactiques.push("Utiliser couverts, fumée ou corps à corps pour neutraliser les tireurs.");
  if (resistants > 0) tactiques.push("Adapter les sources de dégâts (feu, contondant, magie) aux résistances annoncées.");
  if (evaluation.pressionControlePartie >= 0.3) tactiques.push("Placer les contrôles sur les tours clés plutôt que de les disperser.");
  if (party.soinsDisponibles > 0) tactiques.push("Garder une action de soin pour après le pic de dégâts, pas avant.");
  if (nombreEnnemis >= 4) tactiques.push("Chercher un point de blocage (porte, couloir) pour réduire le nombre d'attaquants simultanés.");
  tactiques.push("Prévoir un round de repli ou une ressource de secours si la cible principale survit au burst.");

  return { risques, tactiques };
}

/**
 * Évalue une composition. Les slots sont résolus contre le bestiaire fourni ;
 * un identifiant inconnu est signalé mais ne casse pas le calcul.
 */
export function evaluerRencontre(options: OptionsEvaluation): EvaluationRencontre {
  const configuration = configurerMoteur(options.configuration);
  const cache = options.profils ?? cacheProfils(options.bestiaire);
  const terrain = TERRAINS[options.contexte.terrain];
  const party = options.groupe;
  const avertissements: string[] = [...party.avertissements];

  const slots: SlotResolu[] = [];
  for (const slot of options.slots) {
    const quantite = Math.max(1, Math.floor(slot.quantite));
    const profil = profilDepuisCache(cache, options.bestiaire, slot.monstreId);
    if (!profil) {
      avertissements.push(`Créature inconnue dans le bestiaire : ${slot.monstreId}.`);
      continue;
    }
    slots.push({ ...slot, quantite, profil });
    for (const a of profil.avertissements) avertissements.push(`${profil.nom} : ${a}`);
  }
  const totalCreatures = slots.reduce((n, s) => n + s.quantite, 0);
  if (totalCreatures > configuration.maxCreatures) {
    avertissements.push(
      `La composition dépasse la limite de ${configuration.maxCreatures} créatures (${totalCreatures}) : lisibilité et temps de jeu dégradés.`
    );
  }
  if (slots.length === 0) avertissements.push("Aucune créature résolue : la rencontre est vide.");

  const profilsEnnemis: ProfilCreature[] = [];
  for (const s of slots) {
    for (let i = 0; i < s.quantite; i++) profilsEnnemis.push(s.profil);
  }
  const nombreEnnemis = profilsEnnemis.length;
  const nombreBoss = profilsEnnemis.filter((p) => p.candidatBoss).length;

  const pmTotal = slots.reduce((n, s) => n + pmPourNc(s.profil.nc, configuration.tablePm) * s.quantite, 0);
  const echelle = echellePm(party.nombre);
  const pmNormalise = pmTotal / echelle;
  const nrBudget = nrPourPm(pmNormalise, configuration.tablePm);
  const cibleNrRegle = party.niveauEffectif + configuration.decalageNr[options.difficulte];
  const ciblePmCible = ciblePm(cibleNrRegle, party.nombre, configuration.tablePm);
  const ecartBudget = nrBudget - cibleNrRegle;

  const defensePartie = party.defenseMoyenne + terrain.malusAttaqueDefense;
  const malusParti = terrain.malusAttaqueDefense;

  // PV effectifs : résistances, RD (via les DPR), régénération et vol de vie.
  //
  // La régénération est prise UNIQUEMENT sur les capacités de soin réelles de
  // la fiche (regenerationDepuisTexte) et non sur le « soutien » générique :
  // un capitaine, un invocateur ou un garde du corps ne rend pas de PV. On
  // suppose environ ROUNDS_SOUTIEN rounds de combat pour convertir une
  // régénération par round en PV effectifs.
  //
  // Le vol de vie (50 % des DM reviennent en PV) allonge la durée de vie de la
  // créature d'autant ; on l'approxime par 0.5 × son propre DPR pondéré par la
  // part de ses attaques à vol de vie.
  const pvEffectifsEnnemis = profilsEnnemis.reduce((n, p) => {
    const regen = p.regeneration * ROUNDS_SOUTIEN;
    const volDeVie = 0.5 * p.dprReference * (p.partVolDeVie ?? 0);
    return n + p.pvMax * p.facteurDegatsSubis + regen + volDeVie;
  }, 0);
  const pvEffectifsParti =
    party.pvActuel +
    party.soinsDisponibles * 0.6 * (party.etat === "epuise" ? 0.7 : 1);

  const pressionControleEnnemie = Math.min(
    1,
    profilsEnnemis.reduce((n, p) => n + p.controle, 0) / Math.max(1, party.nombre)
  );
  const pressionControlePartie = Math.min(1, party.controle / Math.max(1, nombreEnnemis));

  // Offense : chaque membre contre la DEF ennemie moyenne, malus de terrain
  // et pénalité de contrôle appliqués. Les créatures utilisent leur DEF réelle
  // et leur RD, avec le nombre d'attaques explicite de la fiche.
  // Le groupe répartit ses coups entre les créatures à proportion de leur part
  // des PV ennemis. Chacune a sa propre DEF, sa RD et ses résistances : on
  // calcule le DPR contre chacune puis on moyenne pondérée. A moyenner d'abord
  // les statistiques, la RD des créatures résistantes disparaissait.
  const totalPvEnnemis = profilsEnnemis.reduce((n, p) => n + Math.max(1, p.pvMax), 0) || 1;
  const dprPartiBrut = profilsEnnemis.reduce((n, p) => {
    const part = Math.max(1, p.pvMax) / totalPvEnnemis;
    return (
      n +
      part *
        party.membres.reduce(
          (s, m) => s + dprMembre(m, p.defense, malusParti, p.rd, p.facteurDegatsSubis),
          0
        )
    );
  }, 0);
  const dprParti = dprPartiBrut * (1 - 0.25 * pressionControleEnnemie);
  // La multiplicité des attaques indépendantes est appliquée par attaque dans
  // dprAvecMalusEtRd ; pas de multiplication globale par actionsAttaque.
  const dprEnnemisBrut = profilsEnnemis.reduce(
    (n, p) =>
      n +
      dprAvecMalusEtRd(p.attaques, defensePartie, 0, p.rd, {
        tauxMana: 1,
        poidsLimitee: 0.35,
        bonusZone: 1.15,
      }),
    0
  );
  const dprEnnemis = dprEnnemisBrut * (1 - 0.25 * pressionControlePartie);

  // Même pondération PV que le DPR, pour que le taux de touche affiché soit
  // cohérent avec les dégâts réellement infligés.
  const tauxToucheParti =
    party.membres.length > 0
      ? profilsEnnemis.reduce((n, p) => {
          const part = Math.max(1, p.pvMax) / totalPvEnnemis;
          return (
            n +
            (part * party.membres.reduce((s, m) => s + tauxToucheMembre(m, p.defense, malusParti), 0)) /
              party.membres.length
          );
        }, 0)
      : 0;
  const tauxToucheEnnemis =
    profilsEnnemis.length > 0
      ? profilsEnnemis.reduce((n, p) => {
          const liste = p.attaques.filter((a) => !a.toucheAuto);
          if (liste.length === 0) return n + 1;
          return n + liste.reduce((s, a) => s + probabiliteToucher(a.bonus, defensePartie), 0) / liste.length;
        }, 0) / profilsEnnemis.length
      : 0;

  const facteurSurprise = FACTEURS_SURPRISE[options.contexte.surprise];
  const facteurEtat = party.etat === "frais" ? 1 : party.etat === "entame" ? 1.12 : 1.3;
  const facteurBoss = options.difficulte === "boss" ? 1 + Math.min(0.2, 0.06 * Math.max(1, nombreBoss)) : 1;
  const facteurTerrain = 1 + Math.abs(terrain.malusAttaqueDefense) / 25 + terrain.ajustementNr * 0.05;

  const actionsParti = party.nombre;
  const actionsEnnemis = profilsEnnemis.reduce((n, p) => n + p.actionsParRound, 0);
  const ratioBrut =
    pvEffectifsEnnemis > 0 && dprParti > 0
      ? (pvEffectifsEnnemis * dprEnnemis) / (Math.max(1, pvEffectifsParti) * dprParti)
      : dprEnnemis > 0
        ? 10
        : 1;
  // Économie d'actions : le ratio agrégé (PV × DPR) ignore que le camp le
  // plus nombreux agit plus souvent et que chaque PJ KO retire ses actions au
  // groupe. On pondère par (actions ennemies / actions du groupe)^exposant.
  const ratioActions = actionsEnnemis / Math.max(1, actionsParti);
  const facteurActions = Math.pow(
    Math.max(0.4, Math.min(4, ratioActions)),
    configuration.exposantEconomieActions
  );
  const ratioPuissance = Math.max(
    0.02,
    Math.min(50, ratioBrut * facteurActions * facteurSurprise * facteurEtat * facteurBoss)
  );
  const correction = ratioVersCorrectionNr(ratioPuissance, configuration);
  // Pas de plancher à 0 ici : le budget DRS est déjà bloqué au plus petit
  // palier (NC 0), et ré-écrêter le NR estimé annulerait la correction
  // tactique sur les faibles niveaux (une rencontre très sous-dimensionnée
  // resterait alors artificiellement « normale »). La valeur reste bornée
  // naturellement par correctionTactiqueMin/Max.
  const nrEstime = nrBudget + correction + terrain.ajustementNr;
  const deltaDanger = nrEstime - party.niveauEffectif;
  const difficulteEstimee = classerDifficulte(deltaDanger);

  const estimationRounds =
    dprParti > 0 && pvEffectifsEnnemis > 0
      ? Math.max(1, Math.min(20, Math.round(pvEffectifsEnnemis / dprParti)))
      : 20;
  const estimationPertesPv = Math.min(
    party.pvActuel,
    Math.round(dprEnnemis * Math.min(estimationRounds, 20) * 10) / 10
  );

  const facteurs: FacteurDifficulte[] = [
    {
      cle: "pm",
      libelle: "Budget Pm",
      valeur: `${Math.round(pmTotal * 10) / 10} Pm`,
      impact: "neutre",
      detail: `Somme des Pm de la table DRS pour ${nombreEnnemis} créature(s).`,
      origine: "regle",
    },
    {
      cle: "pj",
      libelle: "Nombre de PJ",
      valeur: `${party.nombre} PJ (× ${Math.round(echelle * 100) / 100})`,
      detail: "La table DRS ajuste le budget au nombre de personnages (Pm × nombre de PJ / 4).",
      impact: "neutre",
      origine: "regle",
    },
    {
      cle: "cible",
      libelle: "Cible de difficulté",
      valeur: `NR ${Math.round(cibleNrRegle * 100) / 100} (${options.difficulte})`,
      detail: `Niveau effectif ${party.niveauEffectif} ${configuration.decalageNr[options.difficulte] >= 0 ? "+" : ""}${configuration.decalageNr[options.difficulte]}. Objectif du logiciel, pas une catégorie officielle.`,
      impact: "neutre",
      origine: "estimation",
    },
    {
      cle: "budget",
      libelle: "NR du budget",
      valeur: `${Math.round(nrBudget * 100) / 100} (écart ${ecartBudget >= 0 ? "+" : ""}${Math.round(ecartBudget * 100) / 100})`,
      detail: `Pm normalisés ${Math.round(pmNormalise * 10) / 10} ; cible ${Math.round(ciblePmCible * 10) / 10} Pm.`,
      impact: Math.abs(ecartBudget) <= configuration.toleranceNr[options.difficulte] ? "neutre" : ecartBudget > 0 ? "hausse" : "baisse",
      origine: "regle",
    },
    {
      cle: "ratio",
      libelle: "Ratio tactique",
      valeur: `× ${Math.round(ratioPuissance * 100) / 100}`,
      detail: `Correction ${correction >= 0 ? "+" : ""}${Math.round(correction * 100) / 100} NR : offense, PV effectifs, DEF, contrôle et soutien.`,
      impact: correction > 0.05 ? "hausse" : correction < -0.05 ? "baisse" : "neutre",
      origine: "estimation",
    },
    {
      cle: "actions",
      libelle: "Économie d'actions",
      valeur: `${actionsParti} PJ / ${Math.round(actionsEnnemis * 10) / 10} actions ennemies (× ${Math.round(facteurActions * 100) / 100})`,
      detail:
        "Le camp qui agit plus souvent l'emporte à puissance agrégée égale, et chaque PJ KO retire ses actions au groupe. Pondération appliquée au ratio de puissance.",
      impact: facteurActions > 1.05 ? "hausse" : facteurActions < 0.95 ? "baisse" : "neutre",
      origine: "estimation",
    },
    {
      cle: "terrain",
      libelle: `Terrain : ${terrain.nom}`,
      valeur:
        terrain.malusAttaqueDefense === 0 && terrain.ajustementNr === 0
          ? "neutre"
          : `${terrain.malusAttaqueDefense} attaque/DEF${terrain.ajustementNr ? `, NC +${terrain.ajustementNr}` : ""}`,
      detail: terrain.note,
      impact: terrain.malusAttaqueDefense < 0 || terrain.ajustementNr > 0 ? "hausse" : "neutre",
      origine: terrain.ajustementNr !== 0 || terrain.malusAttaqueDefense !== 0 ? "regle" : "donnee",
    },
    {
      cle: "surprise",
      libelle: "Surprise",
      valeur: `${Math.round(facteurSurprise * 100)} %`,
      detail:
        options.contexte.surprise === "aucune"
          ? "Aucun camp ne perd de tour."
          : options.contexte.surprise === "pj"
            ? "Les PJ surprennent : le camp ennemi perd son premier tour (facteur estimé)."
            : "Les ennemis surprennent : le groupe perd son premier tour (facteur estimé).",
      impact: facteurSurprise > 1 ? "hausse" : facteurSurprise < 1 ? "baisse" : "neutre",
      origine: "estimation",
    },
    {
      cle: "etat",
      libelle: "État du groupe",
      valeur: `${party.etat} (× ${facteurEtat})`,
      detail: `PV actuels ${party.pvActuel}/${party.pvTotal} ; mana et ressources non rechargés.`,
      impact: facteurEtat > 1 ? "hausse" : "neutre",
      origine: "estimation",
    },
    {
      cle: "controle",
      libelle: "Contrôle",
      valeur: `ennemis ${Math.round(pressionControleEnnemie * 100)} % · PJ ${Math.round(pressionControlePartie * 100)} %`,
      detail: "Pénalité de 25 % maximum sur le DPR du camp contrôlé (estimation).",
      impact: pressionControleEnnemie > pressionControlePartie ? "hausse" : pressionControlePartie > pressionControleEnnemie ? "baisse" : "neutre",
      origine: "estimation",
    },
  ];

  const { risques, tactiques } = risquesEtTactiques({
    profiles: profilsEnnemis,
    pressionControleEnnemie,
    pressionControlePartie,
    nombreEnnemis,
    nombreBoss,
    party,
    tauxToucheParti,
    dprParti,
    dprEnnemis,
    pmTotal,
    terrain: options.contexte.terrain,
  });

  const editions = new Set(profilsEnnemis.map((p) => p.edition));
  if (editions.size > 1) {
    avertissements.push("Mélange de sources (COF2 / COF1 / hors DRS) : les statistiques ne sont pas directement comparables.");
  }
  if (profilsEnnemis.some((p) => p.attaques.length === 0)) {
    avertissements.push("Au moins une créature n'a pas d'attaque structurée : le danger est sous-estimé.");
  }
  if (options.contexte.surprise !== "aucune") {
    avertissements.push("La surprise est approchée par un facteur : la règle DRS exacte est la perte du premier tour.");
  }

  const fiabilite: EvaluationRencontre["fiabilite"] =
    profilsEnnemis.length === 0 || profilsEnnemis.some((p) => p.edition === "hors-drs" || p.attaques.length === 0)
      ? "basse"
      : editions.size === 1 && editions.has("cof2") && nombreEnnemis <= 8
        ? "haute"
        : "moyenne";

  const hypotheses = [
    ...party.hypotheses,
    "Le budget suit la table NC → Pm du DRS ; les objectifs Facile/Normal/Boss sont des décalages choisis par le logiciel.",
    `La correction tactique pèse ${Math.round(configuration.poidsTactique * 100)} % du logarithme de puissance, bornée à [${configuration.correctionTactiqueMin}, ${configuration.correctionTactiqueMax}] NR.`,
    "Le ratio tactique compare le temps nécessaire pour tuer chaque camp (PV effectifs × DPR), pas seulement la somme des NC.",
    "Les sorts offensifs sont pondérés par le mana restant ; une capacité sans chiffre structuré n'entre pas dans le DPR.",
  ];
  const limites = [
    "Modèle analytique : pas de positions, de couverts, de lignes de vue ni de séquence exacte des tours.",
    "Les capacités narratives (souffle, invocation, téléportation, terreur) ne sont pas simulées ; elles apparaissent en signature, risque ou tactique.",
    "Les résistances sont approximées par un facteur et une RD moyenne ; le type exact des armes du groupe n'est pas suivi.",
    "Un groupe multi-niveaux est ramené à un niveau effectif et à des moyennes : les écarts individuels peuvent être importants.",
    "Les conditions difficiles cumulent le malus de touche/DEF et l'ajustement NR officiel : lecture volontairement prudente.",
  ];

  return {
    slots,
    pmTotal,
    pmNormalise,
    nrBudget,
    cibleNrRegle,
    cibleNrAjuste: cibleNrRegle,
    ecartBudget,
    niveauMoyen: party.niveauMoyen,
    niveauEffectif: party.niveauEffectif,
    nrEstime,
    deltaDanger,
    difficulteEstimee,
    fiabilite,
    ratioPuissance,
    partyOffense: dprParti,
    partyDefense: pvEffectifsParti,
    enemyOffense: dprEnnemis,
    enemyDefense: pvEffectifsEnnemis,
    tauxToucheParti,
    tauxToucheEnnemis,
    dprParti,
    dprEnnemis,
    pvEffectifsParti,
    pvEffectifsEnnemis,
    actionsParti,
    actionsEnnemis,
    pressionControleEnnemie,
    pressionControlePartie,
    facteurTerrain,
    facteurActions,
    facteurSurprise,
    facteurEtat,
    facteurBoss,
    nombreEnnemis,
    nombreBoss,
    estimationRounds,
    estimationPertesPv,
    facteurs,
    risques,
    tactiques,
    hypotheses,
    limites,
    avertissements,
  };
}

/** Évaluation rapide d'une liste de modèles (sans slots), utile aux tests/UI. */
export function evaluerModeles(
  groupe: GroupePJ,
  modeles: { monstre: MonsterTemplate; quantite: number }[],
  difficulte: DifficulteRencontre,
  contexte: ContexteRencontre,
  configuration?: Partial<ConfigurationMoteur>
): EvaluationRencontre {
  return evaluerRencontre({
    groupe,
    slots: modeles.map((m) => ({ monstreId: m.monstre.id, quantite: m.quantite })),
    difficulte,
    contexte,
    bestiaire: modeles.map((m) => m.monstre),
    configuration,
  });
}

/** DPR de référence d'un profil, exposé pour l'UI et les tests. */
export function dprReferenceProfil(profil: ProfilCreature, defense = 15): number {
  // La multiplicité est déjà appliquée par attaque dans dprDepuisAttaques.
  return dprDepuisAttaques(profil.attaques, defense, { poidsSort: 0.55, poidsLimitee: 0.35 });
}
