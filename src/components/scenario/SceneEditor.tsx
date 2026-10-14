"use client";
import type { Condition, Scene, SceneType } from "@/src/lib/rules/scenario/types";
import { SCENE_TYPES, SCENE_TYPE_LABEL, narrationOf, secretsOf } from "@/src/lib/rules/scenario/types";
import type { Item, Npc } from "@/src/lib/rules/world/types";
import { describeCondition } from "@/src/lib/rules/scenario/conditions";

interface Props {
  scene: Scene;
  allScenes: Scene[];
  allNpcs?: Npc[];
  allItems?: Item[];
  onUpdate: (s: Scene) => void;
  onDelete: () => void;
}

function condKind(c: Condition | undefined): string {
  if (!c) return "toujours";
  if (c.type === "flag" && c.op === "estVrai") return "siVrai";
  if (c.type === "flag" && c.op === "estFaux") return "siFaux";
  if (c.type === "flag" && c.op === "egal") return "egal";
  return "avance";
}

function linesToArr(v: string): string[] {
  return v.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function SceneEditor({ scene, allScenes, allNpcs = [], allItems = [], onUpdate, onDelete }: Props) {
  const addChoice = () => {
    const dest = allScenes.find((s) => s.id !== scene.id)?.id ?? scene.id;
    onUpdate({ ...scene, choix: [...scene.choix, { id: `c-${Date.now().toString(36)}`, label: "Nouveau choix", versSceneId: dest }] });
  };

  const setCond = (i: number, kind: string, flag: string, valeur: string) => {
    const choix = scene.choix.map((x, j) => {
      if (j !== i) return x;
      if (kind === "toujours") {
        const rest = { ...x };
        delete rest.condition;
        return rest;
      }
      if (kind === "siVrai") return { ...x, condition: { type: "flag", flag, op: "estVrai" } as Condition };
      if (kind === "siFaux") return { ...x, condition: { type: "flag", flag, op: "estFaux" } as Condition };
      return { ...x, condition: { type: "flag", flag, op: "egal", valeur } as Condition };
    });
    onUpdate({ ...scene, choix });
  };

  const narration = narrationOf(scene);
  const secrets = secretsOf(scene);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-bold">Éditer la scène</h3>
        <button onClick={onDelete} className="text-xs px-2.5 py-1 rounded bg-red-900 hover:bg-red-800">Supprimer</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block text-sm">Titre
          <input value={scene.titre} onChange={(e) => onUpdate({ ...scene, titre: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2" />
        </label>
        <label className="block text-sm">Type de scène
          <select
            value={scene.type ?? "narration"}
            onChange={(e) => onUpdate({ ...scene, type: e.target.value as SceneType })}
            className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
          >
            {SCENE_TYPES.map((t) => (
              <option key={t} value={t}>{SCENE_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">Narration — texte lu aux joueurs
        <textarea
          value={narration}
          onChange={(e) => onUpdate({ ...scene, narration: e.target.value, texteMJ: e.target.value })}
          rows={4}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        />
      </label>

      <label className="block text-sm">Actions possibles — une par ligne (facultatif)
        <textarea
          value={(scene.actionsPossibles ?? []).join("\n")}
          onChange={(e) => onUpdate({ ...scene, actionsPossibles: linesToArr(e.target.value) })}
          rows={3}
          placeholder={"Exemple :\nFouiller la pièce\nInterroger le PNJ"}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        />
      </label>

      <label className="block text-sm">Informations secrètes — MJ seul (facultatif)
        <textarea
          value={secrets}
          onChange={(e) => onUpdate({ ...scene, infosSecretes: e.target.value, notesMJ: e.target.value })}
          rows={2}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        />
      </label>

      <label className="block text-sm">Conséquences — résultats possibles (facultatif)
        <textarea
          value={scene.consequences ?? ""}
          onChange={(e) => onUpdate({ ...scene, consequences: e.target.value })}
          rows={2}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        />
      </label>

      <label className="block text-sm">Indices disponibles — un par ligne (facultatif)
        <textarea
          value={(scene.indices ?? []).join("\n")}
          onChange={(e) => onUpdate({ ...scene, indices: linesToArr(e.target.value) })}
          rows={2}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <label className="block">Description courte (facultatif)
          <input value={scene.description ?? ""} onChange={(e) => onUpdate({ ...scene, description: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2" />
        </label>
        <label className="block">Rencontre liée (facultatif)
          <input value={scene.rencontreId ?? ""} onChange={(e) => onUpdate({ ...scene, rencontreId: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2" />
        </label>
      </div>

      {(allNpcs.length > 0 || allItems.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {allNpcs.length > 0 && (
            <div>
              <div className="font-semibold mb-1">PNJ présents</div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {allNpcs.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={(scene.pnjIds ?? []).includes(n.id)}
                      onChange={(e) => onUpdate({
                        ...scene,
                        pnjIds: e.target.checked
                          ? [...(scene.pnjIds ?? []), n.id]
                          : (scene.pnjIds ?? []).filter((id) => id !== n.id),
                      })}
                    />
                    {n.nom}
                  </label>
                ))}
              </div>
            </div>
          )}
          {allItems.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Objets liés</div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {allItems.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={(scene.itemIds ?? []).includes(o.id)}
                      onChange={(e) => onUpdate({
                        ...scene,
                        itemIds: e.target.checked
                          ? [...(scene.itemIds ?? []), o.id]
                          : (scene.itemIds ?? []).filter((id) => id !== o.id),
                      })}
                    />
                    {o.nom}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Scènes liées — choix ({scene.choix.length})</div>
        {scene.choix.map((c, i) => {
          const kind = condKind(c.condition);
          const flagVal = c.condition?.type === "flag" ? c.condition.flag : "cle";
          return (
            <div key={c.id} className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
              <div className="flex gap-2 items-center">
                <input
                  value={c.label} onChange={(e) => onUpdate({ ...scene, choix: scene.choix.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                  className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
                <select
                  value={c.versSceneId} onChange={(e) => onUpdate({ ...scene, choix: scene.choix.map((x, j) => (j === i ? { ...x, versSceneId: e.target.value } : x)) })}
                  className="bg-zinc-800 rounded px-2 py-1.5 max-w-36">
                  {allScenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.titre}</option>
                  ))}
                </select>
                <button onClick={() => onUpdate({ ...scene, choix: scene.choix.filter((_, j) => j !== i) })} className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-red-900">✕</button>
              </div>
              <div className="flex gap-2 items-center text-xs">
                <select value={kind} onChange={(e) => setCond(i, e.target.value, flagVal, "")} className="bg-zinc-800 rounded px-2 py-1.5">
                  <option value="toujours">Toujours visible</option>
                  <option value="siVrai">SI flag vrai</option>
                  <option value="siFaux">SI flag faux</option>
                  <option value="egal">SI flag = valeur</option>
                  <option value="avance">Avancé (ET/OU/NON, via JSON)</option>
                </select>
                {kind !== "toujours" && kind !== "avance" && (
                  <input
                    defaultValue={flagVal} placeholder="nom du flag (ex: cle)"
                    onBlur={(e) => setCond(i, kind, e.target.value || "cle", c.condition?.type === "flag" && c.condition.op === "egal" ? String(c.condition.valeur ?? "") : "")}
                    className="bg-zinc-800 rounded px-2 py-1.5 w-32" />
                )}
                {kind === "egal" && (
                  <input
                    defaultValue={c.condition?.type === "flag" && c.condition.op === "egal" ? String(c.condition.valeur ?? "") : ""}
                    placeholder="valeur"
                    onBlur={(e) => setCond(i, kind, flagVal, e.target.value)}
                    className="bg-zinc-800 rounded px-2 py-1.5 w-24" />
                )}
                {c.condition && <span className="text-amber-400/90">{describeCondition(c.condition)}</span>}
              </div>
            </div>
          );
        })}
        <button onClick={addChoice} className="text-sm px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">+ Ajouter un lien / choix</button>
        <p className="text-xs text-zinc-500">Les liens créent les connexions du graphe. Les joueurs peuvent ignorer une scène : la navigation reste libre en partie.</p>
      </div>
    </div>
  );
}
