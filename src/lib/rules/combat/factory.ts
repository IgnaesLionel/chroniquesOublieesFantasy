import type { AttackDef, Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { categoriesMonstre } from "@/src/lib/rules/categories";
import { substituerDeEvolutif, substituerDesEvolutifs, substituerStats, dureeEffetSort, resoudreFormuleSort } from "@/src/lib/rules/dice/roller";
import { bonusBouclier, deEvolutif, deriverPersonnage, niveauAttaque, rangMaxVoie } from "@/src/lib/rules/personnage";
import { compterCapacites, niveauMinRang, normaliserNomCapacite } from "@/src/lib/rules/creation";
import { completerSortsDepuisGrimoire } from "@/src/lib/rules/personnage";

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Convertit une arme d'inventaire en attaque. */
export function attaqueFromItem(item: Item): AttackDef | null {
  if (!item.estArme) return null;
  return {
    id: `item:${item.id}`,
    nom: `🗡 ${item.nom}`,
    bonus: item.bonusAttaque ?? 0,
    degats: item.degats ?? "1d6",
    familles: item.familles ? [...item.familles] : undefined,
    effetTouche: item.effetCle ? { cle: item.effetCle, duree: item.effetDuree ?? null } : undefined,
  };
}

/** Convertit un sort offensif en attaque.
 * Sans dégâts (Malédiction, Peur...) : jet d'attaque + effet éventuel, 0 DM
 * (convention du moteur : 0 = "1d1-1"). Sans bonus explicite : attaque
 * magique du lanceur (passée par participantFromCharacter : niv+VOL).
 * Les caracs ("1d4°+INT"), le dé évolutif legacy ("1dE") et les dés
 * évolutifs ("1d4°" -> faces selon le niveau : d4 1-5, d6 6-8, d8 9-11,
 * d10 12-14, d12 15+) sont substitués.
 * Dégâts au rang de voie (degatsParRangVoie, ex: Arc de feu 1d4° puis 2d4°
 * au rang 4) : rangVoie = rang max du lanceur dans la voie du sort.
 * Sauvegarde et durée formulaires ("10+INT", "INT*10") résolues avec les
 * caracs du lanceur + RANG (rang de voie).
 * Action, vol de vie, touche auto, moitié si raté et effet au toucher
 * (dégâts par tour + modificateurs) suivent la fiche du sort. */
export function attaqueFromSort(sort: Sort, bonusMagique = 0, caracs: Record<string, number> = {}, niveauDe = 1, rangVoie = 1): AttackDef | null {
  if (sort.type !== "offensif") return null;
  const contexte = { ...caracs, RANG: Math.max(1, Math.floor(rangVoie)) };
  const degatsBruts = degatsSortAuRangVoie(sort, rangVoie) ?? sort.degats;
  const sauvegarde = sort.effetSauvegarde
    ? {
        carac: sort.effetSauvegarde.carac,
        difficulte: resoudreFormuleSort(sort.effetSauvegarde.difficulte, contexte),
        ...(sort.effetSauvegarde.moitieDM ? { moitieDM: true as const } : {}),
      }
    : undefined;
  const duree = dureeEffetSort(sort.effetDuree, caracs, rangVoie, niveauDe);
  return {
    id: `sort:${sort.id}`,
    nom: `✦ ${sort.nom}`,
    bonus: sort.bonus ?? bonusMagique,
    degats: degatsBruts ? substituerDesEvolutifs(substituerDeEvolutif(substituerStats(degatsBruts, caracs), deEvolutif(niveauDe)), deEvolutif(niveauDe)) : "1d1-1",
    action: sort.action ?? "attaque",
    volDeVie: sort.volDeVie,
    toucheAuto: sort.toucheAuto,
    demiDegatsSiRate: sort.demiDegatsSiRate,
    effetTouche: (sort.effetCle || sort.effetSauvegarde || sort.effetDegats) ? { cle: sort.effetCle ?? sort.nom, duree, degatsParTour: sort.effetDegats, mods: sort.effetMods, sauvegarde } : undefined,
  };
}

/** Dégâts du sort au rang de voie du lanceur (plafonné au dernier palier). */
export function degatsSortAuRangVoie(sort: Pick<Sort, "degatsParRangVoie">, rangVoie: number): string | undefined {
  const paliers = sort.degatsParRangVoie;
  if (!paliers || paliers.length === 0) return undefined;
  return paliers[Math.min(Math.max(1, Math.floor(rangVoie)), paliers.length) - 1];
}

/**
 * PJ -> participant (initiative à lancer ensuite).
 * Les armes ÉQUIPÉES de l'inventaire et les sorts offensifs deviennent des attaques
 * (bonus d'attaque magique = niv+VOL, sauf bonus explicite du sort).
 */
export function participantFromCharacter(c: Character, catalogue: Item[] = []): CombatParticipant {
  // Sorts appris avant l'ajout de champs mécaniques (toucheAuto, cibleEspeces) :
  // complétés depuis le grimoire (jamais écrasés s'ils sont définis).
  const sortsRef = completerSortsDepuisGrimoire(c.sorts ?? []);
  const attaques: AttackDef[] = [...c.attaques];
  for (const entree of c.inventaire ?? []) {
    if (!entree.equipe) continue;
    const item = catalogue.find((i) => i.id === entree.itemId);
    if (!item) continue;
    const a = attaqueFromItem(item);
    if (a) attaques.push(a);
  }
  const magique = niveauAttaque(c.niveau) + c.caracteristiques.VOL;
  for (const sort of sortsRef) {
    const rangVoie = rangMaxVoie(c, sort.voie ?? "");
    const a = attaqueFromSort(sort, magique, c.caracteristiques, c.niveau, rangVoie);
    if (a) attaques.push(a);
  }
  // Verrou de niveau par sort (gratuité Mage déduite) pour les panneaux.
  const compte = compterCapacites(c);
  const sorts = sortsRef.map((s) => {
    if (s.voie == null || s.rang == null) return { ...s };
    const gratuit =
      compte.rang2Nom != null && normaliserNomCapacite(compte.rang2Nom) === normaliserNomCapacite(s.nom);
    return { ...s, niveauMin: gratuit ? 1 : niveauMinRang(s.rang) };
  });
  return {
    instanceId: uid("p"),
    templateId: c.id,
    nom: c.nom,
    camp: "pj",
    pvMax: c.pvMax,
    pv: c.pv,
    // DEF stockée, mais jamais en dessous de la dérivée (armures/boucliers équipés
    // inclus) : une fiche non recalculée part quand même avec son bonus en combat.
    // Un bonus MJ manuel supérieur est conservé (max).
    defense: Math.max(c.defense, deriverPersonnage(c, catalogue).defense),
    initMod: c.initMod,
    initiative: null,
    attaques,
    effets: [],
    sorts,
    capacites: [...(c.capacites ?? [])],
    ressources: { ...c.ressources },
    niveau: c.niveau,
    statut: c.pv <= 0 ? "ko" : "actif",
    // Bouclier manié (mod. DEF) : prérequis Voie du bouclier, figé à l'entrée.
    bouclierBonus: bonusBouclier(c.inventaire ?? [], catalogue),
    bonusMagique: magique,
    caracs: { ...c.caracteristiques },
    profil: c.profil || c.classe,
    usagesSorts: {},
    // Compteurs journaliers de la fiche (mineure, phénix...) : suivis en combat.
    ...(c.usagesJournaliers ? { usagesJournaliers: { ...c.usagesJournaliers } } : {}),
    // Dé de récupération de la fiche : sert à la brûlure de mana (1 DR par PM).
    ...(c.desRecuperation ? { deRecuperation: c.desRecuperation.type } : {}),
    // Maître d'armes (fiche) : prédilection + Spécialisation -> auto-moteur.
    ...(c.famillePredilection ? { famillePredilection: c.famillePredilection } : {}),
    ...(c.bonusSpecialisation ? { bonusSpecialisation: c.bonusSpecialisation } : {}),
  };
}

/** Base d'un nom d'instance ("Rat géant #2" -> "Rat géant"). */
export function nomBaseInstance(nom: string): string {
  return nom.replace(/\s+#\d+\s*$/, "").trim();
}

/**
 * Renumérote les monstres de même nom sur tout le groupe : 1 seul -> nom
 * de base ("Rat géant"), N -> "Rat géant #1..N" dans l'ordre.
 * Sert quand on ajoute un même type en plusieurs fois (2 rats puis 1 rat :
 * sans ça, deux "Rat géant #1" ou trois "Rat géant" indistinguables).
 * PJ et compagnons : inchangés (les doublons PJ restent signalés à la fin).
 */
export function renommerDoublonsMonstres(participants: CombatParticipant[]): CombatParticipant[] {
  const totaux = new Map<string, number>();
  for (const p of participants) {
    if (p.camp !== "monstre") continue;
    const base = nomBaseInstance(p.nom);
    totaux.set(base, (totaux.get(base) ?? 0) + 1);
  }
  const compteurs = new Map<string, number>();
  return participants.map((p) => {
    if (p.camp !== "monstre") return p;
    const base = nomBaseInstance(p.nom);
    if ((totaux.get(base) ?? 0) <= 1) {
      return p.nom === base ? p : { ...p, nom: base };
    }
    const i = (compteurs.get(base) ?? 0) + 1;
    compteurs.set(base, i);
    const nom = `${base} #${i}`;
    return p.nom === nom ? p : { ...p, nom };
  });
}

/** Template monstre x N -> instances "Gobelin #1..N" aux PV indépendants. */
export function monsterInstances(template: MonsterTemplate, count: number): CombatParticipant[] {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => ({
    instanceId: uid("m"),
    templateId: template.id,
    nom: n === 1 ? template.nom : `${template.nom} #${i + 1}`,
    camp: "monstre" as const,
    pvMax: template.pvMax,
    pv: template.pv,
    defense: template.defense,
    initMod: template.initMod,
    initiative: null,
    attaques: template.attaques,
    effets: [],
    sorts: [],
    capacites: [...(template.capacites ?? [])],
    ressources: {},
    niveau: template.niveau,
    statut: "actif" as const,
    // Pas d'inventaire : aucun bouclier (les monstres à bouclier passent par le MJ).
    bouclierBonus: null,
    usagesSorts: {},
    // Caracs DRS (000 si fiche incomplète, à compléter par le MJ) :
    // tests contre les monstres (10+CON...).
    caracs: { ...(template.caracteristiques ?? { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 }) },
    // Espèces du template (type + catégorie + sous-catégories, normalisées) :
    // dégâts bonus contre certaines espèces (armes bénies, Destruction du mal...).
    categories: categoriesMonstre(template),
    sousCategories: [...(template.sousCategories ?? [])],
  }));
}

export function resetUidCounter() {
  counter = 0;
}
