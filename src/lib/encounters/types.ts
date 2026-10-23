// Types du générateur de rencontres COF2.
// Modules purs (aucune dépendance React) : le calcul de difficulté est
// indépendant de l'interface et testable avec Vitest.

import type { MonsterTemplate } from "@/src/lib/rules/types";

export type DifficulteRencontre = "facile" | "normal" | "boss";

export type TypeRencontre =
  | "bataille"
  | "embuscade"
  | "assaut"
  | "defense"
  | "poursuite"
  | "boss";

export type TerrainRencontre =
  | "plaine"
  | "foret"
  | "ruines"
  | "souterrain"
  | "interieur"
  | "montagne"
  | "neige"
  | "eau"
  | "obscurite";

export type SurpriseRencontre = "aucune" | "pj" | "ennemis";

export type EtatGroupe = "frais" | "entame" | "epuise";

export type EditionCreature = "cof2" | "cof1" | "hors-drs";

export type RoleCreature =
  | "combattant"
  | "tireur"
  | "soutien"
  | "controleur"
  | "elite"
  | "boss"
  | "sbire"
  | "animal";

/** Attaque normalisée pour l'évaluation (les valeurs viennent de la fiche). */
export interface AttaqueEvaluee {
  nom: string;
  bonus: number;
  degats: string;
  degatsMoyens: number;
  /** Distance / magie : la créature n'a pas besoin d'être au contact. */
  distance: boolean;
  /** Action limitée ou sort : pas forcément disponible chaque round. */
  limitee: boolean;
  /** Touche automatiquement (pas de jet). */
  toucheAuto: boolean;
  /** Effet de contrôle au toucher (poids 0..1, dérivé de la fiche). */
  controle: number;
  /** Effet de zone estimé (souffle, fauchage...). */
  zone: boolean;
  /** Vol de vie, soin de soi. */
  volDeVie: boolean;
  /** Dégâts par tour de l'effet (saignement, poison...). */
  degatsParTour: number;
  /**
   * Nombre d'attaques indépendantes déclarées sur la fiche ("(2 attaques)",
   * "1 attaque par tête"). 1 par défaut. Lecture de la fiche, pas une
   * statistique inventée — voir `multipliciteDepuisNom`.
   */
  multiplicite: number;
  source: "fiche" | "arme" | "sort";
}

/** Profil tactique d'une créature, dérivé de ses statistiques réelles. */
export interface ProfilCreature {
  id: string;
  nom: string;
  nc: number;
  edition: EditionCreature;
  sourceLabel: string;
  template: MonsterTemplate;
  roles: RoleCreature[];
  pvMax: number;
  defense: number;
  initiative: number;
  caracteristiques: { AGI: number; CON: number; FOR: number; PER: number; CHA: number; INT: number; VOL: number };
  attaques: AttaqueEvaluee[];
  /** Meilleure attaque soutenue (hors action limitée si possible). */
  attaqueSoutenue: AttaqueEvaluee | null;
  /** Meilleure attaque disponible, y compris limitée. */
  meilleureAttaque: AttaqueEvaluee | null;
  /** Nombre d'attaques par round estimé (1 par défaut, 2 si la fiche le dit explicitement). */
  actionsAttaque: number;
  /** Dégâts attendus par round contre une DEF de référence (15). */
  dprReference: number;
  /** Indice de contrôle (0..1) : capacité à retirer une action à un PJ. */
  controle: number;
  /** Indice de soutien (0..1) : soins, buffs, actions offertes. */
  soutien: number;
  /**
   * Régénération passive déclarée sur la fiche (PV/round), 0 sinon.
   *
   * Seules les capacités réelles de soin/régénération la renseignent. Le
   * « soutien » générique (commandement, invocation, protection) n'implique
   * aucun soin et ne doit pas gonfler la durabilité de la créature.
   */
  regeneration: number;
  /**
   * Part (0..1) des dégâts attendus dûe à des attaques à vol de vie.
   * Sert à estimer la durabilité apportée par le vol de vie.
   */
  partVolDeVie: number;
  /** Indice de résistance (multiplicateur de dégâts subis, 1 = normal). */
  facteurDegatsSubis: number;
  /** Réduction de dégâts fixe (RD de la fiche). */
  rd: number;
  /** Capacité-signature (souffle, injonction, regard, invocation...). */
  signature: string[];
  /** Un boss doit avoir une mécanique distinctive, pas seulement des PV. */
  candidatBoss: boolean;
  /** Actions par round estimées (attaque + capacités). */
  actionsParRound: number;
  /** Avertissements de données (stats manquantes, hors édition...). */
  avertissements: string[];
}

export interface MembreGroupe {
  characterId?: string;
  nom: string;
  niveau: number;
  famille: string;
  profil: string;
  pv: number;
  pvMax: number;
  defense: number;
  initiative: number;
  attaques: AttaqueEvaluee[];
  attaqueSoutenue: AttaqueEvaluee | null;
  meilleureAttaque: AttaqueEvaluee | null;
  /** Bonus d'attaque moyen retenu pour les tests de touche. */
  bonusAttaque: number;
  /** Dégâts attendus par round (attaque soutenue). */
  dpr: number;
  /** Dégâts de pointe si ressources dépensées. */
  dprBurst: number;
  /** Soins disponibles sur la rencontre (total estimé). */
  soinsDisponibles: number;
  /** Soin moyen par action de soutien. */
  soinParAction: number;
  ressources: Record<string, { max: number; actuel: number }>;
  mana: number;
  manaMax: number;
  chance: number;
  chanceMax: number;
  desRecuperation: { type: string; max: number; actuel: number } | null;
  equipementMagique: string[];
  capacites: string[];
  sorts: string[];
  controle: number;
  soutien: number;
  particularites: string[];
  /** 0..1 : PV restants. */
  tauxPv: number;
  /** 0..1 : mana restante (1 si pas de mana). */
  tauxMana: number;
}

export interface IndicePuissance {
  offense: number;
  defense: number;
  soutien: number;
  controle: number;
  ressources: number;
  total: number;
}

export interface GroupePJ {
  mode: "fiches" | "simplifie";
  membres: MembreGroupe[];
  nombre: number;
  /** État déclaré (frais / entamé / épuisé), utilisé comme facteur de danger. */
  etat: EtatGroupe;
  niveauMoyen: number;
  /** Niveau ajusté à la puissance réelle estimée (borné ±1,5). */
  niveauEffectif: number;
  pvTotal: number;
  pvActuel: number;
  tauxPv: number;
  defenseMoyenne: number;
  initiativeMoyenne: number;
  dpr: number;
  dprBurst: number;
  bonusAttaqueMoyen: number;
  soinsDisponibles: number;
  soinParAction: number;
  controle: number;
  soutien: number;
  equipementMagique: string[];
  ressources: Record<string, { max: number; actuel: number }>;
  indice: IndicePuissance;
  hypotheses: string[];
  avertissements: string[];
}

export interface SlotRencontre {
  /** id du modèle dans le bestiaire. */
  monstreId: string;
  quantite: number;
  /** Verrouillé par le MJ : la génération le conserve. */
  verrouille?: boolean;
}

export interface SlotResolu extends SlotRencontre {
  profil: ProfilCreature;
}

export interface ContexteRencontre {
  type: TypeRencontre;
  terrain: TerrainRencontre;
  surprise: SurpriseRencontre;
  /** Thème narratif / famille : "toutes", catégorie ou sous-catégorie. */
  theme: string;
  /** Inclure les créatures V1 (signalées) et hors DRS. */
  inclureV1: boolean;
  inclureHorsDrs: boolean;
  /** Nombre de créatures souhaité (optionnel). */
  nbMin?: number;
  nbMax?: number;
  /** Graine de génération (reproductibilité). */
  graine?: number;
}

export interface FacteurDifficulte {
  cle: string;
  libelle: string;
  valeur: string;
  impact: "hausse" | "baisse" | "neutre";
  detail: string;
  /** "regle" = table officielle/DRS ; "estimation" = modèle du logiciel. */
  origine: "regle" | "estimation" | "donnee";
}

export interface EvaluationRencontre {
  slots: SlotResolu[];
  pmTotal: number;
  pmNormalise: number;
  nrBudget: number;
  cibleNrRegle: number;
  cibleNrAjuste: number;
  ecartBudget: number;
  niveauMoyen: number;
  niveauEffectif: number;
  /** NR = budget + correction tactique estimée. */
  nrEstime: number;
  /** nrEstime - niveauEffectif. */
  deltaDanger: number;
  difficulteEstimee: DifficulteRencontre;
  fiabilite: "haute" | "moyenne" | "basse";
  ratioPuissance: number;
  partyOffense: number;
  partyDefense: number;
  enemyOffense: number;
  enemyDefense: number;
  tauxToucheParti: number;
  tauxToucheEnnemis: number;
  dprParti: number;
  dprEnnemis: number;
  pvEffectifsParti: number;
  pvEffectifsEnnemis: number;
  actionsParti: number;
  actionsEnnemis: number;
  pressionControleEnnemie: number;
  pressionControlePartie: number;
  facteurTerrain: number;
  /** Rapport d'actions élevé à l'exposant de configuration (≥ 0). */
  facteurActions: number;
  facteurSurprise: number;
  facteurEtat: number;
  facteurBoss: number;
  nombreEnnemis: number;
  nombreBoss: number;
  estimationRounds: number;
  estimationPertesPv: number;
  facteurs: FacteurDifficulte[];
  risques: string[];
  tactiques: string[];
  hypotheses: string[];
  limites: string[];
  avertissements: string[];
  /** Score de classement de la génération (plus haut = meilleur). */
  scoreGeneration?: number;
  /** Justification lisible du classement (budget, diversité, tactique). */
  raisonsScore?: string[];
}

export interface ConfigurationMoteur {
  /** Table NC -> Pm (DRS COF2). Modifiable pour tester une variante. */
  tablePm: Record<string, number>;
  /** Décalage de NR visé par difficulté (objectif du logiciel). */
  decalageNr: Record<DifficulteRencontre, number>;
  /** Tolérance de NR autour de la cible (génération). */
  toleranceNr: Record<DifficulteRencontre, number>;
  /** Poids de la correction tactique dans le NR estimé (0..1). */
  poidsTactique: number;
  /** Base du logarithme de conversion ratio -> NR. */
  baseLogPuissance: number;
  /** Bornes de la correction tactique en NR. */
  correctionTactiqueMin: number;
  correctionTactiqueMax: number;
  /** Nombre maximum de créatures dans une rencontre. */
  maxCreatures: number;
  /** Poids de la qualité de composition dans le score de génération. */
  poidsQualite: number;
  /**
   * Poids de la cohérence « difficulté estimée » dans le score de génération.
   *
   * Un candidat peut être exactement au budget DRS (nrBudget) tout en étant,
   * après correction tactique (nrEstime), très au-dessus de la difficulté
   * demandée — auquel cas il serait annoncé « normal » mais joué en « boss ».
   * Ce poids fait pencher la sélection vers des candidats dont l'estimation
   * tombe dans la bande voulue. 0 = on ne retient que le budget DRS.
   */
  poidsCoherenceNr: number;
  /** Nombre de candidats explorés par génération. */
  essaisGeneration: number;
  /** Nombre de variantes renvoyées. */
  variantes: number;
  /** Itérations Monte-Carlo pour la simulation affichée. */
  iterationsSimulation: number;
  /**
   * Dégâts ajoutés par niveau aux archétypes du mode simplifié.
   *
   * HYPOTHÈSE DU LOGICIEL — pas une règle COF2. Les règles officielles donnent
   * aux dégâts d'une arme : dé de l'arme + Mod. de FOR (contact uniquement,
   * aucun Mod. à distance — DRS « Dommages »). Un PJ ne gagne donc PAS de
   * dégâts par niveau directement ; il gagne des capacités de voie qui
   * utilisent le DÉ ÉVOLUTIF (d4° : d4 niv.1-5, d6 6-8, d8 9-11, d10 12-14,
   * d12 15+). Ce coefficient approxime cette progression de capacités.
   * 0 = dégâts strictement « arme + Mod. » (aucune capacité modélisée).
   */
  progressionDegatsParNiveau: number;
  /**
   * DEF ajoutée par niveau aux archétypes du mode simplifié.
   *
   * HYPOTHÈSE DU LOGICIEL — pas une règle de base COF2. La DEF officielle est
   * « 10 + AGI + Équipement + Mod. » sans terme de niveau. Mais la règle de
   * progression (DRS « Progression et niveaux ») donne **2 points de capacité
   * par niveau**, et de nombreuses capacités achetées ainsi ajoutent de la DEF :
   * Armure de mana (+3/+4), Peau d'écorce (+2 puis +1), Vêtements sacrés
   * (+2/+3/+4), Runes de défense (+2), Armure de vent (+2/+3), Peau de pierre
   * (+1/+2), Vitesse du félin (+1/+2/+3), Armure d'os (+3). L'équipement
   * s'améliore aussi avec les moyens du personnage.
   * Sans ce terme, un groupe de niveau 15 garderait la DEF d'un débutant et
   * toutes les créatures le toucheraient automatiquement, ce qui fausse la
   * calibration aux niveaux élevés. 0 = DEF strictement « 10+AGI+Équipement ».
   */
  progressionDefParNiveau: number;
  /**
   * Exposant appliqué au rapport d'actions dans le ratio de puissance.
   *
   * Le ratio de puissance de base compare les PV et le DPR agrégés des deux
   * camps. Il ne voit pas l'ÉCONOMIE D'ACTIOns : à puissance agrégée égale,
   * le camp qui agit plus souvent l'emporte, et chaque PJ mis KO retire
   * définitivement ses actions au groupe (cascade que la somme des PV ne
   * décrit pas). On multiplie donc le ratio par
   * (actionsEnnemis/actionsParti)^exposant.
   * 0 = ratio purement agrégé (les actions ne sont pas prises en compte).
   */
  exposantEconomieActions: number;
}

export interface OptionsGeneration {
  groupe: GroupePJ;
  bestiaire: MonsterTemplate[];
  difficulte: DifficulteRencontre;
  contexte: ContexteRencontre;
  /** Slots imposés (verrouillés) : conservés tels quels. */
  verrous?: SlotRencontre[];
  configuration?: Partial<ConfigurationMoteur>;
  /** Graine explicite (sinon contexte.graine ou aléatoire). */
  graine?: number;
}

export interface ResultatGeneration {
  difficulte: DifficulteRencontre;
  cibleNr: number;
  ciblePm: number;
  candidats: EvaluationRencontre[];
  avertissements: string[];
  /** true si au moins un candidat respecte la tolérance de budget. */
  cibleAtteinte: boolean;
  graine: number;
}

export type EtatCombatSimule = "victoire" | "defaite" | "nul";

export interface ResultatSimulation {
  iterations: number;
  victoires: number;
  defaites: number;
  nuls: number;
  tauxVictoire: number;
  tauxDefaite: number;
  tauxNul: number;
  roundsMoyens: number;
  pvPerdusMoyens: number;
  pvPerdusPct: number;
  koMoyens: number;
  ressourcesDepenseesPct: number;
  /** Nombre de simulations où au moins un PJ est tombé. */
  tauxAuMoinsUnKo: number;
  /** true si le groupe a été anéanti. */
  tauxTpk: number;
}
