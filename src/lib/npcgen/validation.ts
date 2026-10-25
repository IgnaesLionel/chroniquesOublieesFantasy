import { z } from "zod";

// Validation des sauvegardes du module PNJ. Les champs récents sont optionnels
// avec des valeurs de repli afin de ne pas rejeter une sauvegarde antérieure.

const conditionsSchema = z
  .object({
    sexes: z.array(z.string()).optional(),
    especes: z.array(z.string()).optional(),
    cultures: z.array(z.string()).optional(),
    professions: z.array(z.string()).optional(),
    categoriesProfession: z.array(z.string()).optional(),
    niveauxSociaux: z.array(z.string()).optional(),
    importances: z.array(z.string()).optional(),
    tagsRequis: z.array(z.string()).optional(),
    tagsExclus: z.array(z.string()).optional(),
  })
  .default({});

const metaValeur = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

const metaSchema = z.record(z.string(), metaValeur).default({});

export const referenceTableSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  categorie: z.enum([
    "Identité", "Apparence", "Social", "Personnalité", "Narratif", "Relations", "Équipement", "Règles",
  ]),
  description: z.string().default(""),
  actif: z.boolean().default(true),
  ordre: z.number().int().default(0),
  version: z.number().int().min(1).default(1),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

export const referenceEntrySchema = z.object({
  id: z.string().min(1),
  tableId: z.string().min(1),
  valeur: z.string().min(1),
  description: z.string().optional(),
  categorie: z.string().optional(),
  tags: z.array(z.string()).default([]),
  poids: z.number().min(0).default(10),
  actif: z.boolean().default(true),
  conditions: conditionsSchema,
  meta: metaSchema,
  source: z.enum(["graine", "mj", "import"]).default("mj"),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

const etatChampSchema = z.object({
  verrouille: z.boolean().default(false),
  sourceTableId: z.string().optional(),
  sourceEntryId: z.string().optional(),
  mode: z.enum(["table", "profil", "manuel", "bestiaire", "estimation"]).default("table"),
});

const personnaliteSchema = z.object({
  traitsPositifs: z.array(z.string()).default([]),
  traitsNegatifs: z.array(z.string()).default([]),
  traitsAmbivalents: z.array(z.string()).default([]),
  qualitesMorales: z.array(z.string()).default([]),
  defauts: z.array(z.string()).default([]),
  peurs: z.array(z.string()).default([]),
  prejuges: z.array(z.string()).default([]),
  habitudes: z.array(z.string()).default([]),
  ticsVerbaux: z.array(z.string()).default([]),
  expressions: z.array(z.string()).default([]),
  reactionsPression: z.array(z.string()).default([]),
  attitudeAutorite: z.string().default(""),
  attitudeDanger: z.string().default(""),
  attitudeArgent: z.string().default(""),
  attitudeMagie: z.string().default(""),
  styleNegociation: z.string().default(""),
  styleMensonge: z.string().default(""),
  styleSeduction: z.string().default(""),
  styleMenace: z.string().default(""),
});

const motivationsSchema = z.object({
  objectifImmediat: z.string().default(""),
  ambition: z.string().default(""),
  desir: z.string().default(""),
  besoin: z.string().default(""),
  secret: z.string().default(""),
  mensonge: z.string().default(""),
  regret: z.string().default(""),
  probleme: z.string().default(""),
  dette: z.string().default(""),
  objetRecherche: z.string().default(""),
  personneProtegee: z.string().default(""),
  personneRecherchee: z.string().default(""),
  conflit: z.string().default(""),
  rumeur: z.string().default(""),
  opportunite: z.string().default(""),
  raisonCooperation: z.string().default(""),
  raisonOpposition: z.string().default(""),
});

const roleplaySchema = z.object({
  accroche: z.string().default(""),
  attitudeInitiale: z.string().default(""),
  raisonAttitude: z.string().default(""),
  premiereReaction: z.string().default(""),
  offre: z.string().default(""),
  demande: z.string().default(""),
  levier: z.string().default(""),
  declencheurHostilite: z.string().default(""),
  fuite: z.string().default(""),
});

const relationSchema = z.object({
  id: z.string().min(1),
  nom: z.string().default(""),
  type: z.string().default(""),
  intensite: z.union([
    z.literal(-3), z.literal(-2), z.literal(-1), z.literal(0),
    z.literal(1), z.literal(2), z.literal(3),
  ]),
  description: z.string().default(""),
  publique: z.boolean().default(true),
});

const caracteristiquesSchema = z.object({
  AGI: z.number(), CON: z.number(), FOR: z.number(), PER: z.number(),
  CHA: z.number(), INT: z.number(), VOL: z.number(),
}).catchall(z.number());

const attackSchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    bonus: z.number(),
    degats: z.string(),
  })
  .catchall(z.unknown());

export const npcGenSchema = z.object({
  id: z.string().min(1),
  prenom: z.string().default(""),
  nomFamille: z.string().default(""),
  nom: z.string().default(""),
  titre: z.string().default(""),
  espece: z.string().default(""),
  culture: z.string().default(""),
  sexe: z.enum(["masculin", "feminin"]).default("masculin"),
  age: z.number().int().min(0).default(0),
  tailleCm: z.number().int().min(0).default(0),
  poidsKg: z.number().int().min(0).default(0),
  profession: z.string().default(""),
  role: z.string().default(""),
  categorieProfession: z.string().default(""),
  niveauSocial: z.enum(["precaire", "modeste", "aise", "riche", "puissant"]).default("modeste"),
  importance: z.enum(["figuration", "secondaire", "important", "majeur"]).default("secondaire"),
  description: z.string().default(""),
  apparence: z.string().default(""),
  maintien: z.string().default(""),
  voix: z.string().default(""),
  vetements: z.string().default(""),
  gestes: z.string().default(""),
  signesDistinctifs: z.string().default(""),
  particularites: z.string().default(""),
  personnalite: personnaliteSchema,
  motivations: motivationsSchema,
  roleplay: roleplaySchema,
  equipement: z.array(z.string()).default([]),
  objetsValeurs: z.array(z.string()).default([]),
  objetsPersonnels: z.array(z.string()).default([]),
  objetsSuspects: z.array(z.string()).default([]),
  objetsMagiques: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  factionId: z.string().default(""),
  factionNom: z.string().default(""),
  lieu: z.string().default(""),
  relations: z.array(relationSchema).default([]),
  notesMJ: z.string().default(""),
  seed: z.string().default(""),
  champs: z.record(z.string(), etatChampSchema).default({}),
  statBlockId: z.string().optional(),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
  version: z.literal(1).default(1),
});

export const npcStatBlockSchema = z.object({
  id: z.string().min(1),
  npcId: z.string().min(1),
  source: z.enum(["estimation", "bestiaire"]),
  palier: z.enum(["faible", "moyen", "fort", "elite"]),
  niveau: z.number(),
  pv: z.number().int().min(1),
  defense: z.number().int(),
  initMod: z.number().int(),
  caracteristiques: caracteristiquesSchema.optional(),
  attaques: z.array(attackSchema).default([]),
  capacites: z.array(z.string()).default([]),
  monsterId: z.string().optional(),
  monsterNom: z.string().optional(),
  notes: z.string().default(""),
  updatedAt: z.string().default(""),
});

export const npcPlacementSchema = z.object({
  id: z.string().min(1),
  npcId: z.string().min(1),
  sessionId: z.string().default(""),
  scenarioId: z.string().default(""),
  sceneId: z.string().default(""),
  role: z.string().default(""),
  notes: z.string().default(""),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

export const factionSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  type: z.string().default(""),
  description: z.string().default(""),
  objectif: z.string().default(""),
  methode: z.string().default(""),
  territoire: z.string().default(""),
  tags: z.array(z.string()).default([]),
  secret: z.string().default(""),
  actif: z.boolean().default(true),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

const optionsGenerationSchema = z.object({
  seed: z.string().optional(),
  profileId: z.string().optional(),
  espece: z.string().optional(),
  culture: z.string().optional(),
  sexe: z.enum(["masculin", "feminin"]).optional(),
  profession: z.string().optional(),
  categorieProfession: z.string().optional(),
  niveauSocial: z.enum(["precaire", "modeste", "aise", "riche", "puissant"]).optional(),
  importance: z.enum(["figuration", "secondaire", "important", "majeur"]).optional(),
  detail: z.enum(["court", "standard", "detaille"]).optional(),
  tags: z.array(z.string()).optional(),
  exclureTags: z.array(z.string()).optional(),
  factionId: z.string().optional(),
  lieu: z.string().optional(),
  genererCombat: z.boolean().optional(),
  palierPuissance: z.enum(["faible", "moyen", "fort", "elite"]).optional(),
  verrous: z.array(z.string()).optional(),
});

export const npcProfileSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  description: z.string().default(""),
  options: optionsGenerationSchema.default({}),
  tags: z.array(z.string()).default([]),
  actif: z.boolean().default(true),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});
