"use client";
import type { AttackResolution, CombatParticipant } from "@/src/lib/rules/combat/types";
import { canAct, getModifier } from "@/src/lib/rules/effects/effects";

interface Props {
  participants: CombatParticipant[];
  attackerId: string | null;
  attackId: string | null;
  targetId: string | null;
  last: AttackResolution | null;
  onAttacker: (id: string) => void;
  onAttack: (id: string) => void;
  onTarget: (id: string) => void;
  onRoll: () => void;
}

export function AttackPanel({ participants, attackerId, attackId, targetId, last, onAttacker, onAttack, onTarget, onRoll }: Props) {
  const attacker = participants.find((p) => p.instanceId === attackerId) ?? null;
  const vivants = participants.filter((p) => p.statut === "actif");
  const bloque = attacker !== null && !canAct(attacker.effets);
  const modAttaque = attacker ? getModifier(attacker.effets, "attaque") : 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase text-zinc-400">Attaque</h2>
      <label className="block text-sm">Attaquant
        <select value={attackerId ?? ""} onChange={(e) => onAttacker(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {participants.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} ({p.pv}/{p.pvMax})</option>
          ))}
        </select>
      </label>
      {attacker && (() => {
        const mana = attacker.ressources["mana"];
        const coutDe = (id: string) => {
          if (!id.startsWith("sort:")) return 0;
          return attacker.sorts.find((x) => `sort:${x.id}` === id)?.cout?.montant ?? 0;
        };
        const jouable = (id: string) => (mana?.actuel ?? 0) >= coutDe(id);
        return (
          <label className="block text-sm">Arme / sort
            {mana && <span className="ml-2 font-mono text-xs text-violet-300">mana {mana.actuel}/{mana.max}</span>}
            <select value={attackId ?? attacker.attaques[0]?.id ?? ""} onChange={(e) => onAttack(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
              {attacker.attaques.map((a) => {
                const cout = coutDe(a.id);
                const manque = !jouable(a.id);
                return (
                  <option key={a.id} value={a.id} disabled={manque}>
                    {a.nom} +{a.bonus}{modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque} effets)` : ""} · {a.degats === "1d1-1" ? "effet" : a.degats}{cout > 0 ? ` · ${cout} PM` : ""}{manque ? " (manque de mana)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        );
      })()}
      {bloque && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {attacker?.nom} ne peut pas agir (Étourdi/Immobilisé) — retirez l'effet ou passez son tour.
        </div>
      )}
      <label className="block text-sm">Cible
        <select value={targetId ?? ""} onChange={(e) => onTarget(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {vivants.filter((p) => p.instanceId !== attackerId).map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} — Déf {p.defense} — {p.pv}/{p.pvMax} PV</option>
          ))}
        </select>
      </label>
      <button onClick={onRoll} disabled={!attackerId || !targetId || bloque} className="w-full py-2.5 rounded bg-red-600 hover:bg-red-500 font-bold disabled:opacity-40">
        Lancer l'attaque
      </button>
      {last && (
        <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-0.5">
          <div className="font-semibold">{last.attaquantNom} → {last.cibleNom} ({last.attaqueNom})</div>
          <div className="font-mono">Jet : {last.jetNaturel} + {last.jetTotal - last.jetNaturel} = {last.jetTotal}</div>
          <div>Défense : {last.defenseCible}</div>
          <div className={`font-bold ${last.touche ? "text-green-400" : "text-red-400"}`}>
            → {last.touche ? (last.critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ"}
          </div>
          {last.touche && (
            <>
              <div>Dégâts : [{last.degatsDetails.join(", ")}] = {last.degatsTotal}</div>
              <div className="font-mono">{last.cibleNom} : {last.pvAvant} → {last.pvApres} PV</div>
              {last.cibleTombe && <div className="text-red-400 font-bold">{last.cibleNom} est hors combat</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
