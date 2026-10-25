"use client";

import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import { localStorageAdapter } from "@/src/lib/store/repository";
import { SEED_ENTRIES, SEED_FACTIONS, SEED_PROFILES, SEED_TABLES } from "@/src/lib/npcgen/seeds";
import { retirerSexesObsoletes } from "@/src/lib/npcgen/migrations";
import type {
  Faction,
  NpcGen,
  NpcPlacement,
  NpcProfile,
  NpcStatBlock,
  ReferenceEntry,
  ReferenceTable,
} from "@/src/lib/npcgen/types";

// Les graines ne sont écrites qu'à la première visite : `fusionner: false`
// empêche le hook de réinsérer une entrée supprimée par le MJ à chaque lecture.
// La restauration est une action explicite (voir plus bas).
const OPTIONS = { libelle: "générateur PNJ", fusionner: false } as const;

export function useNpcReferenceTables() {
  return useLocalCollection<ReferenceTable>(STORAGE_KEYS.npcTables, SEED_TABLES, OPTIONS);
}

export function useNpcReferenceEntries() {
  return useLocalCollection<ReferenceEntry>(STORAGE_KEYS.npcEntries, SEED_ENTRIES, OPTIONS);
}

export function useNpcSaved() {
  return useLocalCollection<NpcGen>(STORAGE_KEYS.npcSaved, [], OPTIONS);
}

export function useNpcStatBlocks() {
  return useLocalCollection<NpcStatBlock>(STORAGE_KEYS.npcStatBlocks, [], OPTIONS);
}

export function useNpcPlacements() {
  return useLocalCollection<NpcPlacement>(STORAGE_KEYS.npcPlacements, [], OPTIONS);
}

export function useNpcFactions() {
  return useLocalCollection<Faction>(STORAGE_KEYS.npcFactions, SEED_FACTIONS, OPTIONS);
}

export function useNpcProfiles() {
  return useLocalCollection<NpcProfile>(STORAGE_KEYS.npcProfiles, SEED_PROFILES, OPTIONS);
}

const CLE_INITIALISATION = "cof.npcgen.initialized.v1";

function lireTableau<T>(cle: string): T[] | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    const valeur = JSON.parse(brut) as unknown;
    return Array.isArray(valeur) ? (valeur as T[]) : null;
  } catch {
    return null;
  }
}

function fusionnerManquants<T extends { id: string }>(existants: T[], graines: T[]): T[] {
  const ids = new Set(existants.map((x) => x.id));
  const manquants = graines.filter((g) => !ids.has(g.id));
  return manquants.length === 0 ? existants : [...existants, ...manquants];
}

function ecrire<T>(cle: string, valeur: T[]): void {
  localStorageAdapter.save(cle, valeur);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: cle }));
    } catch {
      // L'événement est un confort de synchronisation : la valeur est écrite.
    }
  }
}

/**
 * Première visite uniquement : garantit la présence des collections initiales
 * sans jamais remplacer une entrée existante. Le drapeau évite de rejouer la
 * fusion à chaque montage ; supprimer une graine ensuite est définitif.
 * La migration des sexes obsolètes s'applique aussi aux bases déjà initialisées.
 */
export function assurerInitialisationPnj(): { nouveau: boolean; ajouts: number; retires: number } {
  if (typeof window === "undefined") return { nouveau: false, ajouts: 0, retires: 0 };
  try {
    const entries = lireTableau<ReferenceEntry>(STORAGE_KEYS.npcEntries);
    const entriesNettoyees = entries ? retirerSexesObsoletes(entries) : null;
    const retires = entries && entriesNettoyees ? entries.length - entriesNettoyees.length : 0;
    if (retires > 0 && entriesNettoyees) ecrire(STORAGE_KEYS.npcEntries, entriesNettoyees);

    if (window.localStorage.getItem(CLE_INITIALISATION) === "1") {
      return { nouveau: false, ajouts: 0, retires };
    }
    let ajouts = 0;
    const traiter = <T extends { id: string }>(cle: string, graines: T[]) => {
      const existants = lireTableau<T>(cle);
      const fusion = fusionnerManquants(existants ?? [], graines);
      if (!existants) {
        ecrire(cle, graines);
        ajouts += graines.length;
        return;
      }
      if (fusion !== existants) {
        ecrire(cle, fusion);
        ajouts += fusion.length - existants.length;
      }
    };
    traiter(STORAGE_KEYS.npcTables, SEED_TABLES);
    traiter(STORAGE_KEYS.npcEntries, SEED_ENTRIES);
    traiter(STORAGE_KEYS.npcFactions, SEED_FACTIONS);
    traiter(STORAGE_KEYS.npcProfiles, SEED_PROFILES);
    window.localStorage.setItem(CLE_INITIALISATION, "1");
    return { nouveau: true, ajouts, retires };
  } catch {
    return { nouveau: false, ajouts: 0, retires: 0 };
  }
}

/**
 * Restauration explicite : ajoute seulement les entrées initiales manquantes.
 * Les entrées modifiées ou créées par le MJ ne sont jamais écrasées.
 */
export function restaurerDonneesInitialesPnj(): { tables: number; entrees: number; factions: number; profils: number } {
  const resultat = { tables: 0, entrees: 0, factions: 0, profils: 0 };
  if (typeof window === "undefined") return resultat;
  const restaurer = <T extends { id: string }>(cle: string, graines: T[]): number => {
    const existants = lireTableau<T>(cle) ?? [];
    const fusion = fusionnerManquants(existants, graines);
    const ajoutes = fusion.length - existants.length;
    if (ajoutes > 0) ecrire(cle, fusion);
    return ajoutes;
  };
  try {
    resultat.tables = restaurer(STORAGE_KEYS.npcTables, SEED_TABLES);
    resultat.entrees = restaurer(STORAGE_KEYS.npcEntries, SEED_ENTRIES);
    resultat.factions = restaurer(STORAGE_KEYS.npcFactions, SEED_FACTIONS);
    resultat.profils = restaurer(STORAGE_KEYS.npcProfiles, SEED_PROFILES);
    window.localStorage.setItem(CLE_INITIALISATION, "1");
  } catch {
    // Stockage indisponible : le compte des ajouts reste à zéro.
  }
  return resultat;
}

/** Comptage des graines encore présentes (diagnostic / paramètres). */
export function etatDonneesInitialesPnj(): { presente: boolean; entreesInitiales: number } {
  if (typeof window === "undefined") return { presente: false, entreesInitiales: 0 };
  const entries = lireTableau<ReferenceEntry>(STORAGE_KEYS.npcEntries) ?? [];
  return {
    presente: window.localStorage.getItem(CLE_INITIALISATION) === "1",
    entreesInitiales: entries.filter((e) => e.source === "graine").length,
  };
}
