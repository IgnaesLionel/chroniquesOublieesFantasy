import {
  characterSchema,
  itemSchema,
  migrerStatsLegacy,
  monsterSchema,
  npcSchema,
  scenarioSchema,
  sessionSchema,
  sortSchema,
} from "@/src/lib/data/validation";
import {
  factionSchema,
  npcGenSchema,
  npcPlacementSchema,
  npcProfileSchema,
  npcStatBlockSchema,
  referenceEntrySchema,
  referenceTableSchema,
} from "@/src/lib/npcgen/validation";
import { exportJson, localStorageAdapter } from "@/src/lib/store/repository";

export { exportJson };

// Registre central des collections persistées. Une future base SQL
// remplacera les clés localStorage sans changer ce contrat.
export const STORAGE_KEYS = {
  characters: "cof.characters.v2",
  monsters: "cof.monsters.v2",
  npcs: "cof.npcs",
  items: "cof.items.v2",
  scenarios: "cof.scenarios.v3",
  sorts: "cof.sorts",
  sessions: "cof.sessions.v1",
  npcTables: "cof.npcgen.tables.v1",
  npcEntries: "cof.npcgen.entries.v1",
  npcSaved: "cof.npcgen.saved.v1",
  npcStatBlocks: "cof.npcgen.statblocks.v1",
  npcPlacements: "cof.npcgen.placements.v1",
  npcFactions: "cof.npcgen.factions.v1",
  npcProfiles: "cof.npcgen.profiles.v1",
} as const;

export type CollectionName = keyof typeof STORAGE_KEYS;

/** Collections du catalogue MJ (ordre d'affichage et de détection des tableaux nus). */
export const COLLECTIONS_CATALOGUE: CollectionName[] = [
  "characters",
  "monsters",
  "npcs",
  "items",
  "scenarios",
  "sorts",
  "sessions",
];

const SCHEMAS = {
  characters: characterSchema,
  monsters: monsterSchema,
  npcs: npcSchema,
  items: itemSchema,
  scenarios: scenarioSchema,
  sorts: sortSchema,
  sessions: sessionSchema,
  npcTables: referenceTableSchema,
  npcEntries: referenceEntrySchema,
  npcSaved: npcGenSchema,
  npcStatBlocks: npcStatBlockSchema,
  npcPlacements: npcPlacementSchema,
  npcFactions: factionSchema,
  npcProfiles: npcProfileSchema,
} as const;

export interface BackupData {
  version: 1;
  exportedAt: string;
  data: Record<CollectionName, unknown[]>;
  /**
   * Collections réellement contenues dans le fichier. Seules celles-ci sont
   * écrites à l'import : une collection absente du fichier n'est jamais vidée
   * (un export partiel ne doit pas effacer le reste du contenu local).
   */
  present: CollectionName[];
}

export interface ImportReport {
  imported: Record<CollectionName, number>;
  skipped: Record<CollectionName, number>;
  errors: string[];
}

/** Valide un backup (pur, testable). Les items invalides sont comptés, pas importés. */
const NOMS_COLLECTIONS = Object.keys(STORAGE_KEYS) as CollectionName[];

function recordVide(): Record<CollectionName, number> {
  return Object.fromEntries(NOMS_COLLECTIONS.map((name) => [name, 0])) as Record<CollectionName, number>;
}

/**
 * Détecte la collection d'un tableau nu (fichier artisanal, export d'un seul
 * écran). On retient le schéma qui accepte le plus d'éléments ; seules les
 * collections du catalogue sont candidates pour éviter les ambiguïtés avec
 * les tables internes du générateur de PNJ.
 */
export function detecterCollection(liste: unknown[]): CollectionName | null {
  // Discriminants explicites d'abord : le schéma PNJ est volontairement
  // permissif (presque tout est optionnel) et accepte n'importe quel objet
  // muni d'un id et d'un nom — il ne doit pas capter les objets ni les fiches.
  const premier = liste.find((x) => x && typeof x === "object") as Record<string, unknown> | undefined;
  if (premier) {
    if (premier.kind === "personnage") return "characters";
    if (premier.kind === "monstre") return "monsters";
    if ("categorie" in premier && "quantite" in premier) return "items";
    if ("chapitres" in premier && "scenes" in premier) return "scenarios";
    if ("voie" in premier && "cout" in premier) return "sorts";
    if ("characterIds" in premier && "scenarioIds" in premier) return "sessions";
    if ("exemple" in premier && "nom" in premier && !("kind" in premier)) return "npcs";
  }
  // Repli : le schéma qui accepte le plus d'éléments.
  let meilleur: { name: CollectionName; score: number } | null = null;
  for (const name of COLLECTIONS_CATALOGUE) {
    let score = 0;
    for (const item of liste.slice(0, 30)) {
      const entree = name === "characters" ? migrerStatsLegacy(item) : item;
      if (SCHEMAS[name].safeParse(entree).success) score += 1;
    }
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { name, score };
  }
  return meilleur?.name ?? null;
}

export function validateBackup(obj: unknown): { backup: BackupData | null; report: ImportReport } {
  const report: ImportReport = { imported: recordVide(), skipped: recordVide(), errors: [] };

  // Accepte aussi un tableau nu = une seule collection (détection par schéma).
  let raw: Record<string, unknown> | null = null;
  if (Array.isArray(obj)) {
    const nom = detecterCollection(obj);
    if (nom) raw = { [nom]: obj };
    else {
      report.errors.push("Tableau non reconnu : impossible d'identifier la collection.");
      return { backup: null, report };
    }
  } else if (obj && typeof obj === "object" && "data" in (obj as Record<string, unknown>)) {
    raw = ((obj as { data: Record<string, unknown> }).data ?? null) as Record<string, unknown> | null;
  }
  if (!raw || typeof raw !== "object") {
    report.errors.push(`Format invalide : attendu { version, data: { ${NOMS_COLLECTIONS.join(", ")} } }.`);
    return { backup: null, report };
  }

  const clean = Object.fromEntries(NOMS_COLLECTIONS.map((name) => [name, []])) as unknown as Record<
    CollectionName,
    unknown[]
  >;
  const present: CollectionName[] = [];
  NOMS_COLLECTIONS.forEach((name) => {
    const list = (raw as Record<string, unknown>)[name];
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      report.errors.push(`"${name}" ignoré : tableau attendu.`);
      return;
    }
    present.push(name);
    list.forEach((item, i) => {
      const entree = name === "characters" ? migrerStatsLegacy(item) : item;
      const parsed = SCHEMAS[name].safeParse(entree);
      if (parsed.success) {
        clean[name].push(parsed.data);
        report.imported[name] += 1;
      } else {
        report.skipped[name] += 1;
        if (report.errors.length < 8) {
          report.errors.push(`"${name}"[${i}] rejeté : ${parsed.error.issues[0]?.message ?? "invalide"}.`);
        }
      }
    });
  });

  const total = Object.values(report.imported).reduce((a, b) => a + b, 0);
  if (total === 0 && report.errors.length === 0) report.errors.push("Aucune collection reconnue dans le fichier.");
  return { backup: { version: 1, exportedAt: new Date().toISOString(), data: clean, present }, report };
}

/** Construit le backup depuis le localStorage (client uniquement). */
export function buildBackup(): BackupData {
  const data = {} as Record<CollectionName, unknown[]>;
  const present: CollectionName[] = [];
  (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((name) => {
    try {
      const valeur = localStorageAdapter.load<unknown[]>(STORAGE_KEYS[name]);
      if (valeur !== null) {
        data[name] = Array.isArray(valeur) ? valeur : [];
        present.push(name);
      } else {
        data[name] = [];
      }
    } catch {
      data[name] = [];
    }
  });
  return { version: 1, exportedAt: new Date().toISOString(), data, present };
}

export interface ApplyBackupOptions {
  /**
   * Les personnages et leur progression restent sur l'ordinateur courant :
   * par défaut un import ne les touche pas. Sur un nouveau poste, les fiches
   * de départ repartent donc au niveau 1. Mettre `true` pour restaurer aussi
   * les personnages (et leur progression) depuis le fichier.
   */
  importerPersonnages?: boolean;
}

/**
 * Écrit les collections validées puis recharge (les hooks chargent au montage).
 * Seules les collections présentes dans le fichier sont remplacées ; les
 * personnages sont ignorés sauf demande explicite.
 */
export function applyBackup(backup: BackupData, opts: ApplyBackupOptions = {}): void {
  const presentes =
    backup.present ??
    (Object.keys(STORAGE_KEYS) as CollectionName[]).filter((name) => backup.data?.[name] !== undefined);
  presentes.forEach((name) => {
    if (name === "characters" && !opts.importerPersonnages) return;
    const valeur = backup.data?.[name] ?? [];
    localStorageAdapter.save(STORAGE_KEYS[name], valeur);
  });
}

/** Alias historique : préférer `exportJson` (repository, source unique). */
export function downloadJson(filename: string, data: unknown): void {
  exportJson(filename, data);
}

/** Taille maximale acceptée pour un fichier d'import (garde-fou mémoire/stockage). */
export const TAILLE_MAX_IMPORT = 10 * 1024 * 1024;

export function readJsonFile(file: File): Promise<unknown> {
  if (file.size > TAILLE_MAX_IMPORT) {
    return Promise.reject(
      new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) : maximum 10 Mo.`)
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error("Fichier JSON illisible."));
      }
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsText(file);
  });
}
