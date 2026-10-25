"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ActionDRS } from "@/src/lib/rules/types";
import { ACTION_LABEL } from "@/src/lib/data/capacites";
import { ActionBadge } from "@/src/components/ui/ActionBadge";

export interface OptionArmeSort {
  id: string;
  nom: string;
  action: ActionDRS;
  details: string;
  disabled: boolean;
  raison?: string;
}

interface Props {
  id?: string;
  /** Libellé accessible du champ (« Arme / sort »). */
  label: string;
  value: string;
  options: OptionArmeSort[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

/**
 * Sélecteur d'arme/sort avec badges d'action colorés (A/M/L/G).
 * Le `<select>` natif ne permet pas de colorer une partie du texte : ce
 * listbox reprend les mêmes informations avec des badges lisibles.
 */
export function ArmeSortSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const racineRef = useRef<HTMLDivElement>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = useId();

  const selection = options.find((o) => o.id === value) ?? options[0] ?? null;
  const indexSelection = Math.max(
    0,
    options.findIndex((o) => o.id === selection?.id)
  );

  const prochainIndex = (depart: number, delta: number) => {
    if (options.length === 0) return 0;
    let index = depart;
    for (let n = 0; n < options.length; n += 1) {
      index = ((index + delta) % options.length + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return depart;
  };

  const ouvrir = () => {
    if (disabled || options.length === 0) return;
    setIndexActif(indexSelection);
    setOuvert(true);
  };

  const fermer = (rendreFocus = true) => {
    setOuvert(false);
    if (rendreFocus) boutonRef.current?.focus();
  };

  const choisir = (option: OptionArmeSort) => {
    if (option.disabled) return;
    onChange(option.id);
    fermer();
  };

  useEffect(() => {
    if (!ouvert) return;
    const surClicExterieur = (e: MouseEvent) => {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    optionRefs.current[indexActif]?.scrollIntoView({ block: "nearest" });
  }, [ouvert, indexActif]);

  const surTouche = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Escape") {
      if (ouvert) {
        e.preventDefault();
        fermer();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) {
        ouvrir();
        return;
      }
      setIndexActif((index) => prochainIndex(index, e.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      if (!ouvert) return;
      e.preventDefault();
      setIndexActif(e.key === "Home" ? prochainIndex(-1, 1) : prochainIndex(options.length, -1));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!ouvert) {
        ouvrir();
        return;
      }
      const option = options[indexActif];
      if (option) choisir(option);
    }
  };

  const optionActive = ouvert ? options[indexActif] : null;

  return (
    <div
      ref={racineRef}
      className="relative mt-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOuvert(false);
      }}
    >
      <button
        ref={boutonRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? listboxId : undefined}
        aria-activedescendant={ouvert && optionActive ? `${listboxId}-${optionActive.id}` : undefined}
        aria-label={`${label} : ${selection?.nom ?? "aucune"}${
          selection ? ` — ${ACTION_LABEL[selection.action]}` : ""
        }`}
        onClick={() => (ouvert ? fermer(false) : ouvrir())}
        onKeyDown={surTouche}
        className="flex w-full items-center gap-2 rounded bg-zinc-800 px-2 py-2 text-left text-sm hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
      >
        {selection ? (
          <>
            <ActionBadge action={selection.action} size="md" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-zinc-100">{selection.nom}</span>
              {selection.details ? <span className="text-zinc-400"> · {selection.details}</span> : null}
            </span>
            <span
              aria-hidden="true"
              className={`text-zinc-400 transition-transform ${ouvert ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </>
        ) : (
          <span className="text-zinc-500">Aucune attaque</span>
        )}
      </button>
      {ouvert && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Armes et sorts"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded border border-zinc-600 bg-zinc-900 py-1 shadow-2xl"
        >
          {options.map((option, index) => (
            <div
              key={option.id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              id={`${listboxId}-${option.id}`}
              role="option"
              aria-selected={option.id === selection?.id}
              aria-disabled={option.disabled || undefined}
              title={option.disabled && option.raison ? option.raison : ACTION_LABEL[option.action]}
              onMouseEnter={() => {
                if (!option.disabled) setIndexActif(index);
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(option)}
              className={`flex items-start gap-2 px-2.5 py-2 text-sm ${
                option.disabled
                  ? "cursor-not-allowed opacity-50"
                  : index === indexActif
                    ? "cursor-pointer bg-amber-400/15"
                    : "cursor-pointer hover:bg-zinc-800"
              }`}
            >
              <ActionBadge action={option.action} size="md" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-zinc-100">{option.nom}</span>
                {option.details ? <span className="text-zinc-400"> · {option.details}</span> : null}
                {option.disabled && option.raison ? (
                  <span className="block text-[11px] text-red-400">{option.raison}</span>
                ) : null}
              </span>
              {option.id === selection?.id ? (
                <span className="text-amber-300" aria-label="Sélectionné">
                  ✓
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
