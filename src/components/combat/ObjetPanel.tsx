"use client";
import { useState } from "react";
import type { Character } from "@/src/lib/rules/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Item } from "@/src/lib/rules/world/types";
import { canAct } from "@/src/lib/rules/effects/effects";
import { ActionBadge } from "@/src/components/ui/ActionBadge";
import {
  ACTION_OBJET,
  LIBELLE_OBJET,
  chargesRestantesObjet,
  natureObjetCombat,
  type NatureObjetCombat,
} from "@/src/lib/rules/combat/objets";

const AIDE: Record<NatureObjetCombat, string> = {
  potion: "Action de mouvement (M). Boire ou faire boire une potion, utilisable par tout le monde.",
  parchemin:
    "Action limitée (L). Le test de profil/rang/famille est résolu automatiquement ; le sort lui-même reste à appliquer (cible et effet au MJ).",
  baguette:
    "Action d’attaque (A). Un sort par charge ; les charges sont décrémentées automatiquement.",
};

const VERBE: Record<NatureObjetCombat, string> = {
  potion: "Boire",
  parchemin: "Lire",
  baguette: "Activer",
};

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  itemId: string;
  characters: Character[];
  catalogue: Item[];
  onUtiliser?: (lanceurId: string, itemId: string, cibleId: string) => void;
}

/** Détail d'un objet utilisable en combat, sélectionné depuis la palette. */
export function ObjetPanel({ participants, lanceurId, itemId, characters, catalogue, onUtiliser }: Props) {
  const [cibleChoisie, setCibleChoisie] = useState("");
  const acteur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const fiche = characters.find((c) => c.id === acteur?.templateId) ?? null;
  const entree = fiche?.inventaire?.find((e) => e.itemId === itemId) ?? null;
  const item = catalogue.find((o) => o.id === itemId) ?? null;
  const nature = item ? natureObjetCombat(item) : null;
  if (!acteur || !fiche || !entree || !item || !nature) return null;

  // Une potion peut viser un allié KO (soin) ; les autres objets visent une
  // cible active. La portée et la ligne de vue restent au MJ.
  const cibles = participants.filter((p) =>
    nature === "potion"
      ? p.camp === acteur.camp && p.statut !== "mort"
      : p.statut === "actif"
  );
  const cible =
    cibles.find((p) => p.instanceId === cibleChoisie) ??
    cibles.find((p) => p.instanceId === acteur.instanceId) ??
    cibles[0] ??
    null;
  const bloque = !canAct(acteur.effets);
  const action = ACTION_OBJET[nature];
  const charges = nature === "baguette" ? chargesRestantesObjet(entree, item) : null;
  const epuisee = nature === "baguette" && charges === 0;
  const noteUsage =
    nature === "potion"
      ? "Retirée de l’inventaire après usage."
      : nature === "parchemin"
        ? "Consommé si le sort est lancé ou si l’échec atteint 10 points."
        : "Une charge est consommée par activation.";

  return (
    <div className="rounded-lg border border-sky-900 bg-zinc-900 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-bold text-sm uppercase text-sky-300">
          🎒 Objet — {item.nom}
        </h2>
        <ActionBadge action={action} size="md" />
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">{LIBELLE_OBJET[nature]}</span>
        <span className="text-xs text-zinc-400">
          ×{entree.quantite}
          {charges != null ? ` · ${charges} charge${charges > 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {(item.effet || item.description) && (
        <p className="text-xs text-zinc-300 whitespace-pre-line">
          {item.effet ?? item.description}
        </p>
      )}

      <label className="block text-sm">
        {nature === "potion" ? "Bénéficiaire" : "Cible"}
        <select
          value={cible?.instanceId ?? ""}
          onChange={(e) => setCibleChoisie(e.target.value)}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {cibles.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>
              {p.nom} ({p.pv}/{p.pvMax} PV{p.statut !== "actif" ? ` · ${p.statut}` : ""})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!onUtiliser || bloque || epuisee || !cible || entree.quantite <= 0}
          onClick={() => {
            if (onUtiliser && cible) onUtiliser(acteur.instanceId, item.id, cible.instanceId);
          }}
          className="rounded bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {VERBE[nature]} {nature === "potion" ? "la potion" : nature === "parchemin" ? "le parchemin" : "la baguette"}
        </button>
        <span className="text-[11px] text-zinc-500">{noteUsage}</span>
        {bloque && <span className="text-[11px] text-red-400">Le porteur ne peut pas agir.</span>}
        {epuisee && <span className="text-[11px] text-red-400">Baguette épuisée.</span>}
      </div>

      <p className="text-xs text-zinc-500">{AIDE[nature]}</p>
    </div>
  );
}
