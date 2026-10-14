// Persistance des états de partie (scénario prévu vs réel).
// Les scénarios vivent dans cof.scenarios.v3 (useScenarios).
// Les parties vivent ici : une entrée par scénario, sans écraser le scénario.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayState } from "@/src/lib/rules/scenario/types";
import { ensurePlayDefaults } from "@/src/lib/rules/scenario/engine";
import { localStorageAdapter } from "@/src/lib/store/repository";

const KEY = "cof.plays.v1";

type PlayMap = Record<string, PlayState>;

function loadAll(): PlayMap {
  try {
    return localStorageAdapter.load<PlayMap>(KEY) ?? {};
  } catch {
    return {};
  }
}

function saveAll(map: PlayMap) {
  try {
    localStorageAdapter.save(KEY, map);
  } catch {
    // stockage indisponible : état mémoire conservé
  }
}

/** État de partie persisté par scénario. Retourne la partie + mutateur sauvegardé. */
export function usePlaySession(scenarioId: string | null) {
  const [play, setPlayRaw] = useState<PlayState | null>(null);

  useEffect(() => {
    if (!scenarioId) {
      setPlayRaw(null);
      return;
    }
    const all = loadAll();
    const stored = all[scenarioId];
    setPlayRaw(stored ? ensurePlayDefaults(stored) : null);
  }, [scenarioId]);

  const setPlay = useCallback(
    (update: React.SetStateAction<PlayState | null>) => {
      setPlayRaw((prev) => {
        const cur = typeof update === "function" ? (update as (p: PlayState | null) => PlayState | null)(prev) : update;
        if (!scenarioId) return cur;
        const all = loadAll();
        if (cur) all[scenarioId] = { ...cur, updatedAt: new Date().toISOString() };
        else delete all[scenarioId];
        saveAll(all);
        return cur;
      });
    },
    [scenarioId]
  );

  return { play, setPlay };
}
