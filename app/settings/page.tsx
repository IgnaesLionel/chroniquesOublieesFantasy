"use client";
import { useState } from "react";
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

const LABELS: Record<CollectionName, string> = {
  characters: "Personnages",
  monsters: "Monstres",
  npcs: "PNJ",
  items: "Objets",
  scenarios: "Scénarios",
  sorts: "Sorts & Capacités",
};

function storageInfo(): { counts: Record<CollectionName, number>; bytes: number } {
  const counts = {} as Record<CollectionName, number>;
  let bytes = 0;
  (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((name) => {
    const raw = window.localStorage.getItem(STORAGE_KEYS[name]) ?? "[]";
    bytes += raw.length;
    try {
      counts[name] = (JSON.parse(raw) as unknown[]).length;
    } catch {
      counts[name] = 0;
    }
  });
  return { counts, bytes };
}

export default function SettingsPage() {
  const [info, setInfo] = useState(() => (typeof window === "undefined" ? null : storageInfo()));
  const [pending, setPending] = useState<BackupData | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");

  const refresh = () => setInfo(storageInfo());

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
        Stockage local du navigateur (remplaçable par SQLite/Postgres via le Repository).
        Combat en cours et jets de dés non sauvegardés (volatils).
      </p>

      {info && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-bold text-sm uppercase text-zinc-400 mb-2">Contenu actuel ({(info.bytes / 1024).toFixed(1)} Ko)</h2>
          <div className="flex gap-2 flex-wrap text-sm">
            {(Object.keys(LABELS) as CollectionName[]).map((k) => (
              <span key={k} className="px-2.5 py-1 rounded bg-zinc-800">{LABELS[k]} : <b>{info.counts[k]}</b></span>
            ))}
          </div>
        </div>
      )}

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
            if (!confirm("Tout effacer ? Les seeds d'exemple seront rechargés au prochain refresh.")) return;
            (Object.values(STORAGE_KEYS) as string[]).forEach((k) => window.localStorage.removeItem(k));
            window.location.reload();
          }}
          className="px-4 py-2 rounded bg-zinc-800 text-sm hover:bg-red-900"
        >
          Tout effacer (retour aux exemples)
        </button>
        <button onClick={refresh} className="ml-2 px-4 py-2 rounded bg-zinc-800 text-sm">Actualiser l'affichage</button>
      </div>
    </div>
  );
}
