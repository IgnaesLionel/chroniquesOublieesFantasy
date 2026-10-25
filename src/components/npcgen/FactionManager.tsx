"use client";

import { useMemo, useState } from "react";
import type { Faction } from "@/src/lib/npcgen/types";
import { idUnique, identifiantLisible } from "@/src/lib/npcgen/operations";
import { exportJson } from "@/src/lib/store/repository";

interface Props {
  factions: Faction[];
  setFactions: React.Dispatch<React.SetStateAction<Faction[]>>;
}

const champ =
  "w-full bg-zinc-950/70 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";
const bouton = "px-3 py-1.5 rounded text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

type Form = Omit<Faction, "tags"> & { tags: string; id: string };

function vide(): Form {
  return {
    id: "",
    nom: "",
    type: "",
    description: "",
    objectif: "",
    methode: "",
    territoire: "",
    tags: "",
    secret: "",
    actif: true,
    createdAt: "",
    updatedAt: "",
  };
}

function depuis(faction: Faction): Form {
  return { ...faction, tags: faction.tags.join(", ") };
}

export function FactionManager({ factions, setFactions }: Props) {
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [erreur, setErreur] = useState("");

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return factions
      .filter((f) => !q || [f.nom, f.type, f.description, f.objectif, f.territoire, f.tags.join(" ")].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [factions, recherche]);

  const sauver = () => {
    if (!form) return;
    if (!form.nom.trim()) {
      setErreur("Le nom est requis.");
      return;
    }
    const maintenant = new Date().toISOString();
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (form.id) {
      setFactions((prev) =>
        prev.map((f) =>
          f.id === form.id
            ? {
                ...f,
                nom: form.nom.trim(),
                type: form.type.trim(),
                description: form.description.trim(),
                objectif: form.objectif.trim(),
                methode: form.methode.trim(),
                territoire: form.territoire.trim(),
                tags,
                secret: form.secret.trim(),
                actif: form.actif,
                updatedAt: maintenant,
              }
            : f
        )
      );
    } else {
      setFactions((prev) => [
        ...prev,
        {
          id: idUnique(`faction-${identifiantLisible(form.nom)}`, prev),
          nom: form.nom.trim(),
          type: form.type.trim(),
          description: form.description.trim(),
          objectif: form.objectif.trim(),
          methode: form.methode.trim(),
          territoire: form.territoire.trim(),
          tags,
          secret: form.secret.trim(),
          actif: form.actif,
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      ]);
    }
    setForm(null);
    setErreur("");
  };

  const supprimer = (faction: Faction) => {
    if (!confirm(`Supprimer la faction « ${faction.nom} » ? Les PNJ déjà enregistrés gardent son nom en texte.`)) return;
    setFactions((prev) => prev.filter((f) => f.id !== faction.id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bronze-700/60 bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-gold-300">Factions</h2>
            <p className="text-sm text-zinc-400">Groupes, ordres et réseaux qui structurent les PNJ et leurs loyaux.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setErreur(""); setForm(vide()); }} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Faction</button>
            <button type="button" onClick={() => exportJson("factions-pnj.json", factions)} className={bouton}>Export JSON</button>
          </div>
        </div>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une faction, un objectif, un tag…" className={champ} />
        {erreur && <p className="text-sm text-red-400">{erreur}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtrees.map((faction) => (
          <div key={faction.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-bold text-lg ${faction.actif ? "text-zinc-100" : "text-zinc-500 line-through"}`}>{faction.nom}</h3>
                <p className="text-xs text-zinc-500">{faction.type || "Type libre"} · {faction.territoire || "Territoire inconnu"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <button type="button" onClick={() => { setErreur(""); setForm(depuis(faction)); }} className={bouton}>Éditer</button>
                <button type="button" onClick={() => setFactions((prev) => prev.map((f) => f.id === faction.id ? { ...f, actif: !f.actif, updatedAt: new Date().toISOString() } : f))} className={bouton}>
                  {faction.actif ? "Désactiver" : "Activer"}
                </button>
                <button type="button" onClick={() => supprimer(faction)} className="px-2 py-1 rounded text-xs bg-zinc-800 text-red-300">✕</button>
              </div>
            </div>
            {faction.description && <p className="text-sm text-zinc-300">{faction.description}</p>}
            <div className="text-xs text-zinc-400 space-y-1">
              {faction.objectif && <p><b>Objectif :</b> {faction.objectif}</p>}
              {faction.methode && <p><b>Méthodes :</b> {faction.methode}</p>}
              {faction.secret && <p className="text-red-300"><b>Secret MJ :</b> {faction.secret}</p>}
            </div>
            {faction.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {faction.tags.map((tag) => <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">{tag}</span>)}
              </div>
            )}
          </div>
        ))}
        {filtrees.length === 0 && <p className="text-sm text-zinc-500">Aucune faction.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-2 max-h-[92vh] overflow-auto">
            <h3 className="font-bold">{form.id ? "Éditer la faction" : "Nouvelle faction"}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Nom
                <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Type
                <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Guilde, ordre, culte…" className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Territoire
                <input value={form.territoire} onChange={(e) => setForm({ ...form, territoire: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Tags (virgules)
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={`${champ} mt-1`} />
              </label>
            </div>
            <label className="block text-sm">Description
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Objectif
                <textarea rows={2} value={form.objectif} onChange={(e) => setForm({ ...form, objectif: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Méthodes
                <textarea rows={2} value={form.methode} onChange={(e) => setForm({ ...form, methode: e.target.value })} className={`${champ} mt-1`} />
              </label>
            </div>
            <label className="block text-sm">Secret MJ
              <textarea rows={2} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
              Faction active (proposée à la génération)
            </label>
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setForm(null); setErreur(""); }} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button type="button" onClick={sauver} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
