"use client";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { SEED_NPCS } from "@/src/lib/data/worldSeeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import type { Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Npc } from "@/src/lib/rules/world/types";
import type { Scenario } from "@/src/lib/rules/scenario/types";
import type { Session } from "@/src/lib/rules/session/types";

// Hooks typés par collection : l'UI ne connaît plus les clés localStorage.
// Demain, ces hooks brancheront SQLite/Postgres sans changer les pages.
// Persisté (campagne) : personnages, sessions (+ progression via usePlaySession).
// Mémoire seule (données de jeu depuis le code) : monstres, PNJ, sorts,
// scénarios, objets maison (perdus au rechargement).
export function useCharacters() {
  return useLocalCollection<Character>(STORAGE_KEYS.characters, SEED_CHARACTERS);
}

export function useMonsters() {
  return useLocalCollection<MonsterTemplate>(STORAGE_KEYS.monsters, SEED_MONSTERS, { persist: false });
}

export function useNpcs() {
  return useLocalCollection<Npc>(STORAGE_KEYS.npcs, SEED_NPCS, { persist: false });
}

export function useScenarios() {
  return useLocalCollection<Scenario>(STORAGE_KEYS.scenarios, SEED_SCENARIOS, { persist: false });
}

export function useSorts() {
  return useLocalCollection<Sort>(STORAGE_KEYS.sorts, SEED_SORTS, { persist: false });
}

export function useSessions() {
  return useLocalCollection<Session>(STORAGE_KEYS.sessions, []);
}
