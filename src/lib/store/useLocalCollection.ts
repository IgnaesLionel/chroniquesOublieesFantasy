"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localStorageAdapter } from "@/src/lib/store/repository";

// Collection persistée en localStorage avec seed initial.
// Retourne [items, setItems] ; toute écriture est sauvegardée.
export function useLocalCollection<T extends { id: string }>(key: string, seed: T[]) {
  const [items, setItemsRaw] = useState<T[]>(seed);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    const stored = localStorageAdapter.load<T[]>(key);
    if (stored) setItemsRaw(stored);
    loadedRef.current = true;
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (loaded) localStorageAdapter.save(key, items);
  }, [key, items, loaded]);

  // Écriture synchrone : chaque mise à jour est persistée aussitôt, pas
  // seulement après ré-affichage. Sans ça, quitter la page (ex. Combat →
  // Personnages juste après "Terminer") avant que l'effet ne s'exécute
  // perdait la mise à jour : la page suivante rechargeait l'ancien stock.
  // La sauvegarde a lieu dans le mutateur (idempotente) pour survivre
  // à un démontage immédiat.
  const setItems = useCallback(
    (update: React.SetStateAction<T[]>) => {
      if (!loadedRef.current) {
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
    [key]
  );

  // Resynchronisation : un autre onglet peut modifier le stockage (événement
  // storage), et un retour arrière / changement d'onglet peut restaurer une
  // page montée avant (visibilité, focus). Toute écriture étant persistée
  // aussitôt, relire converge vers des données à jour sans rien écraser
  // d'utile (les brouillons d'édition vivent dans des états séparés).
  useEffect(() => {
    const relire = () => {
      const stored = localStorageAdapter.load<T[]>(key);
      if (stored) setItems(stored);
    };
    const surStockage = (e: StorageEvent) => {
      if (e.key === key) relire();
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") relire();
    };
    window.addEventListener("storage", surStockage);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("focus", relire);
    return () => {
      window.removeEventListener("storage", surStockage);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("focus", relire);
    };
  }, [key, setItems]);

  return { items, setItems, loaded };
}
