"use client";

import { useMemo, useState } from "react";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import type { Scenario } from "@/src/lib/rules/scenario/types";
import type { Session } from "@/src/lib/rules/session/types";
import type {
  Faction,
  NpcGen,
  NpcPlacement,
  NpcStatBlock,
  ReferenceEntry,
  ReferenceTable,
} from "@/src/lib/npcgen/types";
import { estimerCombat, validerPnj } from "@/src/lib/npcgen/engine";
import { ouvrirImpressionPnj } from "@/src/lib/npcgen/statblock";
import { exportJson } from "@/src/lib/store/repository";
import { NpcFiche } from "@/src/components/npcgen/NpcFiche";

interface Props {
  saved: NpcGen[];
  setSaved: React.Dispatch<React.SetStateAction<NpcGen[]>>;
  statBlocks: NpcStatBlock[];
  setStatBlocks: React.Dispatch<React.SetStateAction<NpcStatBlock[]>>;
  placements: NpcPlacement[];
  setPlacements: React.Dispatch<React.SetStateAction<NpcPlacement[]>>;
  tables: ReferenceTable[];
  entries: ReferenceEntry[];
  factions: Faction[];
  monsters: MonsterTemplate[];
  scenarios: Scenario[];
  sessions: Session[];
}

const champ =
  "w-full bg-zinc-950/70 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";
const bouton = "px-3 py-1.5 rounded text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

function blocDe(npc: NpcGen, statBlocks: NpcStatBlock[]): NpcStatBlock | undefined {
  return statBlocks.find((b) => b.npcId === npc.id) ?? statBlocks.find((b) => b.id === npc.statBlockId);
}

function copieNpc(npc: NpcGen): NpcGen {
  const maintenant = new Date().toISOString();
  return {
    ...structuredClone(npc),
    id: `npcgen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    nom: `${npc.nom} (copie)`,
    seed: `${npc.seed || "copie"}-copie`,
    createdAt: maintenant,
    updatedAt: maintenant,
    statBlockId: undefined,
  };
}

export function NpcLibrary({
  saved,
  setSaved,
  statBlocks,
  setStatBlocks,
  placements,
  setPlacements,
  tables,
  entries,
  factions,
  monsters,
  scenarios,
  sessions,
}: Props) {
  const [recherche, setRecherche] = useState("");
  const [importance, setImportance] = useState("");
  const [factionId, setFactionId] = useState("");
  const [tri, setTri] = useState("recent");
  const [edition, setEdition] = useState<NpcGen | null>(null);
  const [blocEdition, setBlocEdition] = useState<NpcStatBlock | undefined>(undefined);
  const [placementsPour, setPlacementsPour] = useState<NpcGen | null>(null);
  const [message, setMessage] = useState("");

  const importances = useMemo(
    () => [...new Set(saved.map((n) => n.importance))].sort(),
    [saved]
  );
  const tags = useMemo(
    () => [...new Set(saved.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "fr")),
    [saved]
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const resultat = saved.filter((n) => {
      if (importance && n.importance !== importance) return false;
      if (factionId && n.factionId !== factionId) return false;
      if (!q) return true;
      return [
        n.nom,
        n.prenom,
        n.nomFamille,
        n.profession,
        n.description,
        n.factionNom,
        n.lieu,
        n.roleplay.accroche,
        n.motivations.secret,
        ...n.tags,
      ].some((v) => (v ?? "").toLowerCase().includes(q));
    });
    if (tri === "nom") return resultat.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    if (tri === "importance") {
      const ordre = { majeur: 0, important: 1, secondaire: 2, figuration: 3 };
      return resultat.sort((a, b) => ordre[a.importance] - ordre[b.importance] || a.nom.localeCompare(b.nom, "fr"));
    }
    return resultat.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [saved, recherche, importance, factionId, tri]);

  const ouvrirEdition = (npc: NpcGen) => {
    setMessage("");
    setEdition(structuredClone(npc));
    setBlocEdition(blocDe(npc, statBlocks));
  };

  const sauverEdition = () => {
    if (!edition) return;
    const maintenant = new Date().toISOString();
    const npc = { ...edition, updatedAt: maintenant, statBlockId: blocEdition?.id };
    setSaved((prev) => prev.map((n) => (n.id === npc.id ? npc : n)));
    if (blocEdition) {
      const bloc = { ...blocEdition, npcId: npc.id, updatedAt: maintenant };
      setStatBlocks((prev) => {
        const existe = prev.some((b) => b.id === bloc.id);
        return existe ? prev.map((b) => (b.id === bloc.id ? bloc : b)) : [...prev, bloc];
      });
    } else {
      setStatBlocks((prev) => prev.filter((b) => b.npcId !== npc.id));
    }
    setEdition(null);
    setBlocEdition(undefined);
    setMessage(`${npc.nom} mis à jour.`);
  };

  const dupliquer = (npc: NpcGen) => {
    const copie = copieNpc(npc);
    const bloc = blocDe(npc, statBlocks);
    if (bloc) {
      const idBloc = `stat-${copie.id}`;
      copie.statBlockId = idBloc;
      setStatBlocks((prev) => [
        ...prev,
        { ...structuredClone(bloc), id: idBloc, npcId: copie.id, updatedAt: new Date().toISOString() },
      ]);
    }
    setSaved((prev) => [...prev, copie]);
    setMessage(`${npc.nom} dupliqué.`);
  };

  const supprimer = (npc: NpcGen) => {
    if (!confirm(`Supprimer définitivement « ${npc.nom} » ?`)) return;
    setSaved((prev) => prev.filter((n) => n.id !== npc.id));
    setStatBlocks((prev) => prev.filter((b) => b.npcId !== npc.id));
    setPlacements((prev) => prev.filter((p) => p.npcId !== npc.id));
  };

  const exporter = (npc: NpcGen) => {
    exportJson(`pnj-${npc.nom || "fiche"}.json`, {
      npc,
      statBlock: blocDe(npc, statBlocks),
      placements: placements.filter((p) => p.npcId === npc.id),
    });
  };

  const creerEstimation = () => {
    if (!edition) return;
    const warnings: string[] = [];
    setBlocEdition(estimerCombat(edition, "moyen", { tables, entries, factions }, warnings));
  };

  const problemesEdition = useMemo(
    () => (edition ? validerPnj(edition, tables, entries) : []),
    [edition, tables, entries]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bronze-700/60 bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-gold-300">Bibliothèque de PNJ</h2>
            <p className="text-sm text-zinc-400">{saved.length} fiche(s) persistée(s) · recherche, tri et associations.</p>
          </div>
          <button type="button" onClick={() => exportJson("bibliotheque-pnj.json", { npcs: saved, statBlocks, placements })} className={bouton}>
            Exporter toute la bibliothèque
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, métier, secret, tag…" className={champ} />
          <select value={importance} onChange={(e) => setImportance(e.target.value)} className={champ}>
            <option value="">Toutes importances</option>
            {importances.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={factionId} onChange={(e) => setFactionId(e.target.value)} className={champ}>
            <option value="">Toutes factions</option>
            {factions.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value)} className={champ}>
            <option value="recent">Plus récents</option>
            <option value="nom">Nom (A-Z)</option>
            <option value="importance">Importance</option>
          </select>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 24).map((tag) => (
              <button key={tag} type="button" onClick={() => setRecherche(tag === recherche ? "" : tag)} className={`text-[11px] px-2 py-0.5 rounded-full border ${recherche === tag ? "border-amber-500 text-amber-200" : "border-zinc-700 text-zinc-400"}`}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {message && <p className="text-sm text-emerald-300">{message}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtres.map((npc) => {
          const bloc = blocDe(npc, statBlocks);
          return (
            <article key={npc.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-zinc-100 truncate">{npc.nom}</h3>
                  <p className="text-xs text-zinc-400">
                    {npc.profession || "Sans métier"} · {npc.espece} · {npc.factionNom || "sans faction"}
                  </p>
                  <p className="text-[10px] text-zinc-600">{npc.lieu || "lieu libre"} · {npc.importance}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 shrink-0">
                  <button type="button" onClick={() => ouvrirEdition(npc)} className={bouton}>Ouvrir</button>
                  <button type="button" onClick={() => dupliquer(npc)} className={bouton}>Copier</button>
                  <button type="button" onClick={() => setPlacementsPour(npc)} className={bouton}>Placer</button>
                  <button type="button" onClick={() => exporter(npc)} className={bouton}>JSON</button>
                  <button type="button" onClick={() => ouvrirImpressionPnj(npc, bloc, npc.factionNom)} className={bouton}>Imprimer</button>
                  <button type="button" onClick={() => supprimer(npc)} className="px-2 py-1 rounded text-xs bg-zinc-800 text-red-300">✕</button>
                </div>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-3">{npc.description}</p>
              <p className="text-xs text-zinc-400"><b>Accroche :</b> {npc.roleplay.accroche || "—"}</p>
              <p className="text-xs text-red-300"><b>Secret MJ :</b> {npc.motivations.secret || "—"}</p>
              <div className="flex flex-wrap gap-1">
                {npc.tags.slice(0, 10).map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{tag}</span>)}
                {bloc && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-700/40">{bloc.source === "bestiaire" ? "Bestiaire" : "Combat estimé"}</span>}
              </div>
            </article>
          );
        })}
        {filtres.length === 0 && (
          <div className="md:col-span-2 rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
            Aucun PNJ enregistré ne correspond. Générez puis enregistrez une fiche depuis l&apos;onglet Génération.
          </div>
        )}
      </div>

      {edition && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center p-2 sm:p-4 z-50 overflow-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-5xl my-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-xl font-bold text-gold-300">Éditer {edition.nom}</h2>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setPlacementsPour(edition)} className={bouton}>Placements</button>
                <button type="button" onClick={() => setEdition(null)} className="px-4 py-2 rounded bg-zinc-800 text-sm">Fermer</button>
                <button type="button" onClick={sauverEdition} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold text-sm">Enregistrer</button>
              </div>
            </div>
            <NpcFiche
              npc={edition}
              onChange={setEdition}
              entries={entries}
              tables={tables}
              factions={factions}
              monsters={monsters}
              statBlock={blocEdition}
              onStatBlockChange={(bloc) => {
                setBlocEdition(bloc);
                setEdition((n) => n ? { ...n, statBlockId: bloc?.id } : n);
              }}
              onGenererEstimation={creerEstimation}
              warnings={problemesEdition}
            />
          </div>
        </div>
      )}

      {placementsPour && (
        <PlacementsModal
          npc={placementsPour}
          placements={placements.filter((p) => p.npcId === placementsPour.id)}
          setPlacements={setPlacements}
          scenarios={scenarios}
          sessions={sessions}
          onClose={() => setPlacementsPour(null)}
        />
      )}
    </div>
  );
}

function PlacementsModal({
  npc,
  placements,
  setPlacements,
  scenarios,
  sessions,
  onClose,
}: {
  npc: NpcGen;
  placements: NpcPlacement[];
  setPlacements: React.Dispatch<React.SetStateAction<NpcPlacement[]>>;
  scenarios: Scenario[];
  sessions: Session[];
  onClose: () => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const session = sessions.find((s) => s.id === sessionId);

  const nommerSession = (id: string) => sessions.find((s) => s.id === id)?.nom ?? "";
  const nommerScenario = (id: string) => scenarios.find((s) => s.id === id)?.titre ?? "";
  const nommerScene = (sId: string, sceneIdRecherche: string) =>
    scenarios.find((s) => s.id === sId)?.scenes.find((sc) => sc.id === sceneIdRecherche)?.titre ?? "";

  const ajouter = () => {
    if (!sessionId && !scenarioId) return;
    const maintenant = new Date().toISOString();
    setPlacements((prev) => [
      ...prev,
      {
        id: `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        npcId: npc.id,
        sessionId,
        scenarioId,
        sceneId,
        role: role.trim(),
        notes: notes.trim(),
        createdAt: maintenant,
        updatedAt: maintenant,
      },
    ]);
    setRole("");
    setNotes("");
    setSceneId("");
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-xl space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold">Associer {npc.nom}</h3>
            <p className="text-xs text-zinc-500">Campagne, scénario ou scène. Les identifiants restent séparés du PNJ historique.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-zinc-800 text-sm">Fermer</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block text-sm">Session / campagne
            <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setScenarioId(""); setSceneId(""); }} className={`${champ} mt-1`}>
              <option value="">Aucune session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label className="block text-sm">Scénario
            <select value={scenarioId} onChange={(e) => { setScenarioId(e.target.value); setSceneId(""); }} className={`${champ} mt-1`}>
              <option value="">Aucun scénario</option>
              {scenarios
                .filter((s) => !session || session.scenarioIds.includes(s.id) || s.id === scenarioId)
                .map((s) => <option key={s.id} value={s.id}>{s.titre}</option>)}
            </select>
          </label>
          <label className="block text-sm">Scène
            <select value={sceneId} onChange={(e) => setSceneId(e.target.value)} disabled={!scenario} className={`${champ} mt-1`}>
              <option value="">Scène non précisée</option>
              {scenario?.scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.titre}</option>)}
            </select>
          </label>
          <label className="block text-sm">Rôle local
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Allié, témoin, antagoniste…" className={`${champ} mt-1`} />
          </label>
        </div>
        <label className="block text-sm">Notes de placement
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${champ} mt-1`} />
        </label>
        <div className="flex justify-end">
          <button type="button" onClick={ajouter} disabled={!sessionId && !scenarioId} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold text-sm disabled:opacity-40">
            + Associer
          </button>
        </div>

        <div className="border-t border-zinc-800 pt-2 space-y-2">
          <h4 className="font-semibold text-sm">Associations ({placements.length})</h4>
          {placements.map((placement) => (
            <div key={placement.id} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-sm space-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {nommerSession(placement.sessionId) || "Hors session"}
                    {nommerScenario(placement.scenarioId) ? ` · ${nommerScenario(placement.scenarioId)}` : ""}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {nommerScene(placement.scenarioId, placement.sceneId) || "Scène non précisée"}
                    {placement.role ? ` · ${placement.role}` : ""}
                  </p>
                  {placement.notes && <p className="text-xs text-zinc-500">{placement.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setPlacements((prev) => prev.filter((p) => p.id !== placement.id))}
                  className="px-2 py-1 rounded bg-zinc-800 text-xs text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {placements.length === 0 && <p className="text-xs text-zinc-500">Aucune association.</p>}
        </div>
      </div>
    </div>
  );
}
