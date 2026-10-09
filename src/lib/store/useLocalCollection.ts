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

  return { items, setItems, loaded };
}
