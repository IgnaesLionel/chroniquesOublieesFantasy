import { miroirSauver, miroirSessionLire } from "@/src/lib/store/miroir";
import { codeInterne, installerSurveillanceStockage, type MutationStockage } from "@/src/lib/store/surveillance";

// Pattern Repository : l'UI ne parle qu'à StorageAdapter.
// Aujourd'hui localStorage, demain SQLite/Postgres sans changer l'UI.

export interface StorageAdapter {
  load<T>(key: string): T | null;
  save<T>(key: string, value: T, opts?: { retourAuxGraines?: boolean }): void;
}

// Chronologie des accès au stockage (diagnostic) : lectures ET écritures
// mélangées dans l'ordre réel (seq incrémenté), avec heure, origine appelante
// et détail complet (PV des fiches + taille en caractères). Permet de
// reconstituer exactement ce que chaque accès a lu, dans quel ordre, et lequel
// a écrit par-dessus — sans quoi les deux tampons séparés laissent l'ordre
// lecture/écriture introuvable.
export type Trace = {
  seq: number;
  h: string;
  type: "lecture" | "ecriture" | "evenement";
  cle: string;
  origine: string;
  detail: string;
  raw?: string;
  /** Anomalie (clé vide, retour aux graines, mutation étrangère…) : jamais évincée. */
  epingle?: boolean;
};

const TRACES_MAX = 150;

/** Une trace qui raconte un accident : on ne la laisse jamais chuter du haut. */
function estAnomalie(detail: string): boolean {
  return /VIDE|JSON INVALIDE|ERREUR|illisible|EXTERNE|RETOUR AUX GRAINES|SUPPRIMÉE/.test(detail);
}

/** Clé sessionStorage (par onglet) où la chrono est miroirée pour survivre au F5. */
const SESSION_TRACES = "cof.traces.chrono";
const traces: Trace[] = [];
let seqTrace = 0;

const heure = () => new Date().toTimeString().slice(0, 8);

function noterTrace(t: Omit<Trace, "seq">): void {
  const epingle = estAnomalie(t.detail);
  traces.push({ seq: seqTrace++, ...t, ...(epingle ? { epingle: true } : {}) });
  // Éviction par le plus ancien NON épinglé : une séquence d'anomalies ne
  // doit jamais pouvoir se faire supprimer par son propre débit.
  while (traces.length > TRACES_MAX) {
    const i = traces.findIndex((x) => !x.epingle);
    if (i === -1) break;
    traces.splice(i, 1);
  }
  // Miroir sessionStorage : les tampons en mémoire meurent au F5, or le
  // réflexe « F5 pour vérifier » est exactement ce qui effacerait la preuve
  // au moment où elle apparaît. sessionStorage est par onglet : chaque
  // onglet garde sa propre chronologie, sans croiser les onglets.
  try {
    const brut = JSON.stringify(traces);
    if (typeof window !== "undefined") codeInterne(() => sessionStorage.setItem(SESSION_TRACES, brut));
  } catch {
    // Stockage de session indisponible : la chrono vit au moins le document.
  }
}

// Hydration après rechargement (F5) : on reprend la chronologie de ce même
// onglet, pour ne rien perdre entre l'apparition du bug et la copie de
// l'encart — y compris les opérations d'avant le rechargement.
if (typeof window !== "undefined") {
  try {
    const brut = sessionStorage.getItem(SESSION_TRACES);
    if (brut) {
      const anciennes = JSON.parse(brut) as Trace[];
      if (Array.isArray(anciennes) && anciennes.length > 0) {
        traces.push(...anciennes.slice(-TRACES_MAX));
        seqTrace = Math.max(...anciennes.map((t) => t.seq), seqTrace) + 1;
      }
    }
  } catch {
    // Absente ou illisible : on repart d'une chrono vide.
  }
}

/** Chronologie complète des traces (la plus récente en fin), filtres optionnels. */
export function lireTraces(cle?: string, type?: Trace["type"]): Trace[] {
  return traces.filter((t) => (!cle || t.cle === cle) && (!type || t.type === type));
}

/** Écritures tracées (lecture simple pour l'encart). */
export function lireTracesEcritures(cle?: string): Trace[] {
  return lireTraces(cle, "ecriture");
}

/** Lectures tracées (lecture simple pour l'encart). */
export function lireTracesLectures(cle?: string): Trace[] {
  return lireTraces(cle, "lecture");
}

// Instance du hook (useLocalCollection) qui déclenche l'accès : plusieurs
// écrans — voire plusieurs composants d'un même écran — tiennent la même clé,
// et « qui a écrit » n'a de sens que si la chrono nomme l'instance. Sans ça,
// deux écritures concurrentes d'une même page sont indiscernables.
let instanceCourante = "";
const instancesActives = new Set<string>();

/** « characters » à partir de « cof.characters.v2 » — lisible dans la chrono. */
export function libelleCle(key: string): string {
  return key.replace(/^cof\./, "").replace(/\.v\d+$/, "");
}

/** Exécute `f` en attribuant la trace à l'instance `libelle`. */
export function avecInstance<T>(libelle: string, f: () => T): T {
  const precedent = instanceCourante;
  instanceCourante = libelle;
  try {
    return f();
  } finally {
    instanceCourante = precedent;
  }
}

export function marquerInstanceActive(libelle: string): void {
  instancesActives.add(libelle);
}

export function retirerInstanceActive(libelle: string): void {
  instancesActives.delete(libelle);
}

/** Instances vivantes d'une clé, ex : [« #2 combat », « #4 »]. */
export function instancesDe(cle: string): string[] {
  const prefixe = `${libelleCle(cle)}#`;
  return [...instancesActives]
    .filter((l) => l.startsWith(prefixe))
    .map((l) => l.slice(prefixe.length));
}

const nommer = (origine: string): string => (instanceCourante ? `${origine} [${instanceCourante}]` : origine);

/**
 * Marque la réception d'un événement `storage` (une AUTRE écriture, faite par
 * un autre onglet/fenêtre, vient d'être détectée ici) avec le contenu reçu.
 * C'est le seul accès qui n'apparaît jamais dans la chrono des lectures et
 * écritures locales — or c'est exactement celui qui peut tout expliquer.
 */
export function noterEvenementStockage(cle: string, newValue: string | null): void {
  let detail: string;
  if (newValue === null) {
    detail = "clé SUPPRIMÉE par un autre onglet";
  } else {
    try {
      detail = `autre onglet a écrit : ${resumeValeur(JSON.parse(newValue))} (${newValue.length} car.)`;
    } catch {
      detail = `autre onglet a écrit une valeur illisible (${newValue.length} car.)`;
    }
  }
  noterTrace({ h: heure(), type: "evenement", cle, origine: nommer("événement storage"), detail });
}

/** Marque une resynchronisation explicite (relire suite à cause X). */
export function noterResync(cle: string, cause: string): void {
  noterTrace({ h: heure(), type: "evenement", cle, origine: nommer(`resync (${cause})`), detail: "relire du stockage" });
}

// Diagnostic console : __cofTraces() renvoie la chronologie complète
// (chaque entrée porte son détail et son stack brut).
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__cofTraces = lireTraces;
  (window as unknown as Record<string, unknown>).__cofLectures = lireTracesLectures;
  // Surveillance : toute mutation de stockage faite par un code qui n'est pas
  // le nôtre (autre application de l'origine, dépendance, script tiers) est
  // déclarée dans la chrono avec sa pile — c'est le seul moyen de voir un
  // effacement qui ne passe pas par l'adaptateur.
  installerSurveillanceStockage(noterMutationExt);
}

/** Fichier appelant (hors couche stockage), ex : « combat/terminer ».
 * Les chunks Turbopack sont hasheés mais les noms de fonctions sont lisibles
 * (« useLocalCollection.useEffect », « terminer », « damage »…). */
function examinerAppel(): { origine: string; raw: string } {
  let hookVu = "";
  let raw = "";
  try {
    throw new Error("trace");
  } catch (e) {
    const lignes = (e as Error).stack?.split("\n") ?? [];
    raw = lignes.slice(1, 20).join(" | ");
    for (const ligne of lignes.slice(1)) {
      const m = ligne.match(/^\s*at\s+([^(]+?)\s*\(/);
      const fn = (m ? m[1] : ligne.replace(/^\s*at\s+/, "").split(" ")[0]).trim();
      if (fn === "examinerAppel" || fn === "Object.save" || fn === "Object.load" || fn === "avecInstance" || fn === "codeInterne") continue;
      if (fn.includes("useLocalCollection")) {
        hookVu = fn.includes("useEffect")
          ? "useLocalCollection (effet)"
          : fn.includes("setItems")
            ? "useLocalCollection (mutateur)"
            : "useLocalCollection";
        continue;
      }
      // Bruit React : on le saute pour atteindre l'appelant réel.
      if (/react|reducer|dispatch|commit|workloop|renderwith|schedule|flush|passive|syncqueue|concurrent|guardedcallback|basestate|fiber|runwith|^usestate$|^useref$|^usememo$|^useeffect$|^usecallback$/i.test(fn)) continue;
      return { origine: fn.replace(/^Object\./, ""), raw };
    }
  }
  return { origine: hookVu || "?", raw };
}

/** Résumé lisible du contenu écrit (pv des fiches s'il y en a). */
function resumeValeur(value: unknown): string {
  if (Array.isArray(value)) {
    const pvs = value
      .filter((x): x is { nom?: string; pv?: number; pvMax?: number } => !!x && typeof x === "object")
      .filter((x) => typeof x.pv === "number")
      .slice(0, 6)
      .map((x) => `${x.nom ?? "?"} ${x.pv}/${x.pvMax ?? "?"}`);
    return pvs.length > 0 ? `${value.length} fiches : ${pvs.join(" · ")}` : `${value.length} él.`;
  }
  return typeof value === "object" && value !== null ? "obj." : String(value);
}

/**
 * Formule une mutation vue par la surveillance (pure, testable) : c'est le
 * témoin qui dira si la clé a été effacée par quelqu'un d'autre — et dans le
 * cas d'une écriture étrangère, quelle valeur elle a plantée à la place.
 */
export function detailMutation(
  m: MutationStockage,
  resume: (v: unknown) => string = resumeValeur
): string {
  if (m.action === "clear") {
    const liste = (m.perdues ?? []).join(" · ") || "aucune clé cof.*";
    return `EXTERNE clear(${m.cible}) — efface : ${liste}`;
  }
  if (m.action === "removeItem") {
    const etat = m.avant ? `avait ${m.avant} car.` : "clé déjà absente";
    return `EXTERNE removeItem(${m.cible}, ${m.cle ?? "?"}) — ${etat}`;
  }
  let contenu = `${m.taille ?? 0} car.`;
  if (m.valeur) {
    try {
      contenu = `${resume(JSON.parse(m.valeur))} (${m.taille ?? 0} car.)`;
    } catch {
      // Valeur étrangère illisible : la taille suffit à la décrire.
    }
  }
  const avant = m.avant ? `${m.avant} car.` : "vide";
  return `EXTERNE setItem(${m.cible}, ${m.cle ?? "?"}) → ${contenu} · préc. ${avant}`;
}

/** Déclare une mutation non interne dans la chrono (épinglée, avec la pile). */
function noterMutationExt(m: MutationStockage): void {
  noterTrace({
    h: heure(),
    type: "evenement",
    cle: m.cle ?? m.cible,
    origine: "surveillance storage",
    detail: `⚠ ${detailMutation(m)}`,
    raw: m.pile.slice(0, 500),
  });
}

export const localStorageAdapter: StorageAdapter = {
  load<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    let detail = "";
    let valeur: T | null = null;
    try {
      let raw = window.localStorage.getItem(key);
      let restaure = false;
      if (!raw) {
        // Effacement externe possible (une AUTRE application partageant
        // l'origine a vidé localStorage) : le miroir d'onglet (sessionStorage)
        // survit à un localStorage.clear() → restauration immédiate, tracée,
        // avant que les graines ne prennent le relais.
        const miroir = miroirSessionLire(key);
        if (miroir) {
          codeInterne(() => window.localStorage.setItem(key, miroir));
          raw = miroir;
          restaure = true;
        }
      }
      if (!raw) {
        detail = "VIDE — clé absente";
      } else {
        try {
          valeur = JSON.parse(raw) as T;
          detail = `${restaure ? "RESTAURÉ (miroir onglet) — " : ""}${resumeValeur(valeur)} (${raw.length} car.)`;
        } catch {
          detail = `JSON INVALIDE (${raw.length} car.) début : ${raw.slice(0, 60)}`;
        }
      }
    } catch (e) {
      detail = `ERREUR getItem : ${e instanceof Error ? e.message : "?"}`;
    }
    noterTrace({
      h: new Date().toTimeString().slice(0, 8),
      type: "lecture",
      cle: key,
      origine: nommer(examinerAppel().origine),
      detail,
    });
    return valeur;
  },
  save(key, value, opts) {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(value);
    // Ce qui était EN STOCKAGE avant cette écriture : la question décisive du
    // bug « plein vie après Terminer » est de savoir si la clé était vide au
    // moment de l'écriture (chute sur les graines) ou contenait déjà les PV
    // (quelqu'un a écrit une valeur périmée par-dessus).
    let precedent = "vide";
    try {
      const avant = window.localStorage.getItem(key);
      if (avant) {
        try {
          precedent = `${resumeValeur(JSON.parse(avant))} (${avant.length} car.)`;
        } catch {
          precedent = `illisible (${avant.length} car.)`;
        }
      }
    } catch {
      precedent = "?";
    }
    codeInterne(() => window.localStorage.setItem(key, json));
    // Miroirs (onglet + IndexedDB) : imperméables à un localStorage.clear()
    // venant d'une autre application de la même origine.
    miroirSauver(key, json);
    const appel = examinerAppel();
    noterTrace({
      h: new Date().toTimeString().slice(0, 8),
      type: "ecriture",
      cle: key,
      origine: nommer(appel.origine),
      detail: `${resumeValeur(value)} (${json.length} car.)${
        opts?.retourAuxGraines ? " ⚠ RETOUR AUX GRAINES" : ""
      } · préc. ${precedent}`,
      raw: appel.raw.slice(0, 900),
    });
  },
};

export function exportJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
