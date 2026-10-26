"use client";
import { useMemo, useState } from "react";
import type { CombatParticipant, PhenixEnAttente } from "@/src/lib/rules/combat/types";

interface Props {
  attente: PhenixEnAttente;
  participants: CombatParticipant[];
  /** Alliés cochés par le MJ (les autres sont hors de portée). */
  onValider: (cibleIds: string[]) => void;
}

/**
 * Pop-up de l'onde de Phénix : le prêtre est déjà relevé (soin double, quota
 * consommé). Le moteur ne suivant pas les positions, le MJ coche les alliés
 * situés à 20 m ou moins. Les ennemis et les morts ne sont jamais proposés.
 */
export function PopupPhenix({ attente, participants, onValider }: Props) {
  const candidats = useMemo(
    () =>
      attente.candidats
        .map((id) => participants.find((p) => p.instanceId === id))
        .filter((p): p is CombatParticipant => p != null),
    [attente, participants]
  );
  // Tous cochés par défaut : le MJ décoche les alliés hors de portée.
  const [selection, setSelection] = useState<string[]>(() => [...attente.candidats]);
  const coche = (id: string) =>
    setSelection((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const tous = () => setSelection([...attente.candidats]);
  const aucun = () => setSelection([]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Phénix : alliés à 20 m de ${attente.pretreNom}`}
        className="w-full max-w-lg rounded-lg border border-amber-800 bg-zinc-950 p-4 space-y-3"
      >
        <div>
          <h3 className="font-bold text-sm uppercase text-amber-300">🔥 Phénix — {attente.pretreNom}</h3>
          <p className="mt-1 text-sm text-zinc-300">
            Le prêtre se relève aussitôt avec <strong>{attente.montantPretre} PV</strong> (soin double).
            L&apos;onde rend <strong>{attente.montant} PV</strong> à chaque allié à 20 m ou moins.
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          Jet unique 2d4°+CHA : [{attente.details.join(", ")}] = {attente.montant} PV.
          Les positions ne sont pas suivies par le logiciel : cochez les alliés réellement à portée.
        </p>

        {candidats.length > 0 ? (
          <>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={tous} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Tout sélectionner
              </button>
              <button type="button" onClick={aucun} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Aucun
              </button>
              <span className="ml-auto self-center text-zinc-500">{selection.length}/{candidats.length} à portée</span>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto rounded border border-zinc-800 bg-zinc-900/60 p-2">
              {candidats.map((p) => (
                <li key={p.instanceId}>
                  <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-zinc-800/70">
                    <input
                      type="checkbox"
                      checked={selection.includes(p.instanceId)}
                      onChange={() => coche(p.instanceId)}
                    />
                    <span className="flex-1">{p.nom}</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {p.pv}/{p.pvMax} PV
                    </span>
                    {p.statut === "ko" && <span className="text-xs text-red-400">KO</span>}
                    {p.effets.length > 0 && <span className="text-xs text-violet-300">✦{p.effets.length}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-400">
            Aucun autre allié vivant ou KO dans le combat. Seul le prêtre est soigné.
          </p>
        )}

        <button
          type="button"
          onClick={() => onValider(selection)}
          className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold"
        >
          {selection.length > 0
            ? `Appliquer l'onde à ${selection.length} allié${selection.length > 1 ? "s" : ""} (${attente.montant} PV)`
            : "Valider sans soigner d'allié"}
        </button>
      </div>
    </div>
  );
}
