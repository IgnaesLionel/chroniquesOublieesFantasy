// Générateur de PNJ — modèle de données pur (sans React ni stockage).
// Les tables sont administrables : toute liste affichée par l'interface vient
// de la base locale, jamais d'une constante cachée dans un composant.

import type { AttackDef, Caracteristiques } from "@/src/lib/rules/types";

export type ImportancePnj = "figuration" | "secondaire" | "important" | "majeur";
export type NiveauSocial = "precaire" | "modeste" | "aise" | "riche" | "puissant";
export type SexePnj = "masculin" | "feminin";
export type DetailPnj = "court" | "standard" | "detaille";
export type PalierPuissance = "faible" | "moyen" | "fort" | "elite";

export const IMPORTANCES: ImportancePnj[] = ["figuration", "secondaire", "important", "majeur"];
export const IMPORTANCE_LABEL: Record<ImportancePnj, string> = {
  figuration: "Figuration",
  secondaire: "Secondaire",
  important: "Important",
  majeur: "Majeur",
};

export const NIVEAUX_SOCIAUX: NiveauSocial[] = ["precaire", "modeste", "aise", "riche", "puissant"];
export const NIVEAU_SOCIAL_LABEL: Record<NiveauSocial, string> = {
  precaire: "Précaire",
  modeste: "Modeste",
  aise: "Aisé",
  riche: "Riche",
  puissant: "Puissant",
};

export const SEXES: SexePnj[] = ["masculin", "feminin"];
export const SEXE_LABEL: Record<SexePnj, string> = {
  masculin: "Masculin",
  feminin: "Féminin",
};

export const DETAILS: DetailPnj[] = ["court", "standard", "detaille"];
export const DETAIL_LABEL: Record<DetailPnj, string> = {
  court: "Court",
  standard: "Standard",
  detaille: "Détaillé",
};

export const PALIERS_PUISSANCE: PalierPuissance[] = ["faible", "moyen", "fort", "elite"];
export const PALIER_LABEL: Record<PalierPuissance, string> = {
  faible: "Faible",
  moyen: "Moyen",
  fort: "Fort",
  elite: "Élite",
};

export const REFERENCE_CATEGORIES = [
  "Identité",
  "Apparence",
  "Social",
  "Personnalité",
  "Narratif",
  "Relations",
  "Équipement",
  "Règles",
] as const;
export type ReferenceCategorie = (typeof REFERENCE_CATEGORIES)[number];

/** Conditions lisibles et combinables appliquées aux entrées d'une table. */
export interface ConditionsGeneration {
  sexes?: string[];
  especes?: string[];
  cultures?: string[];
  professions?: string[];
  categoriesProfession?: string[];
  niveauxSociaux?: string[];
  importances?: string[];
  tagsRequis?: string[];
  tagsExclus?: string[];
}

/** Métadonnées structurées d'une entrée (culture, sexe, catégorie de métier…). */
export type MetaReference = Record<string, string | number | boolean | string[] | null>;

export interface ReferenceTable {
  id: string;
  nom: string;
  categorie: ReferenceCategorie;
  description: string;
  /** Table utilisée pour la génération : une table inactive reste consultable. */
  actif: boolean;
  /** Ordre d'affichage dans l'administration. */
  ordre: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceEntry {
  id: string;
  tableId: string;
  valeur: string;
  description?: string;
  categorie?: string;
  tags: string[];
  /** Poids relatif : 0 = jamais tiré, 10 = poids courant. */
  poids: number;
  actif: boolean;
  conditions: ConditionsGeneration;
  meta: MetaReference;
  /** Provenance : graine livrée, création MJ, import… */
  source: "graine" | "mj" | "import";
  createdAt: string;
  updatedAt: string;
}

export interface PersonnalitePnj {
  traitsPositifs: string[];
  traitsNegatifs: string[];
  traitsAmbivalents: string[];
  qualitesMorales: string[];
  defauts: string[];
  peurs: string[];
  prejuges: string[];
  habitudes: string[];
  ticsVerbaux: string[];
  expressions: string[];
  reactionsPression: string[];
  attitudeAutorite: string;
  attitudeDanger: string;
  attitudeArgent: string;
  attitudeMagie: string;
  styleNegociation: string;
  styleMensonge: string;
  styleSeduction: string;
  styleMenace: string;
}

export interface MotivationsPnj {
  objectifImmediat: string;
  ambition: string;
  desir: string;
  besoin: string;
  secret: string;
  mensonge: string;
  regret: string;
  probleme: string;
  dette: string;
  objetRecherche: string;
  personneProtegee: string;
  personneRecherchee: string;
  conflit: string;
  rumeur: string;
  opportunite: string;
  raisonCooperation: string;
  raisonOpposition: string;
}

export interface RoleplayPnj {
  accroche: string;
  attitudeInitiale: string;
  raisonAttitude: string;
  premiereReaction: string;
  offre: string;
  demande: string;
  levier: string;
  declencheurHostilite: string;
  fuite: string;
}

export interface EtatChamp {
  verrouille: boolean;
  sourceTableId?: string;
  sourceEntryId?: string;
  mode: "table" | "profil" | "manuel" | "bestiaire" | "estimation";
}

export interface NpcRelation {
  id: string;
  nom: string;
  type: string;
  intensite: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  description: string;
  publique: boolean;
}

export interface NpcGen {
  id: string;
  prenom: string;
  nomFamille: string;
  nom: string;
  titre: string;
  espece: string;
  culture: string;
  sexe: SexePnj;
  age: number;
  tailleCm: number;
  poidsKg: number;
  profession: string;
  role: string;
  categorieProfession: string;
  niveauSocial: NiveauSocial;
  importance: ImportancePnj;
  description: string;
  apparence: string;
  maintien: string;
  voix: string;
  vetements: string;
  gestes: string;
  signesDistinctifs: string;
  particularites: string;
  personnalite: PersonnalitePnj;
  motivations: MotivationsPnj;
  roleplay: RoleplayPnj;
  equipement: string[];
  objetsValeurs: string[];
  objetsPersonnels: string[];
  objetsSuspects: string[];
  objetsMagiques: string[];
  documents: string[];
  tags: string[];
  factionId: string;
  factionNom: string;
  lieu: string;
  relations: NpcRelation[];
  notesMJ: string;
  seed: string;
  /** Un champ verrouillé garde sa valeur lors des régénérations globales. */
  champs: Record<string, EtatChamp>;
  statBlockId?: string;
  createdAt: string;
  updatedAt: string;
  version: 1;
}

export interface NpcStatBlock {
  id: string;
  npcId: string;
  source: "estimation" | "bestiaire";
  palier: PalierPuissance;
  niveau: number;
  pv: number;
  defense: number;
  initMod: number;
  caracteristiques?: Caracteristiques;
  attaques: AttackDef[];
  capacites: string[];
  monsterId?: string;
  monsterNom?: string;
  notes: string;
  updatedAt: string;
}

export interface Faction {
  id: string;
  nom: string;
  type: string;
  description: string;
  objectif: string;
  methode: string;
  territoire: string;
  tags: string[];
  secret: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Association d'un PNJ à une campagne/session, un scénario ou une scène. */
export interface NpcPlacement {
  id: string;
  npcId: string;
  sessionId: string;
  scenarioId: string;
  sceneId: string;
  role: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NpcGenerationOptions {
  seed?: string;
  profileId?: string;
  espece?: string;
  culture?: string;
  sexe?: SexePnj;
  profession?: string;
  categorieProfession?: string;
  niveauSocial?: NiveauSocial;
  importance?: ImportancePnj;
  detail?: DetailPnj;
  tags?: string[];
  exclureTags?: string[];
  factionId?: string;
  lieu?: string;
  genererCombat?: boolean;
  palierPuissance?: PalierPuissance;
  /** Champs déjà verrouillés : leur valeur est conservée telle quelle. */
  verrous?: string[];
  /** Valeurs de départ pour préserver les champs verrouillés. */
  base?: Partial<NpcGen>;
}

export interface NpcProfile {
  id: string;
  nom: string;
  description: string;
  options: NpcGenerationOptions;
  tags: string[];
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResultatGeneration {
  npc: NpcGen;
  statBlock?: NpcStatBlock;
  warnings: string[];
  seed: string;
  tablesUtilisees: string[];
}

/** Identifiants stables : les graines sont fusionnées sans doublon. */
export const TABLE_IDS = {
  especes: "especes",
  sexes: "sexes",
  cultures: "cultures",
  prenomsMasculins: "prenoms_masculins",
  prenomsFeminins: "prenoms_feminins",
  nomsFamille: "noms_famille",
  tranchesAge: "tranches_age",
  tailles: "tailles",
  corpulences: "corpulences",
  carnations: "carnations",
  cheveux: "cheveux",
  yeux: "yeux",
  visages: "visages",
  voix: "voix",
  particularitesPhysiques: "particularites_physiques",
  signesDistinctifs: "signes_distinctifs",
  maintien: "maintien",
  hygiene: "hygiene",
  demarche: "demarche",
  gestes: "gestes",
  vetements: "vetements",
  professions: "professions",
  niveauxSociaux: "niveaux_sociaux",
  importances: "importances",
  lieux: "lieux",
  traitsPositifs: "traits_positifs",
  traitsNegatifs: "traits_negatifs",
  traitsAmbivalents: "traits_ambivalents",
  qualitesMorales: "qualites_morales",
  defauts: "defauts",
  peurs: "peurs",
  prejuges: "prejuges",
  habitudes: "habitudes",
  ticsVerbaux: "tics_verbaux",
  expressions: "expressions",
  reactionsPression: "reactions_pression",
  attitudesAutorite: "attitudes_autorite",
  attitudesDanger: "attitudes_danger",
  attitudesArgent: "attitudes_argent",
  attitudesMagie: "attitudes_magie",
  stylesNegociation: "styles_negociation",
  stylesMensonge: "styles_mensonge",
  stylesSeduction: "styles_seduction",
  stylesMenace: "styles_menace",
  objectifsImmediats: "objectifs_immediats",
  ambitions: "ambitions",
  desirs: "desirs",
  besoins: "besoins",
  secrets: "secrets",
  mensonges: "mensonges",
  regrets: "regrets",
  problemes: "problemes",
  dettes: "dettes",
  objetsRecherches: "objets_recherches",
  personnesProtegees: "personnes_protegees",
  personnesRecherchees: "personnes_recherchees",
  conflits: "conflits",
  rumeurs: "rumeurs",
  opportunites: "opportunites",
  raisonsCooperation: "raisons_cooperation",
  raisonsOpposition: "raisons_opposition",
  accroches: "accroches",
  attitudesInitiales: "attitudes_initiales",
  raisonsAttitude: "raisons_attitude",
  premieresReactions: "premieres_reactions",
  offres: "offres",
  demandes: "demandes",
  leviers: "leviers",
  declencheursHostilite: "declencheurs_hostilite",
  fuites: "fuites",
  equipements: "equipements",
  objetsValeurs: "objets_valeurs",
  objetsPersonnels: "objets_personnels",
  objetsSuspects: "objets_suspects",
  objetsMagiques: "objets_magiques",
  documents: "documents",
  reglesCompatibilite: "regles_compatibilite",
  paliersPuissance: "paliers_puissance",
} as const;

export type TableId = (typeof TABLE_IDS)[keyof typeof TABLE_IDS];

export const TABLE_LABEL: Record<TableId, string> = {
  especes: "Espèces",
  sexes: "Sexes",
  cultures: "Cultures",
  prenoms_masculins: "Prénoms masculins",
  prenoms_feminins: "Prénoms féminins",
  noms_famille: "Noms de famille",
  tranches_age: "Tranches d'âge",
  tailles: "Tailles",
  corpulences: "Corpulences",
  carnations: "Carnations",
  cheveux: "Cheveux",
  yeux: "Yeux",
  visages: "Visages",
  voix: "Voix",
  particularites_physiques: "Particularités physiques",
  signes_distinctifs: "Signes distinctifs",
  maintien: "Maintien",
  hygiene: "Hygiène",
  demarche: "Démarche",
  gestes: "Gestes",
  vetements: "Vêtements",
  professions: "Professions",
  niveaux_sociaux: "Niveaux sociaux",
  importances: "Importances",
  lieux: "Lieux",
  traits_positifs: "Traits positifs",
  traits_negatifs: "Traits négatifs",
  traits_ambivalents: "Traits ambivalents",
  qualites_morales: "Qualités morales",
  defauts: "Défauts",
  peurs: "Peurs",
  prejuges: "Préjugés",
  habitudes: "Habitudes",
  tics_verbaux: "Tics verbaux",
  expressions: "Expressions",
  reactions_pression: "Réactions à la pression",
  attitudes_autorite: "Attitude envers l'autorité",
  attitudes_danger: "Attitude face au danger",
  attitudes_argent: "Attitude face à l'argent",
  attitudes_magie: "Attitude face à la magie",
  styles_negociation: "Styles de négociation",
  styles_mensonge: "Styles de mensonge",
  styles_seduction: "Styles de séduction",
  styles_menace: "Styles de menace",
  objectifs_immediats: "Objectifs immédiats",
  ambitions: "Ambitions",
  desirs: "Désirs",
  besoins: "Besoins",
  secrets: "Secrets",
  mensonges: "Mensonges",
  regrets: "Regrets",
  problemes: "Problèmes actuels",
  dettes: "Dettes",
  objets_recherches: "Objets recherchés",
  personnes_protegees: "Personnes à protéger",
  personnes_recherchees: "Personnes recherchées",
  conflits: "Conflits",
  rumeurs: "Rumeurs",
  opportunites: "Opportunités",
  raisons_cooperation: "Raisons de coopérer",
  raisons_opposition: "Raisons de s'opposer",
  accroches: "Accroches narratives",
  attitudes_initiales: "Attitudes initiales",
  raisons_attitude: "Raisons de l'attitude",
  premieres_reactions: "Premières réactions",
  offres: "Offres",
  demandes: "Demandes",
  leviers: "Leviers",
  declencheurs_hostilite: "Déclencheurs d'hostilité",
  fuites: "Façons de fuir",
  equipements: "Équipements",
  objets_valeurs: "Objets de valeur",
  objets_personnels: "Objets personnels",
  objets_suspects: "Objets suspects",
  objets_magiques: "Objets magiques",
  documents: "Documents",
  regles_compatibilite: "Règles de compatibilité",
  paliers_puissance: "Paliers de puissance",
};

/** Champs que l'éditeur peut verrouiller et régénérer séparément. */
export const CHAMPS_GENERABLES: { chemin: string; label: string; groupe: string }[] = [
  { chemin: "prenom", label: "Prénom", groupe: "Identité" },
  { chemin: "nomFamille", label: "Nom de famille", groupe: "Identité" },
  { chemin: "espece", label: "Espèce", groupe: "Identité" },
  { chemin: "culture", label: "Culture", groupe: "Identité" },
  { chemin: "sexe", label: "Sexe", groupe: "Identité" },
  { chemin: "age", label: "Âge", groupe: "Identité" },
  { chemin: "profession", label: "Profession", groupe: "Social" },
  { chemin: "niveauSocial", label: "Niveau social", groupe: "Social" },
  { chemin: "importance", label: "Importance", groupe: "Social" },
  { chemin: "description", label: "Description", groupe: "Apparence" },
  { chemin: "apparence", label: "Apparence", groupe: "Apparence" },
  { chemin: "voix", label: "Voix", groupe: "Apparence" },
  { chemin: "vetements", label: "Vêtements", groupe: "Apparence" },
  { chemin: "signesDistinctifs", label: "Signes distinctifs", groupe: "Apparence" },
  { chemin: "personnalite", label: "Personnalité", groupe: "Personnalité" },
  { chemin: "motivations", label: "Motivations et secrets", groupe: "Narratif" },
  { chemin: "roleplay", label: "Réactions et roleplay", groupe: "Narratif" },
  { chemin: "equipement", label: "Équipement", groupe: "Équipement" },
  { chemin: "objetsValeurs", label: "Objets de valeur", groupe: "Équipement" },
  { chemin: "roleplay.accroche", label: "Accroche", groupe: "Narratif" },
];

export const CHAMP_LABEL: Record<string, string> = Object.fromEntries(
  CHAMPS_GENERABLES.map((c) => [c.chemin, c.label])
);

/** Lit un chemin simple ou pointé ("personnalite.peurs"). */
export function lireChamp(npc: NpcGen, chemin: string): unknown {
  return chemin.split(".").reduce<unknown>((valeur, cle) => {
    if (valeur && typeof valeur === "object" && cle in (valeur as Record<string, unknown>)) {
      return (valeur as Record<string, unknown>)[cle];
    }
    return undefined;
  }, npc);
}

/** Écrit un chemin simple ou pointé sans muter le PNJ. */
export function ecrireChamp(npc: NpcGen, chemin: string, valeur: unknown): NpcGen {
  const cles = chemin.split(".");
  const copie = structuredClone(npc) as unknown as Record<string, unknown>;
  let cible = copie;
  cles.slice(0, -1).forEach((cle) => {
    const suivant = cible[cle];
    cible[cle] = suivant && typeof suivant === "object" ? structuredClone(suivant) : {};
    cible = cible[cle] as Record<string, unknown>;
  });
  cible[cles[cles.length - 1]] = valeur;
  return copie as unknown as NpcGen;
}

export function estVerrouille(npc: Pick<NpcGen, "champs">, chemin: string): boolean {
  return npc.champs[chemin]?.verrouille ?? false;
}

export function nomComplet(prenom: string, nomFamille: string): string {
  return [prenom, nomFamille].filter((x) => x.trim().length > 0).join(" ");
}

/** Sépare les entrées réellement utilisables pour une table. */
export function entreesActives(entries: ReferenceEntry[], tableId: string): ReferenceEntry[] {
  return entries.filter((e) => e.tableId === tableId && e.actif && e.poids > 0);
}

export function tableActive(tables: ReferenceTable[], tableId: string): boolean {
  return tables.find((t) => t.id === tableId)?.actif ?? false;
}
