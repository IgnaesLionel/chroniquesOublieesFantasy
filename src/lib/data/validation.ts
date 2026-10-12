import { z } from "zod";
import { ARME_FAMILLE_KEYS } from "@/src/lib/rules/world/types";
import type { Condition } from "@/src/lib/rules/scenario/types";

const caracteristiquesSchema = z.object({
  AGI: z.number().int(),
  CON: z.number().int(),
  FOR: z.number().int(),
  PER: z.number().int(),
  CHA: z.number().int(),
  INT: z.number().int(),
  VOL: z.number().int(),
});

const legacyStatsSchema = z.object({
  FOR: z.number(),
  DEX: z.number(),
  CON: z.number(),
  INT: z.number(),
  SAG: z.number(),
  CHA: z.number(),
});

const attackSchema = z.object({
  id: z.string(),
  nom: z.string(),
  bonus: z.number(),
  degats: z.string(),
  degatsAffiche: z.string().optional(),
  action: z.enum(["attaque", "mouvement", "limitee", "gratuite"]).optional(),
  volDeVie: z.boolean().optional(),
  toucheAuto: z.boolean().optional(),
  demiDegatsSiRate: z.boolean().optional(),
  familles: z.array(z.enum(ARME_FAMILLE_KEYS)).optional(),
  effetTouche: z.object({
    cle: z.string(),
    duree: z.number().int().min(1).nullable(),
    degatsParTour: z.string().optional(),
    mods: z.record(z.string(), z.number()).optional(),
    sauvegarde: z.object({ carac: z.string(), difficulte: z.number().int().min(1) }).optional(),
  }).optional(),
});

const inventaireSchema = z.object({
  itemId: z.string(),
  quantite: z.number().int().min(1),
  equipe: z.boolean(),
});

export const sortSchema = z.object({
  id: z.string(),
  nom: z.string().min(1),
  type: z.enum(["offensif", "defensif", "utilitaire"]),
  ecole: z.string().optional(),
  description: z.string().optional(),
  voie: z.string().optional(),
  rang: z.number().int().min(1).max(5).optional(),
  niveauMin: z.number().int().min(1).optional(),
  action: z.enum(["attaque", "mouvement", "limitee", "gratuite"]).optional(),
  /** Profils pouvant apprendre le sort ; vide = toutes classes. */
  familles: z.array(z.string()).default([]),
  bonus: z.number().optional(),
  degats: z.string().optional(),
  soin: z.string().optional(),
  effetCle: z.string().optional(),
  effetDuree: z.number().int().min(1).nullable().optional(),
  effetDegats: z.string().optional(),
  effetMods: z.record(z.string(), z.number()).optional(),
  effetSauvegarde: z.object({ carac: z.string(), difficulte: z.number().int().min(1) }).optional(),
  cout: z.object({ ressource: z.string(), montant: z.number().min(0) }).optional(),
  coutPV: z.string().optional(),
  volDeVie: z.boolean().optional(),
  toucheAuto: z.boolean().optional(),
  demiDegatsSiRate: z.boolean().optional(),
  limiteCombat: z.number().int().min(1).optional(),
  limiteParCible: z.boolean().optional(),
  attaqueAccordee: z.object({
    nom: z.string(),
    degats: z.string(),
    bonus: z.number().optional(),
    volDeVie: z.boolean().optional(),
  }).optional(),
  invocation: z.object({
    nom: z.string(),
    pvBase: z.number().int().min(0),
    pvParNiveau: z.number().min(0),
    defense: z.number().int(),
    bonusAttaque: z.union([z.number(), z.literal("magique")]),
    degats: z.string(),
    initiative: z.number().optional(),
  }).optional(),
  zone: z.boolean().optional(),
  cibleEspeces: z.array(z.string()).optional(),
});

export const characterSchema = z.object({
  id: z.string(),
  kind: z.literal("personnage"),
  nom: z.string().min(1),
  classe: z.string(),
  niveau: z.number().int().min(1),
  pvMax: z.number().int().min(1),
  pv: z.number().int().min(0),
  defense: z.number().int(),
  initMod: z.number().int(),
  // Nouveau modèle COF Fantasy (requis pour les nouvelles fiches).
  caracteristiques: caracteristiquesSchema.optional(),
  // Ancien modèle v2 : accepté puis migré (FOR/DEX/CON/INT/SAG/CHA).
  stats: legacyStatsSchema.optional(),
  peuple: z.string().default("Humain"),
  famille: z.enum(["Combattant", "Aventurier", "Mystique", "Mage"]).default("Aventurier"),
  profil: z.string().default(""),
  idealHeroique: z.string().optional(),
  travers: z.string().optional(),
  traitsPeuple: z.array(z.string()).default([]),
  voieMage: z.boolean().optional(),
  migreSorts: z.boolean().optional(),
  armure: z.object({ nom: z.string().optional(), def: z.number().int().optional(), agiMax: z.number().int().nullable().optional() }).optional(),
  defenseEquipement: z.number().int().optional(),
  defenseMod: z.number().int().optional(),
  desRecuperation: z.object({ type: z.enum(["d6", "d8", "d10"]), max: z.number().int().min(0), actuel: z.number().int().min(0) }).optional(),
  attaques: z.array(attackSchema),
  capacites: z.array(z.string()),
  ressources: z.record(z.string(), z.object({ max: z.number(), actuel: z.number() })),
  effets: z.array(z.any()).default([]),
  inventaire: z.array(inventaireSchema).default([]),
  bourse: z.object({ pp: z.number().int().min(0), po: z.number().int().min(0), pa: z.number().int().min(0) }).optional(),
  sorts: z.array(sortSchema).default([]),
  notes: z.string().optional(),
  exemple: z.boolean(),
}).superRefine((c, ctx) => {
  if (!c.caracteristiques && !c.stats) {
    ctx.addIssue({ code: "custom", message: "caracteristiques (AGI/CON/FOR/PER/CHA/INT/VOL) ou stats legacy requis.", path: ["caracteristiques"] });
  }
});

/** Migre une sauvegarde v2 (stats FOR/DEX/CON/INT/SAG/CHA) vers caracteristiques COF. */
export function migrerStatsLegacy(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const o = input as Record<string, unknown>;
  if (o.kind !== "personnage") return input;
  if (o.caracteristiques || !o.stats || typeof o.stats !== "object") return input;
  const s = o.stats as Record<string, number>;
  const conv = (v: unknown) => (typeof v === "number" ? Math.round((v - 10) / 2) : 0);
  return {
    ...o,
    caracteristiques: {
      AGI: conv(s.DEX),
      CON: conv(s.CON),
      FOR: conv(s.FOR),
      PER: conv(s.SAG),
      CHA: conv(s.CHA),
      INT: conv(s.INT),
      VOL: conv(s.SAG) ?? 0,
    },
  };
}

export const monsterSchema = z.object({
  id: z.string(),
  kind: z.literal("monstre"),
  nom: z.string().min(1),
  type: z.string(),
  niveau: z.number().min(0),
  pv: z.number().int().min(0),
  pvMax: z.number().int().min(1),
  defense: z.number().int(),
  initMod: z.number().int(),
  attaques: z.array(attackSchema),
  capacites: z.array(z.string()),
  capacitesPartagees: z.array(z.string()).optional(),
  capacitesDetails: z.array(z.object({ nom: z.string(), description: z.string() })).optional(),
  description: z.string().optional(),
  comportement: z.string().optional(),
  taille: z.string().optional(),
  categorie: z.string().optional(),
  sousCategories: z.array(z.string()).optional(),
  rd: z.number().optional(),
  deplacement: z.number().nullable().optional(),
  initiativeFiche: z.number().optional(),
  sourceUrl: z.string().optional(),
  notes: z.string().optional(),
  exemple: z.boolean(),
});

export const npcSchema = z.object({
  id: z.string(),
  nom: z.string().min(1),
  role: z.string().optional(),
  portraitUrl: z.string().optional(),
  description: z.string().optional(),
  personnalite: z.string().optional(),
  statistiques: z.string().optional(),
  dialogues: z.array(z.string()).default([]),
  secret: z.string().optional(),
  relations: z.string().optional(),
  notesMJ: z.string().optional(),
  exemple: z.boolean(),
});

export const itemSchema = z.object({
  id: z.string(),
  nom: z.string().min(1),
  categorie: z.enum(["arme", "armure", "potion", "quete", "outil", "argent", "divers"]),
  description: z.string().optional(),
  effet: z.string().optional(),
  quantite: z.number().int().min(0),
  poids: z.number().optional(),
  valeur: z.number().optional(),
  estArme: z.boolean().optional(),
  bonusAttaque: z.number().optional(),
  degats: z.string().optional(),
  effetCle: z.string().optional(),
  effetDuree: z.number().int().min(1).nullable().optional(),
  familles: z.array(z.enum(ARME_FAMILLE_KEYS)).optional(),
  bonusDefense: z.number().int().min(0).optional(),
  magique: z.boolean().optional(),
  mains: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  emplacement: z.enum(["torse", "bouclier", "accessoire"]).optional(),
  exemple: z.boolean(),
});

const flagValueSchema = z.union([z.boolean(), z.string(), z.number()]);

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("flag"),
      flag: z.string().min(1),
      op: z.enum(["estVrai", "estFaux", "egal", "different"]),
      valeur: flagValueSchema.optional(),
    }),
    z.object({ type: z.literal("et"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("ou"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("non"), condition: conditionSchema }),
  ])
);

const choiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  versSceneId: z.string(),
  condition: conditionSchema.optional(),
});

const sceneSchema = z.object({
  id: z.string(),
  titre: z.string(),
  texteMJ: z.string(),
  description: z.string().optional(),
  notesMJ: z.string().optional(),
  rencontreId: z.string().optional(),
  pnjIds: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  choix: z.array(choiceSchema),
});

export const scenarioSchema = z.object({
  id: z.string(),
  titre: z.string(),
  description: z.string().optional(),
  chapitres: z.array(z.object({ id: z.string(), titre: z.string(), sceneDepartId: z.string() })),
  scenes: z.array(sceneSchema),
  exemple: z.boolean(),
});
