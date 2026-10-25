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
import { exportJson } from "@/src/lib/store/repository";

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

/** Collections mémoire seule (données de jeu depuis le code) : l'import ne les écrit pas. */
export const MEMOIRE_SEULE: ReadonlySet<CollectionName> = new Set([
  "monsters",
  "npcs",
  "items",
  "scenarios",
  "sorts",
]);

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

export function validateBackup(obj: unknown): { backup: BackupData | null; report: ImportReport } {
  const report: ImportReport = { imported: recordVide(), skipped: recordVide(), errors: [] };

  // Accepte aussi un tableau nu = une seule collection (détection par kind/categorie).
  const raw =
    obj && typeof obj === "object" && "data" in (obj as Record<string, unknown>)
      ? ((obj as { data: Record<string, unknown> }).data ?? {})
      : null;
  if (!raw || typeof raw !== "object") {
    report.errors.push(`Format invalide : attendu { version, data: { ${NOMS_COLLECTIONS.join(", ")} } }.`);
    return { backup: null, report };
  }

  const clean = Object.fromEntries(NOMS_COLLECTIONS.map((name) => [name, []])) as unknown as Record<
    CollectionName,
    unknown[]
  >;
  NOMS_COLLECTIONS.forEach((name) => {
    const list = (raw as Record<string, unknown>)[name];
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      report.errors.push(`"${name}" ignoré : tableau attendu.`);
      return;
    }
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
  return { backup: { version: 1, exportedAt: new Date().toISOString(), data: clean }, report };
}

/** Construit le backup depuis le localStorage (client uniquement). */
export function buildBackup(): BackupData {
  const data = {} as Record<CollectionName, unknown[]>;
  (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((name) => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS[name]);
      data[name] = raw ? (JSON.parse(raw) as unknown[]) : [];
    } catch {
      data[name] = [];
    }
  });
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

/** Écrit les collections validées puis recharge (les hooks chargent au montage). Les collections mémoire seule sont ignorées (données du code). */
export function applyBackup(backup: BackupData): void {
  (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((name) => {
    if (MEMOIRE_SEULE.has(name)) return;
    window.localStorage.setItem(STORAGE_KEYS[name], JSON.stringify(backup.data[name] ?? []));
  });
}

/** Alias historique : préférer `exportJson` (repository, source unique). */
export function downloadJson(filename: string, data: unknown): void {
  exportJson(filename, data);
}

export function readJsonFile(file: File): Promise<unknown> {
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
