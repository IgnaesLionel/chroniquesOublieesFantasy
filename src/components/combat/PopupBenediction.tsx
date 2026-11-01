"use client";
import { useMemo, useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

interface Props {
  lanceurNom: string;
  sortNom: string;
  /** Durée appliquée à chaque bénéficiaire, en tours (CHA × 6 avec la règle de table). */
  dureeTours: number | null;
  /** Charisme du lanceur : sert au rappel « CHA minutes = CHA × 6 tours ». */
  cha: number | null;
  participants: CombatParticipant[];
  /** Bénéficiaires proposés (ids) : tous les personnages joueurs vivants ou KO. */
  candidats: string[];
  onValider: (cibleIds: string[]) => void;
  onAnnuler: () => void;
}

/**
 * Pop-up de lancement de Bénédiction (sort de soutien de groupe) : le prêtre
 * chante et le MJ choisit qui reçoit l'amélioration. Tous les personnages
 * joueurs sont cochés par défaut ; les morts ne sont jamais proposés.
 * Le coût n'est payé qu'une fois, quel que soit le nombre de bénéficiaires.
 */
export function PopupBenediction({
  lanceurNom,
  sortNom,
  dureeTours,
  cha,
  participants,
  candidats,
  onValider,
  onAnnuler,
}: Props) {
  const beneficiaires = useMemo(
    () =>
      candidats
        .map((id) => participants.find((p) => p.instanceId === id))
        .filter((p): p is CombatParticipant => p != null),
    [candidats, participants]
  );
  // Tous cochés par défaut : le MJ décoche ceux qui ne sont pas en vue.
  const [selection, setSelection] = useState<string[]>(() => [...candidats]);
  const coche = (id: string) =>
    setSelection((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const tous = () => setSelection([...candidats]);
  const aucun = () => setSelection([]);

  const duree = dureeTours == null ? "jusqu'à dissipation" : `${dureeTours} tour${dureeTours > 1 ? "s" : ""}`;
  const conversion =
    cha != null && cha > 0 && dureeTours != null
      ? `${cha} minute${cha > 1 ? "s" : ""} = ${dureeTours} tours (1 minute = 6 tours)`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${sortNom} : bénéficiaires de l'amélioration`}
        className="w-full max-w-lg rounded-lg border border-violet-800 bg-zinc-950 p-4 space-y-3"
      >
        <div>
          <h3 className="font-bold text-sm uppercase text-violet-300">🛡️ {sortNom} — {lanceurNom}</h3>
          <p className="mt-1 text-sm text-zinc-300">
            Chant : <strong>+1 aux tests et attaques</strong> pendant <strong>{duree}</strong>.
            Choisissez les personnages qui reçoivent l&apos;amélioration.
          </p>
          {conversion && <p className="mt-1 text-xs text-zinc-500">CHA {cha} : {conversion}.</p>}
        </div>

        {beneficiaires.length > 0 ? (
          <>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={tous} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Tout sélectionner
              </button>
              <button type="button" onClick={aucun} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">
                Aucun
              </button>
              <span className="ml-auto self-center text-zinc-500">{selection.length}/{beneficiaires.length} bénéficiaire(s)</span>
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto rounded border border-zinc-800 bg-zinc-900/60 p-2">
              {beneficiaires.map((p) => (
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
                    {p.statut === "ko" && <span className="text-xs text-red-400">KO</span>}
                    {p.effets.length > 0 && <span className="text-xs text-violet-300">✦{p.effets.length}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-400">
            Aucun personnage joueur à bénir dans ce combat.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="px-3 py-2.5 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onValider(selection)}
            disabled={selection.length === 0}
            className="flex-1 py-2.5 rounded bg-violet-700 hover:bg-violet-600 font-bold disabled:opacity-40"
          >
            {selection.length > 0
              ? `Lancer ${sortNom} sur ${selection.length} personnage${selection.length > 1 ? "s" : ""}`
              : "Sélectionnez au moins un personnage"}
          </button>
        </div>
      </div>
    </div>
  );
}
