"use client";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";

function pvColor(pv: number, max: number) {
  const r = max === 0 ? 0 : pv / max;
  if (r > 0.5) return "bg-green-500";
  if (r > 0.25) return "bg-amber-400";
  return "bg-red-500";
}

interface Props {
  combat: { participants: CombatParticipant[]; tourIndex: number };
  onHit: (id: string, n: number) => void;
  onHeal: (id: string, n: number) => void;
  onSelectAttacker: (id: string) => void;
  attackerId: string | null;
}

export function CombatTable({ combat, onHit, onHeal, onSelectAttacker, attackerId }: Props) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2">Init</th>
            <th className="text-left px-3 py-2">Participant</th>
            <th className="text-left px-3 py-2">PV</th>
            <th className="text-left px-3 py-2">Déf</th>
            <th className="text-left px-3 py-2">État</th>
            <th className="text-left px-3 py-2">Tour</th>
          </tr>
        </thead>
        <tbody>
          {combat.participants.map((p, i) => {
            const active = i === combat.tourIndex;
            const isAttacker = p.instanceId === attackerId;
            return (
              <tr
                key={p.instanceId}
                onClick={() => onSelectAttacker(p.instanceId)}
                className={`border-t border-zinc-800 cursor-pointer ${
                  active ? "bg-amber-400/15 outline outline-1 outline-amber-400" : isAttacker ? "bg-zinc-800/60" : "bg-zinc-950"
                } ${p.statut !== "actif" ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2 font-mono font-bold text-amber-300">{p.initiative ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded mr-1.5 ${p.camp === "pj" ? "bg-blue-900 text-blue-200" : "bg-red-900 text-red-200"}`}>
                    {p.camp === "pj" ? "PJ" : "MO"}
                  </span>
                  <span className="font-semibold">{p.nom}</span>
                  {p.effets.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-900 text-violet-200" title={p.effets.map((e) => `${e.nom} (${e.toursRestants ?? "∞"})`).join(", ")}>
                      ✦{p.effets.length}
                    </span>
                  )}
                  {active && <span className="ml-2 text-[10px] font-bold text-amber-300">▶ TOUR</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono font-bold">{p.pv}/{p.pvMax}</div>
                  <div className="w-20 h-1.5 bg-zinc-800 rounded mt-1">
                    <div className={`h-full rounded ${pvColor(p.pv, p.pvMax)}`} style={{ width: `${p.pvMax ? (100 * p.pv) / p.pvMax : 0}%` }} />
                  </div>
                  <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onHit(p.instanceId, 1)} className="px-1.5 rounded bg-red-900 text-xs">−1</button>
                    <button onClick={() => onHit(p.instanceId, 5)} className="px-1.5 rounded bg-red-900 text-xs">−5</button>
                    <button onClick={() => onHeal(p.instanceId, 5)} className="px-1.5 rounded bg-green-900 text-xs">+5</button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono">{p.defense}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.statut === "actif" ? "bg-green-900 text-green-200" : "bg-zinc-800 text-zinc-400"}`}>
                    {p.statut === "actif" ? "actif" : "KO"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">{active ? "à jouer" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
