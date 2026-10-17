"use client";
import { useState } from "react";
import { mjValider } from "@/src/lib/ui/validations-mj";

/** Une condition à faire constater par le MJ avant de résoudre l'action. */
export interface QuestionMJ {
  /** Clé stable en session (ex. "cap:parade", "att:parfaite"). */
  cle: string;
  /** Question posée, formulation du livre ou habillage moteur. */
  question: string;
}

interface Props {
  titre: string;
  questions: QuestionMJ[];
  /** Rappel de règle affiché sous la question (note de la fiche). */
  note?: string;
  /** Appelé après validation (la mémoire de session est mise à jour ici). */
  onValider: () => void;
  onAnnuler: () => void;
}

/**
 * Pop-up « Validation du MJ » : s'interpose entre le clic et la résolution
 * pour toute action à condition (portée, contact, taille, jugement). Le
 * moteur ne modélisant pas les positions, le MJ constate et le panneau
 * journalise la validation (Traçabilité de fin de partie).
 */
export function PopupValidationMJ({ titre, questions, note, onValider, onAnnuler }: Props) {
  const [retenir, setRetenir] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Validation MJ : ${titre}`} className="w-full max-w-md rounded-lg border border-amber-800 bg-zinc-950 p-4 space-y-3">
        <h3 className="font-bold text-sm uppercase text-amber-300">⚖️ Validation du MJ — {titre}</h3>
        <ul className="text-sm space-y-1.5 list-disc pl-5">
          {questions.map((q) => (<li key={q.cle}>{q.question}</li>))}
        </ul>
        {note && <p className="text-xs text-zinc-500">{note}</p>}
        <label className="flex items-center gap-2 text-xs text-zinc-400" title="La condition est mémorisée pour la session : les questions identiques ne seront plus posées (un rechargement d'onglet les réactive).">
          <input type="checkbox" checked={retenir} onChange={(e) => setRetenir(e.target.checked)} />
          <span>Ne plus redemander durant cette session</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (retenir) questions.forEach((q) => mjValider(q.cle));
              onValider();
            }}
            className="py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold"
          >
            ✅ Valider → résoudre
          </button>
          <button onClick={onAnnuler} className="py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 font-semibold">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
