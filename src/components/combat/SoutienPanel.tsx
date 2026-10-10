"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Sort } from "@/src/lib/rules/types";
import { canAct } from "@/src/lib/rules/effects/effects";
import { budgetOk, sortUtilisable } from "@/src/lib/rules/combat/attack";

const LETTRE_ACTION: Record<string, string> = { attaque: "A", mouvement: "M", limitee: "L", gratuite: "G" };

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  onCast: (lanceurId: string, cibleId: string, sort: Sort) => void;
}

export function SoutienPanel({ participants, lanceurId, onCast }: Props) {
  const lanceur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const soutiens = (lanceur?.sorts ?? []).filter((s) => s.type !== "offensif");
  const [sortId, setSortId] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);

  if (!lanceur || soutiens.length === 0) return null;
  const jouables = soutiens.filter((s) => sortUtilisable(lanceur.niveau, s).ok);
  const sort = soutiens.find((s) => s.id === sortId && sortUtilisable(lanceur.niveau, s).ok) ?? jouables[0] ?? soutiens[0];
  const allies = participants.filter((p) => p.statut === "actif" && p.camp === lanceur.camp);
  const cible = allies.find((p) => p.instanceId === cibleId) ?? allies[0] ?? null;
  const bloque = !canAct(lanceur.effets);
  const mana = lanceur.ressources["mana"];
  const budget = budgetOk(lanceur, sort.action);

  return (
    <div className="rounded-lg border border-violet-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-violet-300">
        Sort de soutien{mana ? <span className="ml-2 font-mono normal-case">mana {mana.actuel}/{mana.max}</span> : null}
        {lanceur.budget && <span className="ml-2 font-mono normal-case text-xs" title="1 action + 1 mouvement par tour, ou 1 limitée">A{lanceur.budget.action ? "•" : "○"} M{lanceur.budget.mouvement ? "•" : "○"}</span>}
      </h2>
      {bloque && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {lanceur.nom} ne peut pas agir.
        </div>
      )}
      <label className="block text-sm">Sort
        <select value={sort.id} onChange={(e) => setSortId(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {soutiens.map((s) => {
            const u = sortUtilisable(lanceur.niveau, s);
            const flags = [
              LETTRE_ACTION[s.action ?? "attaque"] ?? "A",
              s.soin ? `+${s.soin}` : "",
              s.cout ? `${s.cout.montant} ${s.cout.ressource}` : "",
              s.coutPV ? `${s.coutPV} PV` : "",
              s.invocation ? "invoque" : "",
              s.zone ? "zone" : "",
              s.attaqueAccordee ? "+attaque" : "",
            ].filter(Boolean).join(" · ");
            return (
              <option key={s.id} value={s.id} disabled={!u.ok}>
                🛡 {s.nom} · {flags}{u.ok ? "" : ` (${u.raison})`}
              </option>
            );
          })}
        </select>
      </label>
      <label className="block text-sm">Bénéficiaire
        <select value={cible?.instanceId ?? ""} onChange={(e) => setCibleId(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {allies.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} — {p.pv}/{p.pvMax} PV</option>
          ))}
        </select>
      </label>
      <button
        onClick={() => { if (cible) onCast(lanceur.instanceId, cible.instanceId, sort); }}
        disabled={bloque || !cible || !budget.ok}
        title={!budget.ok ? budget.raison : undefined}
        className="w-full py-2.5 rounded bg-violet-700 hover:bg-violet-600 font-bold disabled:opacity-40"
      >
        Lancer {sort.nom}{!budget.ok ? ` (${budget.raison})` : ""}
      </button>
    </div>
  );
}
