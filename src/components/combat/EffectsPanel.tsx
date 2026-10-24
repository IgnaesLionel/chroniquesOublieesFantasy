"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { canAct, decrireModificateurs } from "@/src/lib/rules/effects/effects";
import { familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

interface Props {
  /** Tous les participants : choix de la cible de l'effet (pas forcément l'acteur). */
  participants: CombatParticipant[];
  /** Participant dont on affiche/retire les effets. */
  participant: CombatParticipant | null;
  /** `cibleId` = receveur de l'effet (lanceur, allié ou ennemi). */
  onAdd: (cibleId: string, key: string, duree: number | null) => void;
  onRemove: (effetId: string) => void;
  /** Tenter de sortir d'Ensevelissement (action limitée, FOR/AGI + aides). */
  onSortie?: (cibleId: string, carac: "FOR" | "AGI", aides: number) => void;
}

/** Nom + PV + état, pour distinguer les cibles homonymes (#1, #2...). */
function libelleCible(p: CombatParticipant): string {
  const etat = p.statut === "actif" ? "" : ` — ${p.statut === "ko" ? "KO" : "mort"}`;
  return `${p.nom} — ${p.pv}/${p.pvMax} PV${etat}`;
}

export function EffectsPanel({ participants, participant, onAdd, onRemove, onSortie }: Props) {
  const [key, setKey] = useState("empoisonne");
  const [duree, setDuree] = useState("3");
  const [sortieCarac, setSortieCarac] = useState<"FOR" | "AGI">("FOR");
  const [sortieAides, setSortieAides] = useState("");
  /**
   * Cible choisie, liée à l'acteur affiché : changer d'acteur remet la cible
   * sur lui (comportement historique), mais un choix explicite (ennemi,
   * allié) persiste tant qu'on reste sur le même acteur.
   */
  const [choixCible, setChoixCible] = useState<{ acteur: string; cible: string } | null>(null);

  if (!participant) return null;
  const acteurId = participant.instanceId;
  const cibleId = choixCible?.acteur === acteurId ? choixCible.cible : acteurId;
  const cible = participants.find((p) => p.instanceId === cibleId) ?? participant;
  const autres = participants.filter((p) => p.instanceId !== acteurId);

  const enseveli = participant.effets.some((e) => (e.modificateurs["inciblable"] ?? 0) > 0);
  // Tous les modificateurs fusionnés (attaque, DEF, dés, paralysie, marqueurs MJ...).
  const modsFusionnes: Record<string, number> = {};
  for (const e of participant.effets) {
    for (const [k, v] of Object.entries(e.modificateurs)) {
      if (typeof v === "number") modsFusionnes[k] = (modsFusionnes[k] ?? 0) + v;
    }
  }
  const lignesMods = decrireModificateurs(modsFusionnes);

  return (
    <div className="rounded-lg border border-violet-900 bg-zinc-900 p-2.5 space-y-1.5">
      <h2 className="font-bold text-xs uppercase text-violet-300">✦ Effets — {participant.nom} <FamilleBadge famille={participant.camp === "pj" ? familleDuProfil(participant.profil) : null} className="ml-1" /></h2>
      {!canAct(participant.effets) && (
        <div className="text-[11px] font-bold text-red-400 bg-red-950 border border-red-800 rounded px-1.5 py-1">Ne peut pas agir (Étourdi/Paralysé/Surpris)</div>
      )}
      {lignesMods.length > 0 && (
        <div className="text-[11px] text-amber-300">Modificateurs : {lignesMods.join(" · ")}</div>
      )}
      {participant.effets.length === 0 && <p className="text-xs text-zinc-500">Aucun effet actif.</p>}
      {participant.effets.length > 0 && (
        <ul className="space-y-1 max-h-44 overflow-auto pr-1">
          {participant.effets.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
              <span className="min-w-0">
                <span className="font-semibold">{e.nom}</span>
                <span className="text-[11px] text-zinc-400 ml-1.5">{e.toursRestants ?? "∞"} tour(s){e.source ? ` · ${e.source}` : ""}</span>
              </span>
              <button
                onClick={() => onRemove(e.id)}
                aria-label={`Retirer ${e.nom}`}
                title="Retirer l'effet"
                className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-red-900"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {enseveli && onSortie && (
        <div className="rounded border border-amber-800 bg-amber-950/30 p-1.5 space-y-1">
          <div className="text-[11px] uppercase text-amber-300/90 font-bold">Sortie d&apos;Ensevelissement (action limitée)</div>
          <div className="flex gap-1.5">
            <select id="effet-sortie-carac" name="sortieCarac" value={sortieCarac} onChange={(e) => setSortieCarac(e.target.value as "FOR" | "AGI")} title="Caractéristique au choix de la cible" className="flex-1 bg-zinc-800 rounded px-1.5 py-1 text-xs">
              <option value="FOR">FOR</option>
              <option value="AGI">AGI</option>
            </select>
            <input id="effet-aides" name="aides" value={sortieAides} onChange={(e) => setSortieAides(e.target.value)} placeholder="Aides" title="Personnes qui creusent : +2 chacune (max +10)" className="w-14 bg-zinc-800 rounded px-1.5 py-1 text-xs text-center" />
            <button
              onClick={() => onSortie(participant.instanceId, sortieCarac, Number(sortieAides) || 0)}
              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
            >
              Creuser (diff 15)
            </button>
          </div>
        </div>
      )}
      <div className="border-t border-zinc-800 pt-1.5 space-y-1">
        <label className="block text-[11px] text-zinc-400" title="L'effet peut viser n'importe quel participant : lanceur, allié ou ennemi">
          Appliquer l&apos;effet à
          <select
            id="effet-cible"
            name="cible"
            value={cibleId}
            onChange={(e) => setChoixCible({ acteur: acteurId, cible: e.target.value })}
            className="mt-0.5 w-full bg-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
          >
            <option value={participant.instanceId}>{libelleCible(participant)}</option>
            {autres.length > 0 && (
              <optgroup label="Autres participants">
                {autres.map((p) => (
                  <option key={p.instanceId} value={p.instanceId}>{libelleCible(p)}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <div className="flex gap-1.5">
          <select id="effet-cle" name="effet" value={key} onChange={(e) => setKey(e.target.value)} className="min-w-0 flex-1 bg-zinc-800 rounded px-2 py-1 text-xs">
            {EFFECT_CATALOG.map((t) => (
              <option key={t.key} value={t.key}>{t.nom} ({t.dureeDefaut ?? "∞"} tours)</option>
            ))}
          </select>
          <input id="effet-duree" name="duree" value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="3" title="Durée en tours (vide = défaut)" className="w-12 bg-zinc-800 rounded px-1.5 py-1 text-xs text-center" />
          <button
            onClick={() => onAdd(cible.instanceId, key, duree === "" ? null : Number(duree))}
            title={`Appliquer à ${cible.nom}`}
            className="px-2.5 py-1 rounded bg-violet-700 hover:bg-violet-600 text-xs font-semibold whitespace-nowrap"
          >
            + Effet
          </button>
        </div>
      </div>
    </div>
  );
}
