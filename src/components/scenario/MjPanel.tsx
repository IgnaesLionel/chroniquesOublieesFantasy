"use client";
import { useState } from "react";
import type { Item, Npc } from "@/src/lib/rules/world/types";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { actionsOf, narrationOf, secretsOf } from "@/src/lib/rules/scenario/types";
import { getSceneSafe } from "@/src/lib/rules/scenario/engine";
import { availableChoices, lockedChoices } from "@/src/lib/rules/scenario/conditions";

interface Props {
  scenario: Scenario;
  sceneId: string;
  play: PlayState;
  npcs: Npc[];
  items: Item[];
  onToggleDone: (sceneId: string) => void;
  onToggleFlag: (flag: string) => void;
  onAddFlag: (flag: string) => void;
  onToggleIndice: (indice: string) => void;
  onSceneNote: (sceneId: string, note: string) => void;
  onGlobalNotes: (notes: string) => void;
  onEdit: () => void;
}

/** Panneau MJ : secrets + actions + suivi, sans quitter la scène. */
export function MjPanel({ scenario, sceneId, play, npcs, items, onToggleDone, onToggleFlag, onAddFlag, onToggleIndice, onSceneNote, onGlobalNotes, onEdit }: Props) {
  const scene = getSceneSafe(scenario, sceneId);
  const [newFlag, setNewFlag] = useState("");
  const [newIndice, setNewIndice] = useState("");
  if (!scene) return null;

  const flags = Object.entries(play.flags);
  const visibles = availableChoices(scene, play.flags);
  const verrouilles = lockedChoices(scene, play.flags);
  const sceneNpcs = (scene.pnjIds ?? []).map((id) => npcs.find((n) => n.id === id)).filter(Boolean) as Npc[];
  const sceneItems = (scene.itemIds ?? []).map((id) => items.find((o) => o.id === id)).filter(Boolean) as Item[];
  const done = (play.terminees ?? []).includes(scene.id);
  const sceneIndices = [...(scene.indices ?? []), ...(scene.actionsPossibles ?? []).filter((a) => a.toLowerCase().startsWith("indice"))];
  void narrationOf;
  void actionsOf;
  void secretsOf;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs uppercase font-bold text-zinc-400">Outils MJ</h3>
          <button onClick={onEdit} className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Modifier la scène</button>
        </div>
        <button
          onClick={() => onToggleDone(scene.id)}
          className={`w-full px-3 py-2 rounded text-sm font-bold border ${done ? "bg-green-900/60 border-green-700 text-green-200" : "bg-zinc-800 border-zinc-700"}`}
        >
          {done ? "Terminée — cliquer pour rouvrir" : "Marquer terminée"}
        </button>
        {(sceneNpcs.length > 0 || sceneItems.length > 0) && (
          <div className="text-xs space-y-1">
            {sceneNpcs.map((n) => (
              <div key={n.id} className="px-2 py-1 rounded bg-blue-950 border border-blue-800 text-blue-200" title={n.description ?? n.role ?? ""}>
                {n.nom}{n.role ? ` (${n.role})` : ""}
              </div>
            ))}
            {sceneItems.map((o) => (
              <div key={o.id} className="px-2 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-200" title={o.effet ?? o.description ?? ""}>
                {o.nom} ×{o.quantite}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
        <h3 className="text-xs uppercase font-bold text-zinc-400">Flags ({flags.length})</h3>
        <div className="flex flex-wrap gap-1.5">
          {flags.length === 0 && <span className="text-xs text-zinc-500">Aucun pour l{"'"}instant.</span>}
          {flags.map(([k, v]) => (
            <button
              key={k}
              onClick={() => onToggleFlag(k)}
              title={`Valeur : ${String(v)} — cliquer pour basculer`}
              className={`px-2.5 py-1 rounded text-xs font-bold border ${v === true || v === "true" || v === 1 ? "bg-green-800 border-green-600" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={newFlag} onChange={(e) => setNewFlag(e.target.value)} placeholder="nouveau flag (ex: cle)" className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs" />
          <button
            onClick={() => { if (newFlag.trim()) { onAddFlag(newFlag.trim()); setNewFlag(""); } }}
            className="px-2.5 py-1.5 rounded bg-zinc-800 text-xs"
          >
            + Flag
          </button>
        </div>
        {verrouilles.length > 0 && (
          <div className="text-xs text-zinc-500 space-y-0.5">
            <div className="uppercase font-bold">Verrouillés ({verrouilles.length})</div>
            {visibles.length === 0 && <div>Aucun choix visible avec ces flags.</div>}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
        <h3 className="text-xs uppercase font-bold text-zinc-400">Indices ({(play.indices ?? []).length})</h3>
        {sceneIndices.length === 0 && <p className="text-xs text-zinc-500">Aucun indice prévu dans cette scène.</p>}
        {sceneIndices.map((ix) => {
          const on = (play.indices ?? []).includes(ix);
          return (
            <label key={ix} className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 cursor-pointer">
              <input type="checkbox" checked={on} onChange={() => onToggleIndice(ix)} />
              <span className={on ? "text-green-300" : undefined}>{ix}</span>
            </label>
          );
        })}
        <div className="flex gap-1.5">
          <input value={newIndice} onChange={(e) => setNewIndice(e.target.value)} placeholder="indice découvert…" className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs" />
          <button onClick={() => { if (newIndice.trim()) { onToggleIndice(newIndice.trim()); setNewIndice(""); } }} className="px-2.5 py-1.5 rounded bg-zinc-800 text-xs">+</button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
        <h3 className="text-xs uppercase font-bold text-zinc-400">Notes</h3>
        <label className="block text-xs">Note de scène
          <textarea
            defaultValue={play.notesScenes?.[scene.id] ?? ""}
            key={scene.id}
            onBlur={(e) => onSceneNote(scene.id, e.target.value)}
            rows={2}
            placeholder="Note liée à cette scène (conservée même en changeant de scène)…"
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">Note de partie
          <textarea
            defaultValue={play.notes ?? ""}
            onBlur={(e) => onGlobalNotes(e.target.value)}
            rows={2}
            placeholder="Journal MJ…"
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
