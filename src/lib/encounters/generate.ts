// Génération de compositions de rencontre.
//
// La recherche est volontairement « multi-compositions » : on explore des
// combinaisons, on les évalue avec evaluate.ts, puis on classe. Le budget DRS
// reste la colonne vertébrale ; la qualité tactique (rôles, actions, variété,
// mécanique de boss) départage les compositions de budget voisin.
//
// Les verrous du MJ sont conservés tels quels. Une nouvelle graine relance la
// recherche sans perdre les options, les verrous ni les remplacements manuels.

import type { MonsterTemplate } from "@/src/lib/rules/types";
import type {
  ConfigurationMoteur,
  ContexteRencontre,
  DifficulteRencontre,
  EvaluationRencontre,
  OptionsGeneration,
  ProfilCreature,
  ResultatGeneration,
  SlotRencontre,
} from "@/src/lib/encounters/types";
import {
  ciblePm,
  configurerMoteur,
  normaliserTheme,
  pmPourNc,
} from "@/src/lib/encounters/rules";
import { cacheProfils, profilDepuisCache } from "@/src/lib/encounters/roles";
import { evaluerRencontre } from "@/src/lib/encounters/evaluate";
import {
  choixPondere,
  entier,
  entierEntre,
  graineDepuisTexte,
  melanger,
  mulberry32,
  type Rng,
} from "@/src/lib/encounters/random";

function correspondTheme(profil: ProfilCreature, theme: string): boolean {
  if (!theme || normaliserTheme(theme) === "toutes") return true;
  const t = normaliserTheme(theme);
  const champs = [
    profil.template.type,
    profil.template.categorie ?? "",
    ...(profil.template.sousCategories ?? []),
    ...(profil.template.capacitesPartagees ?? []),
  ].map(normaliserTheme);
  return champs.some((c) => c === t || c.includes(t) || t.includes(c));
}

function editionAutorisee(profil: ProfilCreature, contexte: ContexteRencontre): boolean {
  if (profil.edition === "cof2") return true;
  if (profil.edition === "cof1") return contexte.inclureV1;
  return contexte.inclureHorsDrs;
}

function quantiteTotale(slots: SlotRencontre[]): number {
  return slots.reduce((n, s) => n + Math.max(1, s.quantite), 0);
}

function pmSlots(slots: SlotRencontre[], cache: Map<string, ProfilCreature>, table: Record<string, number>): number {
  return slots.reduce((n, s) => {
    const p = cache.get(s.monstreId);
    return n + (p ? pmPourNc(p.nc, table) : 0) * Math.max(1, s.quantite);
  }, 0);
}

/** Ajoute une créature en fusionnant avec un slot existant du même modèle. */
function ajouterSlot(slots: SlotRencontre[], monstreId: string, quantite: number, verrouille = false): SlotRencontre[] {
  const q = Math.max(1, Math.floor(quantite));
  const idx = slots.findIndex((s) => s.monstreId === monstreId && !s.verrouille);
  if (idx >= 0) {
    const copie = [...slots];
    copie[idx] = { ...copie[idx], quantite: copie[idx].quantite + q };
    return copie;
  }
  return [...slots, { monstreId, quantite: q, ...(verrouille ? { verrouille: true } : {}) }];
}

function retirerSlot(slots: SlotRencontre[], monstreId: string): SlotRencontre[] {
  return slots.filter((s) => s.monstreId !== monstreId);
}

function poidsProcheDe(valeur: number, cible: number, largeur: number): number {
  const d = (valeur - cible) / Math.max(1, largeur);
  return Math.exp(-(d * d));
}

function choisirTaille(rng: Rng, difficulte: DifficulteRencontre, ciblePm: number): number {
  const max = difficulte === "boss" ? 7 : 8;
  if (ciblePm < 12) return entierEntre(rng, 1, 2);
  if (ciblePm < 30) return entierEntre(rng, 2, 4);
  if (ciblePm < 90) return entierEntre(rng, 2, 5);
  if (ciblePm < 200) return entierEntre(rng, 3, 6);
  // Grand budget : on explore aussi les compositions à FEW créatures.
  // Le DRS autorise la découpe (« 6 tigres » pour 600 Pm) mais autorise aussi
  // « 2 géants et 2 tigres ». Fixer la fourchette à 4-8 créatures excluait
  // d'avance la solution la moins dangereuse : à budget égal, un grand nombre
  // de créatures multiplie les actions ennemies sans augmenter les PV totaux,
  // ce que le modèle tactique sanctionne fortement.
  return entierEntre(rng, 2, max);
}

interface Composition {
  slots: SlotRencontre[];
  evaluation: EvaluationRencontre;
  score: number;
  raisons: string[];
}

function qualiteTactique(
  evaluation: EvaluationRencontre,
  profils: ProfilCreature[],
  difficulte: DifficulteRencontre
): { score: number; raisons: string[] } {
  const raisons: string[] = [];
  let score = 0;
  const roles = new Set(profils.flatMap((p) => p.roles));
  const diversite = Math.min(1, roles.size / 4);
  score += diversite * 1.2;
  raisons.push(`Rôles : ${[...roles].join(", ")}`);

  const n = evaluation.nombreEnnemis;
  // La variable tactique n'est pas le comptage mais le RAPPORT D'ACTIONS. À
  // budget (PV) égal, des créatures plus nombreuses frappent plus souvent et
  // font tomber les PJ un par un — un avantage que la simple somme des PV ne
  // voit pas. On guide la recherche vers des rapports raisonnables.
  const ratioActionsNombre = evaluation.actionsEnnemis / Math.max(1, evaluation.actionsParti);
  const taille = Math.exp(-Math.pow((ratioActionsNombre - 1.5) / 1.3, 2));
  score += taille * 1.6;
  raisons.push(`Nombre : ${n} créature(s) — rapport d'actions ×${ratioActionsNombre.toFixed(2)}`);

  const bossAttendu = difficulte === "boss";
  const bossPresent = evaluation.nombreBoss > 0;
  if (bossAttendu) {
    score += bossPresent ? 2.4 : -3;
    raisons.push(bossPresent ? "Boss distinctif présent" : "Aucun boss distinctif");
    if (bossPresent) {
      const boss = profils.find((p) => p.candidatBoss);
      if (boss) {
        score += Math.min(1.2, boss.signature.length * 0.25);
        raisons.push(`Signature : ${boss.signature.slice(0, 3).join(", ")}`);
      }
    }
    score += Math.min(0.8, Math.max(0, 4 - (n - 1)) * 0.2);
  } else if (bossPresent && n === 1) {
    // Un « boss » seul dans une rencontre normale peut être un sac de PV.
    score -= 0.6;
    raisons.push("Profil de boss employé seul hors mode boss");
  }

  // Évite les compositions mono-modèle répétées à l'excès.
  const ids = profils.map((p) => p.id);
  const variete = new Set(ids).size / Math.max(1, ids.length);
  score += variete * 0.9;
  if (variete < 0.5) raisons.push("Composition répétitive");

  // Un seul gros profil sans mécanique : « sac de PV ».
  const pmParProfil = profils.map((p) => pmPourNc(p.nc) * (evaluation.nombreEnnemis > 0 ? 1 : 0));
  const totalPm = pmParProfil.reduce((a, b) => a + b, 0);
  const partMax = totalPm > 0 ? Math.max(...pmParProfil) / totalPm : 0;
  if (!bossAttendu && n > 1 && partMax > 0.75) {
    score -= 0.8;
    raisons.push("Un profil domine trop le budget");
  }

  const sansAttaque = profils.filter((p) => p.attaques.length === 0).length;
  if (sansAttaque > 0) {
    score -= sansAttaque * 0.8;
    raisons.push(`${sansAttaque} créature(s) sans attaque`);
  }
  if (evaluation.pressionControleEnnemie > 0.65) {
    score -= 0.5;
    raisons.push("Contrôle ennemi très élevé (risque de blocage)");
  }
  if (evaluation.dprParti <= 0 || evaluation.dprEnnemis <= 0) {
    score -= 1;
    raisons.push("Potentiel offensif incomplet");
  }
  return { score, raisons };
}

function scoreComposition(
  evaluation: EvaluationRencontre,
  profils: ProfilCreature[],
  difficulte: DifficulteRencontre,
  cibleNr: number,
  tolerance: number,
  configuration: ConfigurationMoteur
): { score: number; raisons: string[] } {
  const ecart = Math.abs(evaluation.nrBudget - cibleNr);
  const budget = 1 / (1 + Math.pow(ecart / Math.max(0.15, tolerance * 1.4), 2));
  // Cohérence de l'estimation : le budget DRS peut être parfaitement atteint
  // alors que la correction tactique annonce une rencontre bien plus dure que
  // demandée (trop d'actions ennemies, par exemple). On écarte ces candidats.
  const cibleDelta = configuration.decalageNr[difficulte];
  const ecartEstime = Math.abs(evaluation.deltaDanger - cibleDelta);
  const coherence = 1 / (1 + Math.pow(ecartEstime / Math.max(0.2, tolerance), 2));
  const q = qualiteTactique(evaluation, profils, difficulte);
  const score =
    budget * 3.2 +
    coherence * configuration.poidsCoherenceNr +
    q.score * configuration.poidsQualite;
  return {
    score,
    raisons: [
      `Budget : NR ${Math.round(evaluation.nrBudget * 100) / 100} pour une cible de ${Math.round(cibleNr * 100) / 100} (écart ${Math.round(ecart * 100) / 100}).`,
      `Estimation : delta ${Math.round(evaluation.deltaDanger * 100) / 100} pour une cible de ${cibleDelta} (écart ${Math.round(ecartEstime * 100) / 100}).`,
      ...q.raisons,
    ],
  };
}

/**
 * Créatures les moins coûteuses du pool.
 *
 * Sert de repli quand le budget cible est trop serré pour le thème demandé :
 * avec 5 Pm de budget et des morts-vivants dont le moins cher coûte 10 Pm,
 * aucun profil n'entre dans la fourchette préférée. Renvoyer une composition
 * vide laisserait le MJ sans rien ; on propose alors le minimum disponible et
 * le dépassement de budget est signalé dans les avertissements.
 */
function plusAbordables(pool: ProfilCreature[], configuration: ConfigurationMoteur): ProfilCreature[] {
  if (pool.length === 0) return [];
  const couts = pool.map((p) => pmPourNc(p.nc, configuration.tablePm));
  const min = Math.min(...couts);
  return pool.filter((_, i) => couts[i] === min);
}

function composerAleatoire(
  rng: Rng,
  pool: ProfilCreature[],
  poolBoss: ProfilCreature[],
  difficulte: DifficulteRencontre,
  ciblePm: number,
  verrous: SlotRencontre[],
  configuration: ConfigurationMoteur,
  cache: Map<string, ProfilCreature>,
  contexte: ContexteRencontre
): SlotRencontre[] {
  const nbMin = Math.max(1, Math.min(configuration.maxCreatures, contexte.nbMin ?? 1));
  const nbMax = Math.max(nbMin, Math.min(configuration.maxCreatures, contexte.nbMax ?? configuration.maxCreatures));
  let slots: SlotRencontre[] = verrous.map((v) => ({ ...v, verrouille: true }));
  let pm = pmSlots(slots, cache, configuration.tablePm);
  let count = quantiteTotale(slots);

  if (difficulte === "boss") {
    const bossDejaLa = slots.some((s) => cache.get(s.monstreId)?.candidatBoss);
    if (!bossDejaLa && poolBoss.length > 0) {
      const budgetBoss = ciblePm * (0.5 + rng() * 0.35);
      const boss = choixPondere(rng, poolBoss, (p) => {
        const pmP = pmPourNc(p.nc, configuration.tablePm);
        return (
          poidsProcheDe(pmP, budgetBoss, Math.max(6, budgetBoss * 0.35)) *
          (1 + Math.min(0.6, p.signature.length * 0.12)) *
          (p.edition === "cof2" ? 1 : 0.7)
        );
      });
      if (boss) {
        slots = ajouterSlot(slots, boss.id, 1, false);
        pm += pmPourNc(boss.nc, configuration.tablePm);
        count += 1;
      }
    }
    // Quelques soutiens / gardes, sans dépasser le budget ni le nombre demandé.
    const minimum = Math.max(0, nbMin - count);
    const nbMinions = Math.max(
      minimum,
      entierEntre(rng, 0, Math.min(3, Math.max(0, nbMax - count)))
    );
    for (let i = 0; i < nbMinions; i++) {
      if (count >= configuration.maxCreatures || count >= nbMax) break;
      const restant = ciblePm - pm;
      if (restant <= 0) break;
      const boss = slots
        .map((s) => cache.get(s.monstreId))
        .find((p): p is ProfilCreature => !!p && p.candidatBoss);
      const dansBudget = pool.filter((p) => {
        if (p.candidatBoss && boss) return false;
        if (boss && p.nc >= boss.nc) return false;
        return pmPourNc(p.nc, configuration.tablePm) <= restant * 1.1;
      });
      const candidats =
        dansBudget.length > 0
          ? dansBudget
          : plusAbordables(
              pool.filter((p) => !(boss && p.nc >= boss.nc)),
              configuration
            );
      const choix = choixPondere(rng, candidats, (p) => {
        const pmP = pmPourNc(p.nc, configuration.tablePm);
        return (
          poidsProcheDe(pmP, restant / Math.max(1, nbMinions - i), Math.max(5, restant * 0.35)) *
          (p.roles.includes("soutien") || p.roles.includes("controleur") ? 1.4 : 1) *
          (1 / Math.max(1, p.pvMax / 35))
        );
      });
      if (!choix) break;
      slots = ajouterSlot(slots, choix.id, 1);
      pm += pmPourNc(choix.nc, configuration.tablePm);
      count += 1;
    }
    return garantirNonVide(slots, pool, configuration, verrous);
  }

  const placeMax = Math.max(0, Math.min(nbMax, configuration.maxCreatures) - count);
  const souhaitee = Math.max(0, choisirTaille(rng, difficulte, ciblePm * (1 - pm / Math.max(1, ciblePm))));
  const minimum = Math.max(0, Math.min(placeMax, nbMin - count));
  const taille = Math.max(minimum, Math.min(placeMax, souhaitee));
  const objectif = Math.max(0, ciblePm - pm);
  for (let i = 0; i < taille; i++) {
    if (count >= configuration.maxCreatures) break;
    const restant = Math.max(0, ciblePm - pm);
    const place = Math.max(1, taille - i);
    const dansBudget = pool.filter((p) => {
      const pmP = pmPourNc(p.nc, configuration.tablePm);
      return pmP <= Math.max(3, restant * 1.25) && pmP <= Math.max(4, objectif * 1.35);
    });
    // Budget trop serré pour ce thème : on part de la créature la moins chère
    // plutôt que de rendre une composition vide (cf. plusAbordables).
    const candidats = dansBudget.length > 0 ? dansBudget : plusAbordables(pool, configuration);
    if (candidats.length === 0) break;
    const choix = choixPondere(rng, candidats, (p) => {
      const pmP = pmPourNc(p.nc, configuration.tablePm);
      return (
        poidsProcheDe(pmP, restant / place, Math.max(4, restant / place)) *
        (p.edition === "cof2" ? 1 : 0.7) *
        (p.attaques.length === 0 ? 0.35 : 1)
      );
    });
    if (!choix) break;
    const pmChoix = pmPourNc(choix.nc, configuration.tablePm);
    const maxQte = Math.max(
      1,
      Math.min(
        4,
        configuration.maxCreatures - count,
        Math.floor((restant * 1.15) / Math.max(1, pmChoix))
      )
    );
    const qte = entierEntre(rng, 1, Math.max(1, maxQte));
    slots = ajouterSlot(slots, choix.id, qte);
    pm += pmChoix * qte;
    count += qte;
  }
  return garantirNonVide(slots, pool, configuration, verrous);
}

/**
 * Dernier filet : une composition ne doit jamais être vide quand le pool ne
 * l'est pas. Sans cela, l'interface n'affichait rien du tout — ni composition,
 * ni explication — pour un thème au budget trop serré.
 */
function garantirNonVide(
  slots: SlotRencontre[],
  pool: ProfilCreature[],
  configuration: ConfigurationMoteur,
  verrous: SlotRencontre[]
): SlotRencontre[] {
  if (quantiteTotale(slots) > 0 || verrous.length > 0) return slots;
  const secours = plusAbordables(pool, configuration);
  return secours.length > 0 ? ajouterSlot(slots, secours[0].id, 1) : slots;
}

function cleComposition(slots: SlotRencontre[]): string {
  return [...slots]
    .sort((a, b) => a.monstreId.localeCompare(b.monstreId))
    .map((s) => `${s.monstreId}:${Math.max(1, s.quantite)}`)
    .join("|");
}

/**
 * Génère plusieurs compositions classées pour la difficulté demandée.
 * Retourne toujours un résultat (même vide) avec les avertissements utiles.
 */
export function genererRencontre(options: OptionsGeneration): ResultatGeneration {
  const configuration = configurerMoteur(options.configuration);
  const cache = cacheProfils(options.bestiaire);
  const contexte = options.contexte;
  const difficulte = options.difficulte;
  const graine =
    options.graine ??
    contexte.graine ??
    graineDepuisTexte(`${JSON.stringify(contexte)}|${difficulte}|${options.groupe.niveauEffectif}`);
  const rng = mulberry32(graine);
  const cibleNr = options.groupe.niveauEffectif + configuration.decalageNr[difficulte];
  const cible = ciblePm(cibleNr, options.groupe.nombre, configuration.tablePm);

  const avertissements: string[] = [];
  const tous = [...cache.values()];
  const autorises = tous.filter((p) => editionAutorisee(p, contexte));
  const pool = autorises.filter((p) => correspondTheme(p, contexte.theme));
  const exclusParTheme = autorises.length - pool.length;
  if (exclusParTheme > 0 && contexte.theme && normaliserTheme(contexte.theme) !== "toutes") {
    avertissements.push(`${exclusParTheme} créature(s) exclue(s) par le thème « ${contexte.theme} ».`);
  }
  if (pool.length === 0) {
    avertissements.push(
      "Aucune créature ne correspond aux filtres. Vérifier le thème, les sources autorisées et le bestiaire."
    );
    return {
      difficulte,
      cibleNr,
      ciblePm: cible,
      candidats: [],
      avertissements,
      cibleAtteinte: false,
      graine,
    };
  }

  const ncMax = Math.max(...pool.map((p) => p.nc));
  if (cibleNr > ncMax + 1) {
    avertissements.push(
      `Le bestiaire filtré plafonne à NC ${ncMax} : la cible NR ${Math.round(cibleNr * 100) / 100} demandera plusieurs créatures ou restera sous le budget.`
    );
  }

  // Budget inférieur au prix de la créature la moins chère du filtre : cas
  // typique d'un thème restreint sur un petit groupe (morts-vivants à 10 Pm
  // pour une cible de 5 Pm). La composition est produite quand même, mais le
  // dépassement doit être dit explicitement.
  const coutMin = Math.min(...pool.map((p) => pmPourNc(p.nc, configuration.tablePm)));
  if (coutMin > cible) {
    avertissements.push(
      `Budget trop serré pour ce thème : la cible est de ${Math.round(cible * 10) / 10} Pm, mais la créature la moins chère du filtre en coûte ${coutMin}. La composition proposée dépasse donc le budget — envisager « Toutes » comme thème, autoriser d'autres sources, ou agrandir le groupe.`
    );
  }

  const poolBoss = pool.filter((p) => p.candidatBoss);
  if (difficulte === "boss" && poolBoss.length === 0) {
    avertissements.push(
      "Aucune créature avec mécanique distinctive dans le filtre : le mode boss se rabattra sur le plus gros profil disponible."
    );
  }

  // Les verrous sont conservés, même si leur source est exclue par les filtres.
  const verrous: SlotRencontre[] = [];
  for (const v of options.verrous ?? []) {
    const p = profilDepuisCache(cache, options.bestiaire, v.monstreId);
    if (!p) {
      avertissements.push(`Verrou ignoré : créature inconnue ${v.monstreId}.`);
      continue;
    }
    verrous.push({ ...v, quantite: Math.max(1, Math.floor(v.quantite)), verrouille: true });
    if (!editionAutorisee(p, contexte) || !correspondTheme(p, contexte.theme)) {
      avertissements.push(`Le verrou « ${p.nom} » ne correspond pas aux filtres, mais il est conservé.`);
    }
  }
  if (verrous.length > 0) {
    avertissements.push(`${verrous.length} choix verrouillé(s) conservé(s) par le MJ.`);
  }

  const candidats = new Map<string, Composition>();
  const essais = Math.max(20, configuration.essaisGeneration);
  for (let i = 0; i < essais; i++) {
    const slots = composerAleatoire(
      rng,
      pool,
      poolBoss,
      difficulte,
      cible,
      verrous,
      configuration,
      cache,
      contexte
    );
    if (quantiteTotale(slots) === 0) continue;
    const profils = slots.flatMap((s) => {
      const p = cache.get(s.monstreId);
      return p ? Array.from({ length: Math.max(1, s.quantite) }, () => p) : [];
    });
    const evaluation = evaluerRencontre({
      groupe: options.groupe,
      slots,
      difficulte,
      contexte,
      bestiaire: options.bestiaire,
      configuration,
      profils: cache,
    });
    if (evaluation.slots.length === 0) continue;
    const { score, raisons } = scoreComposition(
      evaluation,
      profils,
      difficulte,
      cibleNr,
      configuration.toleranceNr[difficulte],
      configuration
    );
    // Un peu de variété entre compositions de même score, sans masquer la qualité.
    let scoreFinal = score + rng() * 0.25;
    if (contexte.nbMin && evaluation.nombreEnnemis < contexte.nbMin) scoreFinal -= 2;
    if (contexte.nbMax && evaluation.nombreEnnemis > contexte.nbMax) scoreFinal -= 2;
    const cle = cleComposition(slots);
    const existant = candidats.get(cle);
    if (!existant || existant.score < scoreFinal) {
      candidats.set(cle, { slots, evaluation, score: scoreFinal, raisons });
    }
  }

  const classes = [...candidats.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, configuration.variantes))
    .map((c) => ({
      ...c.evaluation,
      scoreGeneration: Math.round(c.score * 1000) / 1000,
      raisonsScore: c.raisons,
    }));

  const tolerance = configuration.toleranceNr[difficulte];
  const cibleAtteinte = classes.some((c) => Math.abs(c.ecartBudget) <= tolerance);
  if (!cibleAtteinte && classes.length > 0) {
    avertissements.push(
      `Aucune composition ne tombe dans la tolérance de ±${tolerance} NR autour de la cible ${Math.round(cibleNr * 100) / 100}. La meilleure reste proposée ; ajuster le nombre de créatures ou les filtres.`
    );
  }
  if (difficulte === "boss" && classes.every((c) => c.nombreBoss === 0)) {
    avertissements.push("Aucune composition ne contient de boss distinctif : vérifier le thème ou autoriser plus de sources.");
  }
  if (classes.some((c) => c.nombreEnnemis > configuration.maxCreatures)) {
    avertissements.push(`Certaines compositions dépassent ${configuration.maxCreatures} créatures.`);
  }

  return {
    difficulte,
    cibleNr,
    ciblePm: cible,
    candidats: classes,
    avertissements: Array.from(new Set(avertissements)),
    cibleAtteinte,
    graine,
  };
}

/**
 * Recalcule une composition après intervention du MJ (quantité, remplacement,
 * verrou). Aucun aléatoire : les choix manuels sont respectés.
 */
export function reevaluerComposition(options: {
  groupe: OptionsGeneration["groupe"];
  slots: SlotRencontre[];
  difficulte: DifficulteRencontre;
  contexte: ContexteRencontre;
  bestiaire: MonsterTemplate[];
  configuration?: Partial<ConfigurationMoteur>;
}): EvaluationRencontre {
  return evaluerRencontre({
    groupe: options.groupe,
    slots: options.slots,
    difficulte: options.difficulte,
    contexte: options.contexte,
    bestiaire: options.bestiaire,
    configuration: options.configuration,
  });
}

export { choixPondere, entier, entierEntre, melanger, retirerSlot };
