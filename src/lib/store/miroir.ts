// Miroirs de sauvegarde : sur une origine partagée (localhost:3000 a hébergé
// deux applications différentes de la même machine), un localStorage.clear()
// d'UNE application efface les données de l'AUTRE — c'est la panne « fiches
// revenant aux graines full vie » après combat. Deux miroirs, tous deux
// imperméables à un tel effacement :
//  - sessionStorage (synchrone) : survit au clear tant que l'onglet vit ; lu
//    directement par le load() du dépôt, donc restauration IMMÉDIATE avant
//    toute réécriture depuis les graines ;
//  - IndexedDB (asynchrone, durable) : survit à la fermeture de l'onglet ;
//    réconcilié au démarrage, avec événement storage synthétique pour
//    resynchroniser les écrans déjà montés.
// Les deux miroirs sont effacés ensemble par le reset volontaire (bouton
// « Tout effacer » des réglages), pour qu'une réinitialisation délibérée ne
// soit jamais « ressuscitée » par la réconciliation.

const PREFIXE_SESSION = "cof.miroir:";
const NOM_BDD = "cof-miroirs";
const TABLE = "miroirs";

/** Écrit le miroir de cette clé : onglet (synchrone) + IndexedDB (en tâche de fond). */
export function miroirSauver(cle: string, json: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIXE_SESSION + cle, json);
  } catch {
    // sessionStorage indisponible (mode privé restreint) : le miroir onglet
    // saute, IndexedDB peut encore jouer son rôle.
  }
  try {
    if (typeof indexedDB === "undefined") return;
    const ouverture = indexedDB.open(NOM_BDD, 1);
    ouverture.onupgradeneeded = () => {
      const db = ouverture.result;
      if (!db.objectStoreNames.contains(TABLE)) db.createObjectStore(TABLE, { keyPath: "cle" });
    };
    ouverture.onsuccess = () => {
      const db = ouverture.result;
      try {
        const tx = db.transaction(TABLE, "readwrite");
        tx.objectStore(TABLE).put({ cle, json, h: new Date().toTimeString().slice(0, 8) });
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch {
        try { db.close(); } catch { /* rien */ }
      }
    };
  } catch {
    // IndexedDB indisponible : sans effet.
  }
}

/** Miroir d'onglet d'une clé (synchrone), ou null. */
export function miroirSessionLire(cle: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PREFIXE_SESSION + cle);
  } catch {
    return null;
  }
}

/** Efface les deux miroirs (reset volontaire — jamais de résurrection). */
export function effacerMiroirs(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(PREFIXE_SESSION)) window.sessionStorage.removeItem(k);
    }
  } catch {
    // rien
  }
  try {
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase(NOM_BDD);
  } catch {
    // rien
  }
}

/**
 * Réconciliation au démarrage : si une clé manque dans localStorage — ou n'est
 * plus que les graines (écrits par un montage pendant l'effacement) — alors
 * que la sauvegarde IndexedDB la contient, la restaurer et prévenir les écrans
 * via un événement storage synthétique. `graines` : clé -> JSON de référence
 * des graines (comparaison stricte, uniquement pour les clés fournies).
 */
export function demarrerReconciliation(graines: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof indexedDB === "undefined") return;
    const ouverture = indexedDB.open(NOM_BDD, 1);
    ouverture.onupgradeneeded = () => {
      const db = ouverture.result;
      if (!db.objectStoreNames.contains(TABLE)) db.createObjectStore(TABLE, { keyPath: "cle" });
    };
    ouverture.onsuccess = () => {
      const db = ouverture.result;
      try {
        const tx = db.transaction(TABLE, "readonly");
        const requete = tx.objectStore(TABLE).getAll();
        requete.onsuccess = () => {
          try { db.close(); } catch { /* rien */ }
          for (const enregistrement of (requete.result ?? []) as { cle: string; json: string }[]) {
            try {
              const actuel = window.localStorage.getItem(enregistrement.cle);
              const graine = graines[enregistrement.cle];
              const vide = !actuel;
              const regrainé = graine !== undefined && actuel === JSON.stringify(graine);
              if ((!vide && !regrainé) || actuel === enregistrement.json) continue;
              window.localStorage.setItem(enregistrement.cle, enregistrement.json);
              window.dispatchEvent(
                new StorageEvent("storage", {
                  key: enregistrement.cle,
                  newValue: enregistrement.json,
                })
              );
            } catch {
              // Une clé en échec n'empêche pas les autres.
            }
          }
        };
      } catch {
        try { db.close(); } catch { /* rien */ }
      }
    };
  } catch {
    // IndexedDB indisponible : sans effet.
  }
}
