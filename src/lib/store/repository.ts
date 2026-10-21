// Pattern Repository : l'UI ne parle qu'à StorageAdapter.
// Aujourd'hui localStorage, demain SQLite/Postgres sans changer l'UI.

export interface StorageAdapter {
  load<T>(key: string): T | null;
  save<T>(key: string, value: T): void;
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
};

const TRACES_MAX = 60;
/** Clé sessionStorage (par onglet) où la chrono est miroirée pour survivre au F5. */
const SESSION_TRACES = "cof.traces.chrono";
const traces: Trace[] = [];
let seqTrace = 0;

const heure = () => new Date().toTimeString().slice(0, 8);

function noterTrace(t: Omit<Trace, "seq">): void {
  traces.push({ seq: seqTrace++, ...t });
  if (traces.length > TRACES_MAX) traces.splice(0, traces.length - TRACES_MAX);
  // Miroir sessionStorage : les tampons en mémoire meurent au F5, or le
  // réflexe « F5 pour vérifier » est exactement ce qui effacerait la preuve
  // au moment où elle apparaît. sessionStorage est par onglet : chaque
  // onglet garde sa propre chronologie, sans croiser les onglets.
  try {
    sessionStorage.setItem(SESSION_TRACES, JSON.stringify(traces));
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
  noterTrace({ h: heure(), type: "evenement", cle, origine: "événement storage", detail });
}

/** Marque une resynchronisation explicite (relire suite à cause X). */
export function noterResync(cle: string, cause: string): void {
  noterTrace({ h: heure(), type: "evenement", cle, origine: `resync (${cause})`, detail: "relire du stockage" });
}

// Diagnostic console : __cofTraces() renvoie la chronologie complète
// (chaque entrée porte son détail et son stack brut).
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__cofTraces = lireTraces;
  (window as unknown as Record<string, unknown>).__cofLectures = lireTracesLectures;
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
    raw = lignes.slice(1, 13).join(" | ");
    for (const ligne of lignes.slice(1)) {
      const m = ligne.match(/^\s*at\s+([^(]+?)\s*\(/);
      const fn = (m ? m[1] : ligne.replace(/^\s*at\s+/, "").split(" ")[0]).trim();
      if (fn === "examinerAppel" || fn === "Object.save" || fn === "Object.load") continue;
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

export const localStorageAdapter: StorageAdapter = {
  load<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    let detail = "";
    let valeur: T | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        detail = "VIDE — clé absente";
      } else {
        try {
          valeur = JSON.parse(raw) as T;
          detail = `${resumeValeur(valeur)} (${raw.length} car.)`;
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
      origine: examinerAppel().origine,
      detail,
    });
    return valeur;
  },
  save(key, value) {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(value);
    window.localStorage.setItem(key, json);
    const appel = examinerAppel();
    noterTrace({
      h: new Date().toTimeString().slice(0, 8),
      type: "ecriture",
      cle: key,
      origine: appel.origine,
      detail: `${resumeValeur(value)} (${json.length} car.)`,
      raw: appel.raw.slice(0, 500),
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
