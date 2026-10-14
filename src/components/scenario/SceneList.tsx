"use client";
import { useMemo, useState } from "react";
import type { PlayState, Scene, SceneType } from "@/src/lib/rules/scenario/types";
import { SCENE_TYPES, SCENE_TYPE_ICON, SCENE_TYPE_LABEL, sceneTypeOf, statusOf } from "@/src/lib/rules/scenario/types";

interface Props {
  scenes: Scene[];
  play?: PlayState | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAdd: () => void;
}

const DOT: Record<string, string> = {
  non_visitee: "bg-zinc-700",
  en_cours: "bg-amber-400",
  terminee: "bg-green-500",
};

const STATUT_LABEL: Record<string, string> = {
  non_visitee: "Non visitée",
  en_cours: "En cours",
  terminee: "Terminée",
};

export function SceneList({ scenes, play, selectedId, onSelect, onMove, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<SceneType | "tous">("tous");
  const [statut, setStatut] = useState<string>("tous");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scenes.filter((s) => {
      if (type !== "tous" && sceneTypeOf(s) !== type) return false;
      if (needle && !`${s.titre} ${(s.narration ?? s.texteMJ ?? "")}`.toLowerCase().includes(needle)) return false;
      if (statut !== "tous" && play) {
        const st = statusOf(s.id, play);
        // "visitée" regroupe terminée (historique) pour le filtre MJ.
        if (statut === "terminee" ? st === "non_visitee" : st !== statut) return false;
      }
      return true;
    });
  }, [scenes, q, type, statut, play]);

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une scène…"
        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-sm"
      />
      <div className="flex gap-1.5">
        <select value={type} onChange={(e) => setType(e.target.value as SceneType | "tous")} className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs">
          <option value="tous">Tous types</option>
          {SCENE_TYPES.map((t) => (
            <option key={t} value={t}>{SCENE_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs">
          <option value="tous">Tous statuts</option>
          <option value="non_visitee">Non visitée</option>
          <option value="en_cours">En cours</option>
          <option value="terminee">Visitée / terminée</option>
        </select>
      </div>
      <div className="space-y-1.5 max-h-[60vh] overflow-auto pr-0.5">
        {filtered.map((s, idx) => {
          const st = play ? statusOf(s.id, play) : "non_visitee";
          const sel = s.id === selectedId;
          return (
            <div
              key={s.id}
              className={`rounded border text-left ${sel ? "bg-amber-400/10 border-amber-400/60" : "bg-zinc-950 border-zinc-800"}`}
            >
              <button onClick={() => onSelect(s.id)} className="block w-full text-left px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`inline-block w-2 h-2 rounded-full ${DOT[st]}`} title={STATUT_LABEL[st]} />
                  <span className="flex-1 truncate">{s.titre}</span>
                </span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  {SCENE_TYPE_ICON[sceneTypeOf(s)]} {SCENE_TYPE_LABEL[sceneTypeOf(s)]} · {s.choix.length} lien{s.choix.length > 1 ? "s" : ""} · {STATUT_LABEL[st]}
                </span>
              </button>
              <span className="flex gap-1 px-3 pb-2">
                <button onClick={() => onMove(s.id, -1)} disabled={idx === 0} className="text-xs px-2 py-0.5 rounded bg-zinc-800 disabled:opacity-30" title="Monter">↑</button>
                <button onClick={() => onMove(s.id, 1)} disabled={idx === filtered.length - 1} className="text-xs px-2 py-0.5 rounded bg-zinc-800 disabled:opacity-30" title="Descendre">↓</button>
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-zinc-500">Aucune scène ne correspond.</p>}
      </div>
      <button onClick={onAdd} className="text-sm px-3 py-2 rounded bg-zinc-800 w-full hover:bg-zinc-700">
        + Nouvelle scène
      </button>
    </div>
  );
}
