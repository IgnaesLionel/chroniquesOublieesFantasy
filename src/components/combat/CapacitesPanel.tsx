"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { CAPACITES_USABLES } from "@/src/lib/data/capacites-usables";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";
import { canAct } from "@/src/lib/rules/effects/effects";

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  onUtiliser: (
    lanceurId: string,
    cibleId: string,
    talentNom: string,
    opts: {
      effetCle: string | null;
      dureeTours: number | null;
      mods: Record<string, number> | undefined;
      coutPV: string | undefined;
      actionSpeciale: "renvoi" | "compagnon" | undefined;
      soin: string | undefined;
      nettoie: boolean | undefined;
    }
  ) => void;
}

function defautPour(nom: string) {
  const q = normaliserNomCapacite(nom);
  return CAPACITES_USABLES.find((u) => normaliserNomCapacite(u.talent) === q);
}

export function CapacitesPanel({ participants, lanceurId, onUtiliser }: Props) {
  const lanceur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const [talentNom, setTalentNom] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [effetCle, setEffetCle] = useState<string>("");
  const [duree, setDuree] = useState<string>("");

  if (!lanceur || lanceur.capacites.length === 0) return null;
  const talent = lanceur.capacites.includes(talentNom ?? "") ? talentNom! : lanceur.capacites[0];
  const defaut = defautPour(talent);
  const effetActif = effetCle || defaut?.effetCle || "";
  const dureeActive = duree !== "" ? Number(duree) : defaut?.dureeTours ?? null;
  const actifs = participants.filter((p) => p.statut === "actif");
  // Cibles proposées selon le type de capacité : "soi" = posture sur soi
  // (Parer, Absorber...), "allies" = alliés hors soi (Protéger...),
  // "ennemis" = camp adverse, "tous" = tout le monde.
  const ciblesPossibles =
    defaut?.cibles === "soi"
      ? actifs.filter((p) => p.instanceId === lanceur.instanceId)
      : defaut?.cibles === "allies"
        ? actifs.filter((p) => p.camp === lanceur.camp && p.instanceId !== lanceur.instanceId)
        : defaut?.cibles === "ennemis"
          ? actifs.filter((p) => p.camp !== lanceur.camp)
          : actifs;
  // Strict : pas de repli vers soi ou vers un ennemi. Si la liste est vide
  // (ex. Protéger sans allié actif), le bouton reste désactivé.
  const cibles = ciblesPossibles;
  const cible = cibles.find((p) => p.instanceId === cibleId)
    ?? cibles[0] ?? null;
  const bloque = !canAct(lanceur.effets);

  return (
    <div className="rounded-lg border border-amber-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-amber-300">Capacités</h2>
      <label className="block text-sm">Talent
        <select
          value={talent}
          onChange={(e) => { setTalentNom(e.target.value); setEffetCle(""); setDuree(""); setCibleId(null); }}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {lanceur.capacites.map((t) => (
            <option key={t} value={t}>◈ {t}</option>
          ))}
        </select>
      </label>
      {defaut && (
        <p className="text-xs text-zinc-500">
          Effet suggéré : {defaut.effetCle ? (EFFECT_CATALOG.find((t) => t.key === defaut.effetCle)?.nom ?? defaut.effetCle) : "aucun (narratif)"}
          {defaut.dureeTours != null ? ` (${defaut.dureeTours} tour${defaut.dureeTours > 1 ? "s" : ""})` : ""}{defaut.coutPV ? ` · sacrifie ${defaut.coutPV} PV` : ""}{defaut.soin ? ` · soigne ${defaut.soin}` : ""}{defaut.nettoie ? " · purge" : ""} · Cibles : {defaut.cibles === "allies" ? "alliés" : defaut.cibles === "ennemis" ? "ennemis" : defaut.cibles === "soi" ? "soi-meme" : "tous"}.
          {defaut.note ? ` ${defaut.note}` : ""}
        </p>
      )}
      <label className="block text-sm">Cible
        <select value={cible?.instanceId ?? ""} onChange={(e) => setCibleId(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {cibles.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>
              {p.nom} — {p.pv}/{p.pvMax} PV{p.effets.length > 0 ? ` · ✦${p.effets.length}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Effet appliqué
          <select value={effetActif} onChange={(e) => setEffetCle(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            <option value="">Aucun (narratif)</option>
            {EFFECT_CATALOG.map((t) => <option key={t.key} value={t.key}>{t.nom}</option>)}
          </select>
        </label>
        <label className="block text-sm">Durée (tours)<input
          type="number" min={1} value={duree} placeholder={defaut?.dureeTours != null ? String(defaut.dureeTours) : "∞"}
          onChange={(e) => setDuree(e.target.value)}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
        /></label>
      </div>
      {cibles.length === 0 && (
        <p className="text-xs text-red-400">Aucune cible valide pour ce talent (aucun allié actif).</p>
      )}
      <button
        onClick={() => {
          if (cible) {
            onUtiliser(lanceur.instanceId, cible.instanceId, talent, {
              effetCle: effetActif || null,
              dureeTours: dureeActive,
              mods: defaut?.mods,
              coutPV: defaut?.coutPV,
              actionSpeciale: defaut?.actionSpeciale,
              soin: defaut?.soin,
              nettoie: defaut?.nettoie,
            });
          }
        }}
        disabled={bloque || !cible}
        className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40"
      >
        Utiliser {talent}{defaut?.coutPV ? ` (${defaut.coutPV} PV)` : ""}{defaut?.actionSpeciale === "renvoi" ? " ↩" : ""}{defaut?.actionSpeciale === "compagnon" ? " 🐺" : ""}
      </button>
    </div>
  );
}
