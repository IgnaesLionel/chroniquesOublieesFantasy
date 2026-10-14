"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { sessionSchema } from "@/src/lib/data/validation";
import { useCharacters, useScenarios, useSessions } from "@/src/lib/store/collections";
import { exportJson } from "@/src/lib/store/repository";
import { readJsonFile } from "@/src/lib/store/backup";
import type { Session } from "@/src/lib/rules/session/types";
import { ensureSessionDefaults, progressOf } from "@/src/lib/rules/session/types";
import {
  moveScenario,
  newSession,
  nextScenario,
  prevScenario,
  setCurrent,
  setPlaylist,
  toggleMembre,
  toggleTermine,
  validateSession,
} from "@/src/lib/rules/session/engine";
import { resumeScenario } from "@/src/lib/rules/scenario/engine";
import { pvTexteColor } from "@/src/lib/ui/pv";

export default function SessionsPage() {
  const { items, setItems } = useSessions();
  const { items: characters } = useCharacters();
  const { items: scenarios } = useScenarios();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const session = items.find((s) => s.id === selectedId) ?? null;
  const refs = useMemo(
    () => ({ characters: characters.map((c) => c.id), scenarios: scenarios.map((s) => s.id) }),
    [characters, scenarios]
  );
  const avertissements = useMemo(
    () => (session ? validateSession(session, refs) : []),
    [session, refs]
  );
  const playlist = useMemo(() => {
    if (!session) return [];
    return ensureSessionDefaults(session).scenarioIds.map((id) => scenarios.find((s) => s.id === id) ?? null);
  }, [session, scenarios]);
  const membres = useMemo(() => {
    if (!session) return [];
    return ensureSessionDefaults(session).characterIds.map((id) => characters.find((c) => c.id === id) ?? null);
  }, [session, characters]);
  const ajoutables = useMemo(
    () => scenarios.filter((s) => !(session && ensureSessionDefaults(session).scenarioIds.includes(s.id))),
    [scenarios, session]
  );

  const updateSession = (s: Session) => setItems((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  const create = () => {
    const s = newSession(`Session ${items.length + 1}`);
    setItems((prev) => [...prev, s]);
    setSelectedId(s.id);
  };

  const duplicate = () => {
    if (!session) return;
    const base = ensureSessionDefaults(session);
    const copy: Session = {
      ...base,
      id: `ses-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
      nom: `${base.nom} (copie)`,
      updatedAt: new Date().toISOString(),
    };
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const remove = () => {
    if (!session || !confirm(`Supprimer « ${session.nom} » ? Les personnages et scénarios sont conservés.`)) return;
    setItems((prev) => prev.filter((x) => x.id !== session.id));
    setSelectedId(null);
  };

  const importSession = async (f: File) => {
    try {
      const raw = await readJsonFile(f);
      const parsed = sessionSchema.safeParse(raw);
      if (!parsed.success) {
        alert(`Import rejeté : ${parsed.error.issues[0]?.message ?? "session invalide"}.`);
        return;
      }
      const scn = ensureSessionDefaults(parsed.data as Session);
      setItems((prev) => (prev.some((x) => x.id === scn.id) ? prev.map((x) => (x.id === scn.id ? scn : x)) : [...prev, scn]));
      setSelectedId(scn.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import impossible.");
    }
  };

  const prog = session ? progressOf(ensureSessionDefaults(session)) : null;
  const suivant = session ? nextScenario(session) : null;
  const precedent = session ? prevScenario(session) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Sessions ({items.length})</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => session && exportJson(`${session.nom}.json`, session)} disabled={!session} className="btn-dark text-sm disabled:opacity-40">Export JSON</button>
          <label className="btn-dark text-sm cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importSession(f); e.target.value = ""; }} />
          </label>
          <button onClick={create} className="btn-gold text-sm">+ Nouvelle</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {items.map((s) => {
          const p = progressOf(ensureSessionDefaults(s));
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`px-3 py-1.5 rounded text-sm border ${selectedId === s.id ? "bg-amber-400 text-black font-bold" : "bg-zinc-900 border-zinc-800"}`}
            >
              {s.nom}
              <span className="block text-xs opacity-70">
                {s.characterIds.length} pers. · {p.termines}/{p.total} scén.
              </span>
            </button>
          );
        })}
      </div>

      {!session && <p className="text-sm text-zinc-500">Sélectionnez une session, créez-en une, ou importez un JSON.</p>}

      {session && (
        <div className="space-y-3">
          <div className="panel p-4 space-y-2">
            <label className="block text-sm">Nom de la table
              <input value={session.nom} onChange={(e) => updateSession({ ...ensureSessionDefaults(session), nom: e.target.value })} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 font-bold" />
            </label>
            <label className="block text-sm">Description (facultatif)
              <textarea value={session.description ?? ""} onChange={(e) => updateSession({ ...ensureSessionDefaults(session), description: e.target.value })} rows={1} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-sm" />
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              {prog && (
                <span className="text-xs text-zinc-400">
                  Campagne : {prog.termines}/{prog.total} scénario(s) terminé(s)
                  {prog.indexCourant >= 0 ? ` · en cours : n°${prog.indexCourant + 1}` : " · aucun scénario courant"}
                </span>
              )}
              <span className="flex-1" />
              <Link href={session.currentScenarioId ? `/play?session=${session.id}` : "/play"} className="btn-gold text-sm">Jouer</Link>
              <button onClick={duplicate} className="text-xs px-3 py-1.5 rounded bg-zinc-800">Dupliquer</button>
              <button onClick={remove} className="text-xs px-3 py-1.5 rounded bg-red-900">Supprimer</button>
            </div>
          </div>

          {avertissements.length > 0 && (
            <div className="rounded bg-amber-950/60 border border-amber-800 p-3 text-xs space-y-0.5">
              {avertissements.map((a, i) => <div key={i}>{a}</div>)}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-3 items-start">
            <div className="panel p-3 space-y-2">
              <h3 className="text-xs uppercase font-bold text-zinc-400">Personnages ({session.characterIds.length})</h3>
              {characters.length === 0 && <p className="text-xs text-zinc-500">Aucun personnage. Créez-en un dans l{"'"}onglet Personnages.</p>}
              <div className="space-y-1.5 max-h-[50vh] overflow-auto">
                {characters.map((c) => {
                  const inTable = ensureSessionDefaults(session).characterIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-2 text-sm rounded border px-2.5 py-2 cursor-pointer ${inTable ? "bg-amber-400/10 border-amber-400/60" : "bg-zinc-950 border-zinc-800"}`}>
                      <input type="checkbox" checked={inTable} onChange={() => updateSession(toggleMembre(session, c.id))} />
                      <span className="flex-1"><b>{c.nom}</b> <span className={`font-mono text-xs font-bold ${pvTexteColor(c.pv, c.pvMax)}`}>{c.pv}/{c.pvMax}</span></span>
                    </label>
                  );
                })}
              </div>
              {membres.some((m) => m === null) && (
                <p className="text-xs text-amber-400">Un personnage de la table est introuvable (fiche supprimée). Décochez-le via la validation ou recréez la fiche.</p>
              )}
            </div>

            <div className="panel p-3 space-y-2">
              <h3 className="text-xs uppercase font-bold text-zinc-400">Playlist — ordre de campagne ({playlist.length})</h3>
              {precedent && <p className="text-xs text-zinc-500">Précédent : {scenarios.find((s) => s.id === precedent)?.titre}</p>}
              <div className="space-y-1.5">
                {playlist.map((scn, i) => {
                  if (!scn) {
                    const missingId = ensureSessionDefaults(session).scenarioIds[i];
                    return (
                      <div key={missingId} className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm flex items-center gap-2">
                        <span className="flex-1">Scénario introuvable ({missingId})</span>
                        <button onClick={() => updateSession(setPlaylist(session, ensureSessionDefaults(session).scenarioIds.filter((id) => id !== missingId)))} className="text-xs px-2 py-1 rounded bg-zinc-800">Retirer</button>
                      </div>
                    );
                  }
                  const resume = resumeScenario(scn);
                  const courant = ensureSessionDefaults(session).currentScenarioId === scn.id;
                  const termine = (ensureSessionDefaults(session).terminees ?? []).includes(scn.id);
                  return (
                    <div key={scn.id} className={`rounded border px-3 py-2 ${courant ? "bg-amber-400/10 border-amber-400/60" : "bg-zinc-950 border-zinc-800"}`}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-zinc-500 font-mono">n°{i + 1}</span>
                        <span className="flex-1 font-semibold">{scn.titre}</span>
                        <button onClick={() => updateSession(moveScenario(session, scn.id, -1))} disabled={i === 0} className="text-xs px-2 py-0.5 rounded bg-zinc-800 disabled:opacity-30" title="Monter">↑</button>
                        <button onClick={() => updateSession(moveScenario(session, scn.id, 1))} disabled={i === playlist.length - 1} className="text-xs px-2 py-0.5 rounded bg-zinc-800 disabled:opacity-30" title="Descendre">↓</button>
                        <button onClick={() => updateSession(setPlaylist(session, ensureSessionDefaults(session).scenarioIds.filter((id) => id !== scn.id)))} className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900" title="Retirer de la playlist">✕</button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                        <span className="text-zinc-500">{resume.total} scènes · {resume.label}{resume.hubs > 0 ? ` · ${resume.hubs} embranchement(s)` : ""}{resume.fins > 0 ? ` · ${resume.fins} fin(s)` : ""}</span>
                        <span className="flex-1" />
                        <button onClick={() => updateSession(setCurrent(session, scn.id))} className={`px-2 py-0.5 rounded border ${courant ? "bg-amber-400 text-black font-bold" : "bg-zinc-800 border-zinc-700"}`}>
                          {courant ? "En cours" : "Définir en cours"}
                        </button>
                        <button onClick={() => updateSession(toggleTermine(session, scn.id))} className={`px-2 py-0.5 rounded border ${termine ? "bg-green-900/60 border-green-700 text-green-200" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                          {termine ? "Terminé" : "Marquer terminé"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {playlist.length === 0 && <p className="text-xs text-zinc-500">Playlist vide — ajoutez des scénarios ci-dessous.</p>}
              </div>
              {suivant && <p className="text-xs text-zinc-500">Suivant : {scenarios.find((s) => s.id === suivant)?.titre}</p>}
              {ajoutables.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-zinc-400 mb-1">Ajouter un scénario</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ajoutables.map((s) => (
                      <button key={s.id} onClick={() => updateSession(setPlaylist(session, [...ensureSessionDefaults(session).scenarioIds, s.id]))} className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">
                        + {s.titre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel p-3">
            <h3 className="text-xs uppercase font-bold text-zinc-400 mb-1.5">Notes de campagne</h3>
            <textarea
              defaultValue={ensureSessionDefaults(session).notes ?? ""}
              key={session.id}
              onBlur={(e) => updateSession({ ...ensureSessionDefaults(session), notes: e.target.value })}
              rows={3}
              placeholder="Fil rouge, décisions inter-scénarios, sorts à retenir…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
