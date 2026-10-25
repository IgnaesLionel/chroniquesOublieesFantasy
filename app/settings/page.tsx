"use client";
import { useEffect, useState } from "react";
import {
  STORAGE_KEYS,
  applyBackup,
  buildBackup,
  exportJson,
  readJsonFile,
  validateBackup,
  type BackupData,
  type CollectionName,
  type ImportReport,
} from "@/src/lib/store/backup";
import { effacerMiroirs } from "@/src/lib/store/miroir";
import { useCharacters, useMonsters, useNpcs, useScenarios, useSessions, useSorts } from "@/src/lib/store/collections";
import {
  etatDonneesInitialesPnj,
  restaurerDonneesInitialesPnj,
  useNpcFactions,
  useNpcPlacements,
  useNpcProfiles,
  useNpcReferenceEntries,
  useNpcReferenceTables,
  useNpcSaved,
  useNpcStatBlocks,
} from "@/src/lib/store/npcgen";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";

const LABELS: Record<CollectionName, string> = {
  characters: "Personnages",
  monsters: "Monstres",
  npcs: "PNJ (exemples)",
  items: "Objets",
  scenarios: "Scénarios",
  sorts: "Sorts & Capacités",
  sessions: "Sessions",
  npcTables: "PNJ — tables",
  npcEntries: "PNJ — entrées",
  npcSaved: "PNJ — bibliothèque",
  npcStatBlocks: "PNJ — combats",
  npcPlacements: "PNJ — placements",
  npcFactions: "PNJ — factions",
  npcProfiles: "PNJ — profils",
};

function storageBytes(): number {
  let bytes = 0;
  (Object.values(STORAGE_KEYS) as string[]).forEach((k) => {
    bytes += (window.localStorage.getItem(k) ?? "").length;
  });
  return bytes;
}

export default function SettingsPage() {
  // Rendu initial identique serveur/client, chargement après montage.
  const [bytes, setBytes] = useState<number | null>(null);
  const [pending, setPending] = useState<BackupData | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [messagePnj, setMessagePnj] = useState("");
  // Compteurs réels (persisté + mémoire) : le stockage local ne contient
  // que personnages, sessions et progression.
  const { items: characters } = useCharacters("reglages");
  const { items: monsters } = useMonsters();
  const { items: npcs } = useNpcs();
  const { catalogue } = useCatalogueObjets();
  const { items: scenarios } = useScenarios();
  const { items: sorts } = useSorts();
  const { items: sessions } = useSessions();
  const { items: npcTables } = useNpcReferenceTables();
  const { items: npcEntries } = useNpcReferenceEntries();
  const { items: npcSaved } = useNpcSaved();
  const { items: npcStatBlocks } = useNpcStatBlocks();
  const { items: npcPlacements } = useNpcPlacements();
  const { items: npcFactions } = useNpcFactions();
  const { items: npcProfiles } = useNpcProfiles();
  const counts: Record<CollectionName, number> = {
    characters: characters.length,
    monsters: monsters.length,
    npcs: npcs.length,
    items: catalogue.length,
    scenarios: scenarios.length,
    sorts: sorts.length,
    sessions: sessions.length,
    npcTables: npcTables.length,
    npcEntries: npcEntries.length,
    npcSaved: npcSaved.length,
    npcStatBlocks: npcStatBlocks.length,
    npcPlacements: npcPlacements.length,
    npcFactions: npcFactions.length,
    npcProfiles: npcProfiles.length,
  };

  useEffect(() => {
    setBytes(storageBytes());
  }, []);

  const refresh = () => setBytes(storageBytes());

  const onFile = async (f: File | undefined) => {
    setError("");
    setPending(null);
    setReport(null);
    if (!f) return;
    try {
      const obj = await readJsonFile(f);
      const { backup, report: r } = validateBackup(obj);
      setReport(r);
      setPending(backup);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres — Sauvegarde</h1>
      <p className="text-sm text-zinc-400">
        Persistés en local : personnages, sessions, progression des scénarios, bibliothèque PNJ
        et ses tables de référence. Les exemples de PNJ historiques restent en mémoire seule.
        Monstres, objets, sorts et scénarios viennent du code (mémoire seule, perdus au rechargement si modifiés).
        Combat en cours et jets de dés non sauvegardés (volatils).
      </p>

      {bytes !== null && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-bold text-sm uppercase text-zinc-400 mb-2">Contenu actuel ({(bytes / 1024).toFixed(1)} Ko en local)</h2>
          <div className="flex gap-2 flex-wrap text-sm">
            {(Object.keys(LABELS) as CollectionName[]).map((k) => (
              <span key={k} className="px-2.5 py-1 rounded bg-zinc-800">{LABELS[k]} : <b>{counts[k]}</b></span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase text-zinc-400">Contenu initial du générateur PNJ</h2>
        <p className="text-xs text-zinc-500">
          La restauration ajoute uniquement les tables, entrées, factions et profils initiaux manquants.
          Les données créées ou modifiées par le MJ ne sont jamais remplacées.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const etat = etatDonneesInitialesPnj();
              setMessagePnj(
                etat.presente
                  ? `${etat.entreesInitiales} entrées initiales encore présentes.`
                  : "Initialisation non encore effectuée sur ce navigateur."
              );
            }}
            className="px-4 py-2 rounded bg-zinc-800 text-sm"
          >
            Diagnostiquer
          </button>
          <button
            onClick={() => {
              if (!confirm("Ajouter les tables, entrées, factions et profils initiaux manquants ?")) return;
              const ajouts = restaurerDonneesInitialesPnj();
              setMessagePnj(
                `${ajouts.tables} tables, ${ajouts.entrees} entrées, ${ajouts.factions} factions et ${ajouts.profils} profils ajoutés.`
              );
              setBytes(storageBytes());
            }}
            className="px-4 py-2 rounded bg-amber-500 text-black font-bold text-sm"
          >
            Restaurer les données initiales manquantes
          </button>
        </div>
        {messagePnj && <p className="text-sm text-amber-200">{messagePnj}</p>}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase text-zinc-400">Export global</h2>
        <button
          onClick={() => exportJson(`assistant-mj-${new Date().toISOString().slice(0, 10)}.json`, buildBackup())}
          className="px-5 py-2.5 rounded bg-amber-400 text-black font-bold"
        >
          Télécharger la sauvegarde JSON
        </button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase text-zinc-400">Import (validé)</h2>
        <p className="text-xs text-zinc-500">
          Chaque collection est validée. Un import remplace les collections persistées par leur contenu validé
          (une collection absente du fichier est vidée) ; les données mémoire seule du code ne sont pas touchées.
        </p>
        <input
          type="file" accept="application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm text-zinc-300"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {report && (
          <div className="text-sm space-y-1 rounded bg-zinc-950 border border-zinc-800 p-3">
            {(Object.keys(LABELS) as CollectionName[]).map((k) => (
              <div key={k}>
                {LABELS[k]} : <span className="text-green-400 font-bold">{report.imported[k]} importés</span>
                {report.skipped[k] > 0 && <span className="text-red-400"> · {report.skipped[k]} rejetés</span>}
              </div>
            ))}
            {report.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-400">⚠ {e}</p>
            ))}
          </div>
        )}
        {pending && (
          <div className="flex gap-2">
            <button onClick={() => { setPending(null); setReport(null); }} className="px-4 py-2 rounded bg-zinc-800 text-sm">Annuler</button>
            <button
              onClick={() => { applyBackup(pending); window.location.reload(); }}
              className="px-4 py-2 rounded bg-red-700 font-bold text-sm"
            >
              Remplacer les données et recharger
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase text-red-400">Zone dangereuse</h2>
        <button
          onClick={() => {
            if (!confirm("Tout effacer ? Les graines et les exemples reviendront au prochain rechargement.")) return;
            (Object.values(STORAGE_KEYS) as string[]).forEach((k) => window.localStorage.removeItem(k));
            window.localStorage.removeItem("cof.npcgen.initialized.v1");
            // Les miroirs (sessionStorage + IndexedDB) partent aussi : un reset
            // délibéré ne doit jamais être « ressuscité » par la réconciliation.
            effacerMiroirs();
            window.location.reload();
          }}
          className="px-4 py-2 rounded bg-zinc-800 text-sm hover:bg-red-900"
        >
          Tout effacer (personnages/sessions → graines)
        </button>
        <button onClick={refresh} className="ml-2 px-4 py-2 rounded bg-zinc-800 text-sm">Actualiser l'affichage</button>
      </div>
    </div>
  );
}
