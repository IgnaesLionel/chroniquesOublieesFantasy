"use client";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import type { Item, Npc } from "@/src/lib/rules/world/types";
import { availableChoices, describeCondition, lockedChoices } from "@/src/lib/rules/scenario/conditions";
import { followChoice, getSceneSafe, setFlag } from "@/src/lib/rules/scenario/engine";

interface Props {
  scenario: Scenario;
  play: PlayState;
  onPlay: (p: PlayState) => void;
  npcs?: Npc[];
  items?: Item[];
}

const QUICK_FLAGS = ["cle", "indice", "chef_mort"];

export function ScenarioPlay({ scenario, play, onPlay, npcs = [], items = [] }: Props) {
  const scene = getSceneSafe(scenario, play.sceneId);
  if (!scene) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm">
        ⚠ Scène <span className="font-mono">{play.sceneId}</span> introuvable — scénario corrompu.
        Vérifiez l'onglet Préparer ou réimportez une sauvegarde.
      </div>
    );
  }
  const visibles = availableChoices(scene, play.flags);
  const verrouilles = lockedChoices(scene, play.flags);
  const sceneNpcs = (scene.pnjIds ?? []).map((id) => npcs.find((n) => n.id === id)).filter((n) => n !== undefined);
  const sceneItems = (scene.itemIds ?? []).map((id) => items.find((o) => o.id === id)).filter((o) => o !== undefined);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-400/40 bg-zinc-900 p-4">
        <div className="text-xs uppercase text-amber-300 font-bold mb-1">{scene.titre}</div>
        <p className="text-sm whitespace-pre-wrap">{scene.texteMJ}</p>
        {scene.rencontreId && <div className="text-xs text-zinc-400 mt-2">Rencontre liée : {scene.rencontreId}</div>}
      </div>

      {(sceneNpcs.length > 0 || sceneItems.length > 0) && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
          {sceneNpcs.length > 0 && (
            <div className="text-sm">
              <span className="text-xs uppercase text-zinc-500 font-bold">PNJ présents : </span>
              {sceneNpcs.map((n) => (
                <span key={n!.id} title={n!.description ?? n!.role ?? ""} className="inline-block text-xs px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-200 mr-1.5">
                  {n!.nom}{n!.role ? ` (${n!.role})` : ""}
                </span>
              ))}
            </div>
          )}
          {sceneItems.length > 0 && (
            <div className="text-sm">
              <span className="text-xs uppercase text-zinc-500 font-bold">Objets : </span>
              {sceneItems.map((o) => (
                <span key={o!.id} title={o!.effet ?? o!.description ?? ""} className="inline-block text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-200 mr-1.5">
                  {o!.nom} ×{o!.quantite}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div className="text-xs uppercase text-zinc-400 font-bold mb-2">Flags MJ (SI/SINON)</div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_FLAGS.map((f) => {
            const on = !!play.flags[f];
            return (
              <button
                key={f}
                onClick={() => onPlay(setFlag(play, f, !on))}
                className={`px-3 py-1.5 rounded text-xs font-bold border ${on ? "bg-green-700 border-green-500" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
              >
                {f} : {on ? "OUI" : "non"}
              </button>
            );
          })}
        </div>
        {Object.keys(play.flags).length > 0 && (
          <button onClick={() => onPlay({ ...play, flags: {} })} className="text-xs text-zinc-500 underline mt-2">Réinitialiser les flags</button>
        )}
      </div>

      <div className="space-y-2">
        {visibles.map((c) => (
          <button
            key={c.id}
            onClick={() => onPlay(followChoice(scenario, play, c.id))}
            className="w-full text-left px-4 py-2.5 rounded bg-amber-400/10 border border-amber-400/40 hover:bg-amber-400/20 font-medium"
          >
            {c.label}
            <span className="block text-xs text-zinc-500">→ {getSceneSafe(scenario, c.versSceneId)?.titre ?? <span className="text-red-400">destination manquante ({c.versSceneId})</span>}{c.condition && <span className="text-green-400"> · {describeCondition(c.condition)}</span>}</span>
          </button>
        ))}
        {visibles.length === 0 && <p className="text-sm text-zinc-500">Fin de cette branche (aucun choix disponible).</p>}
      </div>

      {verrouilles.length > 0 && (
        <div className="rounded border border-dashed border-zinc-700 p-3 space-y-1">
          <div className="text-xs uppercase text-zinc-500 font-bold">Verrouillés ({verrouilles.length})</div>
          {verrouilles.map((c) => (
            <div key={c.id} className="text-xs text-zinc-500">🔒 {c.label} — <span className="text-amber-400/80">{describeCondition(c.condition)}</span></div>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-500">Parcours : {play.historique.map((id) => (getSceneSafe(scenario, id)?.titre.split("—")[0].trim() ?? `?${id}`)).join(" › ")}</div>
    </div>
  );
}
