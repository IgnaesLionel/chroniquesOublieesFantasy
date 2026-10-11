"use client";
import { useState } from "react";
import Link from "next/link";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_SCENARIOS } from "@/src/lib/data/scenarioSeeds";
import { SEED_ITEMS, SEED_NPCS } from "@/src/lib/data/worldSeeds";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import type { Character } from "@/src/lib/rules/types";
import type { Npc } from "@/src/lib/rules/world/types";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { startPlay } from "@/src/lib/rules/scenario/engine";
import { ScenarioPlay } from "@/src/components/scenario/ScenarioPlay";
import { HorsCombatPanel } from "@/src/components/combat/HorsCombatPanel";
import { DiceRoller } from "@/src/components/dice/DiceRoller";

function pvColor(pv: number, max: number) {
  if (max === 0) return "text-zinc-400";
  const r = pv / max;
  if (r > 0.5) return "text-green-400";
  if (r > 0.25) return "text-amber-400";
  return "text-red-400";
}

export default function PlayPage() {
  const { items: characters, setItems: setCharacters } = useLocalCollection<Character>("cof.characters.v2", SEED_CHARACTERS);
  const { items: scenarios } = useLocalCollection<Scenario>("cof.scenarios.v3", SEED_SCENARIOS);
  const { items: npcs } = useLocalCollection<Npc>("cof.npcs", SEED_NPCS);
  const stock = SEED_ITEMS;

  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null;

  const bump = (id: string, d: number) =>
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pv: Math.max(0, Math.min(c.pvMax, c.pv + d)) } : c))
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">▶ Partie <span className="text-sm font-normal text-zinc-500">— vue MJ épurée</span></h1>
        <div className="flex gap-2">
          <Link href="/combat" className="px-4 py-2 rounded bg-red-700 font-bold text-sm">Combat</Link>
          <Link href="/scenarios" className="px-4 py-2 rounded bg-zinc-800 text-sm">Préparer</Link>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-zinc-400">Scénario :</span>
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => { setScenarioId(s.id); setPlay(startPlay(s)); }}
            className={`px-3 py-1.5 rounded text-sm border ${scenarioId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
          >
            {s.titre}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          {!scenario || !play ? (
            <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500 text-sm">
              Sélectionnez un scénario pour afficher la scène en cours.
            </div>
          ) : (
            <ScenarioPlay scenario={scenario} play={play} onPlay={setPlay} npcs={npcs} items={stock} />
          )}
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
            <h2 className="font-bold text-sm uppercase text-zinc-400">Groupe</h2>
            {characters.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-zinc-800/50">
                <span className="flex-1">
                  <b>{c.nom}</b> <span className={`font-mono font-bold ${pvColor(c.pv, c.pvMax)}`}>{c.pv}/{c.pvMax}</span>
                  {c.pv === 0 && <span className="text-xs text-red-400 ml-1">KO</span>}
                </span>
                <span className="inline-flex gap-1">
                  <button onClick={() => bump(c.id, -5)} className="px-1.5 rounded bg-red-900 text-xs">−5</button>
                  <button onClick={() => bump(c.id, -1)} className="px-1.5 rounded bg-red-900 text-xs">−1</button>
                  <button onClick={() => bump(c.id, 5)} className="px-1.5 rounded bg-green-900 text-xs">+5</button>
                </span>
              </div>
            ))}
          </div>
          <HorsCombatPanel characters={characters} onUpdate={(next) => setCharacters(next)} />
          <DiceRoller compact />
        </div>
      </div>
    </div>
  );
}
