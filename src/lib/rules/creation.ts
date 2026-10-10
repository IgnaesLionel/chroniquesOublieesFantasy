import { CAPACITES } from "@/src/lib/data/capacites";
import { VOIES_PEUPLE, VOIE_MAGE, voiePeupleDe } from "@/src/lib/data/peuples";
import type { Character, Sort } from "@/src/lib/rules/types";
import { ajouterCapacite, apprendreSort } from "@/src/lib/rules/personnage";

// Règle de création COF Fantasy V2 (niveau 1) :
//   - 2 points de capacité -> 2 capacités de rang 1 parmi les voies du profil (1 pt chacune).
//   - + gratuit : la capacité de rang 1 de la voie du peuple (0 pt, en plus des 2 choix).
//   - Cas standard : 3 capacités au total (2 profil + 1 peuple).
// Progression (DRS + système Foundry) :
//   - 2 points de capacité par niveau (création incluse) : R1-2 = 1 pt, R3-5 = 2 pts.
//   - Rangs précédents de la voie requis (pas de saut), niveau minimum = rang.
// Les exceptions sont configurées par profil ci-dessous (jamais en dur dans la logique).

export interface CreationProfil {
  /** Points de capacité à la création. */
  points: number;
  /** +1 capacité de rang 2 gratuite (ex. les 4 profils Mage). */
  rang2Gratuit?: boolean;
  /** Voie spéciale remplaçant la voie du peuple (ex. "Voie du mage"). */
  voieRemplacement?: string;
}

export const CREATION_DEFAUT: CreationProfil = { points: 2 };

const VOIE_DU_MAGE = "Voie du mage";

/** Exceptions par profil (configurables). Tous les autres profils suivent le cas standard. */
export const CREATION_PROFILS: Record<string, CreationProfil> = {
  Ensorceleur: { points: 2, rang2Gratuit: true, voieRemplacement: VOIE_DU_MAGE },
  Forgesort: { points: 2, rang2Gratuit: true, voieRemplacement: VOIE_DU_MAGE },
  Magicien: { points: 2, rang2Gratuit: true, voieRemplacement: VOIE_DU_MAGE },
  Sorcier: { points: 2, rang2Gratuit: true, voieRemplacement: VOIE_DU_MAGE },
};

export function creationProfil(profil: string): CreationProfil {
  return CREATION_PROFILS[profil?.trim()] ?? CREATION_DEFAUT;
}

/** Normalise un nom de capacité ("Flèche sanglante (L)" -> "flèche sanglante"). */
export function normaliserNomCapacite(nom: string): string {
  return nom.replace(/\s*\([A-Z]\)\s*$/, "").trim().toLowerCase();
}

export type SourceCapacite = "profil" | "peuple" | "mage";

export interface CapaciteLocalisee {
  rang: number;
  voie: string;
  source: SourceCapacite;
}

/**
 * Localise une capacité connue : voies du profil d'abord, puis voie du peuple,
 * puis voie du mage (si adoptée). Indéfini si inconnue des voies accessibles.
 */
export function localiserCapacite(
  nom: string,
  profil: string,
  peuple: string,
  voieMage?: boolean
): CapaciteLocalisee | undefined {
  const cle = normaliserNomCapacite(nom);
  const dans = (voies: { voie: string; capacites: { nom: string; rang: number }[] }[]) => {
    for (const v of voies) {
      const trouve = v.capacites.find((c) => normaliserNomCapacite(c.nom) === cle);
      if (trouve) return { rang: trouve.rang, voie: v.voie };
    }
    return undefined;
  };
  const profilTrouve = dans(CAPACITES[profil?.trim()] ?? []);
  if (profilTrouve) return { ...profilTrouve, source: "profil" };
  const voiePeuple = voiePeupleDe(peuple);
  if (voiePeuple) {
    const trouve = dans([voiePeuple]);
    if (trouve) return { ...trouve, source: "peuple" };
  }
  if (voieMage) {
    const trouve = dans([VOIE_MAGE]);
    if (trouve) return { ...trouve, source: "mage" };
  }
  return undefined;
}

export interface EtatCreation {
  points: number;
  /** Points dépensés, gratuités déduites (peuple R1, R2 Mage). */
  depense: number;
  restants: number;
  /** Nom attendu du rang 1 de peuple (null si voie inconnue). */
  peupleAttendue: string | null;
  peupleOk: boolean;
  /** Gratuité rang 2 (profils Mage) : nom consommé ou null. */
  rang2Nom: string | null;
  /** Écarts bloquants/à corriger (vide = création conforme). */
  alertes: string[];
}

/** Coût en points d'une capacité de rang N : rangs 1-2 = 1 pt, rangs 3-5 = 2 pts. */
export function coutRang(rang: number): number {
  return rang >= 3 ? 2 : 1;
}

/** Niveau minimum pour apprendre le rang N : N (la gratuité Mage contourne ce verrou, pas les prérequis). */
export function niveauMinRang(rang: number): number {
  return Math.max(1, Math.floor(rang));
}

/** Points de capacité totaux : 2 par niveau, création incluse. */
export function pointsCapaciteTotal(niveau: number): number {
  return 2 * Math.max(1, Math.floor(niveau));
}

/** Source d'une voie nommée pour un personnage (null si inaccessible). */
export function sourceDeVoie(
  voie: string,
  profil: string,
  peuple: string,
  voieMage?: boolean
): SourceCapacite | null {
  const v = (voie ?? "").trim();
  if (!v) return null;
  if ((CAPACITES[profil?.trim()] ?? []).some((x) => x.voie === v)) return "profil";
  if (voiePeupleDe(peuple)?.voie === v) return "peuple";
  if (voieMage && VOIE_MAGE.voie === v) return "mage";
  return null;
}

export type ListeCapacite = "talents" | "sorts" | "traits";

export interface FaitCapacite {
  nom: string;
  rang: number | null;
  voie: string | null;
  source: SourceCapacite | "inconnu";
  liste: ListeCapacite;
}

/** Toutes les capacités connues (talents + sorts à voie ; les customs sans voie ne sont pas jugés). */
export function faitsCapacites(c: Character): FaitCapacite[] {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const faits: FaitCapacite[] = [];
  // Un talent doublon d'un sort connu est compté une seule fois, côté sort.
  const nomsSorts = new Set((c.sorts ?? []).map((s) => normaliserNomCapacite(s.nom)));
  for (const nom of c.capacites ?? []) {
    if (nomsSorts.has(normaliserNomCapacite(nom))) continue;
    const loc = localiserCapacite(nom, profil, c.peuple, c.voieMage);
    faits.push(
      loc
        ? { nom, rang: loc.rang, voie: loc.voie, source: loc.source, liste: "talents" }
        : { nom, rang: null, voie: null, source: "inconnu", liste: "talents" }
    );
  }
  for (const s of c.sorts ?? []) {
    if (!s.voie || !s.rang) continue; // création maison (MJ), non jugée
    const source = sourceDeVoie(s.voie, profil, c.peuple, c.voieMage);
    faits.push(
      source
        ? { nom: s.nom, rang: s.rang, voie: s.voie, source, liste: "sorts" }
        : { nom: s.nom, rang: s.rang, voie: s.voie, source: "inconnu", liste: "sorts" }
    );
  }
  return faits;
}

/** Rangs connus par voie (talents + sorts + traits), pour les prérequis. */
export function rangsConnusParVoie(c: Character): Map<string, Set<number>> {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const map = new Map<string, Set<number>>();
  const ajoute = (voie: string | null, rang: number | null) => {
    if (!voie || !rang) return;
    if (!map.has(voie)) map.set(voie, new Set());
    map.get(voie)!.add(rang);
  };
  for (const f of faitsCapacites(c)) ajoute(f.voie, f.rang);
  for (const t of c.traitsPeuple ?? []) {
    const loc = localiserCapacite(t, profil, c.peuple, c.voieMage);
    if (loc) ajoute(loc.voie, loc.rang);
  }
  return map;
}

export interface LigneCompte extends FaitCapacite {
  cout: number;
  gratuit: boolean;
}

export interface CompteCapacites {
  lignes: LigneCompte[];
  depense: number;
  points: number;
  restants: number;
  /** Nom de la capacité couverte par la gratuité R2 (ou null). */
  rang2Nom: string | null;
  alertes: string[];
}

/** Comptabilité complète (tous niveaux) : coûts, gratuités, prérequis, niveaux. */
export function compterCapacites(c: Character): CompteCapacites {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const cfg = creationProfil(profil);
  const niveau = Math.max(1, Math.floor(c.niveau));
  const lignes: LigneCompte[] = faitsCapacites(c).map((f) => ({
    ...f,
    cout: f.rang ? coutRang(f.rang) : 0,
    gratuit: false,
  }));
  // Gratuité : rang 1 de peuple (0 pt).
  for (const l of lignes) {
    if (l.source === "peuple" && l.rang === 1) {
      l.gratuit = true;
      l.cout = 0;
    }
  }
  // Gratuité : UNE capacité de rang 2 (profils Mage).
  let rang2Nom: string | null = null;
  if (cfg.rang2Gratuit) {
    const elue = lignes.find((l) => l.rang === 2 && (l.source === "profil" || l.source === "mage"));
    if (elue) {
      elue.gratuit = true;
      elue.cout = 0;
      rang2Nom = elue.nom;
    }
  }
  const points = pointsCapaciteTotal(niveau);
  const depense = lignes.reduce((a, l) => a + l.cout, 0);
  const restants = points - depense;
  const alertes: string[] = [];
  if (restants < 0) alertes.push(`${depense} pts dépensés pour ${points} disponibles`);
  const connus = rangsConnusParVoie(c);
  for (const l of lignes) {
    if (l.source === "inconnu") {
      alertes.push(
        l.liste === "talents"
          ? `"${l.nom}" : inconnue des voies accessibles (${profil || "?"})`
          : `"${l.nom}" : voie "${l.voie}" inaccessible`
      );
      continue;
    }
    if (l.rang === null || l.voie === null) continue; // garde-fou
    if (l.rang > 1) {
      const set = connus.get(l.voie) ?? new Set<number>();
      const manquants = Array.from({ length: l.rang - 1 }, (_, i) => i + 1).filter((r) => !set.has(r));
      if (manquants.length > 0) alertes.push(`"${l.nom}" : requiert ${l.voie} rang ${manquants.join(", ")}`);
    }
    if (!l.gratuit && niveau < l.rang) alertes.push(`"${l.nom}" : niveau ${l.rang} requis (niveau ${niveau})`);
  }
  return { lignes, depense, points, restants, rang2Nom, alertes };
}

/**
 * Vérifie la création d'un personnage de niveau 1. Retourne null au-delà.
 * Non bloquant : les alertes sont affichées, jamais imposées.
 */
export function etatCreation(c: Character): EtatCreation | null {
  if (c.niveau !== 1) return null;
  const compte = compterCapacites(c);
  const voiePeuple = voiePeupleDe(c.peuple);
  const peupleAttendue = voiePeuple ? voiePeuple.capacites[0].nom : null;
  const connus = new Set(
    [
      ...(c.traitsPeuple ?? []),
      ...(c.capacites ?? []),
      ...(c.sorts ?? []).map((s) => s.nom),
    ].map(normaliserNomCapacite)
  );
  const peupleOk = peupleAttendue ? connus.has(normaliserNomCapacite(peupleAttendue)) : true;
  const alertes = [...compte.alertes];
  if (!peupleOk) alertes.push(`Rang 1 de peuple manquant : "${peupleAttendue}" (gratuit)`);
  if (c.voieMage && c.famille !== "Mage") {
    alertes.push("Voie du mage adoptée hors famille Mage");
  }
  if (c.voieMage && peupleAttendue && !peupleOk) {
    alertes.push("Voie du mage : le rang 1 du peuple est conservé");
  }
  return {
    points: compte.points,
    depense: compte.depense,
    restants: compte.restants,
    peupleAttendue,
    peupleOk,
    rang2Nom: compte.rang2Nom,
    alertes,
  };
}

export interface PorteApprentissage {
  ok: boolean;
  raisons: string[];
  cout: number;
  gratuit: boolean;
  connu: boolean;
}

/**
 * Peut-on apprendre (nom, voie, rang) ? Vérifie : déjà connu, voie accessible,
 * rangs précédents, niveau minimum, points (gratuité Mage déduite).
 * Sans voie ni rang (création maison MJ) : toujours permis, non compté.
 */
export function peutApprendre(
  c: Character,
  entree: { nom: string; voie?: string; rang?: number },
  liste: ListeCapacite = "talents"
): PorteApprentissage {
  const nom = (entree.nom ?? "").trim();
  const voie = (entree.voie ?? "").trim();
  const rang = entree.rang ?? 0;
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const niveau = Math.max(1, Math.floor(c.niveau));
  if (!nom) return { ok: false, raisons: ["nom vide"], cout: 0, gratuit: false, connu: false };
  if (!voie || !rang) return { ok: true, raisons: [], cout: 0, gratuit: false, connu: false };
  const q = normaliserNomCapacite(nom);
  const dansListe = (
    liste === "talents" ? c.capacites ?? [] : (c.sorts ?? []).map((s) => s.nom)
  ).some((t) => normaliserNomCapacite(t) === q);
  if (dansListe) return { ok: false, raisons: ["déjà connue"], cout: 0, gratuit: false, connu: true };
  const raisons: string[] = [];
  const src = sourceDeVoie(voie, profil, c.peuple, c.voieMage);
  if (!src) raisons.push(`hors voies accessibles (${profil || "?"})`);
  const connus = rangsConnusParVoie(c);
  const set = connus.get(voie) ?? new Set<number>();
  const manquants = Array.from({ length: rang - 1 }, (_, i) => i + 1).filter((r) => !set.has(r));
  if (manquants.length > 0) raisons.push(`requiert ${voie} rang ${manquants.join(", ")}`);
  const compte = compterCapacites(c);
  const cfg = creationProfil(profil);
  const gratuit =
    (!!cfg.rang2Gratuit && rang === 2 && !compte.rang2Nom && (src === "profil" || src === "mage")) ||
    (src === "peuple" && rang === 1);
  if (!gratuit && niveau < rang) raisons.push(`niveau ${rang} requis (niveau ${niveau})`);
  const cout = gratuit ? 0 : coutRang(rang);
  if (!gratuit && compte.restants - cout < 0) {
    raisons.push(`pas assez de points (coût ${cout}, reste ${compte.restants})`);
  }
  return { ok: raisons.length === 0, raisons, cout, gratuit, connu: false };
}

/** Capacités de rang 1 du profil encore apprenables (pour le sélecteur). */
export function talentsRang1Disponibles(c: Character): { nom: string; voie: string }[] {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const prises = new Set((c.capacites ?? []).map(normaliserNomCapacite));
  return (CAPACITES[profil] ?? []).flatMap((v) =>
    v.capacites
      .filter((x) => x.rang === 1 && !prises.has(normaliserNomCapacite(x.nom)))
      .map((x) => ({ nom: x.nom, voie: v.voie }))
  );
}

/** Capacités de rang 2 éligibles à la gratuité Mage (vide si inéligible ou consommée). */
export function talentsRang2Gratuits(c: Character): { nom: string; voie: string }[] {
  if (c.niveau !== 1) return [];
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  if (!creationProfil(profil).rang2Gratuit) return [];
  if (etatCreation(c)?.rang2Nom) return [];
  const prises = new Set((c.capacites ?? []).map(normaliserNomCapacite));
  const voies = [...(CAPACITES[profil] ?? [])];
  if (c.voieMage) voies.push(VOIE_MAGE);
  return voies.flatMap((v) =>
    v.capacites
      .filter((x) => x.rang === 2 && !prises.has(normaliserNomCapacite(x.nom)))
      .map((x) => ({ nom: x.nom, voie: v.voie }))
  );
}

/**
 * Retrouve l'entrée grimoire d'un talent qui est aussi un sort (via sortId),
 * dans les voies de profils comme du peuple/mage. Indéfini sinon.
 */
export function sortDuTalent(nom: string, grimoire: Sort[]): Sort | undefined {
  const q = normaliserNomCapacite(nom);
  const cherche = (voies: { capacites: { nom: string; sortId?: string }[] }[]): string | undefined => {
    for (const v of voies) {
      const cap = v.capacites.find((x) => x.sortId && normaliserNomCapacite(x.nom) === q);
      if (cap?.sortId) return cap.sortId;
    }
    return undefined;
  };
  const id =
    cherche(Object.values(CAPACITES).flat()) ?? cherche(VOIES_PEUPLE) ?? cherche([VOIE_MAGE]);
  if (!id) return undefined;
  return grimoire.find((s) => s.id === id);
}

/**
 * Apprend un talent ; si c'est aussi un sort, crée l'entrée lançable (+ mana).
 * Connaître le talent sans le sort ne permet pas de le lancer en combat.
 */
export function apprendreTalentComplet<T extends Character>(c: T, nom: string, grimoire: Sort[] = []): T {
  let r = ajouterCapacite(c, nom);
  const sort = sortDuTalent(nom, grimoire);
  const q = normaliserNomCapacite(nom);
  if (sort && !r.sorts.some((s) => normaliserNomCapacite(s.nom) === q)) {
    r = apprendreSort(r, sort);
  }
  return r;
}

export interface PorteDesapprentissage {
  ok: boolean;
  raisons: string[];
}

/**
 * Peut-on désapprendre une capacité ? Interdit de retirer un rang tant qu'un
 * rang supérieur de la même voie est connu (désapprendre du haut vers le bas).
 * Les entrées inconnues ou maison (sans voie) restent toujours retirables,
 * pour ne jamais bloquer la correction d'un écart.
 */
export function peutDesapprendre(
  c: Character,
  nom: string,
  liste: "talents" | "sorts" = "talents"
): PorteDesapprentissage {
  const q = normaliserNomCapacite((nom ?? "").trim());
  if (!q) return { ok: false, raisons: ["nom vide"] };
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const entrees = liste === "talents" ? c.capacites ?? [] : (c.sorts ?? []).map((s) => s.nom);
  if (!entrees.some((t) => normaliserNomCapacite(t) === q)) {
    return { ok: false, raisons: ["non apprise"] };
  }
  let voie: string | null = null;
  let rang: number | null = null;
  if (liste === "sorts") {
    const sort = (c.sorts ?? []).find((s) => normaliserNomCapacite(s.nom) === q);
    if (!sort?.voie || !sort?.rang) return { ok: true, raisons: [] }; // création maison : rien à vérifier
    voie = sort.voie.trim();
    rang = sort.rang;
  } else {
    const loc = localiserCapacite(nom, profil, c.peuple, c.voieMage);
    if (!loc) return { ok: true, raisons: [] }; // inconnue : retirable (corrige l'écart)
    voie = loc.voie;
    rang = loc.rang;
  }
  if (!voie || !rang) return { ok: true, raisons: [] }; // garde-fou
  // Rangs supérieurs connus (talents + sorts) dans la même voie ?
  const superieurs = new Set<number>();
  const scanne = (
    noms: string[],
    localise: (n: string) => { voie: string; rang: number } | undefined
  ) => {
    for (const n of noms) {
      if (normaliserNomCapacite(n) === q) continue; // elle-même
      const l = localise(n);
      if (l && l.voie === voie && l.rang > rang) superieurs.add(l.rang);
    }
  };
  scanne(c.capacites ?? [], (n) => {
    const l = localiserCapacite(n, profil, c.peuple, c.voieMage);
    return l ? { voie: l.voie, rang: l.rang } : undefined;
  });
  scanne(
    (c.sorts ?? []).filter((s) => s.voie && s.rang).map((s) => s.nom),
    (n) => {
      const s = (c.sorts ?? []).find((x) => normaliserNomCapacite(x.nom) === normaliserNomCapacite(n));
      if (!s?.voie || !s?.rang) return undefined;
      if (!sourceDeVoie(s.voie, profil, c.peuple, c.voieMage)) return undefined;
      return { voie: s.voie.trim(), rang: s.rang };
    }
  );
  if (superieurs.size > 0) {
    const rangs = [...superieurs].sort((a, b) => a - b).join(", ");
    return { ok: false, raisons: [`"${nom.trim()}" : désapprendre d'abord ${voie} rang ${rangs}`] };
  }
  return { ok: true, raisons: [] };
}
