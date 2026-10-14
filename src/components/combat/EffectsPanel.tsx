"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { canAct, getModifier } from "@/src/lib/rules/effects/effects";

interface Props {
  participant: CombatParticipant | null;
  onAdd: (key: string, duree: number | null) => void;
  onRemove: (effetId: string) => void;
}

export function EffectsPanel({ participant, onAdd, onRemove }: Props) {
  const [key, setKey] = useState("empoisonne");
  const [duree, setDuree] = useState("3");

  if (!participant) return null;
  const mods = ["attaque", "defense"].map((k) => ({ k, v: getModifier(participant.effets, k) })).filter((m) => m.v !== 0);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase text-zinc-400">Effets — {participant.nom}</h2>
      {!canAct(participant.effets) && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">Ne peut pas agir (Étourdi/Paralysé/Surpris)</div>
      )}
      {mods.length > 0 && (
        <div className="text-xs text-amber-300">Modificateurs : {mods.map((m) => `${m.k} ${m.v > 0 ? "+" : ""}${m.v}`).join(" · ")}</div>
      )}
      {participant.effets.length === 0 && <p className="text-xs text-zinc-500">Aucun effet actif.</p>}
      <div className="space-y-1.5">
        {participant.effets.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5">
            <div>
              <span className="font-semibold">{e.nom}</span>
              <span className="text-xs text-zinc-400 ml-2">{e.toursRestants ?? "∞"} tour(s){e.source ? ` · ${e.source}` : ""}</span>
            </div>
            <button onClick={() => onRemove(e.id)} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-red-900">Retirer</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select value={key} onChange={(e) => setKey(e.target.value)} className="flex-1 bg-zinc-800 rounded px-2 py-2 text-sm">
          {EFFECT_CATALOG.map((t) => (
            <option key={t.key} value={t.key}>{t.nom} ({t.dureeDefaut ?? "∞"} tours)</option>
          ))}
        </select>
        <input value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="3" title="Durée en tours (vide = défaut)" className="w-14 bg-zinc-800 rounded px-2 py-2 text-sm text-center" />
        <button
          onClick={() => onAdd(key, duree === "" ? null : Number(duree))}
          className="px-3 py-2 rounded bg-violet-700 hover:bg-violet-600 text-sm font-semibold"
        >
          + Effet
        </button>
      </div>
    </div>
  );
}
