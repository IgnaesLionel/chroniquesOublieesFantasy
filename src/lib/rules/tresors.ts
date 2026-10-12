// Générateur de trésors COF — table des trésors par niveau (premier générateur).
// Pur TypeScript, sans React. RNG injectable pour tests déterministes.
//
// Rappel monnaies : 100 pa (argent) = 10 po (or) = 1 pp (platine).
// Procédure par niveau : valeur monétaire (toujours), joyaux/bijoux (test
// d20 sur la plage indiquée jusqu'au niv. 9, automatique dès le niv. 10),
// puis objets magiques mineurs / moyens / majeurs (N tests d20, un objet
// différent par succès).

import { rollDie, type Rng } from "@/src/lib/rules/dice/roller";
import { genererObjetMagique, type ObjetMagiqueTire } from "@/src/lib/rules/objetsMagiques";

/** Monnaies du trésor. */
export type UniteMonnaie = "pa" | "po" | "pp";

/** Valeur d'une unité en pa : 1 po = 10 pa, 1 pp = 100 pa. */
export const VALEUR_PA: Record<UniteMonnaie, number> = { pa: 1, po: 10, pp: 100 };

/** Jet de valeur : NdF × mult en unité (ex. 1d6 × 100 pa). */
export interface JetValeur {
  des: number;
  faces: number;
  mult: number;
  unite: UniteMonnaie;
}

/** Test de présence : `essais` lancers de d20, succès si ≥ `seuil`. */
export interface TestPresence {
  /** Seuil de réussite sur d20 (ex. 13 pour "13-20"). */
  seuil: number;
  /** Nombre de tests à réaliser (ex. 2 pour "13-20/2"). */
  essais: number;
}

export interface LigneTresor {
  /** Niveau de trésor (0.5 = niveau "1/2"). */
  niveau: number;
  /** Libellé affiché ("1/2", "1", …, "28"). */
  label: string;
  /** Trésor monétaire (toujours présent). */
  monetaire: JetValeur;
  /** Test d20 pour les joyaux/bijoux (null = automatique dès le niv. 10). */
  joyauxTest: TestPresence | null;
  /** Valeur des joyaux/bijoux si présents. */
  joyauxGain: JetValeur;
  /** Objets magiques mineurs / moyens / majeurs (null = aucun test). */
  mineur: TestPresence | null;
  moyen: TestPresence | null;
  majeur: TestPresence | null;
}

const v = (des: number, faces: number, mult: number, unite: UniteMonnaie): JetValeur =>
  ({ des, faces, mult, unite });
const t = (seuil: number, essais: number): TestPresence => ({ seuil, essais });

/** Table officielle des trésors (niveaux 1/2 à 28). */
export const TABLE_TRESORS: LigneTresor[] = [
  { niveau: 0.5, label: "1/2", monetaire: v(1, 6, 1, "pa"), joyauxTest: t(20, 1), joyauxGain: v(1, 6, 10, "pa"), mineur: null, moyen: null, majeur: null },
  { niveau: 1, label: "1", monetaire: v(2, 6, 1, "pa"), joyauxTest: t(18, 1), joyauxGain: v(1, 12, 10, "pa"), mineur: null, moyen: null, majeur: null },
  { niveau: 2, label: "2", monetaire: v(4, 6, 1, "pa"), joyauxTest: t(16, 1), joyauxGain: v(1, 20, 10, "pa"), mineur: t(20, 1), moyen: null, majeur: null },
  { niveau: 3, label: "3", monetaire: v(1, 6, 10, "pa"), joyauxTest: t(14, 1), joyauxGain: v(1, 6, 100, "pa"), mineur: t(19, 1), moyen: null, majeur: null },
  { niveau: 4, label: "4", monetaire: v(2, 6, 10, "pa"), joyauxTest: t(12, 1), joyauxGain: v(1, 6, 100, "pa"), mineur: t(17, 1), moyen: null, majeur: null },
  { niveau: 5, label: "5", monetaire: v(3, 6, 10, "pa"), joyauxTest: t(10, 1), joyauxGain: v(1, 12, 100, "pa"), mineur: t(15, 1), moyen: null, majeur: null },
  { niveau: 6, label: "6", monetaire: v(4, 6, 10, "pa"), joyauxTest: t(8, 1), joyauxGain: v(1, 12, 100, "pa"), mineur: t(15, 2), moyen: t(20, 1), majeur: null },
  { niveau: 7, label: "7", monetaire: v(5, 6, 10, "pa"), joyauxTest: t(6, 1), joyauxGain: v(1, 12, 100, "pa"), mineur: t(14, 2), moyen: t(19, 1), majeur: null },
  { niveau: 8, label: "8", monetaire: v(1, 6, 100, "pa"), joyauxTest: t(4, 1), joyauxGain: v(1, 20, 100, "pa"), mineur: t(13, 2), moyen: t(17, 1), majeur: null },
  { niveau: 9, label: "9", monetaire: v(2, 6, 100, "pa"), joyauxTest: t(2, 1), joyauxGain: v(1, 20, 100, "pa"), mineur: t(12, 2), moyen: t(15, 1), majeur: null },
  { niveau: 10, label: "10", monetaire: v(3, 6, 100, "pa"), joyauxTest: null, joyauxGain: v(1, 20, 100, "pa"), mineur: t(11, 2), moyen: t(15, 2), majeur: t(20, 1) },
  { niveau: 11, label: "11", monetaire: v(4, 6, 100, "pa"), joyauxTest: null, joyauxGain: v(2, 12, 100, "pa"), mineur: t(10, 2), moyen: t(14, 2), majeur: t(19, 1) },
  { niveau: 12, label: "12", monetaire: v(5, 6, 100, "pa"), joyauxTest: null, joyauxGain: v(3, 10, 100, "pa"), mineur: t(10, 3), moyen: t(13, 2), majeur: t(17, 1) },
  { niveau: 13, label: "13", monetaire: v(1, 6, 100, "po"), joyauxTest: null, joyauxGain: v(3, 12, 100, "pa"), mineur: t(9, 3), moyen: t(12, 2), majeur: t(15, 1) },
  { niveau: 14, label: "14", monetaire: v(2, 6, 100, "po"), joyauxTest: null, joyauxGain: v(2, 20, 100, "pa"), mineur: t(8, 3), moyen: t(11, 2), majeur: t(15, 2) },
  { niveau: 15, label: "15", monetaire: v(3, 6, 100, "po"), joyauxTest: null, joyauxGain: v(1, 6, 100, "po"), mineur: t(7, 3), moyen: t(10, 2), majeur: t(14, 2) },
  { niveau: 16, label: "16", monetaire: v(4, 6, 100, "po"), joyauxTest: null, joyauxGain: v(1, 12, 100, "po"), mineur: t(6, 3), moyen: t(10, 3), majeur: t(13, 2) },
  { niveau: 17, label: "17", monetaire: v(1, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(1, 20, 100, "po"), mineur: t(5, 3), moyen: t(9, 3), majeur: t(12, 2) },
  { niveau: 18, label: "18", monetaire: v(2, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(2, 12, 100, "po"), mineur: t(5, 4), moyen: t(8, 3), majeur: t(11, 2) },
  { niveau: 19, label: "19", monetaire: v(3, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(3, 10, 100, "po"), mineur: t(5, 4), moyen: t(7, 3), majeur: t(10, 2) },
  { niveau: 20, label: "20", monetaire: v(4, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(3, 12, 100, "po"), mineur: t(5, 5), moyen: t(6, 3), majeur: t(10, 3) },
  { niveau: 21, label: "21", monetaire: v(5, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(2, 20, 100, "po"), mineur: t(5, 5), moyen: t(5, 3), majeur: t(9, 3) },
  { niveau: 22, label: "22", monetaire: v(6, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(1, 6, 100, "pp"), mineur: t(5, 6), moyen: t(5, 4), majeur: t(8, 3) },
  { niveau: 23, label: "23", monetaire: v(7, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(1, 12, 100, "pp"), mineur: t(5, 6), moyen: t(5, 4), majeur: t(7, 3) },
  { niveau: 24, label: "24", monetaire: v(8, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(1, 20, 100, "pp"), mineur: t(5, 7), moyen: t(5, 5), majeur: t(6, 3) },
  { niveau: 25, label: "25", monetaire: v(9, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(2, 12, 100, "pp"), mineur: t(5, 7), moyen: t(5, 5), majeur: t(5, 3) },
  { niveau: 26, label: "26", monetaire: v(10, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(3, 10, 100, "pp"), mineur: t(5, 8), moyen: t(5, 6), majeur: t(5, 4) },
  { niveau: 27, label: "27", monetaire: v(11, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(3, 12, 100, "pp"), mineur: t(5, 8), moyen: t(5, 6), majeur: t(5, 4) },
  { niveau: 28, label: "28", monetaire: v(12, 6, 100, "pp"), joyauxTest: null, joyauxGain: v(2, 20, 100, "pp"), mineur: t(5, 8), moyen: t(5, 6), majeur: t(5, 4) },
];

/** Retrouve la ligne d'un niveau (0.5 = "1/2"). Erreur si inconnu. */
export function ligneTresor(niveau: number): LigneTresor {
  const ligne = TABLE_TRESORS.find((l) => l.niveau === niveau);
  if (!ligne) throw new Error(`Niveau de trésor inconnu : ${niveau} (attendu : 1/2 ou 1 à 28).`);
  return ligne;
}

/** Répartition indicative d'un total pa en pp / po / pa (le MJ répartit librement). */
export interface Repartition {
  pp: number;
  po: number;
  pa: number;
}

export function convertirPa(totalPa: number): Repartition {
  const total = Math.max(0, Math.floor(totalPa));
  const pp = Math.floor(total / VALEUR_PA.pp);
  const po = Math.floor((total - pp * VALEUR_PA.pp) / VALEUR_PA.po);
  const pa = total - pp * VALEUR_PA.pp - po * VALEUR_PA.po;
  return { pp, po, pa };
}

/** Gain de valeur tiré (monétaire ou joyaux). */
export interface GainValeur {
  /** Total converti en pa. */
  totalPa: number;
  /** Tirages des dés (avant × mult). */
  jets: number[];
  /** Formule de la ligne (ex. "1d6 × 100 pa"). */
  formule: string;
  /** Découpage indicatif pp / po / pa. */
  repartition: Repartition;
}

export interface ResultatJoyaux {
  present: boolean;
  /** Tirages d20 du test de présence (vide si automatique). */
  tests: number[];
  gain: GainValeur | null;
}

export type CategorieMagique = "mineur" | "moyen" | "majeur";

export interface ResultatMagique {
  type: CategorieMagique;
  succes: number;
  tests: number[];
}

export interface ResultatTresor {
  niveau: number;
  label: string;
  monetaire: GainValeur;
  joyaux: ResultatJoyaux;
  magiques: ResultatMagique[];
  /** Objets magiques tirés (un par succès, dans l'ordre des tests). */
  objets: ObjetMagiqueTire[];
}

function lancerGain(jet: JetValeur, rng: Rng): GainValeur {
  const jets: number[] = [];
  for (let i = 0; i < jet.des; i++) jets.push(rollDie(jet.faces, rng));
  const totalPa = jets.reduce((a, b) => a + b, 0) * jet.mult * VALEUR_PA[jet.unite];
  return { totalPa, jets, formule: formaterJet(jet), repartition: convertirPa(totalPa) };
}

function lancerTests(test: TestPresence, rng: Rng): number[] {
  const jets: number[] = [];
  for (let i = 0; i < test.essais; i++) jets.push(rollDie(20, rng));
  return jets;
}

/** Total distribuable d'un trésor : monétaire + joyaux (hors objets magiques). */
export function totalDistribuable(resultat: ResultatTresor): number {
  return resultat.monetaire.totalPa + (resultat.joyaux.gain?.totalPa ?? 0);
}

/**
 * Tire un trésor complet pour un niveau : monétaire, joyaux (test d20 sauf
 * automatique dès le niv. 10), puis magiques mineurs / moyens / majeurs
 * (un objet différent par succès, tiré aussitôt sur les tables d'objets).
 */
export function genererTresor(niveau: number, rng: Rng = Math.random): ResultatTresor {
  const ligne = ligneTresor(niveau);
  const monetaire = lancerGain(ligne.monetaire, rng);
  let joyaux: ResultatJoyaux;
  if (ligne.joyauxTest === null) {
    joyaux = { present: true, tests: [], gain: lancerGain(ligne.joyauxGain, rng) };
  } else {
    const tests = lancerTests(ligne.joyauxTest, rng);
    const present = tests.some((j) => j >= ligne.joyauxTest!.seuil);
    joyaux = { present, tests, gain: present ? lancerGain(ligne.joyauxGain, rng) : null };
  }
  const magiques: ResultatMagique[] = (["mineur", "moyen", "majeur"] as const).flatMap((type) => {
    const test = ligne[type];
    if (!test) return [];
    const tests = lancerTests(test, rng);
    return [{ type, succes: tests.filter((j) => j >= test.seuil).length, tests }];
  });
  const objets = magiques.flatMap((m) =>
    Array.from({ length: m.succes }, () => genererObjetMagique(m.type, rng))
  );
  return { niveau: ligne.niveau, label: ligne.label, monetaire, joyaux, magiques, objets };
}

/** "1d6 pa" ou "1d6 × 100 pa". */
export function formaterJet(jet: JetValeur): string {
  const base = `${jet.des}d${jet.faces}`;
  return jet.mult === 1 ? `${base} ${jet.unite}` : `${base} × ${jet.mult} ${jet.unite}`;
}

/** "20/1", "13-20/2" ou "—" (aucun test). */
export function formaterTest(test: TestPresence | null): string {
  if (!test) return "—";
  const plage = test.seuil === 20 ? "20" : `${test.seuil}-20`;
  return `${plage}/${test.essais}`;
}

/** "500 pa" avec séparateurs de milliers. */
export function formaterPa(totalPa: number): string {
  return `${totalPa.toLocaleString("fr-FR")} pa`;
}

/** "5 pp, 3 po et 40 pa" (omet les zéros, "0 pa" si vide). */
export function formaterRepartition(r: Repartition): string {
  const morceaux: string[] = [];
  if (r.pp > 0) morceaux.push(`${r.pp} pp`);
  if (r.po > 0) morceaux.push(`${r.po} po`);
  if (r.pa > 0 || morceaux.length === 0) morceaux.push(`${r.pa} pa`);
  return morceaux.length > 1
    ? `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}`
    : morceaux[0];
}
