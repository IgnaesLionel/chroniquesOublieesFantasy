"use client";
import { useState } from "react";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { SEED_ITEMS, SEED_NPCS } from "@/src/lib/data/worldSeeds";
import type { Item, Npc } from "@/src/lib/rules/world/types";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import { exportJson } from "@/src/lib/store/repository";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { startPlay, validateScenario } from "@/src/lib/rules/scenario/engine";
import { ScenarioPlay } from "@/src/components/scenario/ScenarioPlay";
import { SceneEditor } from "@/src/components/scenario/SceneEditor";

export default function ScenariosPage() {
  const { items, setItems } = useLocalCollection<Scenario>("cof.scenarios.v3", SEED_SCENARIOS);
  const { items: npcs } = useLocalCollection<Npc>("cof.npcs", SEED_NPCS);
  const { items: stock } = useLocalCollection<Item>("cof.items.v2", SEED_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "play">("play");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);

  const scenario = items.find((s) => s.id === selectedId) ?? null;
  const errors = scenario ? validateScenario(scenario) : [];
  const departId = scenario ? (scenario.chapitres[0]?.sceneDepartId ?? scenario.scenes[0]?.id) : undefined;
  const scene = scenario?.scenes.find((s) => s.id === (sceneId ?? departId)) ?? null;

  const updateScenario = (s: Scenario) => setItems((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  const createScenario = () => {
    const id = `scn-${Date.now().toString(36)}`;
    const s1 = `s-${Date.now().toString(36)}`;
    const fresh: Scenario = {
      id, titre: "Nouveau scénario", description: "", exemple: false,
      chapitres: [{ id: "ch1", titre: "Chapitre 1", sceneDepartId: s1 }],
      scenes: [{ id: s1, titre: "Scène 1", texteMJ: "", choix: [] }],
    };
    setItems((prev) => [...prev, fresh]);
    setSelectedId(id);
    setSceneId(s1);
    setMode("edit");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Scénarios ({items.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => scenario && exportJson(`${scenario.titre}.json`, scenario)} disabled={!scenario} className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-40">Export JSON</button>
          <button onClick={() => setItems(SEED_SCENARIOS)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm">Réinitialiser</button>
          <button onClick={createScenario} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Nouveau</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelectedId(s.id); setSceneId(null); setPlay(null); }}
            className={`px-3 py-1.5 rounded text-sm border ${selectedId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
          >
            {s.titre} {s.exemple && <span className="text-xs opacity-70">· ex</span>}
          </button>
        ))}
      </div>

      {!scenario && <p className="text-sm text-zinc-500">Sélectionnez un scénario ou créez-en un.</p>}

      {scenario && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setMode("play")} className={`px-4 py-2 rounded font-semibold ${mode === "play" ? "bg-amber-400 text-black" : "bg-zinc-800"}`}>Jouer</button>
            <button onClick={() => setMode("edit")} className={`px-4 py-2 rounded font-semibold ${mode === "edit" ? "bg-amber-400 text-black" : "bg-zinc-800"}`}>Préparer</button>
          </div>
          {errors.length > 0 && (
            <div className="rounded bg-red-950 border border-red-800 p-3 text-xs space-y-0.5">
              {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}

          {mode === "play" ? (
            <div className="space-y-3">
              {!play ? (
                <button onClick={() => setPlay(startPlay(scenario))} className="px-5 py-2.5 rounded bg-amber-400 text-black font-bold">Démarrer la partie</button>
              ) : (
                <>
                  <ScenarioPlay scenario={scenario} play={play} onPlay={setPlay} npcs={npcs} items={stock} />
                  <button onClick={() => setPlay(startPlay(scenario))} className="text-sm text-zinc-400 underline">Recommencer</button>
                </>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                <h3 className="font-bold text-sm uppercase text-zinc-400">Scènes ({scenario.scenes.length})</h3>
                {scenario.scenes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSceneId(s.id)}
                    className={`block w-full text-left px-3 py-2 rounded text-sm ${scene?.id === s.id ? "bg-amber-400/20 border border-amber-400/50" : "bg-zinc-950 border border-zinc-800"}`}
                  >
                    {s.titre}
                    <span className="block text-xs text-zinc-500">{s.choix.length} choix</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    const id = `s-${Date.now().toString(36)}`;
                    updateScenario({ ...scenario, scenes: [...scenario.scenes, { id, titre: `Scène ${scenario.scenes.length + 1}`, texteMJ: "", choix: [] }] });
                    setSceneId(id);
                  }}
                  className="text-sm px-3 py-1.5 rounded bg-zinc-800 w-full"
                >
                  + Ajouter une scène
                </button>
              </div>
              <div className="md:col-span-2">
                {scene ? (
                  <SceneEditor
                    scene={scene}
                    allScenes={scenario.scenes}
                    allNpcs={npcs}
                    allItems={stock}
                    onUpdate={(s) => updateScenario({ ...scenario, scenes: scenario.scenes.map((x) => (x.id === s.id ? s : x)) })}
                    onDelete={() => {
                      updateScenario({ ...scenario, scenes: scenario.scenes.filter((x) => x.id !== scene.id) });
                      setSceneId(null);
                    }}
                  />
                ) : (
                  <p className="text-sm text-zinc-500">Sélectionnez une scène.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
