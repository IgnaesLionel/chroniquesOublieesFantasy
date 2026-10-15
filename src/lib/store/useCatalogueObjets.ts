"use client";
import { useMemo } from "react";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import type { Item } from "@/src/lib/rules/world/types";

/**
 * Fusion seeds + créations MJ en garantissant des ids uniques.
 * En cas de collision (ex. ancien stockage contenant déjà un seed),
 * la version maison écrase le seed sans dupliquer la clé React.
 * Ordre préservé : seeds d'abord, créations ensuite.
 */
export function fusionnerCatalogue(seeds: Item[], maison: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const o of seeds) {
    if (!byId.has(o.id)) byId.set(o.id, o);
  }
  for (const o of maison) byId.set(o.id, o);
  return [...byId.values()];
}

// Catalogue d'objets : seeds en dur + créations du MJ (mémoire seule,
// perdues au rechargement — comme les autres données de jeu).
export function useCatalogueObjets() {
  const { items: maison, setItems: setMaison } = useLocalCollection<Item>(STORAGE_KEYS.items, [], { persist: false });
  const catalogue = useMemo(() => fusionnerCatalogue(SEED_ITEMS, maison), [maison]);
  const idsMaison = useMemo(() => new Set(maison.map((o) => o.id)), [maison]);
  return { catalogue, maison, setMaison, idsMaison };
}
