import { describe, expect, it } from "vitest";
import { genererPnj } from "@/src/lib/npcgen/engine";
import { SEED_ENTRIES, SEED_FACTIONS, SEED_PROFILES, SEED_TABLES } from "@/src/lib/npcgen/seeds";
import {
  factionSchema,
  npcGenSchema,
  npcPlacementSchema,
  npcProfileSchema,
  npcStatBlockSchema,
  referenceEntrySchema,
  referenceTableSchema,
} from "@/src/lib/npcgen/validation";
import { validateBackup } from "@/src/lib/store/backup";

describe("validation des nouvelles collections", () => {
  it("valide toutes les graines", () => {
    expect(SEED_TABLES.every((t) => referenceTableSchema.safeParse(t).success)).toBe(true);
    expect(SEED_ENTRIES.every((e) => referenceEntrySchema.safeParse(e).success)).toBe(true);
    expect(SEED_FACTIONS.every((f) => factionSchema.safeParse(f).success)).toBe(true);
    expect(SEED_PROFILES.every((p) => npcProfileSchema.safeParse(p).success)).toBe(true);
  });

  it("valide un PNJ généré et son bloc de combat", () => {
    const resultat = genererPnj(
      { seed: "validation-schema", genererCombat: true, palierPuissance: "fort" },
      { tables: SEED_TABLES, entries: SEED_ENTRIES, factions: SEED_FACTIONS, profiles: SEED_PROFILES }
    );
    const npc = npcGenSchema.safeParse(resultat.npc);
    expect(npc.success, JSON.stringify(npc.error?.issues)).toBe(true);
    const bloc = npcStatBlockSchema.safeParse(resultat.statBlock);
    expect(bloc.success, JSON.stringify(bloc.error?.issues)).toBe(true);
  });

  it("valide un placement et refuse les champs requis vides", () => {
    const placement = {
      id: "pl-test",
      npcId: "npc-test",
      sessionId: "session-test",
      scenarioId: "scenario-test",
      sceneId: "scene-test",
      role: "Témoin",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(npcPlacementSchema.safeParse(placement).success).toBe(true);
    expect(npcPlacementSchema.safeParse({ ...placement, npcId: "" }).success).toBe(false);
  });

  it("intègre les collections PNJ au backup global", () => {
    const resultat = genererPnj(
      { seed: "backup-npc", genererCombat: true },
      { tables: SEED_TABLES, entries: SEED_ENTRIES, factions: SEED_FACTIONS, profiles: SEED_PROFILES }
    );
    const { backup, report } = validateBackup({
      version: 1,
      data: {
        npcTables: SEED_TABLES,
        npcEntries: SEED_ENTRIES,
        npcSaved: [resultat.npc],
        npcStatBlocks: [resultat.statBlock],
        npcFactions: SEED_FACTIONS,
        npcProfiles: SEED_PROFILES,
      },
    });
    expect(report.errors).toEqual([]);
    expect(report.imported.npcTables).toBe(SEED_TABLES.length);
    expect(report.imported.npcEntries).toBe(SEED_ENTRIES.length);
    expect(report.imported.npcSaved).toBe(1);
    expect(report.imported.npcStatBlocks).toBe(1);
    expect(report.skipped.npcEntries).toBe(0);
    expect(backup?.data.npcSaved).toHaveLength(1);
  });
});
