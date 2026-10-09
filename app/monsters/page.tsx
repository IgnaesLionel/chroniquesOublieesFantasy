"use client";
import { useMemo, useState } from "react";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import { CAPACITES_PARTAGEES } from "@/src/lib/data/capacites-partagees";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import { exportJson } from "@/src/lib/store/repository";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import { MonsterEditor } from "@/src/components/monsters/MonsterEditor";

const EMPTY: MonsterTemplate = {
  id: "", kind: "monstre", nom: "", type: "Créature", niveau: 1,
  pv: 5, pvMax: 5, defense: 12, initMod: 0,
  attaques: [], capacites: [], capacitesPartagees: [], capacitesDetails: [],
  description: "", notes: "", exemple: false,
};

const PARTAGEES = new Map(CAPACITES_PARTAGEES.map((c) => [c.cle, c]));

export default function MonstersPage() {
  const { items, setItems } = useLocalCollection<MonsterTemplate>("cof.monsters.v2", SEED_MONSTERS);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [capacite, setCapacite] = useState("toutes");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MonsterTemplate | null>(null);

  const saveEditing = () => {
    if (!editing || !editing.nom.trim()) return;
    setItems((prev) => {
      if (!editing.id) return [...prev, { ...editing, id: `m-${Date.now().toString(36)}` }];
      return prev.map((m) => (m.id === editing.id ? editing : m));
    });
    setEditing(null);
  };

  const categories = useMemo(
    () => ["toutes", ...Array.from(new Set(items.map((m) => m.categorie ?? m.type))).sort()],
    [items]
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return items.filter((m) => {
      if (categorie !== "toutes" && (m.categorie ?? m.type) !== categorie) return false;
      if (capacite !== "toutes" && !(m.capacitesPartagees ?? []).includes(capacite)) return false;
      if (q && !(m.nom.toLowerCase().includes(q) || m.attaques.some((a) => a.nom.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [items, recherche, categorie, capacite]);

  const fiche = items.find((m) => m.id === ficheId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Bestiaire ({filtres.length}/{items.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => exportJson("monstres.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={() => setEditing({ ...EMPTY, capacitesPartagees: [], capacitesDetails: [] })} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Nouveau</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (nom, attaque)…"
          className="flex-1 min-w-40 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
        />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-2 text-sm">
          {categories.map((c) => <option key={c} value={c}>{c === "toutes" ? "Toutes catégories" : c}</option>)}
        </select>
        <select value={capacite} onChange={(e) => setCapacite(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-2 text-sm max-w-52">
          <option value="toutes">Toutes capacités</option>
          {CAPACITES_PARTAGEES.map((c) => <option key={c.cle} value={c.cle}>⛓ {c.nom}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtres.map((m) => (
          <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-1.5">
            <div className="flex justify-between items-start gap-2">
              <div className="font-bold">{m.nom}</div>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800 shrink-0">NC {m.niveau}</span>
            </div>
            <div className="text-xs text-zinc-400">
              {m.categorie ?? m.type}{m.taille ? ` · ${m.taille}` : ""}
            </div>
            <div className="font-mono text-green-400 text-sm">{m.pv}/{m.pvMax} PV · Déf {m.defense} · Init +{m.initMod}</div>
            {(m.capacitesPartagees ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(m.capacitesPartagees ?? []).slice(0, 4).map((ref) => (
                  <span key={ref} title={PARTAGEES.get(ref)?.resume ?? ref} className="text-[11px] px-1.5 py-0.5 rounded bg-violet-950 border border-violet-800 text-violet-200">
                    ⛓ {PARTAGEES.get(ref)?.nom ?? ref}
                  </span>
                ))}
                {(m.capacitesPartagees ?? []).length > 4 && (
                  <span className="text-[11px] text-zinc-500">+{(m.capacitesPartagees ?? []).length - 4}</span>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFicheId(m.id)} className="flex-1 py-2 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Fiche</button>
              <button onClick={() => setEditing({ ...m, attaques: m.attaques.map((a) => ({ ...a })), capacites: [...m.capacites], capacitesPartagees: [...(m.capacitesPartagees ?? [])] })} className="flex-1 py-2 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Éditer</button>
              <button onClick={() => { if (confirm(`Supprimer ${m.nom} ?`)) setItems((prev) => prev.filter((x) => x.id !== m.id)); }} title="Supprimer" className="px-3 py-2 rounded bg-zinc-800 text-sm hover:bg-red-900">✕</button>
              <a href="/combat" className="flex-1 text-center py-2 rounded bg-amber-400/10 border border-amber-400/40 text-amber-300 text-sm font-semibold hover:bg-amber-400/20">
                + Combat
              </a>
            </div>
          </div>
        ))}
      </div>
      {filtres.length === 0 && <p className="text-sm text-zinc-500">Aucune créature avec ces filtres.</p>}

      {fiche && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setFicheId(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-xl">{fiche.nom} <span className="text-sm font-mono text-zinc-400">NC {fiche.niveau}</span></div>
                <div className="text-xs text-zinc-400">{fiche.type}{fiche.taille ? ` · ${fiche.taille}` : ""}{fiche.categorie ? ` · ${fiche.categorie}` : ""}</div>
              </div>
              <button onClick={() => setFicheId(null)} className="px-2.5 py-1 rounded bg-zinc-800">✕</button>
            </div>
            <div className="font-mono text-sm text-green-400">
              {fiche.pv}/{fiche.pvMax} PV · Déf {fiche.defense} · Init +{fiche.initMod}
              {fiche.initiativeFiche ? <span className="text-zinc-500"> (fiche {fiche.initiativeFiche})</span> : null}
              {fiche.rd ? ` · RD ${fiche.rd}` : ""}{fiche.deplacement ? ` · ${fiche.deplacement} m` : ""}
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-zinc-400 font-bold">Attaques</div>
              {fiche.attaques.map((a) => (
                <div key={a.id} className="text-sm">⚔ {a.nom} +{a.bonus} · {a.degatsAffiche ?? a.degats}</div>
              ))}
            </div>
            {(fiche.capacitesDetails ?? []).length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs uppercase text-zinc-400 font-bold">Capacités</div>
                {fiche.capacitesDetails!.map((c, i) => (
                  <div key={i} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-2">
                    <span className="font-semibold">{c.nom}</span>
                    <p className="text-xs text-zinc-400 mt-0.5">{c.description}</p>
                  </div>
                ))}
              </div>
            )}
            {(fiche.capacitesPartagees ?? []).length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs uppercase text-zinc-400 font-bold">Capacités partagées</div>
                {(fiche.capacitesPartagees ?? []).map((ref) => {
                  const c = PARTAGEES.get(ref);
                  if (!c) return null;
                  return (
                    <details key={ref} className="text-sm bg-violet-950/40 border border-violet-900 rounded p-2">
                      <summary className="cursor-pointer font-semibold text-violet-200">⛓ {c.nom} <span className="font-normal text-xs text-zinc-400">— {c.resume}</span></summary>
                      <p className="text-xs text-zinc-300 mt-1">{c.texte}</p>
                      {c.mecanique && <p className="text-xs text-amber-300/90 mt-1">MJ : {c.mecanique}</p>}
                    </details>
                  );
                })}
              </div>
            )}
            {fiche.description && <p className="text-xs text-zinc-500">{fiche.description}</p>}
            {fiche.sourceUrl && <a href={fiche.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 underline">Source Notion</a>}
          </div>
        </div>
      )}

      <button onClick={() => setItems(SEED_MONSTERS)} className="text-sm text-zinc-500 underline">Réinitialiser le bestiaire</button>

      {editing && (
        <MonsterEditor
          draft={editing}
          onChange={setEditing}
          onSave={saveEditing}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
