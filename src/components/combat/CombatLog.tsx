"use client";
import type { CombatLogEntry } from "@/src/lib/rules/combat/types";

export function CombatLog({ log }: { log: CombatLogEntry[] }) {
  const items = [...log].reverse();
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-bold text-sm uppercase text-zinc-400 mb-2">Journal ({log.length})</h2>
      <div className="space-y-1 max-h-72 overflow-auto text-xs font-mono">
        {items.map((l) => (
          <div key={l.id} className="text-zinc-400">
            <span className="text-zinc-600">M{l.manche} {new Date(l.at).toLocaleTimeString()}</span> — <span className="text-zinc-200">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
