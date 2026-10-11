"use client";
import { useEffect, useState } from "react";
import { localStorageAdapter } from "@/src/lib/store/repository";

// Collection persistée en localStorage avec seed initial.
// Retourne [items, setItems] ; toute écriture est sauvegardée.
export function useLocalCollection<T extends { id: string }>(key: string, seed: T[]) {
  const [items, setItems] = useState<T[]>(seed);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorageAdapter.load<T[]>(key);
    if (stored) setItems(stored);
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (loaded) localStorageAdapter.save(key, items);
  }, [key, items, loaded]);

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
  }, [key]);

  return { items, setItems, loaded };
}
