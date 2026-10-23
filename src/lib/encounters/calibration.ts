// Simulation Monte-Carlo simplifiée pour vérifier une composition candidate.
//
// Ce n'est PAS le moteur de combat tactique de l'application : pas de
// positions, pas de couverts, pas de séquence de sorts complète. C'est un
// modèle d'usure destiné à la calibration et aux indicateurs affichés
// (rounds moyens, PV perdus, KO, taux de victoire).
//
// Toutes les valeurs de créatures viennent des profils (fiches) ; les choix
// tactiques sont des heuristiques explicitement documentées ci-dessous.

import type { AttackDef } from "@/src/lib/rules/types";
import { rollDiceExpression } from "@/src/lib/rules/dice/roller";
import type {
  AttaqueEvaluee,
  EvaluationRencontre,
  GroupePJ,
  MembreGroupe,
  ProfilCreature,
  ResultatSimulation,
} from "@/src/lib/encounters/types";
import { probabiliteToucher } from "@/src/lib/encounters/rules";
import { mulberry32, type Rng } from "@/src/lib/encounters/random";

interface Combattant {
  id: string;
  nom: string;
  camp: "pj" | "ennemi";
  pv: number;
  pvMax: number;
  defense: number;
  initiative: number;
  attaques: AttaqueEvaluee[];
  controle: number;
  soutien: number;
  /**
   * Régénération passive (PV/round) déclarée sur la fiche, 0 sinon.
   *
   * Elle s'applique seule, sans action et sans ressource : c'est la capacité
   * de régénération de la créature. Le « soutien » générique (commandement,
   * invocation, protection) ne soigne PAS — un capitaine ne rend pas de PV.
   */
  regeneration: number;
  facteurDegatsSubis: number;
  rd: number;
  mana: number;
  soins: number;
  soinParAction: number;
  perdTour: boolean;
  /** Ressources initiales pour le bilan de dépense. */
  manaInitial: number;
  soinsInitial: number;
}

export interface OptionsSimulation {
  iterations?: number;
  graine?: number;
  maxRounds?: number;
}

function initiative(rng: Rng, base: number): number {
  return base + rng() * 5;
}

function combattantsDepuisEvaluation(evaluation: EvaluationRencontre, party: GroupePJ, rng: Rng): Combattant[] {
  const out: Combattant[] = [];
  party.membres.forEach((m: MembreGroupe, i) => {
    out.push({
      id: `pj-${i}`,
      nom: m.nom,
      camp: "pj",
      pv: m.pv,
      pvMax: m.pvMax,
      defense: m.defense,
      initiative: initiative(rng, m.initiative),
      attaques: m.attaques,
      controle: m.controle,
      soutien: m.soutien,
      regeneration: 0,
      facteurDegatsSubis: 1,
      rd: 0,
      mana: m.mana,
      soins: m.soinsDisponibles,
      soinParAction: m.soinParAction,
      perdTour: false,
      manaInitial: m.manaMax,
      soinsInitial: m.soinsDisponibles,
    });
  });
  let index = 0;
  for (const slot of evaluation.slots) {
    for (let i = 0; i < Math.max(1, slot.quantite); i++) {
      const p: ProfilCreature = slot.profil;
      out.push({
        id: `ennemi-${index++}`,
        nom: slot.quantite > 1 ? `${p.nom} #${i + 1}` : p.nom,
        camp: "ennemi",
        pv: p.pvMax,
        pvMax: p.pvMax,
        defense: p.defense,
        initiative: initiative(rng, p.initiative),
        attaques: p.attaques,
        controle: p.controle,
        soutien: p.soutien,
        regeneration: p.regeneration,
        facteurDegatsSubis: p.facteurDegatsSubis,
        rd: p.rd,
        mana: 0,
        soins: 0,
        soinParAction: 0,
        perdTour: false,
        manaInitial: 0,
        soinsInitial: 0,
      });
    }
  }
  // Les états initiaux du groupe sont déjà dans les PV ; l'état « épuisé »
  // n'ajoute pas de malus caché dans la simulation (il est déjà dans les PV).
  return out;
}
function vivants(liste: Combattant[], camp?: "pj" | "ennemi"): Combattant[] {
  return liste.filter((c) => c.pv > 0 && (!camp || c.camp === camp));
}

function choisirCible(rng: Rng, liste: Combattant[]): Combattant | null {
  const cibles = vivants(liste);
  if (cibles.length === 0) return null;
  // 55 % : la cible la plus faible (focalisation), 45 % : au hasard.
  if (rng() < 0.55) {
    return [...cibles].sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
  }
  return cibles[Math.floor(rng() * cibles.length)];
}

function choisirAllieBlesse(rng: Rng, liste: Combattant[], camp: "pj" | "ennemi"): Combattant | null {
  const allies = vivants(liste, camp).filter((c) => c.pv / c.pvMax < 0.6);
  if (allies.length === 0) return null;
  return allies[Math.floor(rng() * allies.length)];
}

function degatsAttaque(rng: Rng, attaque: AttaqueEvaluee): number {
  const brut = rollDiceExpression(attaque.degats || "1d1-1", rng).total;
  return Math.max(0, brut + attaque.degatsParTour * 0.5);
}

function poidsAttaque(a: AttaqueEvaluee): number {
  let p = Math.max(0.5, a.degatsMoyens);
  if (a.limitee) p *= 0.3;
  if (a.source === "sort") p *= 0.55;
  return p;
}

function choisirAttaque(rng: Rng, attaques: AttaqueEvaluee[], aMana: boolean): AttaqueEvaluee | null {
  const dispo = attaques.filter((a) => (a.source === "sort" ? aMana : true));
  const liste = dispo.length > 0 ? dispo : attaques;
  if (liste.length === 0) return null;
  const total = liste.reduce((n, a) => n + poidsAttaque(a), 0);
  let t = rng() * total;
  for (const a of liste) {
    t -= poidsAttaque(a);
    if (t <= 0) return a;
  }
  return liste[liste.length - 1];
}

function attaquer(rng: Rng, attaquant: Combattant, cible: Combattant, tous: Combattant[]): number {
  const a = choisirAttaque(rng, attaquant.attaques, attaquant.mana > 0);
  if (!a) return 0;
  if (a.source === "sort" && attaquant.mana > 0) attaquant.mana -= 1;
  // Attaques indépendantes déclarées sur la fiche ("(2 attaques)") : chacune
  // est un jet séparé et peut viser une cible différente (DRS « Attaques
  // multiples »). On garde la même cible si elle est encore debout, sinon la
  // suivante.
  const nb = Math.max(1, a.multiplicite ?? 1);
  const adversaires = cible.camp === "pj" ? vivants(tous, "pj") : vivants(tous, "ennemi");
  let total = 0;
  for (let i = 0; i < nb; i++) {
    const cibleCourante = adversaires.includes(cible) && cible.pv > 0 ? cible : choisirCible(rng, adversaires);
    if (!cibleCourante) break;
    const jet = Math.floor(rng() * 20) + 1;
    const critique = jet === 20;
    const touche = a.toucheAuto || jet + a.bonus >= cibleCourante.defense || critique;
    if (!touche) continue;
    let dm = degatsAttaque(rng, a);
    if (critique) dm *= 2;
    dm = Math.max(0, dm * cibleCourante.facteurDegatsSubis - cibleCourante.rd);
    cibleCourante.pv = Math.max(0, cibleCourante.pv - dm);
    if (a.volDeVie) attaquant.pv = Math.min(attaquant.pvMax, attaquant.pv + dm * 0.5);
    total += dm;
  }
  return total;
}

function tenterControle(rng: Rng, attaquant: Combattant, ennemis: Combattant[]): boolean {
  if (attaquant.controle < 0.25) return false;
  const cibles = vivants(ennemis).filter((c) => !c.perdTour);
  if (cibles.length === 0) return false;
  const chance = Math.min(0.6, 0.25 + attaquant.controle * 0.35);
  if (rng() >= chance) return false;
  const cible = cibles[Math.floor(rng() * cibles.length)];
  cible.perdTour = true;
  return true;
}

/**
 * Soin par ACTION.
 *
 * Seuls les PJ en ont un, et il est borné par leur réserve de sorts (mana +
 * points de soin). Les ennemis ne soignent jamais par action : leur
 * régénération éventuelle est PASSIVE (champ `regeneration`, issu d'une
 * capacité de la fiche) et s'applique en fin de round.
 *
 * Une version précédente laissait les soutiens ennemis rendre 10 % des PV
 * max d'un allié à chaque action, sans limite de ressource — un mécénisme
 * absent de toute fiche, qui rendait les bandes invincibles en simulation.
 */
function tenterSoin(rng: Rng, attaquant: Combattant, tous: Combattant[]): boolean {
  if (attaquant.camp !== "pj") return false;
  if (attaquant.soinParAction <= 0 || attaquant.soins <= 0 || attaquant.mana <= 0) return false;
  const blesse = choisirAllieBlesse(rng, tous, attaquant.camp);
  if (!blesse) return false;
  const montant = Math.max(1, attaquant.soinParAction);
  blesse.pv = Math.min(blesse.pvMax, blesse.pv + montant);
  attaquant.soins = Math.max(0, attaquant.soins - montant);
  attaquant.mana = Math.max(0, attaquant.mana - 1);
  return true;
}

interface IssueSimulation {
  etat: "victoire" | "defaite" | "nul";
  rounds: number;
  pvPerdus: number;
  ko: number;
  ressourcesPct: number;
}

function simulerUneFois(
  evaluation: EvaluationRencontre,
  party: GroupePJ,
  rng: Rng,
  maxRounds: number
): IssueSimulation {
  const tous = combattantsDepuisEvaluation(evaluation, party, rng);
  const ordre = [...tous].sort((a, b) => b.initiative - a.initiative);
  const pvInitial = party.membres.reduce((n, m) => n + m.pv, 0);
  const manaInitial = party.membres.reduce((n, m) => n + m.manaMax, 0);
  const soinsInitiaux = party.membres.reduce((n, m) => n + m.soinsDisponibles, 0);
  let rounds = 0;
  let etat: IssueSimulation["etat"] = "nul";

  for (let round = 1; round <= maxRounds; round++) {
    rounds = round;
    for (const c of ordre) {
      if (c.pv <= 0) continue;
      if (vivants(tous, "pj").length === 0 || vivants(tous, "ennemi").length === 0) break;
      if (c.perdTour) {
        c.perdTour = false;
        continue;
      }
      const adversaires = c.camp === "pj" ? vivants(tous, "ennemi") : vivants(tous, "pj");
      if (adversaires.length === 0) break;
      // Contrôle : le contrôleur renonce à sa frappe ce tour.
      if (c.controle >= 0.25 && rng() < 0.35 && tenterControle(rng, c, adversaires)) continue;
      // Soin : le soutien PJ soigne un allié blessé (borne par sa réserve).
      if (c.soinParAction > 0 && rng() < 0.55 && tenterSoin(rng, c, tous)) continue;
      const cible = choisirCible(rng, adversaires);
      if (!cible) break;
      attaquer(rng, c, cible, tous);
    }
    // Régénération passive : capacité déclarée sur la fiche, appliquée sans
    // action ni ressource. Aucun montant n'est inventé — il vient de la
    // capacité de soin réelle détectée sur la créature.
    for (const c of ordre) {
      if (c.pv > 0 && c.regeneration > 0) c.pv = Math.min(c.pvMax, c.pv + c.regeneration);
    }
    const pjVivants = vivants(tous, "pj").length;
    const ennemisVivants = vivants(tous, "ennemi").length;
    if (ennemisVivants === 0 && pjVivants > 0) {
      etat = "victoire";
      break;
    }
    if (pjVivants === 0) {
      etat = "defaite";
      break;
    }
  }

  const pvFinaux = party.membres.reduce((n, m, i) => n + (tous[i]?.pv ?? m.pv), 0);
  const manaFinal = tous.filter((c) => c.camp === "pj").reduce((n, c) => n + c.mana, 0);
  const soinsFinaux = tous.filter((c) => c.camp === "pj").reduce((n, c) => n + c.soins, 0);
  const depense = Math.max(0, manaInitial - manaFinal) + Math.max(0, soinsInitiaux - soinsFinaux);
  const ressourcesPct = manaInitial + soinsInitiaux > 0 ? depense / (manaInitial + soinsInitiaux) : 0;
  const ko = vivants(tous, "pj").length === 0 ? party.nombre : party.nombre - vivants(tous, "pj").length;
  return {
    etat,
    rounds,
    pvPerdus: Math.max(0, pvInitial - pvFinaux),
    ko,
    ressourcesPct,
  };
}

/** Probabilité de toucher d'une attaque (exportée pour la documentation/tests). */
export function toucheAttaque(a: Pick<AttackDef, "bonus" | "toucheAuto">, defense: number): number {
  return a.toucheAuto ? 1 : probabiliteToucher(a.bonus, defense);
}

/**
 * Simule une rencontre plusieurs fois.
 * Les itérations sont indépendantes et reproductibles via `graine`.
 */
export function simulerRencontre(
  evaluation: EvaluationRencontre,
  party: GroupePJ,
  options: OptionsSimulation = {}
): ResultatSimulation {
  const iterations = Math.max(1, Math.min(5000, Math.round(options.iterations ?? 250)));
  const maxRounds = Math.max(1, Math.min(50, Math.round(options.maxRounds ?? 20)));
  const graine = options.graine ?? 1;
  const issues: IssueSimulation[] = [];
  for (let i = 0; i < iterations; i++) {
    const rng = mulberry32(graine + i * 7919);
    issues.push(simulerUneFois(evaluation, party, rng, maxRounds));
  }
  const victoires = issues.filter((i) => i.etat === "victoire").length;
  const defaites = issues.filter((i) => i.etat === "defaite").length;
  const nuls = issues.length - victoires - defaites;
  const moyenne = (f: (i: IssueSimulation) => number) =>
    issues.length > 0 ? issues.reduce((n, i) => n + f(i), 0) / issues.length : 0;
  const pvTotal = Math.max(1, party.pvActuel);
  return {
    iterations,
    victoires,
    defaites,
    nuls,
    tauxVictoire: victoires / iterations,
    tauxDefaite: defaites / iterations,
    tauxNul: nuls / iterations,
    roundsMoyens: Math.round(moyenne((i) => i.rounds) * 10) / 10,
    pvPerdusMoyens: Math.round(moyenne((i) => i.pvPerdus) * 10) / 10,
    pvPerdusPct: Math.round((moyenne((i) => i.pvPerdus) / pvTotal) * 1000) / 10,
    koMoyens: Math.round(moyenne((i) => i.ko) * 10) / 10,
    ressourcesDepenseesPct: Math.round(moyenne((i) => i.ressourcesPct) * 1000) / 10,
    tauxAuMoinsUnKo: issues.filter((i) => i.ko > 0).length / iterations,
    tauxTpk: issues.filter((i) => i.etat === "defaite").length / iterations,
  };
}

/** Scénario de calibration autonome (sans UI) : utile en test et en diagnostic. */
export interface ScenarioCalibration {
  nom: string;
  evaluation: EvaluationRencontre;
  groupe: GroupePJ;
  resultat: ResultatSimulation;
}

/**
 * Lance une série de simulations sur des compositions déjà évaluées.
 * Permet de comparer des groupes (niveaux, effectifs, états) à difficulté
 * constante sans dépendre de l'interface.
 */
export function calibrerSeries(
  scenarios: { nom: string; evaluation: EvaluationRencontre; groupe: GroupePJ }[],
  options: OptionsSimulation = {}
): ScenarioCalibration[] {
  return scenarios.map((s) => ({
    ...s,
    resultat: simulerRencontre(s.evaluation, s.groupe, options),
  }));
}
