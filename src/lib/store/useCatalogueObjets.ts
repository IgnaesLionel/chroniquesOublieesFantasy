"use client";
import { useMemo } from "react";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import type { Item } from "@/src/lib/rules/world/types";

// Catalogue d'objets : seeds en dur + créations du MJ (persistées en
// localStorage, sauvegardées via le backup comme les autres collections).
export function useCatalogueObjets() {
  const { items: maison, setItems: setMaison } = useLocalCollection<Item>(STORAGE_KEYS.items, []);
  const catalogue = useMemo(() => [...SEED_ITEMS, ...maison], [maison]);
  const idsMaison = useMemo(() => new Set(maison.map((o) => o.id)), [maison]);
  return { catalogue, maison, setMaison, idsMaison };
}
