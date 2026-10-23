// Tables et constantes de référence du générateur de rencontres.
//
// IMPORTANT — ne pas confondre :
// - La table NC -> Pm ci-dessous est la table publiée dans les règles COF2
//   en ligne (DRS, page « Nombre de créatures »). C'est la base de budget.
// - Les objectifs Facile / Normal / Boss sont des objectifs du logiciel, pas
//   des catégories officielles de l'éditeur. Ils sont traduits en décalages de
//   NR explicitement affichés et configurables.
// - Les coefficients tactiques (poids, log, bornes) sont des estimations du
//   logiciel, documentées et testables. Ils ne sont jamais présentés comme
//   des règles officielles.

import type {
  ConfigurationMoteur,
  DifficulteRencontre,
  EditionCreature,
  RoleCreature,
  TerrainRencontre,
  TypeRencontre,
} from "@/src/lib/encounters/types";

/** Table NC -> Pm publiée dans le DRS COF2. */
export const TABLE_PM_DRS: Record<string, number> = {
  "0": 3,
  "0.5": 5,
  "1": 10,
  "2": 20,
  "3": 40,
  "4": 70,
  "5": 100,
  "6": 150,
  "7": 200,
  "8": 250,
  "9": 320,
  "10": 400,
  "11": 500,
  "12": 600,
  "13": 700,
  "14": 850,
  "15": 1000,
  "16": 1200,
  "17": 1400,
  "18": 1600,
  "19": 1800,
  "20": 2000,
};

export const SOURCES = {
  tablePm: {
    libelle: "Table NC → Pm (DRS COF2, « Nombre de créatures »)",
    url: "https://www.co-drs.org/fr/jeu/regles/rencontres/les-creatures/creer-une-rencontre/nombre-de-creatures",
    statut: "Règle publiée dans le DRS",
  },
  nombrePj: {
    libelle: "Ajustement du budget par nombre de PJ (DRS COF2, « Nombre de PJ »)",
    url: "https://www.co-drs.org/fr/jeu/regles/rencontres/les-creatures/creer-une-rencontre/nombre-de-pj",
    statut: "Règle publiée dans le DRS",
  },
  difficulte: {
    libelle: "Repères de difficulté (DRS COF2, « Créer une rencontre »)",
    url: "https://www.co-drs.org/fr/jeu/regles/rencontres/les-creatures/creer-une-rencontre",
    statut: "Repères de règle ; les libellés Facile/Normal/Boss sont des objectifs du logiciel",
  },
  conditions: {
    libelle: "Conditions difficiles (DRS COF2)",
    url: "https://www.co-drs.org/fr/jeu/regles/rencontres/les-creatures/creer-une-rencontre/conditions-difficiles",
    statut: "Règle publiée dans le DRS",
  },
  surprise: {
    libelle: "Surprise (DRS COF2)",
    url: "https://www.co-drs.org/fr/jeu/regles/le-combat/surprise",
    statut: "Règle publiée dans le DRS",
  },
  attaques: {
    libelle: "Résolution des attaques et des DM (DRS COF2)",
    url: "https://www.co-drs.org/fr/jeu/regles/le-combat/resolution-des-attaques",
    statut: "Règle publiée dans le DRS",
  },
  populationAuteur: {
    libelle: "Table POP proposée par l'auteur sur le forum BBE (2024)",
    url: "https://black-book-editions.fr/forums.php?topic_id=73351",
    statut: "Proposition d'auteur, annoncée pour un ouvrage futur — NON utilisée comme règle officielle",
  },
} as const;

/** Table POP de la proposition d'auteur 2024. Sert uniquement de contrôle croisé. */
export const TABLE_POP_AUTEUR_2024: Record<string, number> = {
  "0": 2,
  "0.5": 5,
  "1": 10,
  "2": 20,
  "3": 40,
  "4": 60,
  "5": 90,
  "6": 120,
  "7": 160,
  "8": 200,
  "9": 250,
  "10": 300,
  "11": 350,
  "12": 400,
  "13": 450,
  "14": 500,
  "15": 550,
  "16": 600,
  "17": 650,
  "18": 700,
  "19": 750,
  "20": 800,
};

export const LIBELLES_DIFFICULTE: Record<DifficulteRencontre, { nom: string; description: string; couleur: string }> = {
  facile: {
    nom: "Facile",
    description:
      "Combat maîtrisable : risque limité, consommation modeste. Objectif logiciel : environ 2 niveaux de rencontre sous le groupe, d'après le repère DRS « une étape 1 à 2 niveaux sous les PJ ».",
    couleur: "emerald",
  },
  normal: {
    nom: "Normal",
    description:
      "Combat réellement exigeant : le groupe doit utiliser ses capacités, des blessures et une dépense importante sont possibles. Objectif logiciel : NR au niveau du groupe, repère DRS de la rencontre « assez difficile ».",
    couleur: "amber",
  },
  boss: {
    nom: "Boss",
    description:
      "Affrontement majeur : un adversaire distinctif, des soutiens éventuels, un danger élevé. Objectif logiciel : NR un niveau au-dessus du groupe, repère DRS du « climax particulièrement ardu », avec règles de composition boss.",
    couleur: "red",
  },
};

export const LIBELLES_TYPE: Record<TypeRencontre, string> = {
  bataille: "Bataille rangée",
  embuscade: "Embuscade",
  assaut: "Assaut",
  defense: "Défense",
  poursuite: "Poursuite",
  boss: "Confrontation de boss",
};

export const DESCRIPTIONS_TYPE: Record<TypeRencontre, string> = {
  bataille: "Bataille rangée, les deux camps se voient et se préparent.",
  embuscade: "Le camp ennemi tend une embuscade (avantage possible à la surprise).",
  assaut: "Les PJ attaquent un lieu préparé : couvert, défenseurs, réserves.",
  defense: "Les PJ défendent une position : terrain et réserves comptent.",
  poursuite: "Combat mobile : distances, fuites et attaques à distance.",
  boss: "Confrontation finale : un boss identifiable et ses soutiens.",
};

export interface TerrainRegle {
  nom: string;
  description: string;
  /** Malus officiel aux attaques/DEF des PJ (conditions difficiles DRS). */
  malusAttaqueDefense: number;
  /** Ajustement de NR officiel des conditions (DRS). */
  ajustementNr: number;
  /** Malus de dégâts éventuel (sous l'eau : -5 sauf armes perçantes). */
  facteurDegatsParti: number;
  /** Note de source / hypothèse. */
  note: string;
}

export const TERRAINS: Record<TerrainRencontre, TerrainRegle> = {
  plaine: {
    nom: "Plaine dégagée",
    description: "Terrain neutre, peu de couvert.",
    malusAttaqueDefense: 0,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Aucun modificateur officiel.",
  },
  foret: {
    nom: "Forêt / taillis",
    description: "Couvert et lignes de vue cassées ; les créatures adaptées en profitent.",
    malusAttaqueDefense: 0,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Aucun malus chiffré officiel par défaut. Le couvert est laissé à l'appréciation du MJ (non modélisé).",
  },
  ruines: {
    nom: "Ruines / décombres",
    description: "Équilibre précaire, passages encombrés.",
    malusAttaqueDefense: -2,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Conditions hostiles DRS : −2 aux tests de FOR/AGI, en attaque et en DEF. Le NC n'augmente pas.",
  },
  souterrain: {
    nom: "Souterrain",
    description: "Galeries, plafonds bas, lumière incertaine.",
    malusAttaqueDefense: 0,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Neutre si les PJ ont de la lumière. Utiliser « Obscurité » pour le noir total.",
  },
  interieur: {
    nom: "Intérieur / donjon",
    description: "Pièces, portes, mobilier, défenseurs retranchés.",
    malusAttaqueDefense: 0,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Aucun modificateur officiel global.",
  },
  montagne: {
    nom: "Montagne / escarpement",
    description: "Pentes, éboulis, souffle court.",
    malusAttaqueDefense: -2,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Conditions hostiles DRS : −2 aux tests de FOR/AGI, en attaque et en DEF.",
  },
  neige: {
    nom: "Neige / blizzard",
    description: "Froid, sol glissant, visibilité réduite.",
    malusAttaqueDefense: -2,
    ajustementNr: 0,
    facteurDegatsParti: 1,
    note: "Conditions hostiles DRS : −2 aux tests de FOR/AGI, en attaque et en DEF.",
  },
  eau: {
    nom: "Sous l'eau",
    description: "Déplacements divisés par 2, armes non perçantes émoussées.",
    malusAttaqueDefense: -5,
    ajustementNr: 2,
    facteurDegatsParti: 0.8,
    note: "Conditions extrêmes + sous l'eau (DRS) : −5 attaque/DEF, −5 DM sauf armes perçantes, NC +2. Le malus de DM est approximé par un facteur 0,8.",
  },
  obscurite: {
    nom: "Obscurité / invisible",
    description: "Les PJ combattent sans voir, l'adversaire est adapté.",
    malusAttaqueDefense: -5,
    ajustementNr: 1,
    facteurDegatsParti: 1,
    note: "Conditions extrêmes DRS : −5 aux tests de FOR/AGI, en attaque et en DEF, NC +1.",
  },
};

export const DESCRIPTIONS_SURPRISE = {
  aucune: "Aucun camp ne commence surpris.",
  pj: "Les PJ surprennent les ennemis : le camp ennemi perd son premier tour (règle DRS de surprise).",
  ennemis: "Les ennemis surprennent les PJ : le groupe perd son premier tour.",
} as const;

/** Facteurs de surprise approximatifs pour le calcul de danger (pas une règle). */
export const FACTEURS_SURPRISE = { aucune: 1, pj: 0.85, ennemis: 1.18 } as const;

export const LIBELLES_EDITION: Record<EditionCreature, string> = {
  cof2: "COF2 (DRS)",
  cof1: "COF1 (V1)",
  "hors-drs": "Hors DRS (maison / compagnon)",
};

export const LIBELLES_ROLE: Record<RoleCreature, string> = {
  combattant: "Combattant",
  tireur: "Tireur",
  soutien: "Soutien",
  controleur: "Contrôleur",
  elite: "Élite",
  boss: "Boss",
  sbire: "Sbire",
  animal: "Animal",
};

/** Rôles qui apportent une mécanique intéressante à un boss. */
export const ROLES_BOSS_INTERESSANTS: RoleCreature[] = ["controleur", "soutien", "tireur", "elite"];

export const CONFIGURATION_PAR_DEFAUT: ConfigurationMoteur = {
  tablePm: TABLE_PM_DRS,
  // Décalage de budget demandé par difficulté. Le boss est calibré à +1,5 NR
  // (et non +1) : avec +1, la calibration Monte-Carlo donnait des boss PLUS
  // FACILES que les rencontres normales de même niveau (75 % de victoires contre
  // 67 % au niveau 8). Un boss doit être une menace nettement supérieure.
  decalageNr: { facile: -2, normal: 0, boss: 1.5 },
  toleranceNr: { facile: 0.6, normal: 0.6, boss: 0.75 },
  // Poids de la correction tactique : 0 = budget DRS seul, 1 = toute la
  // correction. Valeur choisie pour que le budget reste la colonne vertébrale.
  poidsTactique: 0.65,
  // Conversion ratio de puissance -> décalage NR. 1,35 signifie qu'un camp
  // 35 % plus puissant vaut environ +1 NR dans le modèle.
  baseLogPuissance: 1.35,
  correctionTactiqueMin: -2.5,
  correctionTactiqueMax: 2.5,
  maxCreatures: 12,
  poidsQualite: 1,
  // Le budget DRS reste la colonne vertébrale (poids 3.2 dans le score) mais
  // la sélection refuse aussi les candidats dont l'estimation de difficulté
  // sort de la bande demandée : un « normal » annoncé mais joué en « boss »
  // est un échec de génération.
  poidsCoherenceNr: 4,
  essaisGeneration: 400,
  variantes: 3,
  iterationsSimulation: 250,
  // Hypothèse du logiciel sur la progression des dégâts des archétypes (mode
  // simplifié). En COF2 les dégâts = dé de l'arme + Mod. de FOR (contact
  // seulement) ; un PJ gagne en dégâts par ses capacités de voie (dés
  // évolutifs), pas par niveau. Ce coefficient approxime cette progression.
  // Calibré pour qu'une rencontre au budget exact du niveau reste « assez
  // difficile » (DRS) à tous les niveaux testés (1, 3, 5, 8, 11, 15).
  progressionDegatsParNiveau: 0.5,
  // Progression de DEF (capacités achetées avec les 2 points de capacité par
  // niveau + meilleur équipement). Voir types.ts pour la liste des capacités.
  progressionDefParNiveau: 0.3,
  // Poids de l'économie d'actions dans le ratio de puissance. Voit la cascade
  // des PJ KO que la comparaison PV × DPR agrégés ignore.
  exposantEconomieActions: 0.4,
};

export function configurerMoteur(partiel?: Partial<ConfigurationMoteur>): ConfigurationMoteur {
  if (!partiel) return { ...CONFIGURATION_PAR_DEFAUT, tablePm: { ...TABLE_PM_DRS } };
  return {
    ...CONFIGURATION_PAR_DEFAUT,
    ...partiel,
    tablePm: partiel.tablePm ?? { ...TABLE_PM_DRS },
    decalageNr: { ...CONFIGURATION_PAR_DEFAUT.decalageNr, ...(partiel.decalageNr ?? {}) },
    toleranceNr: { ...CONFIGURATION_PAR_DEFAUT.toleranceNr, ...(partiel.toleranceNr ?? {}) },
  };
}

function clesNumeriques(table: Record<string, number>): number[] {
  return Object.keys(table)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

/** Convertit un NC en Pm (interpolation linéaire entre les paliers). */
export function pmPourNc(nc: number, table: Record<string, number> = TABLE_PM_DRS): number {
  if (!Number.isFinite(nc) || nc <= 0) return nc === 0 ? (table["0"] ?? 3) : 0;
  const cles = clesNumeriques(table);
  const exact = table[String(nc)];
  if (exact !== undefined) return exact;
  const bas = [...cles].reverse().find((k) => k < nc);
  const haut = cles.find((k) => k > nc);
  if (bas === undefined && haut === undefined) return 0;
  if (bas === undefined) return table[String(haut)] * (nc / (haut as number));
  if (haut === undefined) {
    // Au-delà du dernier palier : +200 Pm par NC (prolongement documenté).
    return table[String(bas)] + (nc - bas) * 200;
  }
  const p1 = table[String(bas)];
  const p2 = table[String(haut)];
  return p1 + ((p2 - p1) * (nc - bas)) / (haut - bas);
}

/** Inverse la table : Pm -> NR (interpolation linéaire). */
export function nrPourPm(pm: number, table: Record<string, number> = TABLE_PM_DRS): number {
  if (!Number.isFinite(pm) || pm <= 0) return 0;
  const cles = clesNumeriques(table);
  if (pm <= table[String(cles[0])]) {
    const p0 = table[String(cles[0])];
    return cles[0] * (pm / Math.max(1, p0));
  }
  for (let i = 1; i < cles.length; i++) {
    const p1 = table[String(cles[i - 1])];
    const p2 = table[String(cles[i])];
    if (pm <= p2) {
      const t = (pm - p1) / Math.max(1, p2 - p1);
      return cles[i - 1] + t * (cles[i] - cles[i - 1]);
    }
  }
  const dernier = cles[cles.length - 1];
  return dernier + (pm - table[String(dernier)]) / 200;
}

/** Pm correspondant à un NR (même table, utilisée dans l'autre sens). */
export function pmPourNr(nr: number, table: Record<string, number> = TABLE_PM_DRS): number {
  return pmPourNc(nr, table);
}

/** Budget Pm ajusté au nombre de PJ (règle DRS : × nombre de PJ / 4). */
export function echellePm(nombrePj: number): number {
  return Math.max(1, nombrePj) / 4;
}

export function ciblePm(nr: number, nombrePj: number, table: Record<string, number> = TABLE_PM_DRS): number {
  return pmPourNr(nr, table) * echellePm(nombrePj);
}

/** Catégorie estimée à partir de l'écart entre NR estimé et niveau effectif. */
export function classerDifficulte(deltaDanger: number): DifficulteRencontre {
  if (deltaDanger <= -1.25) return "facile";
  if (deltaDanger < 0.6) return "normal";
  return "boss";
}

/** Convertit un ratio de puissance en décalage NR (estimation du logiciel). */
export function ratioVersCorrectionNr(ratio: number, configuration: ConfigurationMoteur): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return configuration.correctionTactiqueMin;
  const brut = Math.log(ratio) / Math.log(configuration.baseLogPuissance);
  return Math.max(
    configuration.correctionTactiqueMin,
    Math.min(configuration.correctionTactiqueMax, brut * configuration.poidsTactique)
  );
}

/** Probabilité de toucher avec 1d20 + bonus contre une DEF (20 naturel = critique). */
export function probabiliteToucher(bonus: number, defense: number): number {
  if (!Number.isFinite(bonus) || !Number.isFinite(defense)) return 0.5;
  // 20 naturel touche toujours ; le 1 n'est pas une échec automatique en COF.
  const necessaire = defense - bonus;
  const reussites = Math.max(1, Math.min(20, 20 - necessaire + 1));
  return Math.max(0.05, Math.min(1, reussites / 20));
}

/** Probabilité de critique (20 naturel). */
export const PROBABILITE_CRITIQUE = 1 / 20;

/** Moyenne d'une expression de dégâts COF ("2d6+3", "1d1-1"). */
export function moyenneDegats(expression: string): number {
  const m = /^\s*(\d*)\s*[dD]\s*(\d+)\s*(?:°)?\s*([+-]\s*\d+)?\s*$/.exec(expression ?? "");
  if (!m) return 0;
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3].replace(/\s+/g, "")) : 0;
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return 0;
  return Math.max(0, count * ((sides + 1) / 2) + mod);
}

/** Dégâts attendus d'une attaque contre une DEF (critique inclus, DM doublés). */
export function degatsAttendus(bonus: number, defense: number, degatsMoyens: number, toucheAuto = false): number {
  if (toucheAuto) return degatsMoyens;
  const touche = probabiliteToucher(bonus, defense);
  return touche * degatsMoyens * (1 + PROBABILITE_CRITIQUE);
}

export function normaliserTheme(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function difficulteDepuisLibelle(texte: string): DifficulteRencontre {
  const t = normaliserTheme(texte);
  if (t.includes("boss")) return "boss";
  if (t.includes("facile")) return "facile";
  return "normal";
}
