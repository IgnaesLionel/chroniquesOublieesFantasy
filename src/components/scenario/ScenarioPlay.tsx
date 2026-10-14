"use client";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { actionsOf, narrationOf, secretsOf } from "@/src/lib/rules/scenario/types";
import { SCENE_TYPE_LABEL, sceneTypeOf } from "@/src/lib/rules/scenario/types";
import type { Item, Npc } from "@/src/lib/rules/world/types";
import { availableChoices, describeCondition, lockedChoices } from "@/src/lib/rules/scenario/conditions";
import { backTo, followChoice, getSceneSafe, gotoScene, setFlag } from "@/src/lib/rules/scenario/engine";

interface Props {
  scenario: Scenario;
  play: PlayState;
  onPlay: (p: PlayState) => void;
  npcs?: Npc[];
  items?: Item[];
  /** Navigation libre depuis la fiche (utilisé par la vue 3 zones). */
  onGoto?: (id: string) => void;
}

const QUICK_FLAGS = ["cle", "indice", "chef_mort"];

export function ScenarioPlay({ scenario, play, onPlay, npcs = [], items = [], onGoto }: Props) {
  const scene = getSceneSafe(scenario, play.sceneId);
  if (!scene) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm">
        Scène <span className="font-mono">{play.sceneId}</span> introuvable — scénario corrompu.
        Vérifiez l{"'"}onglet Préparer ou réimportez une sauvegarde.
      </div>
    );
  }
  const visibles = availableChoices(scene, play.flags);
  const verrouilles = lockedChoices(scene, play.flags);
  const sceneNpcs = (scene.pnjIds ?? []).map((id) => npcs.find((n) => n.id === id)).filter((n) => n !== undefined);
  const sceneItems = (scene.itemIds ?? []).map((id) => items.find((o) => o.id === id)).filter((o) => o !== undefined);
  const narration = narrationOf(scene);
  const secrets = secretsOf(scene);
  const actions = actionsOf(scene);
  const go = (id: string) => {
    if (onGoto) onGoto(id);
    else onPlay(gotoScene(scenario, play, id, `Saut MJ vers ${getSceneSafe(scenario, id)?.titre ?? id}`));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-400/40 bg-zinc-900 p-4">
        <div className="text-xs uppercase text-amber-300 font-bold mb-1">
          {SCENE_TYPE_LABEL[sceneTypeOf(scene)]} · {scene.titre}
        </div>
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{narration}</p>
        {actions.length > 0 && (
          <ul className="mt-2 text-sm list-disc ml-5 space-y-0.5 text-zinc-300">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {secrets && (
          <details className="mt-2">
            <summary className="text-xs font-bold text-red-300 cursor-pointer">Secrets MJ</summary>
            <p className="text-sm whitespace-pre-wrap mt-1 text-zinc-300">{secrets}</p>
          </details>
        )}
        {scene.consequences?.trim() && <p className="text-xs text-zinc-400 mt-2">Conséquences : {scene.consequences}</p>}
        {scene.rencontreId && <div className="text-xs text-zinc-400 mt-1">Rencontre liée : {scene.rencontreId}</div>}
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
        {visibles.length === 0 && <p className="text-sm text-zinc-500">Fin de cette branche — utilisez la liste ou le graphe pour aller ailleurs, les scènes sont ignorables.</p>}
      </div>

      {verrouilles.length > 0 && (
        <div className="rounded border border-dashed border-zinc-700 p-3 space-y-1">
          <div className="text-xs uppercase text-zinc-500 font-bold">Verrouillés ({verrouilles.length})</div>
          {verrouilles.map((c) => (
            <div key={c.id} className="text-xs text-zinc-500">{c.label} — <span className="text-amber-400/80">{describeCondition(c.condition)}</span></div>
          ))}
        </div>
      )}

      <div className="rounded border border-zinc-800 p-3">
        <div className="text-xs uppercase text-zinc-500 font-bold mb-1.5">Parcours ({play.historique.length}) — cliquer pour revenir</div>
        <div className="flex flex-wrap gap-1.5">
          {play.historique.map((id, i) => (
            <button
              key={`${id}-${i}`}
              onClick={() => onPlay(backTo(scenario, play, id))}
              title="Revenir à cette scène sans perdre l'historique"
              className={`text-xs px-2 py-1 rounded border ${id === play.sceneId ? "bg-amber-400 text-black font-bold" : "bg-zinc-800 border-zinc-700"}`}
            >
              {getSceneSafe(scenario, id)?.titre.split("—")[0].trim() ?? `?${id}`}
            </button>
          ))}
        </div>
        {(play.indices?.length ?? 0) > 0 && <div className="text-xs text-green-300 mt-2">Indices : {(play.indices ?? []).join(" · ")}</div>}
        {(play.decisions?.length ?? 0) > 0 && (
          <details className="mt-1.5">
            <summary className="text-xs text-zinc-500 cursor-pointer">Décisions ({play.decisions!.length})</summary>
            <ul className="text-xs text-zinc-400 mt-1 space-y-0.5">
              {play.decisions!.slice(-8).map((d, i) => (
                <li key={i}>— {d.label}</li>
              ))}
            </ul>
          </details>
        )}
        {scenario.scenes.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-zinc-500 w-full">Saut libre :</span>
            {scenario.scenes.filter((s) => s.id !== play.sceneId).map((s) => (
              <button key={s.id} onClick={() => go(s.id)} className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 hover:border-amber-400/60">
                {s.titre}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
