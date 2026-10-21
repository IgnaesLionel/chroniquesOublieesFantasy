"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localStorageAdapter } from "@/src/lib/store/repository";

// Collection avec seed initial.
// persist (défaut true) : lue/écrite en localStorage.
// persist: false : mémoire seule, toujours depuis les graines du code
// (aucune lecture/écriture locale ; la clé périmée est nettoyée au montage).
// Retourne [items, setItems] ; toute écriture persistée est sauvegardée.
export function useLocalCollection<T extends { id: string }>(
  key: string,
  seed: T[],
  opts: { persist?: boolean; migrer?: (items: T[]) => T[] } = {}
) {
  const persist = opts.persist ?? true;
  const [items, setItemsRaw] = useState<T[]>(seed);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!persist) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Stockage indisponible : rien à nettoyer.
      }
      loadedRef.current = true;
      setLoaded(true);
      return;
    }
    const stored = localStorageAdapter.load<T[]>(key);
    // Stock existant : on ajoute les graines manquantes (nouveau contenu
    // livré par une mise à jour, ex : scénario ajouté après coup) sans
    // toucher aux données de l’utilisateur, puis on applique la migration
    // éventuelle (ex : renommage de fiches graines).
    if (stored) setItemsRaw(preparerStock(stored, seed, opts.migrer));
    loadedRef.current = true;
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, persist]);

  useEffect(() => {
    if (persist && loaded) localStorageAdapter.save(key, items);
  }, [key, items, loaded, persist]);

  // Écriture synchrone : chaque mise à jour est persistée aussitôt, pas
  // seulement après ré-affichage. Sans ça, quitter la page (ex. Combat →
  // Personnages juste après "Terminer") avant que l'effet ne s'exécute
  // perdait la mise à jour : la page suivante rechargeait l'ancien stock.
  // La sauvegarde a lieu dans le mutateur (idempotente) pour survivre
  // à un démontage immédiat.
  const setItems = useCallback(
    (update: React.SetStateAction<T[]>) => {
      if (!persist || !loadedRef.current) {
        setItemsRaw(update);
        return;
      }
      setItemsRaw((prev) => {
        const next = typeof update === "function" ? (update as (p: T[]) => T[])(prev) : update;
        try {
          localStorageAdapter.save(key, next);
        } catch {
          // Stockage indisponible : l'état mémoire reste la source de vérité.
        }
        return next;
      });
    },
    [key, persist]
  );

  // Resynchronisation : un autre onglet peut modifier le stockage (événement
  // storage), et un retour arrière / changement d'onglet peut restaurer une
  // page montée avant (visibilité, focus). Toute écriture étant persistée
  // aussitôt, relire converge vers des données à jour sans rien écraser
  // d'utile (les brouillons d'édition vivent dans des états séparés).
  useEffect(() => {
    if (!persist) return;
    const relire = () => {
      const stored = localStorageAdapter.load<T[]>(key);
      if (stored) setItems(preparerStock(stored, seed, opts.migrer));
    };
    const surStockage = (e: StorageEvent) => {
      if (e.key === key) relire();
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") relire();
    };
    // Restoration bfcache (←/→ ou retour après une navigation « document ») :
    // le gel du document ne redéclenche ni visibilitychange ni focus selon les
    // navigateurs (cas typique iPad/Safari) — pageshow est LE signal fiable de
    // sortie de bfcache, et popstate couvre les traversées d'historique dans le
    // même document (App Router). Sans eux, un écran restauré affiche d'anciens
    // PV jusqu'au prochain rechargement complet.
    const surRestauration = () => relire();
    window.addEventListener("storage", surStockage);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("focus", relire);
    window.addEventListener("pageshow", surRestauration);
    window.addEventListener("popstate", surRestauration);
    return () => {
      window.removeEventListener("storage", surStockage);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("focus", relire);
      window.removeEventListener("pageshow", surRestauration);
      window.removeEventListener("popstate", surRestauration);
    };
    // seed / migrer : constantes de module côté appelants (mêmes valeurs à
    // chaque rendu) ; les relire ne doit pas réabonner les écouteurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, persist, setItems]);

  return { items, setItems, loaded };
}

/**
 * Ajoute les graines absentes du stock (nouveau contenu après une mise à
 * jour) sans toucher aux données existantes : ni réécriture, ni réordre,
 * ni doublon. Pur et testable (le hook React ne l’est pas ici).
 */
export function fusionnerSeedsManquants<T extends { id: string }>(stockes: T[], graines: T[]): T[] {
  if (graines.length === 0) return stockes;
  const ids = new Set(stockes.map((x) => x.id));
  const manquants = graines.filter((g) => !ids.has(g.id));
  return manquants.length === 0 ? stockes : [...stockes, ...manquants];
}

/**
 * Stock local -> état affiché : graines manquantes ajoutées, puis migration
 * éventuelle de collection (ex. renommage des fiches graines, qui ne touche
 * que les fiches encore au nom d'origine). Pure et testable.
 */
export function preparerStock<T extends { id: string }>(
  stockes: T[],
  graines: T[],
  migrer?: (items: T[]) => T[]
): T[] {
  const fusion = fusionnerSeedsManquants(stockes, graines);
  return migrer ? migrer(fusion) : fusion;
}
