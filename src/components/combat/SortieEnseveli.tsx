"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { SortieEnseveliResolution } from "@/src/lib/rules/combat/attack";

interface Props {
  /** Participant enseveli (Ensevelissement) : seule la sortie de terre est possible. */
  participant: CombatParticipant;
  /** Lance le test : d20 + FOR/AGI + aides ≥ 15. Retourne le résultat (ou null si refusé). */
  onSortie: (cibleId: string, carac: "FOR" | "AGI", aides: number) => SortieEnseveliResolution | null;
}

/**
 * Action limitée d'un personnage enseveli : creuser pour sortir de terre.
 * Le moteur interdit toute autre action (empecheAgir) ; ce panneau est donc
 * la seule action proposée à l'acteur tant que l'effet « Enseveli » est actif.
 */
export function SortieEnseveli({ participant, onSortie }: Props) {
  const [carac, setCarac] = useState<"FOR" | "AGI">("FOR");
  const [aides, setAides] = useState("");
  const [dernier, setDernier] = useState<SortieEnseveliResolution | null>(null);

  const bonusCarac = participant.caracs?.[carac] ?? 0;
  const bonusAides = Math.max(0, Math.min(5, Math.floor(Number(aides) || 0))) * 2;

  return (
    <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 space-y-2">
      <div className="text-xs uppercase text-amber-300 font-bold">⛏ Sortie de terre — action limitée</div>
      <p className="text-[11px] text-amber-200/80">
        Test de FOR ou AGI, difficulté 15. Chaque aide qui creuse donne +2 (max +10).
        Réussite : libre de ses actions ; échec : reste enseveli (2d4° dégâts en fin de tour).
      </p>
      <div className="flex flex-wrap gap-1.5">
        <select
          id="sortie-carac"
          name="carac"
          value={carac}
          onChange={(e) => setCarac(e.target.value as "FOR" | "AGI")}
          title="Caractéristique au choix de la cible"
          className="flex-1 min-w-24 bg-zinc-800 rounded px-1.5 py-1.5 text-sm"
        >
          <option value="FOR">FOR {participant.caracs?.FOR != null ? `(${participant.caracs.FOR >= 0 ? "+" : ""}${participant.caracs.FOR})` : ""}</option>
          <option value="AGI">AGI {participant.caracs?.AGI != null ? `(${participant.caracs.AGI >= 0 ? "+" : ""}${participant.caracs.AGI})` : ""}</option>
        </select>
        <input
          id="sortie-aides"
          name="aides"
          value={aides}
          onChange={(e) => setAides(e.target.value)}
          placeholder="Aides"
          inputMode="numeric"
          title="Personnes qui creusent : +2 chacune (max +10)"
          className="w-16 bg-zinc-800 rounded px-1.5 py-1.5 text-sm text-center"
        />
        <button
          onClick={() => setDernier(onSortie(participant.instanceId, carac, Number(aides) || 0))}
          className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold whitespace-nowrap"
        >
          🎲 Lancer les dés (d20 + {bonusCarac} {bonusAides > 0 ? `+ ${bonusAides} ` : ""}≥ 15)
        </button>
      </div>
      {dernier && (
        <div
          className={`rounded border px-2 py-1 text-xs font-semibold ${
            dernier.reussie
              ? "border-green-700 bg-green-950/50 text-green-300"
              : "border-red-800 bg-red-950/40 text-red-300"
          }`}
        >
          Jet {dernier.jetNaturel} + {dernier.jetTotal - dernier.jetNaturel} = {dernier.jetTotal} vs 15 →{" "}
          {dernier.reussie ? "LIBRE, sorti de terre !" : "toujours enseveli"}
        </div>
      )}
    </div>
  );
}
