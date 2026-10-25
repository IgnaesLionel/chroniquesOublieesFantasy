import type {
  ConditionsGeneration,
  MetaReference,
  ReferenceEntry,
} from "@/src/lib/npcgen/types";

export const DATE_GRAINE = "2026-01-01T00:00:00.000Z";

export interface OptionsEntree {
  description?: string;
  categorie?: string;
  tags?: string[];
  poids?: number;
  conditions?: ConditionsGeneration;
  meta?: MetaReference;
}

export function sansAccents(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slug(valeur: string): string {
  return (
    sansAccents(valeur)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "entree"
  );
}

/** Fabrique locale : identifiants stables, doublons suffixés, dates fixes. */
export function fabrique() {
  const idsUtilises = new Set<string>();
  const entries: ReferenceEntry[] = [];

  const E = (tableId: string, valeur: string, options: OptionsEntree = {}): ReferenceEntry => {
    const base = `${tableId}-${slug(valeur)}`;
    let id = base;
    let suffixe = 2;
    while (idsUtilises.has(id)) id = `${base}-${suffixe++}`;
    idsUtilises.add(id);
    return {
      id,
      tableId,
      valeur,
      description: options.description,
      categorie: options.categorie,
      tags: options.tags ?? [],
      poids: options.poids ?? 10,
      actif: true,
      conditions: options.conditions ?? {},
      meta: options.meta ?? {},
      source: "graine",
      createdAt: DATE_GRAINE,
      updatedAt: DATE_GRAINE,
    };
  };

  const many = (tableId: string, valeurs: string[], options: OptionsEntree = {}): ReferenceEntry[] =>
    valeurs.map((valeur) => E(tableId, valeur, options));

  return { E, many, entries };
}
