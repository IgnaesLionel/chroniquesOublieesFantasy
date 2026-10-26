"use client";
import { useMemo, useState } from "react";
import type { ActionDRS } from "@/src/lib/rules/types";
import { ACTION_DESCRIPTION } from "@/src/lib/data/capacites";
import { ActionBadge } from "@/src/components/ui/ActionBadge";

export type TypeActionCombat = "attaque" | "soutien" | "capacite" | "objet";

export interface SelectionActionCombat {
  type: TypeActionCombat;
  id: string;
}

export interface EntreeActionCombat {
  type: TypeActionCombat;
  id: string;
  nom: string;
  action?: ActionDRS | null;
  /** Arme, sort offensif, sort de soutien, talent… */
  sousTitre: string;
  /** Résumé court : bonus, dégâts, coût, portée, soin… */
  details: string;
  disponible: boolean;
  /** Explication courte quand l'action n'est pas lançable maintenant. */
  raison?: string;
}

const GROUPES: { type: TypeActionCombat; titre: string; icone: string; teinte: string }[] = [
  { type: "attaque", titre: "Attaques", icone: "⚔️", teinte: "text-red-300" },
  { type: "soutien", titre: "Soutien", icone: "🛡️", teinte: "text-emerald-300" },
  { type: "capacite", titre: "Capacités", icone: "✨", teinte: "text-amber-300" },
  { type: "objet", titre: "Objets", icone: "🎒", teinte: "text-sky-300" },
];

const FILTRES: { id: "tous" | TypeActionCombat; label: string }[] = [
  { id: "tous", label: "Toutes" },
  { id: "attaque", label: "Attaques" },
  { id: "soutien", label: "Soutien" },
  { id: "capacite", label: "Capacités" },
  { id: "objet", label: "Objets" },
];

function sansAccents(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface Props {
  entrees: EntreeActionCombat[];
  selection: SelectionActionCombat | null;
  onSelection: (selection: SelectionActionCombat) => void;
}

/**
 * Palette unique des actions de combat : armes, sorts offensifs, sorts de
 * soutien et capacités au même endroit. Elle remplace les anciens onglets
 * Action / Capacités / Soutien et sert de sélecteur au panneau de détail.
 */
export function ActionPalette({ entrees, selection, onSelection }: Props) {
  const [filtre, setFiltre] = useState<"tous" | TypeActionCombat>("tous");
  const [recherche, setRecherche] = useState("");

  const compte = useMemo(() => {
    const parType: Record<TypeActionCombat, number> = { attaque: 0, soutien: 0, capacite: 0, objet: 0 };
    for (const e of entrees) parType[e.type] += 1;
    return parType;
  }, [entrees]);

  const q = sansAccents(recherche.trim());
  const filtrees = useMemo(() => {
    return entrees.filter((e) => {
      if (filtre !== "tous" && e.type !== filtre) return false;
      if (!q) return true;
      const texte = sansAccents(`${e.nom} ${e.sousTitre} ${e.details} ${e.raison ?? ""}`);
      return texte.includes(q);
    });
  }, [entrees, filtre, q]);

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">Rechercher une action</span>
        <input
          id="action-recherche"
          name="action-recherche"
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une action…"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer les actions">
        {FILTRES.map((f) => {
          const n = f.id === "tous" ? entrees.length : compte[f.id];
          if (f.id !== "tous" && n === 0) return null;
          const actif = filtre === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={actif}
              onClick={() => setFiltre(f.id)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                actif
                  ? "border-amber-500 bg-amber-400/15 text-amber-200"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {f.label} <span className="font-mono opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="max-h-64 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/50 p-1.5">
        {filtrees.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">Aucune action ne correspond à cette recherche.</p>
        ) : (
          <div className="space-y-2">
            {GROUPES.map((g) => {
              const items = filtrees.filter((e) => e.type === g.type);
              if (items.length === 0) return null;
              return (
                <section key={g.type} aria-label={g.titre}>
                  <div className={`sticky top-0 z-[1] flex items-center justify-between bg-zinc-950/95 px-1 py-1 text-[10px] font-bold uppercase tracking-wide ${g.teinte}`}>
                    <span>{g.icone} {g.titre}</span>
                    <span className="font-mono text-zinc-500">{items.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((e) => {
                      const estSel = selection?.type === e.type && selection.id === e.id;
                      const description = e.action ? ACTION_DESCRIPTION[e.action] : "Passif";
                      return (
                        <button
                          key={`${e.type}:${e.id}`}
                          type="button"
                          aria-pressed={estSel}
                          aria-disabled={!e.disponible}
                          onClick={() => {
                            if (e.disponible) onSelection({ type: e.type, id: e.id });
                          }}
                          title={`${description} — ${e.details}${e.raison ? ` — ${e.raison}` : ""}`}
                          className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left transition ${
                            estSel
                              ? "border-amber-500/70 bg-amber-400/10"
                              : e.disponible
                                ? "border-transparent hover:bg-zinc-800/70"
                                : "cursor-not-allowed border-transparent opacity-60"
                          }`}
                        >
                          <ActionBadge action={e.action} size="md" className="mt-0.5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-zinc-100">{e.nom}</span>
                              <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400">
                                {e.sousTitre}
                              </span>
                            </span>
                            {e.details ? <span className="block truncate text-[11px] text-zinc-400">{e.details}</span> : null}
                            {!e.disponible && e.raison ? (
                              <span className="block text-[10px] text-red-400">⛔ {e.raison}</span>
                            ) : null}
                          </span>
                          {estSel ? <span className="shrink-0 text-xs text-amber-300" aria-hidden>✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        A / M / L / G = attaque, mouvement, limitée, gratuite. Le logiciel affiche l&apos;économie d&apos;action mais ne la décrémente pas automatiquement.
      </p>
    </div>
  );
}
