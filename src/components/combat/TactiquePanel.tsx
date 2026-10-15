"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";

interface Props {
  participants: CombatParticipant[];
  acteurId: string | null;
  /** Applique la posture (effet 1 round, journalisé). */
  onAppliquer: (cibleId: string, cle: string, duree: number | null) => void;
}

/**
 * Options tactiques déclaratives (LDB) : se jouent AU LIEU d'attaquer
 * (économie d'actions gérée en réel par le MJ).
 * - Défense partielle (A) : +3 DEF 1 round ; totale (L) : +5 DEF 1 round
 *   (générales : contact, distance, magie ; tests opposés : MJ).
 * - Riposte (L ou A, au contact) : posture 1 round ; si attaqué au contact,
 *   le MJ fait riposter immédiatement (sélectionner le riposteur comme
 *   attaquant, 1/round — avant sa propre initiative : attaque seule).
 * - Soutenir (L) : +5 en attaque au contact à un allié contre la créature
 *   désignée, jusqu'au tour de l'allié au round suivant (MJ : contact,
 *   créature désignée, action offensive).
 */
export function TactiquePanel({ participants, acteurId, onAppliquer }: Props) {
  const [cibleId, setCibleId] = useState<string | null>(null);
  const actifs = participants.filter((p) => p.statut === "actif");
  if (actifs.length === 0) return null;
  const acteur = participants.find((p) => p.instanceId === acteurId) ?? null;
  const cible = actifs.find((p) => p.instanceId === cibleId) ?? acteur ?? actifs[0];
  const estAllie = !!acteur && !!cible && cible.instanceId !== acteur.instanceId && cible.camp === acteur.camp;

  const boutons: { cle: string; titre: string; label: string; aide: string; actif: boolean }[] = [
    { cle: "defense-partielle", titre: "Défense partielle (A) : +3 DEF 1 round (générale)", label: `Défense partielle (+3 DEF)`, aide: "+3 en DEF et aux tests opposés (MJ) pendant 1 round.", actif: true },
    { cle: "defense-totale", titre: "Défense totale (L) : +5 DEF 1 round (générale)", label: `Défense totale (+5 DEF)`, aide: "+5 en DEF et aux tests opposés (MJ) pendant 1 round.", actif: true },
    { cle: "riposte-posture", titre: "Riposte (L ou A, au contact) : posture 1 round, riposte immédiate si attaqué", label: "Posture de riposte", aide: "Déclarée en début de round ; le MJ fait riposter (1/round).", actif: true },
    { cle: "soutien-tactique", titre: "Soutenir (L) : +5 au contact à un allié contre la créature désignée", label: "Soutenir un allié (+5)", aide: "Cible = un allié (pas soi). MJ : contact, créature désignée.", actif: estAllie },
  ];

  return (
    <div className="rounded-lg border border-teal-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-teal-300">Options tactiques</h2>
      <p className="text-xs text-zinc-500">Postures LDB (au lieu d&apos;attaquer — actions gérées en réel par le MJ).</p>
      <label className="block text-sm">Bénéficiaire
        <select value={cible.instanceId} onChange={(e) => setCibleId(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {actifs.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} — {p.pv}/{p.pvMax} PV{p.camp === acteur?.camp ? "" : " (adverse)"}</option>
          ))}
        </select>
      </label>
      <div className="space-y-1.5">
        {boutons.map((b) => (
          <button
            key={b.cle}
            onClick={() => onAppliquer(cible.instanceId, b.cle, 1)}
            disabled={!b.actif}
            title={`${b.titre}${b.cle === "soutien-tactique" && !b.actif ? " — choisissez un allié (pas soi-même)" : ""}`}
            className="w-full text-left px-3 py-2 rounded bg-zinc-800 hover:bg-teal-900 text-sm disabled:opacity-40"
          >
            <span className="font-semibold">{b.label}</span>
            <span className="block text-xs text-zinc-400">{b.aide}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
