"use client";
import { useMemo, useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

interface Props {
  /** "lancer" = premier round (coût payé) ; "tour" = relance à chaque tour du lanceur. */
  mode: "lancer" | "tour";
  sortNom: string;
  lanceurNom: string;
  /** Expression des dégâts par round (ex: "2d4°"). */
  degats: string;
  participants: CombatParticipant[];
  /** Ennemis actifs proposés (les inciblables sont déjà écartés). */
  candidats: string[];
  /** Cibles pré-cochées : sélection précédente (tour) ou tous (lancer). */
  selectionInitiale?: string[];
  round?: number;
  roundsTotal?: number;
  onValider: (cibleIds: string[]) => void;
  /** Présent au lancer uniquement : permet d'annuler avant de payer le coût. */
  onAnnuler?: () => void;
}

/**
 * Pop-up d'Armée des morts (zone persistante) : le moteur ne suit pas les
 * positions. Au lancer, le MJ coche les ennemis dans les 10 m ; à chaque tour
 * du sorcier, la même question est reposée pour le round en cours.
 */
export function PopupZonePersistante({
  mode,
  sortNom,
  lanceurNom,
  degats,
  participants,
  candidats,
  selectionInitiale,
  round,
  roundsTotal,
  onValider,
  onAnnuler,
}: Props) {
  const ennemis = useMemo(
    () =>
      candidats
        .map((id) => participants.find((p) => p.instanceId === id))
        .filter((p): p is CombatParticipant => p != null),
    [candidats, participants]
  );
  // Lancer : tous cochés par défaut (le MJ décoche les absents). Tour : on
  // repart de la sélection précédente, sans recocher les autres par défaut.
  const [selection, setSelection] = useState<string[]>(() => {
    const precedents = (selectionInitiale ?? []).filter((id) => candidats.includes(id));
    if (precedents.length > 0) return precedents;
    return mode === "lancer" ? [...candidats] : [];
  });
  const coche = (id: string) =>
    setSelection((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const tous = () => setSelection([...candidats]);
  const aucun = () => setSelection([]);

  const roundInfo =
    mode === "tour" && round != null && roundsTotal != null
      ? `Round ${round}/${roundsTotal}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${sortNom} : ennemis dans la zone`}
        className="w-full max-w-lg rounded-lg border border-violet-800 bg-zinc-950 p-4 space-y-3"
      >
        <div>
          <h3 className="font-bold text-sm uppercase text-violet-300">
            🦴 {sortNom} — {mode === "lancer" ? lanceurNom : `tour de ${lanceurNom}`}
            {roundInfo && <span className="ml-2 font-mono normal-case text-violet-200/80">{roundInfo}</span>}
          </h3>
          <p className="mt-1 text-sm text-zinc-300">
            {mode === "lancer"
              ? "Le sorcier déchaîne une armée de squelettes dans un rayon de 10 m. Cochez les ennemis qui s'y trouvent : ils subissent immédiatement les dégâts, puis à chaque tour du sorcier tant que le sort dure."
              : "Cochez les ennemis actuellement dans la zone de 10 m. Ceux qui sont cochés subissent les dégâts automatiques de ce round."}
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          Dégâts par round : <strong className="text-violet-200">{degats}</strong> (dés évolutifs au niveau du lanceur).
          Les positions ne sont pas suivies par le logiciel : cochez les ennemis réellement dans la zone.
        </p>

        {ennemis.length > 0 ? (
          <>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={tous} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Tout sélectionner
              </button>
              <button type="button" onClick={aucun} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Aucun
              </button>
              <span className="ml-auto self-center text-zinc-500">
                {selection.length}/{ennemis.length} ennemi(s) dans la zone
              </span>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto rounded border border-zinc-800 bg-zinc-900/60 p-2">
              {ennemis.map((p) => (
                <li key={p.instanceId}>
                  <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-zinc-800/70">
                    <input
                      type="checkbox"
                      checked={selection.includes(p.instanceId)}
                      onChange={() => coche(p.instanceId)}
                    />
                    <span className="flex-1">{p.nom}</span>
                    <FamilleBadge famille={p.camp === "pj" ? familleDuProfil(p.profil) : null} />
                    <span className="font-mono text-xs text-zinc-400">
                      {p.pv}/{p.pvMax} PV
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-400">
            Aucun ennemi actif dans la zone (ou aucun ennemi ciblable).
          </p>
        )}

        <div className="flex gap-2">
          {onAnnuler && (
            <button
              type="button"
              onClick={onAnnuler}
              className="px-3 py-2.5 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={() => onValider(selection)}
            disabled={mode === "lancer" && selection.length === 0}
            className="flex-1 py-2.5 rounded bg-violet-700 hover:bg-violet-600 font-bold disabled:opacity-40"
          >
            {mode === "lancer"
              ? selection.length > 0
                ? `Lancer ${sortNom} sur ${selection.length} ennemi${selection.length > 1 ? "s" : ""}`
                : "Cochez au moins un ennemi dans la zone"
              : selection.length > 0
                ? `Appliquer ${degats} à ${selection.length} ennemi${selection.length > 1 ? "s" : ""}`
                : "Personne dans la zone — aucun dégât"}
          </button>
        </div>
      </div>
    </div>
  );
}
