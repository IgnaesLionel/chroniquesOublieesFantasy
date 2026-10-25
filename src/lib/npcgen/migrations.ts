import { TABLE_IDS, type ReferenceEntry } from "@/src/lib/npcgen/types";

// Valeurs de sexe livrées par une ancienne version des graines. Elles sont
// retirées uniquement des entrées encore marquées « graine » : une valeur
// recréée volontairement par le MJ doit rester intacte.
const SEXES_OBSOLETES = new Set(["non-binaire", "inconnu", "inconnue"]);

function cleSexe(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function estSexeObsolete(entry: ReferenceEntry): boolean {
  return (
    entry.tableId === TABLE_IDS.sexes &&
    entry.source === "graine" &&
    SEXES_OBSOLETES.has(cleSexe(entry.valeur))
  );
}

/** Retire les anciennes graines de sexe sans toucher aux entrées du MJ. */
export function retirerSexesObsoletes(entries: ReferenceEntry[]): ReferenceEntry[] {
  return entries.filter((entry) => !estSexeObsolete(entry));
}
