"use client";
import { useMemo } from "react";
import type { PlayState, Scenario } from "@/src/lib/rules/scenario/types";
import { SCENE_TYPE_ICON, sceneTypeOf, statusOf } from "@/src/lib/rules/scenario/types";
import { getDepart } from "@/src/lib/rules/scenario/engine";

interface Props {
  scenario: Scenario;
  play?: PlayState | null;
  currentId?: string | null;
  onSelect: (id: string) => void;
}

/** Graphe SVG léger, sans dépendance. Positions : profondeur BFS + index. */
export function ScenarioGraph({ scenario, play, currentId, onSelect }: Props) {
  const layout = useMemo(() => {
    const byId = new Map(scenario.scenes.map((s) => [s.id, s]));
    let depart = scenario.chapitres[0]?.sceneDepartId ?? scenario.scenes[0]?.id;
    if (!depart || !byId.has(depart)) {
      try {
        depart = getDepart(scenario).id;
      } catch {
        depart = scenario.scenes[0]?.id;
      }
    }
    // BFS pour la profondeur (les cycles / retours ne bloquent pas).
    const depth = new Map<string, number>();
    const queue: string[] = depart ? [depart] : [];
    if (depart) depth.set(depart, 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const s = byId.get(id);
      if (!s) continue;
      for (const c of s.choix) {
        if (!byId.has(c.versSceneId)) continue;
        if (!depth.has(c.versSceneId)) {
          depth.set(c.versSceneId, (depth.get(id) ?? 0) + 1);
          queue.push(c.versSceneId);
        }
      }
    }
    scenario.scenes.forEach((s) => {
      if (!depth.has(s.id)) depth.set(s.id, 0);
    });
    const cols = new Map<number, string[]>();
    scenario.scenes.forEach((s) => {
      const d = depth.get(s.id) ?? 0;
      if (!cols.has(d)) cols.set(d, []);
      cols.get(d)!.push(s.id);
    });
    const W = 210;
    const H = 64;
    const GX = 60;
    const GY = 36;
    const pos = new Map<string, { x: number; y: number }>();
    [...cols.entries()].sort((a, b) => a[0] - b[0]).forEach(([d, ids]) => {
      ids.forEach((id, i) => pos.set(id, { x: 20 + d * (W + GX), y: 20 + i * (H + GY) }));
    });
    const maxY = Math.max(120, ...[...pos.values()].map((p) => p.y + H + 20));
    const maxX = Math.max(320, ...[...pos.values()].map((p) => p.x + W + 20));
    return { pos, W, H, maxX, maxY, byId };
  }, [scenario]);

  if (scenario.scenes.length === 0) return <p className="text-sm text-zinc-500">Aucune scène.</p>;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 overflow-auto">
      <svg width={layout.maxX} height={layout.maxY} role="img" aria-label="Graphe des scènes">
        {scenario.scenes.flatMap((s) =>
          s.choix.map((c) => {
            const a = layout.pos.get(s.id);
            const b = layout.pos.get(c.versSceneId);
            if (!a || !b) return null;
            const x1 = a.x + layout.W;
            const y1 = a.y + layout.H / 2;
            const x2 = b.x;
            const y2 = b.y + layout.H / 2;
            const mx = (x1 + x2) / 2;
            const missing = !layout.byId.has(c.versSceneId);
            return (
              <path
                key={`${s.id}-${c.id}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={missing ? "#7f1d1d" : "#5d4d33"}
                strokeWidth={s.id === currentId ? 2.5 : 1.5}
                strokeDasharray={c.condition ? "6 4" : undefined}
              />
            );
          })
        )}
        {scenario.scenes.map((s) => {
          const p = layout.pos.get(s.id)!;
          const isCur = s.id === currentId;
          const st = play ? statusOf(s.id, { ...play, visitees: play.visitees ?? play.historique }) : "non_visitee";
          const dot = st === "en_cours" ? "#c9a227" : st === "terminee" ? "#4ade80" : "#5d4d33";
          return (
            <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: "pointer" }}>
              <rect
                x={p.x}
                y={p.y}
                width={layout.W}
                height={layout.H}
                rx={10}
                fill={isCur ? "#3a2c0d" : "#1e1811"}
                stroke={isCur ? "#c9a227" : "#453823"}
                strokeWidth={isCur ? 2 : 1}
              />
              <circle cx={p.x + 14} cy={p.y + 16} r={5} fill={dot} />
              <text x={p.x + 26} y={p.y + 21} fill="#dfc06a" fontSize={11} fontWeight="bold">
                {SCENE_TYPE_ICON[sceneTypeOf(s)]} {s.titre.length > 26 ? `${s.titre.slice(0, 26)}…` : s.titre}
              </text>
              <text x={p.x + 12} y={p.y + 40} fill="#ab9d80" fontSize={10}>
                {sceneTypeOf(s)} · {s.choix.length} lien{s.choix.length > 1 ? "s" : ""}
              </text>
              <text x={p.x + 12} y={p.y + 53} fill="#7f7261" fontSize={10}>
                {st === "en_cours" ? "en cours" : st === "terminee" ? "visitée / terminée" : "non visitée"}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-zinc-500 px-2 pb-1">Pointillés = lien conditionnel (SI flag). Cliquez un nœud pour y aller.</p>
    </div>
  );
}
