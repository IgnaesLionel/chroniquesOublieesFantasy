"use client";
import { useState } from "react";
import { rollDiceExpression } from "@/src/lib/rules/dice/roller";
import { createHistoryEntry, type DiceHistoryEntry } from "@/src/lib/rules/dice/history";

const QUICK = ["d4", "d6", "d8", "d10", "d12", "d20", "1d20+5", "2d6+3", "1d8+2"];

export function DiceRoller({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("1d20+5");
  const [label, setLabel] = useState("Jet d'attaque du Guerrier");
  const [last, setLast] = useState<DiceHistoryEntry | null>(null);
  const [history, setHistory] = useState<DiceHistoryEntry[]>([]);
  const [error, setError] = useState("");

  const roll = (expr: string) => {
    try {
      const r = rollDiceExpression(expr);
      const entry = createHistoryEntry(r, label || undefined);
      setLast(entry);
      setHistory((h) => [entry, ...h].slice(0, 30));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      {!compact && <h2 className="font-bold">Lanceur de dés</h2>}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} onClick={() => { setInput(q); roll(q); }} className="px-2.5 py-1.5 rounded bg-zinc-800 text-sm font-mono hover:bg-zinc-700">{q}</button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (ex: Attaque Guerrier)" className="flex-1 min-w-40 bg-zinc-800 rounded px-2 py-2 text-sm" />
        <input value={input} onChange={(e) => setInput(e.target.value)} className="w-28 bg-zinc-800 rounded px-2 py-2 text-sm font-mono" />
        <button onClick={() => roll(input)} className="px-5 py-2 rounded bg-amber-400 text-black font-bold">Lancer</button>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      {last && (
        <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-0.5">
          <div className="font-semibold text-amber-300">{last.label ?? "Jet"}</div>
          <div className="font-mono">d{last.expression.sides} : {last.rolls.join(", ")}</div>
          <div>Bonus : {last.modifier >= 0 ? "+" : ""}{last.modifier}</div>
          <div className="font-bold text-lg">Total : {last.total}</div>
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-auto">
          {history.map((h) => (
            <div key={h.id} className="text-xs font-mono text-zinc-400">
              {new Date(h.at).toLocaleTimeString()} — {h.label ?? h.expression.normalized} : [{h.rolls.join(",")}] {h.modifier >= 0 ? "+" : ""}{h.modifier} = <span className="text-zinc-200 font-bold">{h.total}</span>
            </div>
          ))}
          <button onClick={() => { setHistory([]); setLast(null); }} className="text-xs text-zinc-500 underline">Effacer</button>
        </div>
      )}
    </div>
  );
}
