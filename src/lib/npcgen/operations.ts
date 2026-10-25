// Opérations pures du module PNJ : CRUD de référence, import/export CSV et
// JSON. Aucune dépendance DOM ici, sauf les helpers d'export fichier.

import type {
  ReferenceEntry,
  ReferenceTable,
} from "@/src/lib/npcgen/types";

function sansAccents(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function identifiantLisible(valeur: string): string {
  return (
    sansAccents(valeur)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "entree"
  );
}

export function idUnique(base: string, existants: { id: string }[]): string {
  const ids = new Set(existants.map((x) => x.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function creerEntree(
  valeurs: {
    tableId: string;
    valeur: string;
    description?: string;
    categorie?: string;
    tags?: string[];
    poids?: number;
    actif?: boolean;
    conditions?: ReferenceEntry["conditions"];
    meta?: ReferenceEntry["meta"];
  },
  existants: ReferenceEntry[]
): ReferenceEntry {
  const maintenant = new Date().toISOString();
  const id = idUnique(`${valeurs.tableId}-${identifiantLisible(valeurs.valeur)}`, existants);
  return {
    id,
    tableId: valeurs.tableId,
    valeur: valeurs.valeur.trim(),
    description: valeurs.description?.trim() || undefined,
    categorie: valeurs.categorie?.trim() || undefined,
    tags: valeurs.tags ?? [],
    poids: Math.max(0, valeurs.poids ?? 10),
    actif: valeurs.actif ?? true,
    conditions: valeurs.conditions ?? {},
    meta: valeurs.meta ?? {},
    source: "mj",
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

export function dupliquerEntree(
  entree: ReferenceEntry,
  existants: ReferenceEntry[]
): ReferenceEntry {
  const maintenant = new Date().toISOString();
  return {
    ...structuredClone(entree),
    id: idUnique(`${entree.id}-copie`, existants),
    valeur: `${entree.valeur} (copie)`,
    source: "mj",
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

export function dupliquerTable(
  table: ReferenceTable,
  existantes: ReferenceTable[]
): ReferenceTable {
  const maintenant = new Date().toISOString();
  return {
    ...structuredClone(table),
    id: idUnique(`${table.id}-copie`, existantes),
    nom: `${table.nom} (copie)`,
    version: 1,
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

function csvEchapper(valeur: unknown): string {
  const texte = valeur == null ? "" : String(valeur);
  return /[",\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

export function exporterEntreesCsv(entrees: ReferenceEntry[]): string {
  const entetes = [
    "id", "tableId", "valeur", "categorie", "tags", "poids", "actif", "description", "conditions", "meta",
  ];
  const lignes = entrees.map((e) =>
    [
      e.id,
      e.tableId,
      e.valeur,
      e.categorie ?? "",
      e.tags.join(";"),
      e.poids,
      e.actif ? "1" : "0",
      e.description ?? "",
      JSON.stringify(e.conditions),
      JSON.stringify(e.meta),
    ]
      .map(csvEchapper)
      .join(",")
  );
  return [entetes.join(","), ...lignes].join("\r\n");
}

/** Parseur CSV simple mais conforme (guillemets doublés, retours à la ligne). */
export function analyserCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entreGuillemets = false;
  const source = texte.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cellule += '"';
          i += 1;
        } else {
          entreGuillemets = false;
        }
      } else {
        cellule += c;
      }
      continue;
    }
    if (c === '"') {
      entreGuillemets = true;
    } else if (c === ",") {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n") {
      ligne.push(cellule.replace(/\r$/, ""));
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else {
      cellule += c;
    }
  }
  if (cellule.length > 0 || ligne.length > 0) {
    ligne.push(cellule.replace(/\r$/, ""));
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((cell) => cell.trim().length > 0));
}

function jsonObjet(texte: string): Record<string, unknown> {
  if (!texte.trim()) return {};
  try {
    const valeur = JSON.parse(texte) as unknown;
    return valeur && typeof valeur === "object" && !Array.isArray(valeur)
      ? (valeur as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function importerEntreesCsv(
  texte: string,
  tableIdParDefaut: string,
  tables: ReferenceTable[],
  existants: ReferenceEntry[]
): { entrees: ReferenceEntry[]; erreurs: string[] } {
  const lignes = analyserCsv(texte);
  if (lignes.length === 0) return { entrees: [], erreurs: ["Fichier CSV vide."] };
  const entetes = lignes[0].map((h) => h.trim());
  const index = (nom: string) => entetes.findIndex((h) => h.toLowerCase() === nom.toLowerCase());
  const iTable = index("tableId");
  const iValeur = index("valeur");
  if (iValeur < 0) return { entrees: [], erreurs: ["Colonne « valeur » absente."] };

  const tableIds = new Set(tables.map((t) => t.id));
  const entrees: ReferenceEntry[] = [];
  const erreurs: string[] = [];
  const deja = new Set(existants.map((e) => e.id));
  const maintenant = new Date().toISOString();

  lignes.slice(1).forEach((ligne, position) => {
    const valeur = (ligne[iValeur] ?? "").trim();
    const tableId = (iTable >= 0 ? ligne[iTable] : tableIdParDefaut)?.trim() || tableIdParDefaut;
    if (!valeur) {
      erreurs.push(`Ligne ${position + 2} ignorée : valeur vide.`);
      return;
    }
    if (!tableIds.has(tableId)) {
      erreurs.push(`Ligne ${position + 2} ignorée : table « ${tableId} » inconnue.`);
      return;
    }
    const tagsIndex = index("tags");
    const categorieIndex = index("categorie");
    const poidsIndex = index("poids");
    const actifIndex = index("actif");
    const descriptionIndex = index("description");
    const conditionsIndex = index("conditions");
    const metaIndex = index("meta");
    const idIndex = index("id");
    const idDemande = idIndex >= 0 ? (ligne[idIndex] ?? "").trim() : "";
    const id = idDemande && !deja.has(idDemande)
      ? idDemande
      : idUnique(`${tableId}-${identifiantLisible(valeur)}`, [...existants, ...entrees]);
    if (deja.has(id)) {
      erreurs.push(`Ligne ${position + 2} ignorée : identifiant « ${id} » déjà présent.`);
      return;
    }
    deja.add(id);
    const poids = poidsIndex >= 0 ? Number(ligne[poidsIndex]) : 10;
    entrees.push({
      id,
      tableId,
      valeur,
      description: descriptionIndex >= 0 ? (ligne[descriptionIndex] ?? "").trim() || undefined : undefined,
      categorie: categorieIndex >= 0 ? (ligne[categorieIndex] ?? "").trim() || undefined : undefined,
      tags: tagsIndex >= 0
        ? (ligne[tagsIndex] ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean)
        : [],
      poids: Number.isFinite(poids) ? Math.max(0, poids) : 10,
      actif: actifIndex >= 0 ? !["0", "false", "non", "inactif"].includes((ligne[actifIndex] ?? "1").toLowerCase()) : true,
      conditions: conditionsIndex >= 0
        ? (jsonObjet(ligne[conditionsIndex]) as ReferenceEntry["conditions"])
        : {},
      meta: metaIndex >= 0 ? (jsonObjet(ligne[metaIndex]) as ReferenceEntry["meta"]) : {},
      source: "import",
      createdAt: maintenant,
      updatedAt: maintenant,
    });
  });

  if (entrees.length === 0 && erreurs.length === 0) erreurs.push("Aucune ligne exploitable dans le CSV.");
  return { entrees, erreurs };
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : "";
}

function tableauTextes(valeur: unknown): string[] {
  return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : [];
}

export function importerEntreesJson(
  donnees: unknown,
  tables: ReferenceTable[],
  existants: ReferenceEntry[]
): { entrees: ReferenceEntry[]; erreurs: string[] } {
  const brut = Array.isArray(donnees)
    ? donnees
    : donnees && typeof donnees === "object" && Array.isArray((donnees as { entrees?: unknown }).entrees)
      ? (donnees as { entrees: unknown[] }).entrees
      : null;
  if (!brut) return { entrees: [], erreurs: ["Format attendu : tableau d'entrées ou { entrees: [...] }."] };
  const tableIds = new Set(tables.map((t) => t.id));
  const maintenant = new Date().toISOString();
  const entrees: ReferenceEntry[] = [];
  const erreurs: string[] = [];
  const deja = new Set(existants.map((e) => e.id));

  brut.forEach((item, position) => {
    if (!item || typeof item !== "object") {
      erreurs.push(`Entrée ${position + 1} ignorée : objet attendu.`);
      return;
    }
    const o = item as Record<string, unknown>;
    const valeur = texte(o.valeur).trim();
    const tableId = texte(o.tableId).trim();
    if (!valeur || !tableId) {
      erreurs.push(`Entrée ${position + 1} ignorée : tableId et valeur requis.`);
      return;
    }
    if (!tableIds.has(tableId)) {
      erreurs.push(`Entrée ${position + 1} ignorée : table « ${tableId} » inconnue.`);
      return;
    }
    const idDemande = texte(o.id).trim();
    const id = idDemande && !deja.has(idDemande)
      ? idDemande
      : idUnique(`${tableId}-${identifiantLisible(valeur)}`, [...existants, ...entrees]);
    if (deja.has(id)) {
      erreurs.push(`Entrée ${position + 1} ignorée : identifiant « ${id} » déjà présent.`);
      return;
    }
    deja.add(id);
    const poids = typeof o.poids === "number" ? o.poids : Number(o.poids ?? 10);
    entrees.push({
      id,
      tableId,
      valeur,
      description: texte(o.description) || undefined,
      categorie: texte(o.categorie) || undefined,
      tags: tableauTextes(o.tags),
      poids: Number.isFinite(poids) ? Math.max(0, poids) : 10,
      actif: typeof o.actif === "boolean" ? o.actif : true,
      conditions: jsonObjet(
        typeof o.conditions === "string" ? o.conditions : JSON.stringify(o.conditions ?? {})
      ) as ReferenceEntry["conditions"],
      meta: jsonObjet(
        typeof o.meta === "string" ? o.meta : JSON.stringify(o.meta ?? {})
      ) as ReferenceEntry["meta"],
      source: "import",
      createdAt: texte(o.createdAt) || maintenant,
      updatedAt: maintenant,
    });
  });
  if (entrees.length === 0 && erreurs.length === 0) erreurs.push("Aucune entrée exploitable.");
  return { entrees, erreurs };
}

/** Télécharge un contenu texte sans passer par le helper JSON. */
export function telechargerTexte(nomFichier: string, contenu: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}
