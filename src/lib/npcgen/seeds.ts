import {
  TABLE_IDS,
  TABLE_LABEL,
  type ReferenceCategorie,
  type TableId,
} from "@/src/lib/npcgen/types";
import { DATE_GRAINE } from "@/src/lib/npcgen/seed/helpers";
import { ENTRIES_IDENTITE } from "@/src/lib/npcgen/seed/identite";
import { ENTRIES_APPARENCE } from "@/src/lib/npcgen/seed/apparence";
import { ENTRIES_SOCIAL } from "@/src/lib/npcgen/seed/social";
import { ENTRIES_PERSONNALITE } from "@/src/lib/npcgen/seed/personnalite";
import { ENTRIES_NARRATIF } from "@/src/lib/npcgen/seed/narratif";
import { ENTRIES_RELATIONS_EQUIPEMENT } from "@/src/lib/npcgen/seed/relations-equipement";
import {
  ENTRIES_REGLES,
  SEED_FACTIONS,
  SEED_PROFILES,
} from "@/src/lib/npcgen/seed/config";

export { SEED_FACTIONS, SEED_PROFILES };

const CATEGORIES: [ReferenceCategorie, TableId[]][] = [
  ["Identité", [
    TABLE_IDS.especes, TABLE_IDS.sexes, TABLE_IDS.cultures,
    TABLE_IDS.prenomsMasculins, TABLE_IDS.prenomsFeminins, TABLE_IDS.nomsFamille,
    TABLE_IDS.tranchesAge, TABLE_IDS.tailles, TABLE_IDS.corpulences,
  ]],
  ["Apparence", [
    TABLE_IDS.carnations, TABLE_IDS.cheveux, TABLE_IDS.yeux, TABLE_IDS.visages,
    TABLE_IDS.voix, TABLE_IDS.particularitesPhysiques, TABLE_IDS.signesDistinctifs,
    TABLE_IDS.maintien, TABLE_IDS.hygiene, TABLE_IDS.demarche, TABLE_IDS.gestes,
    TABLE_IDS.vetements,
  ]],
  ["Social", [
    TABLE_IDS.professions, TABLE_IDS.niveauxSociaux, TABLE_IDS.importances, TABLE_IDS.lieux,
  ]],
  ["Personnalité", [
    TABLE_IDS.traitsPositifs, TABLE_IDS.traitsNegatifs, TABLE_IDS.traitsAmbivalents,
    TABLE_IDS.qualitesMorales, TABLE_IDS.defauts, TABLE_IDS.peurs, TABLE_IDS.prejuges,
    TABLE_IDS.habitudes, TABLE_IDS.ticsVerbaux, TABLE_IDS.expressions,
    TABLE_IDS.reactionsPression, TABLE_IDS.attitudesAutorite, TABLE_IDS.attitudesDanger,
    TABLE_IDS.attitudesArgent, TABLE_IDS.attitudesMagie, TABLE_IDS.stylesNegociation,
    TABLE_IDS.stylesMensonge, TABLE_IDS.stylesSeduction, TABLE_IDS.stylesMenace,
  ]],
  ["Narratif", [
    TABLE_IDS.objectifsImmediats, TABLE_IDS.ambitions, TABLE_IDS.desirs, TABLE_IDS.besoins,
    TABLE_IDS.secrets, TABLE_IDS.mensonges, TABLE_IDS.regrets, TABLE_IDS.problemes,
    TABLE_IDS.dettes, TABLE_IDS.objetsRecherches, TABLE_IDS.personnesProtegees,
    TABLE_IDS.personnesRecherchees, TABLE_IDS.conflits, TABLE_IDS.rumeurs,
    TABLE_IDS.opportunites, TABLE_IDS.raisonsCooperation, TABLE_IDS.raisonsOpposition,
    TABLE_IDS.accroches,
  ]],
  ["Relations", [
    TABLE_IDS.attitudesInitiales, TABLE_IDS.raisonsAttitude, TABLE_IDS.premieresReactions,
    TABLE_IDS.offres, TABLE_IDS.demandes, TABLE_IDS.leviers,
    TABLE_IDS.declencheursHostilite, TABLE_IDS.fuites,
  ]],
  ["Équipement", [
    TABLE_IDS.equipements, TABLE_IDS.objetsValeurs, TABLE_IDS.objetsPersonnels,
    TABLE_IDS.objetsSuspects, TABLE_IDS.objetsMagiques, TABLE_IDS.documents,
  ]],
  ["Règles", [TABLE_IDS.reglesCompatibilite, TABLE_IDS.paliersPuissance]],
];

const CATEGORIE_PAR_TABLE = new Map<string, ReferenceCategorie>();
CATEGORIES.forEach(([categorie, ids]) => ids.forEach((id) => CATEGORIE_PAR_TABLE.set(id, categorie)));

const DESCRIPTIONS: Partial<Record<TableId, string>> = {
  [TABLE_IDS.especes]: "Espèces et peuples rencontrés dans la campagne.",
  [TABLE_IDS.professions]: "Métiers, statuts et activités du PNJ. Les affinités servent aux règles de compatibilité.",
  [TABLE_IDS.vetements]: "Tenues proposées selon le niveau social.",
  [TABLE_IDS.accroches]: "Amorces de scène ; variables : {nom}, {profession}, {lieu}, {secret}, {objet}, {faction}, {rumeur}.",
  [TABLE_IDS.paliersPuissance]: "Estimations de combat configurables, jamais des règles officielles COF2.",
  [TABLE_IDS.reglesCompatibilite]: "Exclusions et exigences interprétées par le moteur de génération.",
};

export const SEED_TABLES = Object.values(TABLE_IDS).map((id, ordre) => ({
  id,
  nom: TABLE_LABEL[id],
  categorie: CATEGORIE_PAR_TABLE.get(id) ?? "Narratif",
  description: DESCRIPTIONS[id] ?? `Table de référence « ${TABLE_LABEL[id]} ».`,
  actif: true,
  ordre,
  version: 1,
  createdAt: DATE_GRAINE,
  updatedAt: DATE_GRAINE,
}));

// Les modules de données sont volontairement séparés ; quelques listes de
// roleplay sont partagées. On déduplique par identifiant stable pour que les
// fusions, les clés React et les sauvegardes restent uniques.
const ENTREES_BRUTES = [
  ...ENTRIES_IDENTITE,
  ...ENTRIES_APPARENCE,
  ...ENTRIES_SOCIAL,
  ...ENTRIES_PERSONNALITE,
  ...ENTRIES_NARRATIF,
  ...ENTRIES_RELATIONS_EQUIPEMENT,
  ...ENTRIES_REGLES,
];

export const SEED_ENTRIES = [...new Map(ENTREES_BRUTES.map((entree) => [entree.id, entree])).values()];
