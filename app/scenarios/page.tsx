"use client";
import { useEffect, useMemo, useState } from "react";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { scenarioSchema } from "@/src/lib/data/validation";
import { useNpcs, useScenarios } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { usePlaySession } from "@/src/lib/store/usePlaySession";
import { exportJson } from "@/src/lib/store/repository";
import { readJsonFile } from "@/src/lib/store/backup";
import type { Scenario } from "@/src/lib/rules/scenario/types";
import { ensurePlayDefaults, getSceneSafe, gotoScene, orphanScenes, setFlag, setNotes, setSceneNote, startPlay, toggleIndice, toggleTerminee, validateScenario } from "@/src/lib/rules/scenario/engine";
import { ScenarioPlay } from "@/src/components/scenario/ScenarioPlay";
import { SceneEditor } from "@/src/components/scenario/SceneEditor";
import { SceneList } from "@/src/components/scenario/SceneList";
import { SceneFiche } from "@/src/components/scenario/SceneFiche";
import { ScenarioGraph } from "@/src/components/scenario/ScenarioGraph";
import { MjPanel } from "@/src/components/scenario/MjPanel";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export default function ScenariosPage() {
  const { items, setItems } = useScenarios();
  const { items: npcs } = useNpcs();
  const { catalogue: stock } = useCatalogueObjets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"play" | "edit">("play");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [view, setView] = useState<"fiche" | "graphe">("fiche");
  const { play: storedPlay, setPlay: setStoredPlay } = usePlaySession(selectedId);

  const scenario = items.find((s) => s.id === selectedId) ?? null;
  const errors = useMemo(() => (scenario ? validateScenario(scenario) : []), [scenario]);
  const orphelines = useMemo(() => (scenario ? orphanScenes(scenario) : []), [scenario]);
  const departId = scenario ? (scenario.chapitres[0]?.sceneDepartId ?? scenario.scenes[0]?.id) : undefined;

  // Scène d'édition : sélection manuelle, sinon départ.
  const editScene = scenario?.scenes.find((s) => s.id === (sceneId ?? departId)) ?? null;
  // Scène de partie : position réelle de la partie, sinon sélection / départ.
  const playSceneId = storedPlay?.sceneId ?? sceneId ?? departId ?? null;

  useEffect(() => {
    if (scenario && storedPlay && storedPlay.scenarioId !== scenario.id) setStoredPlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const updateScenario = (s: Scenario) => setItems((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  const createScenario = () => {
    const id = uid("scn");
    const s1 = uid("s");
    const fresh: Scenario = {
      id, titre: "Nouveau scénario", description: "", exemple: false,
      chapitres: [{ id: "ch1", titre: "Chapitre 1", sceneDepartId: s1 }],
      scenes: [{ id: s1, titre: "Scène 1", type: "narration", texteMJ: "", narration: "", choix: [] }],
    };
    setItems((prev) => [...prev, fresh]);
    setSelectedId(id);
    setSceneId(s1);
    setMode("edit");
    setStoredPlay(null);
  };

  const duplicateScenario = () => {
    if (!scenario) return;
    const id = uid("scn");
    const idMap = new Map(scenario.scenes.map((s) => [s.id, uid("s")]));
    const copy: Scenario = {
      ...scenario,
      id,
      titre: `${scenario.titre} (copie)`,
      exemple: false,
      chapitres: scenario.chapitres.map((c) => ({ ...c, id: uid("ch"), sceneDepartId: idMap.get(c.sceneDepartId) ?? c.sceneDepartId })),
      scenes: scenario.scenes.map((s) => ({
        ...s,
        id: idMap.get(s.id)!,
        choix: s.choix.map((c) => ({ ...c, id: uid("c"), versSceneId: idMap.get(c.versSceneId) ?? c.versSceneId })),
      })),
    };
    setItems((prev) => [...prev, copy]);
    setSelectedId(id);
    setSceneId(copy.scenes[0]?.id ?? null);
  };

  const deleteScenario = () => {
    if (!scenario || !confirm(`Supprimer « ${scenario.titre} » ?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== scenario.id));
    setSelectedId(null);
    setSceneId(null);
    setStoredPlay(null);
  };

  const addScene = () => {
    if (!scenario) return;
    const id = uid("s");
    updateScenario({ ...scenario, scenes: [...scenario.scenes, { id, titre: `Scène ${scenario.scenes.length + 1}`, type: "narration", texteMJ: "", choix: [] }] });
    setSceneId(id);
  };

  const moveScene = (id: string, dir: -1 | 1) => {
    if (!scenario) return;
    const i = scenario.scenes.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= scenario.scenes.length) return;
    const next = [...scenario.scenes];
    [next[i], next[j]] = [next[j], next[i]];
    updateScenario({ ...scenario, scenes: next });
  };

  const importScenario = async (f: File) => {
    try {
      const raw = await readJsonFile(f);
      const parsed = scenarioSchema.safeParse(raw);
      if (!parsed.success) {
        alert(`Import rejeté : ${parsed.error.issues[0]?.message ?? "scénario invalide"}.`);
        return;
      }
      const scn = { ...parsed.data, exemple: false } as Scenario;
      setItems((prev) => (prev.some((x) => x.id === scn.id) ? prev.map((x) => (x.id === scn.id ? scn : x)) : [...prev, scn]));
      setSelectedId(scn.id);
      setSceneId(scn.scenes[0]?.id ?? null);
      setStoredPlay(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  const start = () => {
    if (!scenario) return;
    setStoredPlay(startPlay(scenario));
  };

  const gotoPlay = (id: string) => {
    if (!scenario || !storedPlay) return;
    if (!getSceneSafe(scenario, id)) return;
    setStoredPlay(gotoScene(scenario, ensurePlayDefaults(storedPlay), id));
    setSceneId(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Scénarios ({items.length})</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => scenario && exportJson(`${scenario.titre}.json`, scenario)} disabled={!scenario} className="btn-dark text-sm disabled:opacity-40">Export JSON</button>
          <label className="btn-dark text-sm cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importScenario(f); e.target.value = ""; }} />
          </label>
          <button onClick={() => { setItems(SEED_SCENARIOS); setSelectedId(null); setSceneId(null); setStoredPlay(null); }} className="btn-dark text-sm">Réinitialiser</button>
          <button onClick={createScenario} className="btn-gold text-sm">+ Nouveau</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelectedId(s.id); setSceneId(null); }}
            className={`px-3 py-1.5 rounded text-sm border ${selectedId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
          >
            {s.titre} {s.exemple && <span className="text-xs opacity-70">· ex</span>}
          </button>
        ))}
      </div>

      {!scenario && <p className="text-sm text-zinc-500">Sélectionnez un scénario, créez-en un, ou importez un JSON.</p>}

      {scenario && (
        <div className="space-y-3">
          {/* Éditeur de scénario : titre / description / départ / actions */}
          <div className="panel p-4 space-y-2">
            <div className="grid md:grid-cols-[1fr_220px] gap-2">
              <label className="block text-sm">Titre du scénario
                <input value={scenario.titre} onChange={(e) => updateScenario({ ...scenario, titre: e.target.value })} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 font-bold" />
              </label>
              <label className="block text-sm">Scène de départ
                <select
                  value={departId ?? ""}
                  onChange={(e) => updateScenario({ ...scenario, chapitres: [{ ...(scenario.chapitres[0] ?? { id: "ch1", titre: "Chapitre 1" }), sceneDepartId: e.target.value }] })}
                  className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm"
                >
                  {scenario.scenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.titre}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">Description (facultatif)
              <textarea value={scenario.description ?? ""} onChange={(e) => updateScenario({ ...scenario, description: e.target.value })} rows={1} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-sm" />
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => setMode("play")} className={`px-4 py-2 rounded font-semibold text-sm ${mode === "play" ? "bg-amber-400 text-black" : "bg-zinc-800"}`}>Jouer</button>
              <button onClick={() => setMode("edit")} className={`px-4 py-2 rounded font-semibold text-sm ${mode === "edit" ? "bg-amber-400 text-black" : "bg-zinc-800"}`}>Éditer</button>
              <span className="w-2" />
              <button onClick={() => setView("fiche")} className={`px-3 py-1.5 rounded text-sm border ${view === "fiche" ? "bg-zinc-100 text-black font-bold" : "bg-zinc-900 border-zinc-700"}`}>Liste + fiche</button>
              <button onClick={() => setView("graphe")} className={`px-3 py-1.5 rounded text-sm border ${view === "graphe" ? "bg-zinc-100 text-black font-bold" : "bg-zinc-900 border-zinc-700"}`}>Graphe</button>
              <span className="flex-1" />
              <button onClick={duplicateScenario} className="text-xs px-3 py-1.5 rounded bg-zinc-800">Dupliquer</button>
              <button onClick={deleteScenario} className="text-xs px-3 py-1.5 rounded bg-red-900">Supprimer</button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="rounded bg-red-950 border border-red-800 p-3 text-xs space-y-0.5">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {orphelines.length > 0 && (
            <p className="text-xs text-zinc-500">Scènes isolées (atteignables uniquement en saut libre) : {orphelines.map((s) => s.titre).join(" · ")}</p>
          )}

          {mode === "play" ? (
            <div className="space-y-3">
              {!storedPlay ? (
                <div className="panel p-6 text-center space-y-3">
                  <p className="text-sm text-zinc-400">Aucune partie en cours — l{"'"}état sera sauvegardé et restauré automatiquement.</p>
                  <button onClick={start} className="btn-gold">Démarrer la partie</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className="text-xs text-zinc-500">
                      Partie sauvegardée · {(storedPlay.visitees ?? storedPlay.historique).length} scène(s) visitée(s) · {(storedPlay.indices ?? []).length} indice(s)
                    </span>
                    <span className="flex-1" />
                    <button onClick={start} className="text-xs text-zinc-400 underline">Recommencer (réinitialise le suivi)</button>
                  </div>
                  {/* 3 zones : liste / contenu / outils MJ */}
                  <div className="grid lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-3 items-start">
                    <div className="panel p-3">
                      <h3 className="text-xs uppercase font-bold text-zinc-400 mb-2">Scènes ({scenario.scenes.length})</h3>
                      <SceneList scenes={scenario.scenes} play={storedPlay} selectedId={playSceneId} onSelect={gotoPlay} onMove={moveScene} onAdd={addScene} />
                    </div>
                    <div className="space-y-3 min-w-0">
                      {view === "graphe" ? (
                        <ScenarioGraph scenario={scenario} play={storedPlay} currentId={playSceneId} onSelect={gotoPlay} />
                      ) : playSceneId ? (
                        <SceneFiche scenario={scenario} sceneId={playSceneId} play={storedPlay} onGoto={gotoPlay} />
                      ) : (
                        <p className="text-sm text-zinc-500">Sélectionnez une scène.</p>
                      )}
                      <ScenarioPlay scenario={scenario} play={storedPlay} onPlay={setStoredPlay} npcs={npcs} items={stock} onGoto={gotoPlay} />
                    </div>
                    <div className="lg:sticky lg:top-16">
                      {playSceneId && (
                        <MjPanel
                          scenario={scenario}
                          sceneId={playSceneId}
                          play={storedPlay}
                          npcs={npcs}
                          items={stock}
                          onToggleDone={(id) => setStoredPlay((p) => (p ? toggleTerminee(p, id) : p))}
                          onToggleFlag={(f) => setStoredPlay((p) => (p ? setFlag(p, f, !p.flags[f]) : p))}
                          onAddFlag={(f) => setStoredPlay((p) => (p ? setFlag(p, f, true) : p))}
                          onToggleIndice={(ix) => setStoredPlay((p) => (p ? toggleIndice(p, ix) : p))}
                          onSceneNote={(id, n) => setStoredPlay((p) => (p ? setSceneNote(p, id, n) : p))}
                          onGlobalNotes={(n) => setStoredPlay((p) => (p ? setNotes(p, n) : p))}
                          onEdit={() => { setSceneId(playSceneId); setMode("edit"); setView("fiche"); }}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-3 items-start">
              <div className="panel p-3">
                <h3 className="text-xs uppercase font-bold text-zinc-400 mb-2">Scènes ({scenario.scenes.length})</h3>
                <SceneList scenes={scenario.scenes} play={storedPlay} selectedId={editScene?.id ?? null} onSelect={setSceneId} onMove={moveScene} onAdd={addScene} />
              </div>
              <div className="space-y-3 min-w-0">
                {view === "graphe" ? (
                  <ScenarioGraph scenario={scenario} play={storedPlay} currentId={editScene?.id ?? null} onSelect={setSceneId} />
                ) : editScene ? (
                  <SceneEditor
                    scene={editScene}
                    allScenes={scenario.scenes}
                    allNpcs={npcs}
                    allItems={stock}
                    onUpdate={(s) => updateScenario({ ...scenario, scenes: scenario.scenes.map((x) => (x.id === s.id ? s : x)) })}
                    onDelete={() => {
                      updateScenario({ ...scenario, scenes: scenario.scenes.filter((x) => x.id !== editScene.id) });
                      setSceneId(null);
                    }}
                  />
                ) : (
                  <p className="text-sm text-zinc-500">Sélectionnez une scène.</p>
                )}
              </div>
              <div className="panel p-3 space-y-2 lg:sticky lg:top-16">
                <h3 className="text-xs uppercase font-bold text-zinc-400">Aperçu + contrôle</h3>
                {editScene ? (
                  <SceneFiche scenario={scenario} sceneId={editScene.id} play={storedPlay} onGoto={setSceneId} />
                ) : (
                  <p className="text-xs text-zinc-500">Aucune scène sélectionnée.</p>
                )}
                <button onClick={() => setMode("play")} className="w-full text-sm px-3 py-2 rounded bg-zinc-800">Retour en partie</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
