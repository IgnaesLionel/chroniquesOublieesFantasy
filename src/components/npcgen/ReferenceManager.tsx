"use client";

import { useMemo, useRef, useState } from "react";
import {
  REFERENCE_CATEGORIES,
  TABLE_IDS,
  type MetaReference,
  type ReferenceCategorie,
  type ReferenceEntry,
  type ReferenceTable,
} from "@/src/lib/npcgen/types";
import { exportJson } from "@/src/lib/store/repository";
import {
  creerEntree,
  dupliquerEntree,
  dupliquerTable,
  exporterEntreesCsv,
  idUnique,
  identifiantLisible,
  importerEntreesCsv,
  importerEntreesJson,
  telechargerTexte,
} from "@/src/lib/npcgen/operations";
import { restaurerDonneesInitialesPnj } from "@/src/lib/store/npcgen";

interface Props {
  tables: ReferenceTable[];
  setTables: React.Dispatch<React.SetStateAction<ReferenceTable[]>>;
  entries: ReferenceEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ReferenceEntry[]>>;
}

interface TableForm {
  id: string;
  nom: string;
  categorie: ReferenceCategorie;
  description: string;
  actif: boolean;
  ordre: number;
}

interface EntryForm {
  id: string;
  tableId: string;
  valeur: string;
  description: string;
  categorie: string;
  tags: string;
  poids: number;
  actif: boolean;
  conditions: string;
  meta: string;
}

const champ =
  "w-full bg-zinc-950/70 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";
const bouton = "px-3 py-1.5 rounded text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

function entreeVide(tableId: string): EntryForm {
  return {
    id: "",
    tableId,
    valeur: "",
    description: "",
    categorie: "",
    tags: "",
    poids: 10,
    actif: true,
    conditions: "{}",
    meta: "{}",
  };
}

function depuisEntree(entree: ReferenceEntry): EntryForm {
  return {
    id: entree.id,
    tableId: entree.tableId,
    valeur: entree.valeur,
    description: entree.description ?? "",
    categorie: entree.categorie ?? "",
    tags: entree.tags.join(", "),
    poids: entree.poids,
    actif: entree.actif,
    conditions: JSON.stringify(entree.conditions, null, 2),
    meta: JSON.stringify(entree.meta, null, 2),
  };
}

export function ReferenceManager({ tables, setTables, entries, setEntries }: Props) {
  const [selected, setSelected] = useState("");
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const [seulementActives, setSeulementActives] = useState(false);
  const [formTable, setFormTable] = useState<TableForm | null>(null);
  const [formEntree, setFormEntree] = useState<EntryForm | null>(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [rapportImport, setRapportImport] = useState<string[]>([]);
  const fichierRef = useRef<HTMLInputElement>(null);

  const tablesTriees = useMemo(
    () => [...tables].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr")),
    [tables]
  );
  const tableCourante = tablesTriees.find((t) => t.id === selected) ?? tablesTriees[0];
  const tableIdCourante = tableCourante?.id ?? "";

  const tablesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return tablesTriees.filter((t) => {
      if (categorie && t.categorie !== categorie) return false;
      if (seulementActives && !t.actif) return false;
      if (!q) return true;
      return (
        t.nom.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.categorie.toLowerCase().includes(q)
      );
    });
  }, [tablesTriees, recherche, categorie, seulementActives]);

  const entreesTable = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return entries
      .filter((e) => e.tableId === tableIdCourante)
      .filter((e) => !seulementActives || e.actif)
      .filter((e) => {
        if (!q) return true;
        return (
          e.valeur.toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)) ||
          (e.categorie ?? "").toLowerCase().includes(q)
        );
      });
  }, [entries, tableIdCourante, recherche, seulementActives]);

  const compter = (tableId: string) => entries.filter((e) => e.tableId === tableId).length;

  const ouvrirNouvelleTable = () => {
    setErreur("");
    setFormTable({
      id: "",
      nom: "",
      categorie: "Narratif",
      description: "",
      actif: true,
      ordre: (tablesTriees.at(-1)?.ordre ?? 0) + 10,
    });
  };

  const ouvrirEditionTable = (table: ReferenceTable) => {
    setErreur("");
    setFormTable({
      id: table.id,
      nom: table.nom,
      categorie: table.categorie,
      description: table.description,
      actif: table.actif,
      ordre: table.ordre,
    });
  };

  const sauverTable = () => {
    if (!formTable) return;
    if (!formTable.nom.trim()) {
      setErreur("Le nom de la table est requis.");
      return;
    }
    const maintenant = new Date().toISOString();
    if (formTable.id) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === formTable.id
            ? {
                ...t,
                nom: formTable.nom.trim(),
                categorie: formTable.categorie,
                description: formTable.description.trim(),
                actif: formTable.actif,
                ordre: formTable.ordre,
                updatedAt: maintenant,
              }
            : t
        )
      );
    } else {
      const id = idUnique(`table-${identifiantLisible(formTable.nom)}`, tables);
      setTables((prev) => [
        ...prev,
        {
          id,
          nom: formTable.nom.trim(),
          categorie: formTable.categorie,
          description: formTable.description.trim(),
          actif: formTable.actif,
          ordre: formTable.ordre,
          version: 1,
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      ]);
      setSelected(id);
    }
    setFormTable(null);
    setErreur("");
    setMessage("Table enregistrée.");
  };

  const supprimerTable = (table: ReferenceTable) => {
    const nombre = compter(table.id);
    if (!confirm(`Supprimer la table « ${table.nom} » et ses ${nombre} entrées ?`)) return;
    setTables((prev) => prev.filter((t) => t.id !== table.id));
    setEntries((prev) => prev.filter((e) => e.tableId !== table.id));
    if (selected === table.id) setSelected("");
  };

  const dupliquerUneTable = (table: ReferenceTable) => {
    const copie = dupliquerTable(table, tables);
    setTables((prev) => [...prev, copie]);
    const copies = entries
      .filter((e) => e.tableId === table.id)
      .map((e, index) => ({
        ...structuredClone(e),
        id: `${copie.id}-${index + 1}`,
        tableId: copie.id,
        source: "mj" as const,
        createdAt: copie.createdAt,
        updatedAt: copie.updatedAt,
      }));
    setEntries((prev) => [...prev, ...copies]);
    setSelected(copie.id);
  };

  const basculerTable = (table: ReferenceTable) => {
    setTables((prev) =>
      prev.map((t) => (t.id === table.id ? { ...t, actif: !t.actif, updatedAt: new Date().toISOString() } : t))
    );
  };

  const ouvrirNouvelleEntree = () => {
    if (!tableIdCourante) {
      setErreur("Créez d'abord une table.");
      return;
    }
    setErreur("");
    setFormEntree(entreeVide(tableIdCourante));
  };

  const sauverEntree = () => {
    if (!formEntree) return;
    if (!formEntree.valeur.trim()) {
      setErreur("La valeur de l'entrée est requise.");
      return;
    }
    if (!formEntree.tableId) {
      setErreur("La table cible est requise.");
      return;
    }
    let conditions: ReferenceEntry["conditions"];
    let meta: MetaReference;
    try {
      const c = JSON.parse(formEntree.conditions || "{}") as unknown;
      const m = JSON.parse(formEntree.meta || "{}") as unknown;
      if (!c || typeof c !== "object" || Array.isArray(c)) throw new Error("Conditions : objet JSON attendu.");
      if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("Métadonnées : objet JSON attendu.");
      conditions = c as ReferenceEntry["conditions"];
      meta = m as MetaReference;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "JSON invalide.");
      return;
    }
    const tags = formEntree.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const maintenant = new Date().toISOString();
    if (formEntree.id) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === formEntree.id
            ? {
                ...e,
                tableId: formEntree.tableId,
                valeur: formEntree.valeur.trim(),
                description: formEntree.description.trim() || undefined,
                categorie: formEntree.categorie.trim() || undefined,
                tags,
                poids: Math.max(0, Number(formEntree.poids) || 0),
                actif: formEntree.actif,
                conditions,
                meta,
                source: "mj",
                updatedAt: maintenant,
              }
            : e
        )
      );
    } else {
      const creee = creerEntree(
        {
          tableId: formEntree.tableId,
          valeur: formEntree.valeur,
          description: formEntree.description,
          categorie: formEntree.categorie,
          tags,
          poids: formEntree.poids,
          actif: formEntree.actif,
          conditions,
          meta,
        },
        entries
      );
      setEntries((prev) => [...prev, creee]);
      setSelected(creee.tableId);
    }
    setFormEntree(null);
    setErreur("");
    setMessage("Entrée enregistrée.");
  };

  const basculerEntree = (entree: ReferenceEntry) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entree.id ? { ...e, actif: !e.actif, updatedAt: new Date().toISOString() } : e
      )
    );
  };

  const supprimerEntree = (entree: ReferenceEntry) => {
    if (!confirm(`Supprimer « ${entree.valeur} » ?`)) return;
    setEntries((prev) => prev.filter((e) => e.id !== entree.id));
  };

  const reprendreInitiales = () => {
    if (!confirm("Ajouter les entrées initiales manquantes ? Les données modifiées ne seront pas touchées.")) return;
    const rapport = restaurerDonneesInitialesPnj();
    setRapportImport([
      `Restauration : ${rapport.tables} table(s), ${rapport.entrees} entrée(s), ${rapport.factions} faction(s), ${rapport.profils} profil(s) ajoutés.`,
    ]);
    setMessage("Restauration des données initiales effectuée.");
  };

  const importerFichier = async (fichier: File | undefined) => {
    setErreur("");
    setRapportImport([]);
    if (!fichier) return;
    const texte = await fichier.text();
    const estCsv = fichier.name.toLowerCase().endsWith(".csv");
    let resultat: { entrees: ReferenceEntry[]; erreurs: string[] };
    try {
      resultat = estCsv
        ? importerEntreesCsv(texte, tableIdCourante, tables, entries)
        : importerEntreesJson(JSON.parse(texte) as unknown, tables, entries);
    } catch (e) {
      setErreur(`Fichier illisible : ${e instanceof Error ? e.message : "JSON invalide"}.`);
      if (fichierRef.current) fichierRef.current.value = "";
      return;
    }
    if (resultat.entrees.length > 0) setEntries((prev) => [...prev, ...resultat.entrees]);
    setRapportImport([
      `${resultat.entrees.length} entrée(s) importée(s).`,
      ...(resultat.erreurs.length > 0 ? [`${resultat.erreurs.length} ligne(s) ignorée(s) :`, ...resultat.erreurs] : []),
    ]);
    if (fichierRef.current) fichierRef.current.value = "";
  };

  const exporterCsv = () => {
    if (!tableCourante) return;
    telechargerTexte(
      `table-${tableCourante.id}.csv`,
      "\uFEFF" + exporterEntreesCsv(entries.filter((e) => e.tableId === tableCourante.id)),
      "text/csv;charset=utf-8"
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bronze-700/60 bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-gold-300">Tables de référence</h2>
            <p className="text-sm text-zinc-400">
              {tables.length} tables · {entries.length} entrées · les modifications sont persistées localement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={ouvrirNouvelleTable} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">
              + Table
            </button>
            <button type="button" onClick={reprendreInitiales} className={bouton}>
              Restaurer les graines manquantes
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-[1fr_180px_auto_auto] gap-2 items-center">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une table, une entrée, un tag…"
            className={champ}
          />
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={champ}>
            <option value="">Toutes catégories</option>
            {REFERENCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={seulementActives} onChange={(e) => setSeulementActives(e.target.checked)} />
            Actives seulement
          </label>
          <div className="flex gap-1">
            <button type="button" onClick={() => exportJson("tables-pnj.json", { tables, entries })} className={bouton}>
              Export JSON
            </button>
          </div>
        </div>
        {erreur && <p className="text-sm text-red-400">{erreur}</p>}
        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {rapportImport.length > 0 && (
          <div className="text-xs rounded bg-zinc-950 border border-zinc-800 p-2 space-y-0.5">
            {rapportImport.map((ligne, index) => <p key={index} className={ligne.includes("ignorée") ? "text-amber-300" : "text-zinc-300"}>{ligne}</p>)}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 max-h-[68vh] overflow-auto space-y-1">
          {tablesFiltrees.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelected(table.id)}
              className={`w-full text-left rounded p-2 border ${
                table.id === tableIdCourante
                  ? "border-amber-500/70 bg-amber-400/10"
                  : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${table.actif ? "text-zinc-100" : "text-zinc-500 line-through"}`}>
                  {table.nom}
                </span>
                <span className="text-[10px] text-zinc-500">{compter(table.id)}</span>
              </div>
              <div className="text-[11px] text-zinc-500">{table.categorie}</div>
            </button>
          ))}
          {tablesFiltrees.length === 0 && <p className="text-xs text-zinc-500 p-2">Aucune table.</p>}
        </aside>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 space-y-3 min-w-0">
          {!tableCourante && (
            <p className="text-sm text-zinc-400">Aucune table sélectionnée. Créez-en une ou restaurez les graines.</p>
          )}
          {tableCourante && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-gold-200">{tableCourante.nom}</h3>
                  <p className="text-xs text-zinc-500">
                    {tableCourante.id} · {tableCourante.categorie} · {entreesTable.length}/{compter(tableCourante.id)} entrée(s)
                    {!tableCourante.actif && " · INACTIVE"}
                  </p>
                  {tableCourante.description && <p className="text-sm text-zinc-400 mt-1">{tableCourante.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => ouvrirEditionTable(tableCourante)} className={bouton}>Éditer</button>
                  <button type="button" onClick={() => dupliquerUneTable(tableCourante)} className={bouton}>Dupliquer</button>
                  <button type="button" onClick={() => basculerTable(tableCourante)} className={bouton}>
                    {tableCourante.actif ? "Désactiver" : "Activer"}
                  </button>
                  <button type="button" onClick={() => supprimerTable(tableCourante)} className="px-3 py-1.5 rounded text-sm bg-zinc-800 text-red-300 border border-zinc-700">Supprimer</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2">
                <button type="button" onClick={ouvrirNouvelleEntree} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Entrée</button>
                <button type="button" onClick={exporterCsv} className={bouton}>Export CSV de la table</button>
                <label className={`${bouton} cursor-pointer`}>
                  Importer CSV / JSON
                  <input
                    ref={fichierRef}
                    type="file"
                    accept=".csv,text/csv,application/json,.json"
                    className="hidden"
                    onChange={(e) => importerFichier(e.target.files?.[0])}
                  />
                </label>
                <span className="text-[11px] text-zinc-500 self-center">
                  CSV : colonnes valeur, tableId, tags, poids, actif, description, conditions, meta.
                </span>
              </div>

              <div className="overflow-auto border border-zinc-800 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Valeur</th>
                      <th className="text-left p-2">Tags</th>
                      <th className="text-right p-2">Poids</th>
                      <th className="text-left p-2">État</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entreesTable.map((entree) => (
                      <tr key={entree.id} className="border-t border-zinc-800 align-top">
                        <td className="p-2">
                          <div className={entree.actif ? "text-zinc-100" : "text-zinc-500 line-through"}>{entree.valeur}</div>
                          {entree.description && <div className="text-xs text-zinc-500 max-w-xl">{entree.description}</div>}
                          <div className="text-[10px] text-zinc-600">{entree.categorie ?? "—"} · {entree.source}</div>
                        </td>
                        <td className="p-2 text-xs text-zinc-400 max-w-[180px]">{entree.tags.join(", ") || "—"}</td>
                        <td className="p-2 text-right text-xs">{entree.poids}</td>
                        <td className="p-2 text-xs">
                          <span className={entree.actif ? "text-emerald-300" : "text-red-300"}>{entree.actif ? "Active" : "Inactive"}</span>
                        </td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => { setErreur(""); setFormEntree(depuisEntree(entree)); }} className={bouton}>Éditer</button>
                            <button type="button" onClick={() => setEntries((prev) => [...prev, dupliquerEntree(entree, prev)])} className={bouton}>Dupl.</button>
                            <button type="button" onClick={() => basculerEntree(entree)} className={bouton}>{entree.actif ? "Off" : "On"}</button>
                            <button type="button" onClick={() => supprimerEntree(entree)} className="px-2 py-1 rounded text-xs bg-zinc-800 text-red-300">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {entreesTable.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-zinc-500 text-sm">Aucune entrée ne correspond.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {formTable && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg space-y-2">
            <h3 className="font-bold">{formTable.id ? "Éditer la table" : "Nouvelle table"}</h3>
            <label className="block text-sm">Nom
              <input value={formTable.nom} onChange={(e) => setFormTable({ ...formTable, nom: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Catégorie
                <select value={formTable.categorie} onChange={(e) => setFormTable({ ...formTable, categorie: e.target.value as ReferenceCategorie })} className={`${champ} mt-1`}>
                  {REFERENCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-sm">Ordre
                <input type="number" value={formTable.ordre} onChange={(e) => setFormTable({ ...formTable, ordre: Number(e.target.value) })} className={`${champ} mt-1`} />
              </label>
            </div>
            <label className="block text-sm">Description
              <textarea rows={2} value={formTable.description} onChange={(e) => setFormTable({ ...formTable, description: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formTable.actif} onChange={(e) => setFormTable({ ...formTable, actif: e.target.checked })} />
              Table active pour la génération
            </label>
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setFormTable(null); setErreur(""); }} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button type="button" onClick={sauverTable} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {formEntree && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-2 max-h-[92vh] overflow-auto">
            <h3 className="font-bold">{formEntree.id ? "Éditer l'entrée" : "Nouvelle entrée"}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Table
                <select value={formEntree.tableId} onChange={(e) => setFormEntree({ ...formEntree, tableId: e.target.value })} className={`${champ} mt-1`}>
                  {tablesTriees.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </label>
              <label className="block text-sm">Valeur
                <input value={formEntree.valeur} onChange={(e) => setFormEntree({ ...formEntree, valeur: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Catégorie libre
                <input value={formEntree.categorie} onChange={(e) => setFormEntree({ ...formEntree, categorie: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Tags (virgules)
                <input value={formEntree.tags} onChange={(e) => setFormEntree({ ...formEntree, tags: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Poids
                <input type="number" min={0} value={formEntree.poids} onChange={(e) => setFormEntree({ ...formEntree, poids: Number(e.target.value) })} className={`${champ} mt-1`} />
              </label>
              <label className="flex items-center gap-2 text-sm mt-5">
                <input type="checkbox" checked={formEntree.actif} onChange={(e) => setFormEntree({ ...formEntree, actif: e.target.checked })} />
                Entrée active
              </label>
            </div>
            <label className="block text-sm">Description
              <textarea rows={2} value={formEntree.description} onChange={(e) => setFormEntree({ ...formEntree, description: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Conditions (JSON)
                <textarea rows={7} value={formEntree.conditions} onChange={(e) => setFormEntree({ ...formEntree, conditions: e.target.value })} className={`${champ} mt-1 font-mono text-xs`} />
              </label>
              <label className="block text-sm">Métadonnées (JSON)
                <textarea rows={7} value={formEntree.meta} onChange={(e) => setFormEntree({ ...formEntree, meta: e.target.value })} className={`${champ} mt-1 font-mono text-xs`} />
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">
              Conditions reconnues : sexes, especes, cultures, professions, categoriesProfession, niveauxSociaux,
              importances, tagsRequis, tagsExclus. Les métadonnées servent aux règles du moteur (culture, catégorie…).
            </p>
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setFormEntree(null); setErreur(""); }} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button type="button" onClick={sauverEntree} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-zinc-500">
        Conseil : l&apos;identifiant technique d&apos;une table est stable. Utilisez « Dupliquer » plutôt que de changer
        l&apos;identifiant des tables livrées, afin de ne pas casser le moteur de génération.
        {Object.values(TABLE_IDS).includes(tableIdCourante as never) && " Cette table est utilisée par le moteur."}
      </div>
    </div>
  );
}
