// Persistance des états de partie (scénario prévu vs réel).
// Les scénarios vivent dans cof.scenarios.v3 (useScenarios).
// Les parties vivent ici : une entrée par scénario, sans écraser le scénario.
//
// Store externe (useSyncExternalStore) plutôt qu'un état par composant : les
// écrans Scénarios et Partie peuvent tenir la même partie ; une seule source
// de vérité évite qu'un écran périmé réécrive la progression de l'autre.
"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { PlayState } from "@/src/lib/rules/scenario/types";
import { ensurePlayDefaults } from "@/src/lib/rules/scenario/engine";
import { localStorageAdapter } from "@/src/lib/store/repository";

/** Clé locale : la progression de campagne reste sur cet ordinateur. */
export const CLE_PARTIES = "cof.plays.v1";

type PlayMap = Record<string, PlayState>;

const MAPE_VIDE: PlayMap = {};

function lireStockage(): PlayMap {
  try {
    return localStorageAdapter.load<PlayMap>(CLE_PARTIES) ?? {};
  } catch {
    return {};
  }
}

let mapCourant: PlayMap | null = null;
const abonnes = new Set<() => void>();

function instantane(): PlayMap {
  if (mapCourant === null) mapCourant = lireStockage();
  return mapCourant;
}

function notifier(): void {
  abonnes.forEach((cb) => cb());
}

function surStockageExterne(e: StorageEvent): void {
  if (e.key !== CLE_PARTIES) return;
  mapCourant = lireStockage();
  notifier();
}

function abonner(cb: () => void): () => void {
  abonnes.add(cb);
  if (abonnes.size === 1) window.addEventListener("storage", surStockageExterne);
  return () => {
    abonnes.delete(cb);
    if (abonnes.size === 0) window.removeEventListener("storage", surStockageExterne);
  };
}

/** État de partie persisté par scénario. Retourne la partie + mutateur sauvegardé. */
export function usePlaySession(scenarioId: string | null) {
  const map = useSyncExternalStore(abonner, instantane, () => MAPE_VIDE);
  const play = useMemo(() => {
    if (!scenarioId) return null;
    const stocke = map[scenarioId];
    return stocke ? ensurePlayDefaults(stocke) : null;
  }, [map, scenarioId]);

  const setPlay = useCallback(
    (update: React.SetStateAction<PlayState | null>) => {
      if (!scenarioId) return;
      const courant = instantane();
      const actuel = courant[scenarioId] ? ensurePlayDefaults(courant[scenarioId]) : null;
      const suivant =
        typeof update === "function" ? (update as (p: PlayState | null) => PlayState | null)(actuel) : update;
      const prochain: PlayMap = { ...courant };
      if (suivant) prochain[scenarioId] = { ...suivant, updatedAt: new Date().toISOString() };
      else delete prochain[scenarioId];
      mapCourant = prochain;
      try {
        localStorageAdapter.save(CLE_PARTIES, prochain);
      } catch {
        // Stockage indisponible : l'état mémoire reste la source de vérité.
      }
      notifier();
    },
    [scenarioId]
  );

  return { play, setPlay };
}
