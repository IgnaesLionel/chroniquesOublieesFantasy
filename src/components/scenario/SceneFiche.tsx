"use client";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { actionsOf, narrationOf, secretsOf } from "@/src/lib/rules/scenario/types";
import { SCENE_TYPE_LABEL, sceneTypeOf } from "@/src/lib/rules/scenario/types";
import { getSceneSafe, PROFIL_LABEL, profilScene } from "@/src/lib/rules/scenario/engine";
import { describeCondition } from "@/src/lib/rules/scenario/conditions";

interface Props {
  scenario: Scenario;
  sceneId: string;
  play?: PlayState | null;
  onGoto: (id: string) => void;
}

/** Fiche de scène lisible : sections repliables, narration mise en avant. */
export function SceneFiche({ scenario, sceneId, play, onGoto }: Props) {
  const scene = getSceneSafe(scenario, sceneId);
  if (!scene) return <p className="text-sm text-red-400">Scène introuvable ({sceneId}).</p>;

  const narration = narrationOf(scene);
  const secrets = secretsOf(scene);
  const actions = actionsOf(scene);
  const note = play?.notesScenes?.[scene.id]?.trim() ?? "";
  const profil = profilScene(scene);

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <header className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
        <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">
          {SCENE_TYPE_LABEL[sceneTypeOf(scene)]}
          <span className={`ml-2 normal-case tracking-normal font-semibold ${profil === "embranchement" ? "text-amber-300" : "text-zinc-500"}`}>
            · {PROFIL_LABEL[profil]}{profil === "embranchement" ? ` ×${scene.choix.length}` : ""}
          </span>
        </div>
        <h2 className="text-lg font-bold leading-snug">{scene.titre}</h2>
        {scene.description && <p className="text-xs text-zinc-500 mt-0.5">{scene.description}</p>}
      </header>

      <div className="p-4 space-y-3">
        <section className="rounded bg-zinc-950 border border-amber-400/30 p-3">
          <div className="text-xs uppercase text-amber-300 font-bold mb-1">Narration à lire</div>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{narration || <span className="text-zinc-500">— Aucune narration —</span>}</p>
        </section>

        <details open={actions.length > 0}>
          <summary className="text-sm font-bold text-zinc-300">Actions possibles ({actions.length})</summary>
          {actions.length > 0 ? (
            <ul className="list-disc ml-5 mt-1.5 text-sm space-y-1">
              {actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 mt-1">Aucune (champ facultatif).</p>
          )}
        </details>

        <details>
          <summary className="text-sm font-bold text-red-300">Informations secrètes (MJ seul)</summary>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap mt-1.5 rounded bg-red-950/30 border border-red-900/60 p-2.5">
            {secrets || "— Aucune —"}
          </p>
        </details>

        <details open={!!scene.consequences?.trim()}>
          <summary className="text-sm font-bold text-zinc-300">Conséquences ({scene.consequences?.trim() ? "1" : "0"})</summary>
          <p className="text-sm whitespace-pre-wrap mt-1.5 text-zinc-300">{scene.consequences?.trim() || "— Aucune —"}</p>
        </details>

        {(scene.indices?.length ?? 0) > 0 && (
          <details open>
            <summary className="text-sm font-bold text-zinc-300">Indices ({scene.indices!.length})</summary>
            <ul className="list-disc ml-5 mt-1.5 text-sm space-y-0.5">
              {scene.indices!.map((ix, i) => {
                const found = (play?.indices ?? []).includes(ix);
                return (
                  <li key={i} className={found ? "text-green-300" : undefined}>
                    {ix} {found && "· découvert"}
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        <details open>
          <summary className="text-sm font-bold text-zinc-300">Scènes liées ({scene.choix.length})</summary>
          <div className="grid gap-1.5 mt-2">
            {scene.choix.map((c) => {
              const dest = getSceneSafe(scenario, c.versSceneId);
              return (
                <button
                  key={c.id}
                  onClick={() => dest && onGoto(dest.id)}
                  disabled={!dest}
                  className="text-left px-3 py-2 rounded bg-zinc-950 border border-zinc-800 hover:border-amber-400/60 text-sm disabled:opacity-50"
                >
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-zinc-500">
                    → {dest ? `${SCENE_TYPE_LABEL[sceneTypeOf(dest)]} · ${dest.titre}` : `destination manquante (${c.versSceneId})`}
                    {c.condition && <span className="text-amber-400/90"> · {describeCondition(c.condition)}</span>}
                  </span>
                </button>
              );
            })}
            {scene.choix.length === 0 && <p className="text-xs text-zinc-500">Aucun lien : fin de branche possible, les joueurs peuvent rebrousser chemin.</p>}
          </div>
        </details>

        {scene.rencontreId && <p className="text-xs text-zinc-400">Rencontre liée : {scene.rencontreId}</p>}
        {note && (
          <div className="rounded border border-blue-900/60 bg-blue-950/30 p-2.5 text-sm">
            <div className="text-xs uppercase text-blue-300 font-bold">Note de partie</div>
            <p className="whitespace-pre-wrap">{note}</p>
          </div>
        )}
      </div>
    </article>
  );
}
