// Profil de groupe : transforme des fiches de personnages (ou un groupe
// simplifié) en indices exploitables par l'évaluateur.
//
// Le mode « fiches » lit les vraies valeurs : PV, DEF, attaques équipées,
// sorts offensifs, soins, mana, chance, dés de récupération, objets magiques.
// Le mode « simplifié » fabrique des archétypes à partir des formules COF2
// (PV/DEF/attaque) : ce sont des HYPOTHÈSES du logiciel, affichées comme
// telles, jamais des fiches officielles.

import type { AttackDef, Character, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { FamilleCOF } from "@/src/lib/rules/personnage";
import {
  attaquesBase,
  deriverPersonnage,
  niveauAttaque,
  pvMaxBase,
  rangMaxVoie,
} from "@/src/lib/rules/personnage";
import { attaqueFromItem, attaqueFromSort } from "@/src/lib/rules/combat/factory";
import type {
  AttaqueEvaluee,
  EtatGroupe,
  GroupePJ,
  IndicePuissance,
  MembreGroupe,
} from "@/src/lib/encounters/types";
import {
  dprDepuisAttaques,
  indiceControle,
  indiceSoutien,
} from "@/src/lib/encounters/roles";
import { moyenneDegats, normaliserTheme } from "@/src/lib/encounters/rules";

const CARACS_VIDES = { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 };

function texteMembre(c: Pick<Character, "capacites" | "sorts">): string {
  const sorts = (c.sorts ?? []).map((s) => `${s.nom} ${s.type} ${s.effetCle ?? ""} ${s.description ?? ""}`);
  return normaliserTheme([...(c.capacites ?? []), ...sorts].join(" "));
}

function estDistancePJ(a: AttackDef, sort: Sort | undefined): boolean {
  if (sort) return true;
  if ((a.familles ?? []).some((f) => ["arcs", "arbaletes", "armes-de-jet"].includes(f))) return true;
  const t = normaliserTheme(`${a.nom} ${a.degatsAffiche ?? ""}`);
  return /arc|arbal|jet|distance|magique|\bm\b|\d+\s*m\b/.test(t);
}

function normaliserAttaquePJ(a: AttackDef, sort: Sort | undefined, texte: string): AttaqueEvaluee {
  const cle = normaliserTheme(`${a.nom} ${a.effetTouche?.cle ?? ""}`);
  const controle = Math.min(
    1,
    Math.max(
      indiceControle(cle),
      a.effetTouche ? 0.2 : 0,
      indiceControle(texte) * 0.5
    )
  );
  const limitee = a.action === "limitee" || (sort?.limiteCombat ?? 0) > 0;
  return {
    nom: a.nom,
    bonus: Number.isFinite(a.bonus) ? a.bonus : 0,
    degats: a.degats || "1d1-1",
    degatsMoyens: moyenneDegats(a.degats || "1d1-1"),
    distance: estDistancePJ(a, sort),
    limitee,
    toucheAuto: a.toucheAuto === true,
    controle,
    zone: sort?.zone === true,
    volDeVie: a.volDeVie === true,
    degatsParTour: a.effetTouche?.degatsParTour ? moyenneDegats(a.effetTouche.degatsParTour) : 0,
    // Une attaque de PJ = un jet : la notation « (N attaques) » est propre aux
    // fiches de créatures du bestiaire.
    multiplicite: 1,
    source: sort ? "sort" : a.id.startsWith("item:") ? "arme" : "fiche",
  };
}

function attaquesDepuisPersonnage(c: Character, catalogue: Item[], sorts: Sort[]): AttaqueEvaluee[] {
  const texte = texteMembre(c);
  const sortsParId = new Map(sorts.map((s) => [s.id, s]));
  const attaques: { attaque: AttackDef; sort?: Sort }[] = (c.attaques ?? []).map((a) => ({ attaque: a }));
  for (const entree of c.inventaire ?? []) {
    if (!entree.equipe) continue;
    const item = catalogue.find((i) => i.id === entree.itemId);
    if (!item) continue;
    const a = attaqueFromItem(item);
    if (a) attaques.push({ attaque: a });
  }
  const magique = niveauAttaque(c.niveau) + (c.caracteristiques?.VOL ?? 0);
  for (const sort of sorts) {
    const rangVoie = rangMaxVoie(c, sort.voie ?? "");
    const a = attaqueFromSort(sort, magique, c.caracteristiques ?? CARACS_VIDES, c.niveau, rangVoie);
    if (a) attaques.push({ attaque: a, sort: sortsParId.get(sort.id) });
  }
  return attaques.map(({ attaque, sort }) => normaliserAttaquePJ(attaque, sort, texte));
}

function bonusAttaqueRetenu(attaques: AttaqueEvaluee[]): number {
  const utiles = attaques.filter((a) => !a.limitee);
  const liste = utiles.length > 0 ? utiles : attaques;
  if (liste.length === 0) return 0;
  // Bonus de l'attaque qui produit le plus de dégâts attendus à DEF 15.
  return [...liste].sort((a, b) => dprDepuisAttaques([b], 15) - dprDepuisAttaques([a], 15))[0].bonus;
}

function soinsDepuisPersonnage(c: Character, sorts: Sort[], mana: number): { parAction: number; disponibles: number } {
  let parAction = 0;
  let disponibles = 0;
  for (const s of sorts) {
    if (!s.soin) continue;
    const montant = moyenneDegats(s.soin);
    if (montant <= 0) continue;
    const cout = Math.max(1, s.cout?.montant ?? s.rang ?? 1);
    const lancements = Math.max(1, Math.floor(mana / cout));
    parAction = Math.max(parAction, montant);
    disponibles += montant * lancements;
  }
  // Les capacités de soin sans montant chiffré ne sont pas converties en PV :
  // elles restent visibles dans les particularités, sans faux chiffre.
  const texte = texteMembre(c);
  if (disponibles === 0 && /soin|guerison|guérison/.test(texte) && mana > 0) {
    disponibles = Math.min(mana, 3) * 3;
    parAction = Math.max(parAction, 3);
  }
  return { parAction, disponibles: Math.round(disponibles * 10) / 10 };
}

function agregatRessources(membres: MembreGroupe[]): Record<string, { max: number; actuel: number }> {
  const out: Record<string, { max: number; actuel: number }> = {};
  for (const m of membres) {
    for (const [cle, r] of Object.entries(m.ressources ?? {})) {
      if (!out[cle]) out[cle] = { max: 0, actuel: 0 };
      out[cle].max += r.max ?? 0;
      out[cle].actuel += r.actuel ?? 0;
    }
  }
  return out;
}

function indiceDepuis(membres: MembreGroupe[], equipement: string[]): IndicePuissance {
  const offense = membres.reduce((n, m) => n + m.dpr, 0);
  const defense = membres.reduce((n, m) => n + m.pvMax, 0);
  const soins = membres.reduce((n, m) => n + m.soinsDisponibles, 0);
  const controle = membres.reduce((n, m) => n + m.controle, 0);
  const soutien = membres.reduce((n, m) => n + m.soutien, 0);
  const mana = membres.reduce((n, m) => n + m.mana, 0);
  const chance = membres.reduce((n, m) => n + m.chance, 0);
  const ressources =
    mana * 0.6 +
    chance * 1.5 +
    membres.reduce((n, m) => n + (m.desRecuperation?.actuel ?? 0), 0) * 2;
  return {
    offense,
    defense,
    soutien: soins + soutien * 10,
    controle: controle * 10,
    ressources,
    // Barème du logiciel (non officiel), commun au groupe réel et à la
    // référence simplifiée : il sert à comparer, pas à mesurer une règle.
    total:
      offense * 6 +
      defense * 0.35 +
      soins * 0.5 +
      controle * 12 +
      soutien * 6 +
      ressources +
      equipement.length * 8,
  };
}

function etatDepuisTaux(tauxPv: number): EtatGroupe {
  if (tauxPv >= 0.9) return "frais";
  if (tauxPv >= 0.55) return "entame";
  return "epuise";
}

function groupeBase(
  mode: "fiches" | "simplifie",
  membres: MembreGroupe[],
  etat: EtatGroupe,
  hypotheses: string[],
  avertissements: string[],
  options: { calculerReference?: boolean } = {}
): GroupePJ {
  const nombre = membres.length;
  const pvTotal = membres.reduce((n, m) => n + m.pvMax, 0);
  const pvActuel = membres.reduce((n, m) => n + m.pv, 0);
  const equipementMagique = Array.from(new Set(membres.flatMap((m) => m.equipementMagique)));
  const indice = indiceDepuis(membres, equipementMagique);
  const niveaux = membres.map((m) => m.niveau);
  const niveauMoyen =
    nombre > 0 ? niveaux.reduce((n, v) => n + v, 0) / nombre : 1;
  // Référence : un groupe simplifié de même effectif et de même niveau moyen.
  // L'écart de puissance est converti en niveaux avec la même base logarithmique
  // que la correction tactique (1,35 par niveau), borné à ±1,5.
  // Le groupe simplifié est lui-même sa référence (pas de récursion).
  const referenceTotal =
    options.calculerReference === false || nombre === 0
      ? indice.total
      : groupeSimplifie(nombre, niveauMoyen, { etat: "frais", silencieux: true }).indice.total;
  const ratio = referenceTotal > 0 ? indice.total / referenceTotal : 1;
  const ajustement =
    nombre === 0 ? 0 : Math.max(-1.5, Math.min(1.5, Math.log(Math.max(0.2, ratio)) / Math.log(1.35)));
  const niveauEffectif = nombre === 0 ? 0 : Math.round((niveauMoyen + ajustement) * 20) / 20;
  const dpr = membres.reduce((n, m) => n + m.dpr, 0);
  const poidsAttaque = membres.reduce((n, m) => n + (m.dpr > 0 ? m.dpr : 0), 0);
  return {
    mode,
    membres,
    nombre,
    etat,
    niveauMoyen: Math.round(niveauMoyen * 20) / 20,
    niveauEffectif,
    pvTotal,
    pvActuel,
    tauxPv: pvTotal > 0 ? pvActuel / pvTotal : 1,
    defenseMoyenne: nombre > 0 ? membres.reduce((n, m) => n + m.defense, 0) / nombre : 10,
    initiativeMoyenne: nombre > 0 ? membres.reduce((n, m) => n + m.initiative, 0) / nombre : 10,
    dpr,
    dprBurst: membres.reduce((n, m) => n + m.dprBurst, 0),
    bonusAttaqueMoyen:
      poidsAttaque > 0
        ? membres.reduce((n, m) => n + m.bonusAttaque * m.dpr, 0) / poidsAttaque
        : nombre > 0
          ? membres.reduce((n, m) => n + m.bonusAttaque, 0) / nombre
          : 0,
    soinsDisponibles: membres.reduce((n, m) => n + m.soinsDisponibles, 0),
    soinParAction: nombre > 0 ? membres.reduce((n, m) => n + m.soinParAction, 0) / nombre : 0,
    controle: membres.reduce((n, m) => n + m.controle, 0),
    soutien: membres.reduce((n, m) => n + m.soutien, 0),
    equipementMagique,
    ressources: agregatRessources(membres),
    indice,
    hypotheses,
    avertissements,
  };
}

/** Profil détaillé d'un personnage. `sorts` déjà complétés par le grimoire. */
export function membreDepuisPersonnage(c: Character, catalogue: Item[] = []): MembreGroupe {
  const d = deriverPersonnage(c, catalogue);
  const sorts = (c.sorts ?? []).map((s) => ({ ...s }));
  const attaques = attaquesDepuisPersonnage(c, catalogue, sorts);
  const mana = Math.max(0, c.ressources?.mana?.actuel ?? 0);
  const manaMax = Math.max(mana, c.ressources?.mana?.max ?? 0);
  const chance = Math.max(0, c.ressources?.chance?.actuel ?? 0);
  const chanceMax = Math.max(chance, c.ressources?.chance?.max ?? 0);
  const soins = soinsDepuisPersonnage(c, sorts, mana);
  const texte = texteMembre(c);
  const controle = Math.min(1, indiceControle(texte));
  const soutien = Math.min(1, indiceSoutien(texte));
  const equipementMagique = (c.inventaire ?? [])
    .map((e) => catalogue.find((i) => i.id === e.itemId))
    .filter((i): i is Item => !!i && i.magique === true)
    .map((i) => i.nom);
  const pvMax = Math.max(1, c.pvMax || d.pvMax);
  const pv = Math.max(0, Math.min(c.pv, pvMax));
  const particularites: string[] = [];
  if (manaMax > 0) particularites.push(`Mana ${mana}/${manaMax}`);
  if (chanceMax > 0) particularites.push(`Chance ${chance}/${chanceMax}`);
  if (equipementMagique.length > 0) particularites.push(`Équipement magique : ${equipementMagique.join(", ")}`);
  if (c.capacites?.some((x) => normaliserTheme(x).includes("robustesse"))) particularites.push("Robustesse (PV)");
  if (c.famillePredilection) particularites.push("Maître d'armes");
  if (soins.disponibles > 0) particularites.push(`Soins estimés ${soins.disponibles} PV`);
  if (controle >= 0.35) particularites.push("Contrôle");
  if (soutien >= 0.25) particularites.push("Soutien");
  if (c.compagnon) particularites.push("Compagnon animal (non compté dans le groupe)");
  if (pv / pvMax < 0.5) particularites.push("PV bas");

  const ressources: Record<string, { max: number; actuel: number }> = {};
  for (const [cle, r] of Object.entries(c.ressources ?? {})) ressources[cle] = { max: r.max, actuel: r.actuel };

  return {
    characterId: c.id,
    nom: c.nom,
    niveau: c.niveau,
    famille: c.famille,
    profil: c.profil || c.classe,
    pv,
    pvMax,
    defense: Math.max(c.defense, d.defense),
    initiative: d.initiative,
    attaques,
    attaqueSoutenue: [...attaques.filter((a) => !a.limitee)].sort(
      (a, b) => dprDepuisAttaques([b], 15) - dprDepuisAttaques([a], 15)
    )[0] ?? attaques[0] ?? null,
    meilleureAttaque: [...attaques].sort(
      (a, b) => dprDepuisAttaques([b], 15) - dprDepuisAttaques([a], 15)
    )[0] ?? null,
    bonusAttaque: bonusAttaqueRetenu(attaques),
    dpr: dprDepuisAttaques(attaques, 15),
    dprBurst: dprDepuisAttaques(attaques, 15, { poidsSort: 1, poidsLimitee: 1 }),
    soinsDisponibles: soins.disponibles,
    soinParAction: soins.parAction,
    ressources,
    mana,
    manaMax,
    chance,
    chanceMax,
    desRecuperation: c.desRecuperation ?? null,
    equipementMagique,
    capacites: [...(c.capacites ?? [])],
    sorts: sorts.map((s) => s.nom),
    controle,
    soutien,
    particularites,
    tauxPv: pvMax > 0 ? pv / pvMax : 1,
    tauxMana: manaMax > 0 ? mana / manaMax : 1,
  };
}

/** Profil complet d'un groupe à partir des fiches sélectionnées. */
export function groupeDepuisFiches(
  personnages: Character[],
  options: { catalogue?: Item[]; etat?: EtatGroupe; noms?: string[] } = {}
): GroupePJ {
  const catalogue = options.catalogue ?? [];
  const membres = personnages.map((c) => membreDepuisPersonnage(c, catalogue));
  const taux = membres.length > 0 ? membres.reduce((n, m) => n + m.tauxPv, 0) / membres.length : 1;
  const etat = options.etat ?? etatDepuisTaux(taux);
  const hypotheses = [
    "Profil construit à partir des fiches : PV, DEF, attaques équipées, sorts, mana, chance et dés de récupération.",
    "Les soins disponibles sont estimés à partir des sorts de soin et du mana restant ; les capacités narratives non chiffrées ne sont pas converties en PV.",
    "Les objets magiques sont lus dans le catalogue ; leurs effets hors DEF/PV ne sont pas simulés.",
    `Niveau effectif = niveau moyen corrigé de la puissance du groupe (référence simplifiée, borné ±1,5) : ${membres.length > 0 ? "estimation logiciel" : "groupe vide"}.`,
    `État retenu : ${etat}${options.etat ? " (choix du MJ)" : " (déduit du taux de PV actuel)"}.`,
  ];
  const avertissements: string[] = [];
  if (membres.length === 0) avertissements.push("Aucun personnage sélectionné.");
  for (const m of membres) {
    if (m.attaques.length === 0) avertissements.push(`${m.nom} n'a aucune attaque exploitable : vérifier l'équipement et les sorts.`);
    if (m.tauxPv < 0.35) avertissements.push(`${m.nom} est très blessé (${m.pv}/${m.pvMax} PV).`);
  }
  return groupeBase("fiches", membres, etat, hypotheses, avertissements);
}

/** Archétype du mode simplifié (hypothèses du logiciel, pas une règle COF2).
 *
 * Dégâts : dé de l'arme (table DRS « Armes ») + Mod. de caractéristique
 * SELON LA RÈGLE OFFICIELLE — « Le Mod. de FOR s'ajoute aux DM des armes de
 * contact. Aucun Mod. n'est ajouté aux armes à distance » (DRS « Dommages »).
 * Le sort offensif du Mage suit sa propre approximation (voir plus bas).
 *
 * La progression avec le niveau n'est PAS un bonus de niveau (inexistant en
 * COF2) mais un terme configurable `progressionDegatsParNiveau` qui
 * approxime les capacités de voie (dés évolutifs). Voir ConfigurationMoteur.
 */
const ARCHETYPES: Record<
  FamilleCOF,
  {
    nom: string;
    caracs: { AGI: number; CON: number; FOR: number; PER: number; CHA: number; INT: number; VOL: number };
    equipement: number;
    arme: string;
    /** Dé de dégâts de l'arme (table DRS « Armes »). */
    deArme: string;
    /** Modificateur de dégâts selon la règle COF2 (contact : FOR ; distance : 0). */
    modificateurDegats: (caracs: Record<string, number>) => number;
    distance: boolean;
    soins: number;
    mana: number;
  }
> = {
  Combattant: {
    nom: "Combattant",
    caracs: { AGI: 1, CON: 2, FOR: 3, PER: 0, CHA: 0, INT: 0, VOL: 0 },
    equipement: 4,
    arme: "Épée longue",
    deArme: "1d8",
    modificateurDegats: (c) => Math.max(0, c.FOR),
    distance: false,
    soins: 0,
    mana: 0,
  },
  Aventurier: {
    nom: "Aventurier",
    caracs: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 1, INT: 0, VOL: 0 },
    equipement: 2,
    arme: "Arc long",
    deArme: "1d8",
    // Règle COF2 : aucun Mod. aux armes à distance.
    modificateurDegats: () => 0,
    distance: true,
    soins: 0,
    mana: 0,
  },
  Mystique: {
    nom: "Mystique",
    caracs: { AGI: 1, CON: 1, FOR: 0, PER: 2, CHA: 1, INT: 1, VOL: 3 },
    equipement: 2,
    arme: "Masse d'armes",
    deArme: "1d6",
    modificateurDegats: (c) => Math.max(0, c.FOR),
    distance: false,
    soins: 8,
    mana: 4,
  },
  Mage: {
    nom: "Mage",
    caracs: { AGI: 1, CON: 1, FOR: -1, PER: 1, CHA: 0, INT: 2, VOL: 4 },
    equipement: 0,
    arme: "Dague",
    deArme: "1d4",
    modificateurDegats: (c) => Math.max(0, c.FOR),
    distance: false,
    soins: 0,
    mana: 6,
  },
};

/**
 * Groupe simplifié : effectif + niveau seulement.
 * Répartition par défaut : Combattant, Aventurier, Mystique, Mage (cyclique).
 * Hypothèses explicites : caractéristiques d'archétype, équipement standard,
 * aucun objet magique, état uniforme. Le MJ peut fournir `familles`.
 */
export function groupeSimplifie(
  nombre: number,
  niveau: number,
  options: {
    familles?: FamilleCOF[];
    etat?: EtatGroupe;
    tauxPv?: number;
    silencieux?: boolean;
    /**
     * Dégâts ajoutés par niveau aux archétypes (hypothèse du logiciel).
     * 0 = dégâts strictement COF2 « arme + Mod. ».
     */
    progressionDegatsParNiveau?: number;
    /**
     * DEF ajoutée par niveau aux archétypes (hypothèse du logiciel).
     * 0 = DEF strictement « 10 + AGI + Équipement ».
     */
    progressionDefParNiveau?: number;
  } = {}
): GroupePJ {
  const n = Math.max(1, Math.min(20, Math.floor(nombre)));
  const niv = Math.max(1, Math.min(20, Math.floor(niveau)));
  const etat = options.etat ?? "frais";
  const tauxPv = options.tauxPv ?? (etat === "frais" ? 1 : etat === "entame" ? 0.65 : 0.4);
  const familles = options.familles && options.familles.length > 0
    ? options.familles
    : (["Combattant", "Aventurier", "Mystique", "Mage"] as FamilleCOF[]);
  // Progression des capacités de voie (hypothèse configurable). Pas un bonus
  // de niveau : un personnage de niveau 1 n'a pas encore de capacité.
  const progression = Math.max(
    0,
    Math.round((options.progressionDegatsParNiveau ?? 0.5) * (niv - 1))
  );
  const progressionDefense = (options.progressionDefParNiveau ?? 0.3) * (niv - 1);
  const membres: MembreGroupe[] = [];
  for (let i = 0; i < n; i++) {
    const famille = familles[i % familles.length];
    const a = ARCHETYPES[famille];
    const caracs = { ...a.caracs };
    const pvMax = pvMaxBase(famille, caracs.CON, niv);
    const pv = Math.max(1, Math.round(pvMax * tauxPv));
    const defense = 10 + caracs.AGI + a.equipement + progressionDefense;
    const attaques = attaquesBase(niv, caracs);
    const bonus = a.distance ? attaques.distance : attaques.contact;
    const bonusMagique = attaques.magique;
    // Dé de l'arme (table DRS) + Mod. selon la règle COF2, puis progression
    // des capacités (approximation configurable, arrondie).
    const modificateur = a.modificateurDegats(caracs) + progression;
    const exprArme = `${a.deArme}+${modificateur}`;
    const arme: AttaqueEvaluee = {
      nom: a.arme,
      bonus,
      degats: exprArme,
      degatsMoyens: moyenneDegats(exprArme),
      distance: a.distance,
      limitee: false,
      toucheAuto: false,
      controle: 0,
      zone: false,
      volDeVie: false,
      degatsParTour: 0,
      multiplicite: 1,
      source: "arme",
    };
    const attaquesListe = [arme];
    if (famille === "Mage") {
      // Approximation d'un sort offensif : dé 2d6 (hypothèse de rang moyen)
      // + VOL ; la progression des capacités s'applique aussi au sort.
      const exprSort = `2d6+${Math.max(0, caracs.VOL) + progression}`;
      attaquesListe.push({
        nom: "Sort offensif (archétype)",
        bonus: bonusMagique,
        degats: exprSort,
        degatsMoyens: moyenneDegats(exprSort),
        distance: true,
        limitee: false,
        toucheAuto: false,
        controle: 0.1,
        zone: false,
        volDeVie: false,
        degatsParTour: 0,
        multiplicite: 1,
        source: "sort",
      });
    }
    const manaMax = a.mana;
    const soins = a.soins > 0 ? a.soins * Math.max(1, Math.floor(manaMax / 2)) : 0;
    membres.push({
      nom: `${a.nom} ${i + 1}`,
      niveau: niv,
      famille,
      profil: `${a.nom} (simplifié)`,
      pv,
      pvMax,
      defense,
      initiative: 10 + caracs.PER,
      attaques: attaquesListe,
      attaqueSoutenue: arme,
      meilleureAttaque: attaquesListe[attaquesListe.length - 1],
      bonusAttaque: bonus,
      dpr: dprDepuisAttaques(attaquesListe, 15),
      dprBurst: dprDepuisAttaques(attaquesListe, 15, { poidsSort: 1, poidsLimitee: 1 }),
      soinsDisponibles: soins,
      soinParAction: a.soins,
      ressources: {
        mana: { max: manaMax, actuel: Math.round(manaMax * tauxPv) },
        chance: { max: 2, actuel: 2 },
      },
      mana: Math.round(manaMax * tauxPv),
      manaMax,
      chance: 2,
      chanceMax: 2,
      desRecuperation: { type: famille === "Combattant" ? "d10" : famille === "Mage" ? "d6" : "d8", max: 2 + caracs.CON, actuel: Math.max(0, 2) },
      equipementMagique: [],
      capacites: ["Archétype simplifié"],
      sorts: famille === "Mage" ? ["Sort offensif (archétype)"] : famille === "Mystique" ? ["Soin (archétype)"] : [],
      controle: famille === "Mage" ? 0.25 : 0,
      soutien: famille === "Mystique" ? 0.5 : 0,
      particularites: ["Profil simplifié : hypothèses du logiciel"],
      tauxPv: pv / pvMax,
      tauxMana: manaMax > 0 ? Math.round(manaMax * tauxPv) / manaMax : 1,
    });
  }
  const hypotheses = options.silencieux
    ? []
    : [
        "Mode simplifié : effectif et niveau seulement, sans lire les fiches.",
        "Archétypes : Combattant (épée longue 1d8 + FOR), Aventurier (arc long 1d8, sans Mod. car arme à distance), Mystique (masse d'armes 1d6 + FOR, soins), Mage (dague 1d4 + sort offensif).",
        "Règles appliquées telles quelles : DEF 10+AGI+Équipement, dégâts = dé de l'arme + Mod. de FOR (contact) et aucun Mod. (distance), attaque = niveau + Mod. (DRS « Attaque » et « Dommages »).",
        `HYPOTHÈSES DU LOGICIEL (configurables) : +${progression} DM et +${Math.round(progressionDefense * 10) / 10} DEF de progression de capacités à ce niveau — elles approximent les capacités achetées avec les 2 points de capacité par niveau (dégâts : Spécialisation ; DEF : Armure de mana, Peau d'écorce, Vêtements sacrés…), pas une règle de niveau automatique.`,
        "Autres hypothèses : caractéristiques d'archétype, équipement standard, aucun objet magique, pas de capacité de contrôle/soutien hors archétype.",
        "Ces valeurs ne sont PAS des fiches officielles : elles servent à obtenir un ordre de grandeur quand le MJ ne veut pas saisir chaque PJ.",
        `État appliqué à tous : ${etat} (${Math.round(tauxPv * 100)} % des PV).`,
      ];
  return groupeBase("simplifie", membres, etat, hypotheses, [], { calculerReference: false });
}
