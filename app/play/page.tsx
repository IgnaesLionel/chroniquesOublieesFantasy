"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCharacters, useNpcs, useScenarios, useSessions } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { pvTexteColor } from "@/src/lib/ui/pv";
import { classeFamille, familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";
import { usePlaySession } from "@/src/lib/store/usePlaySession";
import type { PlayState } from "@/src/lib/rules/scenario/types";
import { ensurePlayDefaults, gotoScene, startPlay } from "@/src/lib/rules/scenario/engine";
import { ensureSessionDefaults, progressOf } from "@/src/lib/rules/session/types";
import { nextScenario, prevScenario, setCurrent } from "@/src/lib/rules/session/engine";
import { ScenarioPlay } from "@/src/components/scenario/ScenarioPlay";
import { HorsCombatPanel } from "@/src/components/combat/HorsCombatPanel";
import { DiceRoller } from "@/src/components/dice/DiceRoller";

function PlayInner() {
  const searchParams = useSearchParams();
  const { items: characters, setItems: setCharacters } = useCharacters();
  const { items: scenarios } = useScenarios();
  const { items: npcs } = useNpcs();
  const { items: sessions, setItems: setSessions } = useSessions();
  const { catalogue: stock } = useCatalogueObjets();

  const [sessionId, setSessionId] = useState<string | null>(() => searchParams.get("session"));
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const { play, setPlay } = usePlaySession(scenarioId);

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const sessionBase = session ? ensureSessionDefaults(session) : null;

  // Playlist ordonnée (scénarios connus uniquement).
  const playlist = useMemo(
    () => (sessionBase ? sessionBase.scenarioIds.map((id) => scenarios.find((s) => s.id === id) ?? null).filter((s) => s !== null) : scenarios),
    [sessionBase, scenarios]
  );
  // Groupe de la table (références par id, PV partagés avec les fiches en V1).
  const groupe = useMemo(
    () => (sessionBase ? characters.filter((c) => sessionBase.characterIds.includes(c.id)) : characters),
    [sessionBase, characters]
  );
  const membresManquants = (sessionBase?.characterIds.length ?? 0) - groupe.length;
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null;
  const prog = sessionBase ? progressOf(sessionBase) : null;

  const demarrerSiAbsent = (id: string) => {
    const scn = scenarios.find((s) => s.id === id);
    if (!scn) return;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("cof.plays.v1") : null;
      const map = raw ? (JSON.parse(raw) as Record<string, PlayState>) : {};
      if (!map[id]) setPlay(startPlay(scn));
    } catch {
      setPlay(startPlay(scn));
    }
  };

  const choisir = (id: string) => {
    if (!scenarios.some((s) => s.id === id)) return;
    setScenarioId(id);
    demarrerSiAbsent(id);
  };

  const choisirSession = (id: string | null) => {
    setSessionId(id);
    if (!id) return;
    const ses = sessions.find((s) => s.id === id);
    if (!ses) return;
    const base = ensureSessionDefaults(ses);
    const connus = base.scenarioIds.filter((sid) => scenarios.some((s) => s.id === sid));
    const cible = connus.includes(base.currentScenarioId ?? "") ? base.currentScenarioId! : (connus[0] ?? null);
    if (cible) {
      setScenarioId(cible);
      demarrerSiAbsent(cible);
    } else {
      setScenarioId(null);
    }
  };

  const allerScenarioSession = (sid: string) => {
    if (!session || !sessionBase) return;
    if (!sessionBase.scenarioIds.includes(sid)) return;
    setSessions((prev) => prev.map((s) => (s.id === session.id ? setCurrent(s, sid) : s)));
    choisir(sid);
  };

  const bump = (id: string, d: number) =>
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pv: Math.max(0, Math.min(c.pvMax, c.pv + d)) } : c))
    );

  const prec = sessionBase ? prevScenario(sessionBase) : null;
  const suiv = sessionBase ? nextScenario(sessionBase) : null;

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
        <span className="text-sm text-zinc-400">Session :</span>
        <button
          onClick={() => choisirSession(null)}
          className={`px-3 py-1.5 rounded text-sm border ${!session ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
        >
          Sans session
        </button>
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => choisirSession(s.id)}
            className={`px-3 py-1.5 rounded text-sm border ${sessionId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
          >
            {s.nom}
          </button>
        ))}
        <Link href="/sessions" className="text-xs text-zinc-400 underline">Gérer les sessions</Link>
      </div>

      {session && prog && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 flex gap-2 flex-wrap items-center text-sm">
          <b>{session.nom}</b>
          <span className="text-xs text-zinc-500">Campagne {prog.termines}/{prog.total}</span>
          <span className="flex-1" />
          <button onClick={() => prec && allerScenarioSession(prec)} disabled={!prec} className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 disabled:opacity-30">← Précédent</button>
          <button onClick={() => suiv && allerScenarioSession(suiv)} disabled={!suiv} className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 disabled:opacity-30">Suivant →</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-zinc-400">Scénario :</span>
        {playlist.map((s) => (
          <button
            key={s.id}
            onClick={() => choisir(s.id)}
            className={`px-3 py-1.5 rounded text-sm border ${scenarioId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
          >
            {s.titre}
          </button>
        ))}
        {playlist.length === 0 && <span className="text-xs text-zinc-500">Playlist vide — ajoutez des scénarios dans Sessions.</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          {!scenario || !play ? (
            <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500 text-sm">
              Sélectionnez un scénario pour afficher la scène en cours.
            </div>
          ) : (
            <ScenarioPlay
              scenario={scenario}
              play={play}
              onPlay={setPlay}
              npcs={npcs}
              items={stock}
              onGoto={(id) => setPlay((p) => (p && scenario ? gotoScene(scenario, ensurePlayDefaults(p), id) : p))}
            />
          )}
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
            <h2 className="font-bold text-sm uppercase text-zinc-400">Groupe{session ? ` — ${session.nom}` : ""} ({groupe.length})</h2>
            {session && <p className="text-xs text-zinc-500">PV partagés avec les fiches (V1).</p>}
            {membresManquants > 0 && <p className="text-xs text-amber-400">{membresManquants} personnage(s) introuvable(s) — voir Sessions.</p>}
            {groupe.map((c) => (
              <div key={c.id} className={`flex items-center justify-between gap-2 text-sm py-1 border-b border-zinc-800/50 fam-rail ${classeFamille(familleDuProfil(c.profil || c.classe))}`}>
                <span className="flex-1">
                  <b>{c.nom}</b> <FamilleBadge famille={familleDuProfil(c.profil || c.classe)} className="mx-1" /> <span className={`font-mono font-bold ${pvTexteColor(c.pv, c.pvMax)}`}>{c.pv}/{c.pvMax}</span>
                  {c.pv === 0 && <span className="text-xs text-red-400 ml-1">KO</span>}
                </span>
                <span className="inline-flex gap-1">
                  <button onClick={() => bump(c.id, -5)} className="px-1.5 rounded bg-red-900 text-xs">−5</button>
                  <button onClick={() => bump(c.id, -1)} className="px-1.5 rounded bg-red-900 text-xs">−1</button>
                  <button onClick={() => bump(c.id, 5)} className="px-1.5 rounded bg-green-900 text-xs">+5</button>
                </span>
              </div>
            ))}
            {groupe.length === 0 && <p className="text-xs text-zinc-500">{session ? "Table sans personnages — voir Sessions." : "Aucun personnage."}</p>}
          </div>
          <HorsCombatPanel characters={characters} onUpdate={(next) => setCharacters(next)} />
          <DiceRoller compact />
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement de la partie…</p>}>
      <PlayInner />
    </Suspense>
  );
}
