"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Sort } from "@/src/lib/rules/types";
import { canAct } from "@/src/lib/rules/effects/effects";
import { sortUtilisable, type PaiementSort } from "@/src/lib/rules/combat/attack";

const LETTRE_ACTION: Record<string, string> = { attaque: "A", mouvement: "M", limitee: "L", gratuite: "G" };

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  onCast: (lanceurId: string, cibleId: string, sort: Sort, paiement?: PaiementSort) => void;
}

export function SoutienPanel({ participants, lanceurId, onCast }: Props) {
  const lanceur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const soutiens = (lanceur?.sorts ?? []).filter((s) => s.type !== "offensif");
  const [sortId, setSortId] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [modeLancement, setModeLancement] = useState<"mana" | "brulure">("mana");
  const [concentration, setConcentration] = useState(false);

  if (!lanceur || soutiens.length === 0) return null;
  const jouables = soutiens.filter((s) => sortUtilisable(lanceur.niveau, s).ok);
  const sort = soutiens.find((s) => s.id === sortId && sortUtilisable(lanceur.niveau, s).ok) ?? jouables[0] ?? soutiens[0];
  const allies = participants.filter((p) => p.statut === "actif" && p.camp === lanceur.camp);
  const cible = allies.find((p) => p.instanceId === cibleId) ?? allies[0] ?? null;
  const bloque = !canAct(lanceur.effets);
  const mana = lanceur.ressources["mana"];
  const coutBase = sort.cout?.montant ?? 0;
  const concPossible = (sort.action ?? "attaque") === "attaque" && coutBase > 0;
  const concActive = concentration && concPossible;
  const coutEff = concActive ? Math.max(0, coutBase - 2) : coutBase;
  const raisonBrulure = (): string | null => {
    if (sort.soin) return "brûlure interdite pour les soins";
    if (coutEff <= 0) return "brûlure inutile (coût 0)";
    if ((mana?.actuel ?? 0) !== 0) return "brûlure réservée au 0 mana";
    if (!lanceur.deRecuperation) return "pas de dé de récupération";
    return null;
  };
  const burnPossible = raisonBrulure() === null;
  const burnActive = modeLancement === "brulure" && burnPossible;

  return (
    <div className="rounded-lg border border-violet-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-violet-300">
        Sort de soutien{mana ? <span className="ml-2 font-mono normal-case">mana {mana.actuel}/{mana.max}</span> : null}
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
      {coutBase > 0 && (
        <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
          <div className="text-xs uppercase text-zinc-500 font-bold">Lancement du sort</div>
          <label className="flex items-center gap-2" title="Incantation classique : paie le coût en mana">
            <input type="radio" checked={modeLancement === "mana"} onChange={() => setModeLancement("mana")} />
            <span>Incantation ({coutEff} PM{concActive && coutEff !== coutBase ? `, concentré depuis ${coutBase}` : ""})</span>
          </label>
          <label className={`flex items-center gap-2 ${burnPossible ? "" : "opacity-40"}`} title={raisonBrulure() ?? `Brûlure de mana : paie en PV (1 ${lanceur.deRecuperation ?? "DR"} par PM, sans RD, KO possible) — jamais pour les soins`}>
            <input type="radio" checked={modeLancement === "brulure"} disabled={!burnPossible} onChange={() => setModeLancement("brulure")} />
            <span>Brûlure de mana ({coutEff}{lanceur.deRecuperation ?? "?"} de PV)</span>
          </label>
          {modeLancement === "brulure" && !burnPossible && raisonBrulure() && (
            <div className="text-xs text-amber-300/90">⚠ {raisonBrulure()}</div>
          )}
          {concPossible && (
            <label className="flex items-center gap-2" title="Sort (A) lancé en action limitée (L) : −2 PM. Le lanceur se prive de déplacement.">
              <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
              <span>Concentration accrue (−2 PM → {Math.max(0, coutBase - 2)} PM, action L)</span>
            </label>
          )}
        </div>
      )}
      <button
        onClick={() => { if (cible) onCast(lanceur.instanceId, cible.instanceId, sort, { mode: burnActive ? "brulure" : "mana", concentration: concActive }); }}
        disabled={bloque || !cible}
        className="w-full py-2.5 rounded bg-violet-700 hover:bg-violet-600 font-bold disabled:opacity-40"
      >
        Lancer {sort.nom}
      </button>
    </div>
  );
}
