// Profils tactiques des créatures du bestiaire.
//
// Toutes les valeurs sont DÉRIVÉES des données de la fiche (NC, PV, DEF,
// attaques, capacités, RD). Aucune statistique n'est inventée : quand une
// capacité n'a pas de chiffre exploitable (souffle sans portée/dégâts
// structurés, invocation...), elle influence seulement les indices
// qualitatifs (contrôle, soutien, signature) et les avertissements.
//
// Les heuristiques de mots-clés sont des ESTIMATIONS du logiciel, pas des
// règles COF2. Elles sont regroupées ici pour être auditées et calibrées.

import type { MonsterTemplate } from "@/src/lib/rules/types";
import type {
  AttaqueEvaluee,
  EditionCreature,
  ProfilCreature,
  RoleCreature,
} from "@/src/lib/encounters/types";
import {
  degatsAttendus,
  moyenneDegats,
  normaliserTheme,
} from "@/src/lib/encounters/rules";

const CARACS_VIDES = { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 };

function texteCapacites(m: MonsterTemplate): string {
  const noms = [...(m.capacites ?? []), ...(m.capacitesDetails ?? []).map((c) => c.nom)];
  const details = (m.capacitesDetails ?? []).map((c) => c.description ?? "");
  return normaliserTheme([...noms, ...details, m.description ?? "", m.comportement ?? ""].join(" "));
}

/** Poids de contrôle par mot-clé (0..1), maximum retenu par famille d'effet. */
const CONTROLE_MOTS: { motif: RegExp; poids: number; libelle: string }[] = [
  { motif: /paralys/, poids: 0.5, libelle: "paralysie" },
  { motif: /petrifi|pétrifi/, poids: 0.5, libelle: "pétrification" },
  { motif: /injonction mortelle/, poids: 0.45, libelle: "mort immédiate" },
  { motif: /etourd|étourd/, poids: 0.35, libelle: "étourdissement" },
  { motif: /inconscience|assomm/, poids: 0.4, libelle: "inconscience" },
  { motif: /envo[uû]t|charme|domination/, poids: 0.4, libelle: "charme" },
  { motif: /terreur|effroi|peur|intimidation/, poids: 0.3, libelle: "peur" },
  { motif: /immobilis|enlace|etreinte|étreinte|agripp|enlevement|enlèvement/, poids: 0.28, libelle: "immobilisation" },
  { motif: /renvers|fauchage|balayage/, poids: 0.22, libelle: "renversement" },
  { motif: /sommeil|endorm/, poids: 0.4, libelle: "sommeil" },
  { motif: /toile|soie/, poids: 0.25, libelle: "entrave" },
  { motif: /rires? insupportables?/, poids: 0.22, libelle: "dé malus" },
  { motif: /regard/, poids: 0.22, libelle: "regard" },
  { motif: /ailes?|vol rapide/, poids: 0.08, libelle: "mobilité" },
  { motif: /ralenti|ralentis/, poids: 0.18, libelle: "ralentissement" },
  { motif: /aveugl|obscur/, poids: 0.2, libelle: "aveuglement" },
  { motif: /poison|venin/, poids: 0.12, libelle: "poison" },
];

const SOUTIEN_MOTS: { motif: RegExp; poids: number; libelle: string }[] = [
  { motif: /soin|guerison|guérison|gueris|guéris|recuperation|récupération|regeneration|régénération|vitalite|vitalité/, poids: 0.45, libelle: "soins" },
  { motif: /capitaine|commandant|sergent|chef de meute|chef\b/, poids: 0.3, libelle: "commandement" },
  { motif: /inspirer|beni|béni|benediction|bénédiction|buffs?|soutien|soutenir/, poids: 0.2, libelle: "soutien" },
  { motif: /celerite|célérité|hate|hâte|acceleration|accélération/, poids: 0.18, libelle: "accélération" },
  { motif: /invocation|invoque|invoqué|animer|releve|relève/, poids: 0.35, libelle: "invocation" },
  { motif: /interchangeables?/, poids: 0.18, libelle: "meute" },
  { motif: /gardien|garde du corps|proteger|protéger|rempart/, poids: 0.2, libelle: "protection" },
];

/**
 * Capacités de soin RÉELLES de la fiche.
 *
 * Attention : ce n'est PAS la même chose que le « soutien » générique, qui
 * mélange commandement (« Capitaine », « Chef »), invocation, protection,
 * bénédiction… Un capitaine ne soigne pas ses troupes. Seules les capacités
 * listées ici produisent de la régénération dans le moteur.
 */
const SOIN_DIRECT_MOTIF = /soin|guerison|guérison|gueris|guéris|soigne|soignant|recuperation|récupération|regeneration|régénération|vitalite|vitalité/;
/** PV récupérés par round pour 1 point de NC (calé sur « Guérison accélérée » : 5 PV/round pour l'Hydre NC 10). */
const REGEN_PAR_NC = 0.5;
const REGEN_DE_BASE = 2;
const REGEN_MAX = 12;

/** Régénération passive (PV/round) déclarée sur la fiche, 0 sinon. */
export function regenerationDepuisTexte(texte: string, nc: number): number {
  if (!SOIN_DIRECT_MOTIF.test(texte)) return 0;
  return Math.round(Math.min(REGEN_MAX, REGEN_DE_BASE + Math.max(0, nc) * REGEN_PAR_NC));
}

const RESISTANCE_MOTS: { motif: RegExp; facteur: number; libelle: string }[] = [
  { motif: /resistances? aux dm|resistance aux dm|résistance aux dm/, facteur: 0.7, libelle: "résistance aux DM" },
  { motif: /insensible a la douleur/, facteur: 0.9, libelle: "insensible à la douleur" },
  { motif: /guerison acceleree|guérison accélérée/, facteur: 0.88, libelle: "guérison accélérée" },
  { motif: /resistances? demon|résistances? démon|resistance impie/, facteur: 0.85, libelle: "résistances surnaturelles" },
  { motif: /forme gazeuse|immortel/, facteur: 0.92, libelle: "forme/immortalité" },
  { motif: /reduction des dm|réduction des dm/, facteur: 0.9, libelle: "réduction des DM" },
];

function meilleurIndice(texte: string, mots: { motif: RegExp; poids: number }[]): { valeur: number; libelles: string[] } {
  let valeur = 0;
  const libelles: string[] = [];
  for (const m of mots) {
    if (m.motif.test(texte)) {
      valeur = Math.max(valeur, m.poids);
      libelles.push((m as { libelle?: string }).libelle ?? m.motif.source);
    }
  }
  return { valeur, libelles };
}

/** Détecte une attaque à distance sans supposer de portée chiffrée. */
function estDistance(nom: string, affiche: string): boolean {
  const t = normaliserTheme(`${nom} ${affiche}`);
  return /arc|arbal|jet|souffle|crachat|regard|distance|magique|onde|projectile|\bm\b|\d+\s*m\b/.test(t);
}

function estZone(nom: string, affiche: string, texte: string): boolean {
  const t = normaliserTheme(`${nom} ${affiche} ${texte}`);
  return /souffle|onde|balayage|fauchage|tourbillon|explosion|cone|cône|zone/.test(t);
}

/**
 * Nombre d'attaques indépendantes déclarées sur la fiche.
 *
 * Le DRS (page « Attaques multiples ») : « Lorsqu'une créature peut réaliser
 * plusieurs attaques indépendantes dans le même tour, cela est précisé. » Les
 * fiches du bestiaire le notent dans le nom de l'attaque, par exemple
 * « Morsures, bec ou cornes (3 attaques) » ou « Morsure (1 attaque par tête) ».
 *
 * Ces attaques ne portent pas de marque d'action limitée dans les données : le
 * nombre déclaré est donc retenu tel quel. C'est une LECTURE de la fiche, pas
 * une statistique inventée.
 */
export function multipliciteDepuisNom(nomAttaque: string, nomCreature: string): number {
  const t = normaliserTheme(`${nomAttaque} ${nomCreature}`);
  const tetes = /(\d+)\s*tetes?/.exec(t);
  // « 1 attaque par tête » : le nombre de têtes vient du nom de la créature.
  if (/attaque par tete/.test(t) && tetes) return Math.max(1, Math.min(12, Number(tetes[1])));
  const explicite = /\((\d+)\s*attaque/.exec(t);
  if (explicite) return Math.max(1, Math.min(12, Number(explicite[1])));
  return 1;
}

function controleDeTexte(texte: string): number {
  return meilleurIndice(texte, CONTROLE_MOTS).valeur;
}

function normaliserAttaque(m: MonsterTemplate, attaque: MonsterTemplate["attaques"][number], texte: string): AttaqueEvaluee {
  const affiche = attaque.degatsAffiche ?? attaque.degats ?? "";
  const t = normaliserTheme(`${attaque.nom} ${affiche}`);
  const effet = attaque.effetTouche;
  const controleEffet = effet
    ? Math.max(
        0.2,
        controleDeTexte(normaliserTheme(`${effet.cle} ${effet.degatsParTour ?? ""}`)) + (effet.sauvegarde ? 0.08 : 0)
      )
    : 0;
  const controle = Math.min(1, Math.max(controleDeTexte(t), controleEffet));
  const limitee = attaque.action === "limitee" || /\(l\)|\(1\)/.test(t);
  const source: AttaqueEvaluee["source"] = attaque.id.includes("sort")
    ? "sort"
    : attaque.id.includes("item")
      ? "arme"
      : "fiche";
  return {
    nom: attaque.nom,
    bonus: Number.isFinite(attaque.bonus) ? attaque.bonus : 0,
    degats: attaque.degats ?? "1d1-1",
    degatsMoyens: moyenneDegats(attaque.degats ?? "1d1-1"),
    distance: estDistance(attaque.nom, affiche),
    limitee,
    toucheAuto: attaque.toucheAuto === true,
    controle,
    zone: estZone(attaque.nom, affiche, texte),
    volDeVie: attaque.volDeVie === true,
    degatsParTour: effet?.degatsParTour ? moyenneDegats(effet.degatsParTour) : 0,
    multiplicite: multipliciteDepuisNom(attaque.nom, m.nom),
    source,
  };
}

export function editionDepuisMonstre(m: MonsterTemplate): EditionCreature {
  if (m.drsSlug) return "cof2";
  if (m.v1) return "cof1";
  return "hors-drs";
}

export function libelleSource(m: MonsterTemplate): string {
  const edition = editionDepuisMonstre(m);
  if (edition === "cof2") return "COF2 · fiche DRS";
  if (edition === "cof1") return "COF1 · V1 (hors DRS V2)";
  return "Hors DRS · création / ancienne édition";
}

/** Indice de contrôle d'une attaque/effet, exposé pour les tests. */
export function indiceControle(texte: string): number {
  return controleDeTexte(normaliserTheme(texte));
}

/** Indice de soutien d'une capacité, exposé pour les tests. */
export function indiceSoutien(texte: string): number {
  return meilleurIndice(normaliserTheme(texte), SOUTIEN_MOTS).valeur;
}

/** Facteur de dégâts subis (1 = normal), dérivé des capacités de résistance. */
export function facteurResistance(texte: string): number {
  const t = normaliserTheme(texte);
  let facteur = 1;
  for (const r of RESISTANCE_MOTS) {
    if (r.motif.test(t)) facteur = Math.min(facteur, r.facteur);
  }
  return facteur;
}

/** Dégâts par round d'un profil contre une DEF donnée (poids des sorts/actions limitées).
 *
 * Règle DRS appliquée (page « Attaques ») : « En dessous figure parfois un
 * second mode d'attaque [à distance] ... **Ces deux attaques ne peuvent pas
 * être réalisées dans le même tour**, chacune d'elle exige une action
 * d'attaque indépendante. » Le mode de contact et le mode à distance sont
 * donc des OPTIONS : on retient le meilleur, on ne les additionne pas.
 * Les actions limitées (marquées « L » sur la fiche) restent additives car
 * elles ne coûtent pas l'action d'attaque principale.
 */
export function dprDepuisAttaques(
  attaques: AttaqueEvaluee[],
  defense: number,
  options: { poidsSort?: number; poidsLimitee?: number; bonusZone?: number } = {}
): number {
  const poidsSort = options.poidsSort ?? 0.55;
  const poidsLimitee = options.poidsLimitee ?? 0.35;
  const bonusZone = options.bonusZone ?? 1;
  const contribution = (a: AttaqueEvaluee): number => {
    let poids = a.source === "sort" ? poidsSort : 1;
    if (a.zone) poids *= bonusZone;
    // Attaques indépendantes déclarées sur la fiche ("(2 attaques)") :
    // chacune est un jet et des DM séparés dans le même tour.
    const nb = Math.max(1, a.multiplicite ?? 1);
    return degatsAttendus(a.bonus, defense, a.degatsMoyens, a.toucheAuto) * poids * nb;
  };
  let modeContact = 0;
  let modeDistance = 0;
  let additif = 0;
  for (const a of attaques) {
    // Effet durable (poison, saignement) : une seule application par round,
    // pondérée pour ne pas compter tout le DOT comme un nova. Il s'applique
    // quel que soit le mode retenu.
    const dot = a.degatsParTour * 0.5;
    if (a.limitee) {
      additif += contribution(a) * poidsLimitee + dot;
    } else if (a.distance) {
      modeDistance += contribution(a) + dot;
    } else {
      modeContact += contribution(a) + dot;
    }
  }
  return Math.max(modeContact, modeDistance) + additif;
}

function signatureDe(m: MonsterTemplate, texte: string): string[] {
  const generiques = new Set([
    "soutenir",
    "attaque en meute",
    "sensible a la lumiere",
    "tres petit",
    "minuscule",
    "vision dans le noir",
    "familier",
    "transformation",
    "telepathie",
    "tenebres",
    "vol",
    "deplacement",
  ]);
  const vus = new Set<string>();
  const out: string[] = [];
  for (const nom of m.capacites ?? []) {
    const nettoye = nom.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const cle = normaliserTheme(nettoye);
    if (!cle || generiques.has(cle) || vus.has(cle)) continue;
    vus.add(cle);
    out.push(nettoye);
  }
  // Capacité distinctive sans nom exploitable : garder au moins l'indice.
  if (out.length === 0 && controleDeTexte(texte) >= 0.3) out.push("Effet de contrôle (fiche)");
  return out;
}

function rolesDe(
  m: MonsterTemplate,
  distance: boolean,
  controle: number,
  soutien: number,
  candidatBoss: boolean
): RoleCreature[] {
  const roles: RoleCreature[] = [];
  const type = normaliserTheme(`${m.type} ${m.categorie ?? ""} ${(m.sousCategories ?? []).join(" ")}`);
  if (/animal|bete|bête/.test(type) || (m.niveau <= 1 && /loup|aigle|serpent|chauve/.test(normaliserTheme(m.nom)))) {
    roles.push("animal");
  }
  if (candidatBoss) roles.push("boss");
  if (m.niveau <= 1 && m.pvMax <= 15) roles.push("sbire");
  if (controle >= 0.35) roles.push("controleur");
  if (soutien >= 0.25) roles.push("soutien");
  if (distance) roles.push("tireur");
  if (m.niveau >= 6 && !candidatBoss) roles.push("elite");
  if (roles.length === 0) roles.push("combattant");
  return Array.from(new Set(roles));
}

/**
 * Construit le profil tactique d'une créature.
 * `candidatBoss` exige une capacité distinctive : un « sac de PV » ne devient
 * jamais boss par le seul poids de ses PV.
 */
export function profilDepuisMonstre(m: MonsterTemplate): ProfilCreature {
  const avertissements: string[] = [];
  const edition = editionDepuisMonstre(m);
  if (edition !== "cof2") {
    avertissements.push(`Source ${edition === "cof1" ? "COF1/V1" : "hors DRS"} : vérifier la compatibilité des statistiques avec COF2.`);
  }
  const texte = texteCapacites(m);
  const attaques = (m.attaques ?? []).map((a) => normaliserAttaque(m, a, texte));
  if (attaques.length === 0) avertissements.push("Aucune attaque structurée sur la fiche : le potentiel offensif est sous-estimé.");
  const nonLimitees = attaques.filter((a) => !a.limitee);
  const attaqueSoutenue = [...nonLimitees].sort(
    (a, b) => dprDepuisAttaques([b], 15) - dprDepuisAttaques([a], 15)
  )[0] ?? null;
  const meilleureAttaque = [...attaques].sort(
    (a, b) => dprDepuisAttaques([b], 15) - dprDepuisAttaques([a], 15)
  )[0] ?? null;
  // Attaques indépendantes par tour : la plus grande multiplicité déclarée sur
  // la fiche ("(2 attaques)", "1 attaque par tête"). Le multiplicateur est
  // appliqué PAR ATTAQUE dans dprDepuisAttaques ; ce champ sert à l'affichage
  // et à l'économie d'actions. La capacité « Attaques multiples » sans
  // précision dans le nom vaut 2 (borne basse explicite).
  const multipliciteMax = attaques.reduce((max, a) => Math.max(max, a.multiplicite ?? 1), 1);
  const capaciteMultiples = (m.capacites ?? []).some((c) => normaliserTheme(c).includes("attaques multiples"));
  const actionsAttaque = Math.max(multipliciteMax, capaciteMultiples ? 2 : 1);
  const controleCapacites = controleDeTexte(texte);
  const controleAttaques = attaques.reduce((max, a) => Math.max(max, a.controle), 0);
  const controle = Math.min(1, Math.max(controleCapacites, controleAttaques));
  const soutien = Math.min(1, meilleurIndice(texte, SOUTIEN_MOTS).valeur);
  const signature = signatureDe(m, texte);
  const facteurDegatsSubis = facteurResistance(texte);
  const distance = attaques.some((a) => a.distance);
  const pvMax = Math.max(1, m.pvMax ?? m.pv ?? 1);
  const candidatBoss =
    m.niveau >= 2 &&
    pvMax >= 10 &&
    (signature.length > 0 || controle >= 0.3 || soutien >= 0.3);

  if (!m.caracteristiques) avertissements.push("Caractéristiques absentes : les tests opposés ne sont pas modélisés.");
  if (edition === "hors-drs") avertissements.push("Créature hors DRS : ne pas la présenter comme un profil officiel COF2.");

  // La multiplicité est déjà appliquée par attaque dans dprDepuisAttaques :
  // pas de multiplication globale ici (cela compterait en double).
  const dprReference = dprDepuisAttaques(attaques, 15);
  // Part des dégâts issue d'attaques à vol de vie : elle sert à estimer la
  // durabilité supplémentaire que le vol de vie apporte (50 % des DM reviennent
  // en PV, donc la créature tient d'autant plus longtemps).
  const dprParAttaque = attaques.map((a) => dprDepuisAttaques([a], 15));
  const dprTotalAttaques = dprParAttaque.reduce((n, x) => n + x, 0);
  const partVolDeVie =
    dprTotalAttaques > 0
      ? Math.min(
          1,
          attaques.reduce((n, a, i) => n + (a.volDeVie ? dprParAttaque[i] : 0), 0) / dprTotalAttaques
        )
      : 0;

  return {
    id: m.id,
    nom: m.nom,
    nc: Number.isFinite(m.niveau) ? m.niveau : 0,
    edition,
    sourceLabel: libelleSource(m),
    template: m,
    roles: rolesDe(m, distance, controle, soutien, candidatBoss),
    pvMax,
    defense: Number.isFinite(m.defense) ? m.defense : 10,
    initiative: 10 + (Number.isFinite(m.initMod) ? m.initMod : 0),
    caracteristiques: { ...CARACS_VIDES, ...(m.caracteristiques ?? {}) },
    attaques,
    attaqueSoutenue,
    meilleureAttaque,
    actionsAttaque,
    dprReference,
    controle,
    soutien,
    regeneration: regenerationDepuisTexte(texte, Number.isFinite(m.niveau) ? m.niveau : 0),
    partVolDeVie,
    facteurDegatsSubis,
    rd: Math.max(0, m.rd ?? 0),
    signature,
    candidatBoss,
    // Économie d'actions : les attaques indépendantes déclarées ("(3 attaques)")
    // consomment chacune une attaque dans le tour, elles sont donc comptées.
    actionsParRound: actionsAttaque + (soutien >= 0.35 ? 0.35 : 0) + (controle >= 0.4 ? 0.2 : 0),
    avertissements,
  };
}

/**
 * Cache de profils pour la génération (le bestiaire est stable pendant une
 * recherche). Les profils restent des objets purs, sans état mutable.
 */
export function cacheProfils(bestiaire: MonsterTemplate[]): Map<string, ProfilCreature> {
  const cache = new Map<string, ProfilCreature>();
  for (const m of bestiaire) cache.set(m.id, profilDepuisMonstre(m));
  return cache;
}

export function profilDepuisCache(
  cache: Map<string, ProfilCreature>,
  bestiaire: MonsterTemplate[],
  id: string
): ProfilCreature | null {
  const direct = cache.get(id);
  if (direct) return direct;
  const m = bestiaire.find((x) => x.id === id);
  if (!m) return null;
  const profil = profilDepuisMonstre(m);
  cache.set(id, profil);
  return profil;
}
