"use client";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { capacitesCreature } from "@/src/lib/rules/combat/fiche-creature";
import { pvTexteColor } from "@/src/lib/ui/pv";

/**
 * Fiche de créature ouverte depuis la table de combat (capacités du bestiaire).
 * Informative : ces capacités ne sont pas automatisées par le moteur, le MJ
 * les applique (journal de combat pour la trace).
 */
export function FicheCreature({
  participant: p,
  onClose,
}: {
  participant: CombatParticipant;
  onClose: () => void;
}) {
  const capacites = capacitesCreature(p);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiche-creature-titre"
        className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="fiche-creature-titre" className="font-bold text-xl">
              {p.nom} <span className="font-mono text-sm text-zinc-400">NC {p.niveau}</span>
            </h3>
            <div className="text-xs text-zinc-400">
              {p.statut === "actif" ? "actif" : p.statut === "ko" ? "KO" : "mort"}
              {(p.sousCategories ?? []).length > 0 ? ` · 💀 ${(p.sousCategories ?? []).join(", ")}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700" aria-label="Fermer la fiche">
            ✕
          </button>
        </div>

        <div className={`font-mono text-sm ${pvTexteColor(p.pv, p.pvMax)}`}>
          {p.pv}/{p.pvMax} PV
          <span className="text-green-400"> · Déf {p.defense}</span>
          {p.initiative != null ? <span className="text-zinc-400"> · Init {p.initiative}</span> : null}
        </div>

        {p.attaques.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs uppercase text-zinc-400 font-bold">Attaques</div>
            {p.attaques.map((a) => (
              <div key={a.id} className="text-sm">
                ⚔ {a.nom} {a.bonus >= 0 ? "+" : ""}{a.bonus} · {a.degatsAffiche ?? a.degats}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs uppercase text-zinc-400 font-bold">Capacités</div>
          {capacites.length === 0 && (
            <p className="text-sm text-zinc-500">Aucune capacité décrite dans le bestiaire.</p>
          )}
          {capacites.map((c) => (
            <div key={c.nom} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-2">
              <div className="font-semibold">
                {c.origine === "partagee" ? "⛓ " : ""}
                {c.nom}
                {c.resume ? <span className="ml-1 text-xs font-normal text-zinc-400">— {c.resume}</span> : null}
              </div>
              {c.texte ? (
                <p className="text-xs text-zinc-300 mt-1 whitespace-pre-line">{c.texte}</p>
              ) : (
                <p className="text-xs text-zinc-500 mt-1">Texte non fourni par le bestiaire (voir la fiche).</p>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-500">
          Fiche informative : le moteur n&apos;applique pas ces capacités, le MJ les joue (validation au journal si nécessaire).
        </p>
      </div>
    </div>
  );
}
