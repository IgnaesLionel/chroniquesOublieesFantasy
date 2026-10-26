"use client";

import { useState } from "react";
import { useNpcs } from "@/src/lib/store/collections";
import { exportJson } from "@/src/lib/store/repository";
import type { Npc } from "@/src/lib/rules/world/types";

const EMPTY: Npc = {
  id: "", nom: "", role: "", description: "", personnalite: "",
  statistiques: "", dialogues: [], secret: "", relations: "", notesMJ: "", exemple: false,
};

/** Ancien éditeur d'exemples : conservé tel quel dans son onglet dédié. */
export function LegacyNpcs() {
  const { items, setItems } = useNpcs();
  const [editing, setEditing] = useState<Npc | null>(null);
  const [dialogueInput, setDialogueInput] = useState("");

  const save = () => {
    if (!editing || !editing.nom.trim()) return;
    setItems((prev) => {
      if (!editing.id) return [...prev, { ...editing, id: `npc-${Date.now().toString(36)}` }];
      return prev.map((n) => (n.id === editing.id ? editing : n));
    });
    setEditing(null);
    setDialogueInput("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
        Cet onglet conserve les exemples historiques ; leurs modifications sont désormais persistées
        localement comme le reste du contenu. La bibliothèque PNJ et le générateur se trouvent dans les autres onglets.
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">PNJ exemples ({items.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => exportJson("pnj.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={() => { setEditing({ ...EMPTY }); setDialogueInput(""); }} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Nouveau</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((n) => (
          <div key={n.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-1.5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="font-bold text-lg">{n.nom}</span>
                {n.role && <span className="text-sm text-zinc-400"> · {n.role}</span>}
                {n.exemple && <span className="text-xs text-amber-400 ml-1">· exemple</span>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setEditing({ ...n, dialogues: [...n.dialogues] }); setDialogueInput(""); }} className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Éditer</button>
                <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== n.id))} className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-900">✕</button>
              </div>
            </div>
            {n.description && <p className="text-sm text-zinc-300">{n.description}</p>}
            {n.personnalite && <p className="text-xs text-zinc-500">Personnalité : {n.personnalite}</p>}
            {n.dialogues.length > 0 && (
              <div className="text-sm space-y-0.5 pt-1">
                {n.dialogues.map((d, i) => <p key={i} className="italic text-zinc-300">« {d} »</p>)}
              </div>
            )}
            {n.secret && <p className="text-xs text-red-400/90 pt-1">🔒 Secret MJ : {n.secret}</p>}
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg space-y-2.5 max-h-[90vh] overflow-auto">
            <h2 className="font-bold">{editing.id ? `Éditer ${editing.nom}` : "Nouveau PNJ"}</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Nom*<input value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="text-sm">Rôle<input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <label className="block text-sm">Description<textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <label className="block text-sm">Personnalité<input value={editing.personnalite ?? ""} onChange={(e) => setEditing({ ...editing, personnalite: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <label className="block text-sm">Statistiques (exemple)<input value={editing.statistiques ?? ""} onChange={(e) => setEditing({ ...editing, statistiques: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <div className="text-sm">
              <div className="mb-1">Dialogues ({editing.dialogues.length})</div>
              {editing.dialogues.map((d, i) => (
                <div key={i} className="flex gap-2 items-center mb-1">
                  <span className="flex-1 text-xs italic">« {d} »</span>
                  <button onClick={() => setEditing({ ...editing, dialogues: editing.dialogues.filter((_, j) => j !== i) })} className="text-xs px-2 py-1 rounded bg-zinc-800">✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={dialogueInput} onChange={(e) => setDialogueInput(e.target.value)} placeholder="Nouvelle réplique" className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
                <button onClick={() => { if (dialogueInput.trim()) { setEditing({ ...editing, dialogues: [...editing.dialogues, dialogueInput.trim()] }); setDialogueInput(""); } }} className="px-3 py-1.5 rounded bg-zinc-800 text-xs">+ Ajouter</button>
              </div>
            </div>
            <label className="block text-sm">Secret MJ<input value={editing.secret ?? ""} onChange={(e) => setEditing({ ...editing, secret: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <label className="block text-sm">Notes MJ<textarea value={editing.notesMJ ?? ""} onChange={(e) => setEditing({ ...editing, notesMJ: e.target.value })} rows={2} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
