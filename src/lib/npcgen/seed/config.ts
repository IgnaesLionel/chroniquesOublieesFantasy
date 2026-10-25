import {
  TABLE_IDS,
  type Faction,
  type NpcProfile,
  type ReferenceEntry,
} from "@/src/lib/npcgen/types";
import { DATE_GRAINE, fabrique, slug } from "@/src/lib/npcgen/seed/helpers";

const { E, entries } = fabrique();

// Règles interprétées par le moteur :
// - exclusion : si un PNJ possède tableCible/valeurCible, l'entrée candidate
//   de tableCandidate (avec éventuellement le tagCandidat) est écartée.
// - requiert : l'entrée candidate exige la présence de tableRequise/valeurRequise.
const regles: [string, Record<string, string | string[] | number | boolean>][] = [
  ["Un mendiant ne transporte pas d'objet de valeur", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Mendiant",
    tableCandidate: TABLE_IDS.objetsValeurs,
    message: "La pauvreté du mendiant exclut les biens de valeur.",
  }],
  ["Un mendiant ne possède pas d'objet magique", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Mendiant",
    tableCandidate: TABLE_IDS.objetsMagiques,
    message: "Un objet magique chez un mendiant doit être justifié par le MJ.",
  }],
  ["Un chevalier évite les objets compromettants", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Chevalier",
    tableCandidate: TABLE_IDS.objetsSuspects,
    message: "Un chevalier en règle ne porte pas d'objet suspect.",
  }],
  ["Un garde évite les documents de crime", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Garde",
    tableCandidate: TABLE_IDS.documents,
    tagCandidat: "crime",
    message: "Un garde ne transporte pas de faux ordre criminel par défaut.",
  }],
  ["Un prêtre n'a pas d'objet maudit", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Prêtre",
    tableCandidate: TABLE_IDS.objetsMagiques,
    tagCandidat: "maudit",
    message: "Un prêtre ne porte pas volontairement un objet maudit.",
  }],
  ["Un mage de cour a une tenue soignée", {
    type: "exclusion",
    tableCible: TABLE_IDS.professions,
    valeurCible: "Mage de cour",
    tableCandidate: TABLE_IDS.vetements,
    tagCandidat: "misère",
    message: "La fonction de mage de cour exclut les guenilles.",
  }],
];

for (const [valeur, meta] of regles) {
  entries.push(
    E(TABLE_IDS.reglesCompatibilite, valeur, {
      description: String(meta.message ?? ""),
      tags: [String(meta.type)],
      meta,
    })
  );
}

const paliers: [string, number, number, number, number, number, string][] = [
  ["Faible", 1, 8, 11, 0, 2, "1d6"],
  ["Moyen", 3, 18, 13, 1, 4, "1d8+1"],
  ["Fort", 5, 32, 15, 2, 6, "1d8+3"],
  ["Élite", 8, 55, 17, 3, 9, "2d6+3"],
];

for (const [valeur, niveau, pv, defense, initMod, bonus, degats] of paliers) {
  entries.push(
    E(TABLE_IDS.paliersPuissance, valeur, {
      description: "Estimation de combat configurable — ce n'est pas une règle officielle COF2.",
      meta: {
        niveau,
        pv,
        defense,
        initMod,
        bonusAttaque: bonus,
        degats,
        estimation: true,
      },
    })
  );
}

export const ENTRIES_REGLES: ReferenceEntry[] = entries;

export const SEED_FACTIONS: Faction[] = [
  {
    id: "faction-guet-des-lanternes",
    nom: "Guet des Lanternes",
    type: "Ordre urbain",
    description: "Patrouilles municipales chargées de la sécurité des quartiers marchands.",
    objectif: "Maintenir l'ordre sans froisser les guildes.",
    methode: "Patrouilles visibles, informateurs et registres de porte.",
    territoire: "Citadelle et faubourgs",
    tags: ["ville", "ordre", "militaire", "officiel"],
    secret: "Une partie des officiers protège des contrebandiers contre rétribution.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-ordre-du-lys-argent",
    nom: "Ordre du Lys d'Argent",
    type: "Ordre chevaleresque",
    description: "Chevaliers errants voués à la protection des routes et des sanctuaires.",
    objectif: "Faire respecter un code d'honneur sur les terres sans seigneur.",
    methode: "Duel judiciaire, escortes et serments publics.",
    territoire: "Routes du royaume",
    tags: ["noble", "militaire", "honneur", "religion"],
    secret: "Le grand maître a été déchu pour une faute que ses fidèles ignorent.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-cour-du-corbeau",
    nom: "Cour du Corbeau",
    type: "Réseau occulte",
    description: "Courtiers en secrets, dettes et disparitions discrètes.",
    objectif: "Accumuler des leviers sur toutes les maisons importantes.",
    methode: "Chantage, intermédiaires et fausses identités.",
    territoire: "Sous-sols de la capitale",
    tags: ["crime", "occulte", "information", "secret"],
    secret: "La Cour est dirigée par un conseil de trois masques qui ne se connaissent pas.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-compagnie-du-sel",
    nom: "Compagnie du Sel",
    type: "Guilde marchande",
    description: "Négociants en sel, poisson séché et épices des côtes.",
    objectif: "Contrôler les routes maritimes et les entrepôts côtiers.",
    methode: "Contrats exclusifs, prêts et pression sur les ports.",
    territoire: "Côte et fleuve",
    tags: ["commerce", "mer", "argent", "politique"],
    secret: "Elle finance une flotte pirate sous un pavillon neutre.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-cercle-des-racines",
    nom: "Cercle des Racines",
    type: "Cercle druidique",
    description: "Gardiens des forêts anciennes et des sources sacrées.",
    objectif: "Empêcher l'exploitation des lieux de pouvoir naturels.",
    methode: "Veilles saisonnières, pactes anciens et colère des bêtes.",
    territoire: "Forêt du Vieux Chêne",
    tags: ["nature", "religion", "occulte", "communauté"],
    secret: "Un bosquet abrite un passage vers un domaine féerique.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-maison-de-la-cendre",
    nom: "Maison de la Cendre",
    type: "Maison noble déchue",
    description: "Ancienne famille seigneuriale dont les terres ont été confisquées.",
    objectif: "Récupérer un titre et une forteresse perdus.",
    methode: "Alliances de circonstance, procès et mariages arrangés.",
    territoire: "Val de Cendre",
    tags: ["noble", "politique", "honneur", "vengeance"],
    secret: "Le dernier héritier légitime vit sous une fausse identité.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-freres-du-fleuve",
    nom: "Frères du Fleuve",
    type: "Confrérie de bateliers",
    description: "Bateliers, passeurs et dockers qui contrôlent le trafic fluvial.",
    objectif: "Garder l'indépendance des quais face aux guildes.",
    methode: "Grèves, péages coutumiers et solidarité de métier.",
    territoire: "Fleuve et ports intérieurs",
    tags: ["rivière", "transport", "communauté", "commerce"],
    secret: "Ils cachent des fugitifs dans des cales aménagées.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-academie-sept-tours",
    nom: "Académie des Sept Tours",
    type: "Collège savant",
    description: "Érudits, astrologues et mages patentés au service des puissants.",
    objectif: "Préserver et contrôler les savoirs dangereux.",
    methode: "Examens, archives interdites et recommandations.",
    territoire: "Cité haute",
    tags: ["savoir", "occulte", "noble", "officiel"],
    secret: "Une tour ne figure sur aucun plan officiel.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-lames-de-brume",
    nom: "Lames de Brume",
    type: "Compagnie mercenaire",
    description: "Soldats sans bannière qui louent leurs services aux frontières.",
    objectif: "Vivre de la guerre sans être rattrapés par elle.",
    methode: "Contrats courts, discipline de fer et réputation sanglante.",
    territoire: "Marches du Nord",
    tags: ["militaire", "guerre", "route", "crime"],
    secret: "La compagnie cherche à acheter une terre pour se sédentariser.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
  {
    id: "faction-hospice-sainte-vigile",
    nom: "Hospice de Sainte-Vigile",
    type: "Communauté religieuse",
    description: "Soignants et prêcheurs accueillant malades, orphelins et pèlerins.",
    objectif: "Soulager les souffrances et gagner des âmes.",
    methode: "Soins gratuits, quêtes de dons et protection des faibles.",
    territoire: "Toutes les villes dotées d'une chapelle",
    tags: ["religion", "soin", "communauté", "pauvre"],
    secret: "Une partie des reliques exposées sont des copies destinées à financer l'hospice.",
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  },
];

function profil(
  nom: string,
  description: string,
  options: NpcProfile["options"],
  tags: string[]
): NpcProfile {
  return {
    id: `profil-${slug(nom)}`,
    nom,
    description,
    options,
    tags,
    actif: true,
    createdAt: DATE_GRAINE,
    updatedAt: DATE_GRAINE,
  };
}

export const SEED_PROFILES: NpcProfile[] = [
  profil(
    "Roturier de village",
    "Un visage ordinaire du bourg, utile pour les rumeurs et les petites tâches.",
    { importance: "secondaire", niveauSocial: "modeste", detail: "standard", genererCombat: false },
    ["quotidien", "campagne"]
  ),
  profil(
    "Marchand de passage",
    "Un négociant qui transporte nouvelles, marchandises et dettes.",
    { importance: "secondaire", niveauSocial: "aise", detail: "standard", tags: ["commerce"], genererCombat: false },
    ["commerce", "voyage"]
  ),
  profil(
    "Garde en patrouille",
    "Un agent de l'ordre susceptible de devenir allié ou obstacle.",
    { profession: "Garde", importance: "secondaire", niveauSocial: "modeste", detail: "standard", tags: ["militaire"], genererCombat: true, palierPuissance: "moyen" },
    ["militaire", "ville"]
  ),
  profil(
    "Noble de cour",
    "Un personnage de rang, entouré d'intrigues et de précautions.",
    { importance: "important", niveauSocial: "riche", detail: "detaille", tags: ["noble"], genererCombat: false },
    ["noble", "politique"]
  ),
  profil(
    "Érudit discret",
    "Un passeur de savoir, rarement désintéressé.",
    { importance: "secondaire", niveauSocial: "aise", detail: "detaille", tags: ["savoir"], genererCombat: false },
    ["savoir", "ville"]
  ),
  profil(
    "Ombre de la pègre",
    "Un acteur du crime qui connaît les passages et les dettes de chacun.",
    { importance: "important", niveauSocial: "modeste", detail: "standard", tags: ["crime"], genererCombat: true, palierPuissance: "moyen" },
    ["crime", "ville"]
  ),
  profil(
    "Mystique de village",
    "Guérisseur ou sorcier local, à la frontière du sacré et du soupçon.",
    { importance: "secondaire", niveauSocial: "modeste", detail: "detaille", tags: ["occulte"], genererCombat: false },
    ["occulte", "campagne"]
  ),
  profil(
    "Antagoniste majeur",
    "Un adversaire durable, avec ressources, alliés et secrets.",
    { importance: "majeur", niveauSocial: "riche", detail: "detaille", genererCombat: true, palierPuissance: "fort" },
    ["villain", "politique"]
  ),
  profil(
    "Voyageur de la route",
    "Colporteur, pèlerin ou messager : une rencontre au coin du chemin.",
    { importance: "figuration", niveauSocial: "modeste", detail: "court", tags: ["voyage"], genererCombat: false },
    ["voyage", "route"]
  ),
  profil(
    "Capitaine du port",
    "Un marin qui commande hommes et cargaisons.",
    { importance: "important", niveauSocial: "aise", detail: "standard", tags: ["mer"], genererCombat: true, palierPuissance: "fort" },
    ["mer", "commerce"]
  ),
];
