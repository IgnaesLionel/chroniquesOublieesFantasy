// Pattern Repository : l'UI ne parle qu'à StorageAdapter.
// Aujourd'hui localStorage, demain SQLite/Postgres sans changer l'UI.

export interface StorageAdapter {
  load<T>(key: string): T | null;
  save<T>(key: string, value: T): void;
}

// Trace d'écriture (diagnostic) : chaque save note heure, clé, origine
// appelante et un résumé du contenu. Sert à repérer QUI réécrit une valeur
// déjà vérifiée (bug « combat terminé puis fiches à l'ancien état »).
export type TraceEcriture = { h: string; cle: string; origine: string; resume: string; raw?: string };

const TRACES_MAX = 30;
const tracesEcritures: TraceEcriture[] = [];

/** Dernières écritures tracées (la plus récente en fin), filtrées par clé. */
export function lireTracesEcritures(cle?: string): TraceEcriture[] {
  return cle ? tracesEcritures.filter((t) => t.cle === cle) : [...tracesEcritures];
}

// Diagnostic console : __cofTraces() liste les écritures (avec stack brut).
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__cofTraces = lireTracesEcritures;
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
      if (fn === "examinerAppel" || fn === "Object.save") continue;
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
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  save(key, value) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
    const appel = examinerAppel();
    tracesEcritures.push({
      h: new Date().toTimeString().slice(0, 8),
      cle: key,
      origine: appel.origine,
      resume: resumeValeur(value),
      raw: appel.raw.slice(0, 500),
    });
    if (tracesEcritures.length > TRACES_MAX) tracesEcritures.splice(0, tracesEcritures.length - TRACES_MAX);
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
