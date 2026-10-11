"use client";
import { useState } from "react";
import type { Character, Sort } from "@/src/lib/rules/types";
import {
  lancerSortHorsCombat,
  sortLancableHorsCombat,
  sortUtilisable,
} from "@/src/lib/rules/combat/attack";

const LETTRE_ACTION: Record<string, string> = { attaque: "A", mouvement: "M", limitee: "L", gratuite: "G" };

interface Props {
  characters: Character[];
  onUpdate: (next: Character[]) => void;
}

/**
 * Lancement de sorts de soutien hors combat (défensifs / utilitaires).
 * L'action DRS (A/M/L) et les limites par combat sont ignorées hors combat ;
 * seuls le niveau, le mana et le sacrifice PV comptent. Offensifs, zones
 * et invocations : en combat uniquement.
 */
export function HorsCombatPanel({ characters, onUpdate }: Props) {
  const [lanceurId, setLanceurId] = useState<string | null>(null);
  const [sortId, setSortId] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lanceurs = characters.filter((c) => (c.sorts ?? []).length > 0);
  if (lanceurs.length === 0) return null;

  const lanceur = lanceurs.find((c) => c.id === lanceurId) ?? lanceurs[0];
  const sorts = lanceur.sorts ?? [];
  const triés = [...sorts].sort((a, b) => {
    const la = sortLancableHorsCombat(a).ok ? 0 : 1;
    const lb = sortLancableHorsCombat(b).ok ? 0 : 1;
    return la - lb;
  });
  const sort =
    triés.find((s) => s.id === sortId && sortLancableHorsCombat(s).ok && sortUtilisable(lanceur.niveau, s).ok) ??
    triés.find((s) => sortLancableHorsCombat(s).ok && sortUtilisable(lanceur.niveau, s).ok) ??
    triés.find((s) => s.id === sortId) ??
    triés[0];
  const cible = characters.find((c) => c.id === cibleId) ?? lanceur;
  const mana = lanceur.ressources?.["mana"];

  const lancer = () => {
    setMessage(null);
    setErreur(null);
    if (!sort) return;
    try {
      const { lanceur: l2, cible: c2, resolution } = lancerSortHorsCombat(lanceur, cible, sort);
      onUpdate(
        characters.map((c) => {
          if (c.id === l2.id && c.id === c2.id) return l2;
          if (c.id === l2.id) return l2;
          if (c.id === c2.id) return c2;
          return c;
        })
      );
      const parties = [`${resolution.lanceurNom} lance ${resolution.sortNom} sur ${resolution.cibleNom}`];
      if (resolution.manaPaye > 0) parties.push(`−${resolution.manaPaye} mana`);
      if (resolution.pvSacrifie > 0) parties.push(`−${resolution.pvSacrifie} PV sacrifiés`);
      if (resolution.soinTotal > 0) {
        parties.push(`+${resolution.soinTotal} PV (${resolution.soinDetails.join(", ")}) : ${resolution.pvAvant} → ${resolution.pvApres}`);
      } else {
        parties.push("effet narratif (MJ)");
      }
      if (resolution.effetNom) parties.push(`✦ ${resolution.effetNom}`);
      if (resolution.attaqueAccordee) parties.push(`⚔ ${resolution.attaqueAccordee}`);
      setMessage(parties.join(" · "));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Sort impossible.");
    }
  };

  const libelleSort = (s: Sort): string => {
    const lancable = sortLancableHorsCombat(s);
    const niv = sortUtilisable(lanceur.niveau, s);
    const ok = lancable.ok && niv.ok;
    const flags = [
      LETTRE_ACTION[s.action ?? "attaque"] ?? "A",
      s.soin ? `+${s.soin}` : "",
      s.cout ? `${s.cout.montant} mana` : "",
      s.coutPV ? `${s.coutPV} PV` : "",
      s.effetCle ? `✦${s.effetCle}` : "",
      s.attaqueAccordee ? "+attaque" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const raison = !lancable.ok ? lancable.raison : !niv.ok ? niv.raison : null;
    return `${s.nom} · ${flags}${ok ? "" : ` (${raison})`}`;
  };

  return (
    <div className="rounded-lg border border-emerald-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-emerald-300">
        Sorts hors combat
        {mana ? <span className="ml-2 font-mono normal-case">mana {mana.actuel}/{mana.max}</span> : null}
      </h2>
      <p className="text-xs text-zinc-500">
        Soutien hors combat : action (A/M/L) ignorée, pas de limite d&apos;action ni de mouvement.
        Niveau, mana et PV sacrifiés appliqués. Offensifs, zones et invocations : en combat uniquement.
      </p>
      <label className="block text-sm">Lanceur
        <select
          value={lanceur.id}
          onChange={(e) => { setLanceurId(e.target.value); setSortId(null); setMessage(null); setErreur(null); }}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {lanceurs.map((c) => {
            const nb = (c.sorts ?? []).filter((s) => sortLancableHorsCombat(s).ok).length;
            const m = c.ressources?.["mana"];
            return (
              <option key={c.id} value={c.id}>
                {c.nom} — {c.pv}/{c.pvMax} PV{m ? ` · ${m.actuel}/${m.max} mana` : ""} · {nb} sort(s) hors combat
              </option>
            );
          })}
        </select>
      </label>
      <label className="block text-sm">Sort
        <select
          value={sort?.id ?? ""}
          onChange={(e) => { setSortId(e.target.value); setMessage(null); setErreur(null); }}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {triés.map((s) => {
            const ok = sortLancableHorsCombat(s).ok && sortUtilisable(lanceur.niveau, s).ok;
            return (
              <option key={s.id} value={s.id} disabled={!ok}>
                {s.type === "offensif" ? "✦ " : "🛡 "}{libelleSort(s)}
              </option>
            );
          })}
        </select>
      </label>
      <label className="block text-sm">Bénéficiaire
        <select
          value={cible.id}
          onChange={(e) => { setCibleId(e.target.value); setMessage(null); setErreur(null); }}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.nom} — {c.pv}/{c.pvMax} PV</option>
          ))}
        </select>
      </label>
      {sort && <p className="text-xs text-zinc-500">{sort.description ?? "Aucune description."}</p>}
      <button
        onClick={lancer}
        disabled={!sort || !sortLancableHorsCombat(sort).ok || !sortUtilisable(lanceur.niveau, sort).ok}
        className="w-full py-2.5 rounded bg-emerald-700 hover:bg-emerald-600 font-bold disabled:opacity-40"
      >
        Lancer {sort ? sort.nom : "—"} (hors combat)
      </button>
      {message && (
        <div className="text-xs text-emerald-300 bg-emerald-950 border border-emerald-800 rounded px-2 py-1.5">{message}</div>
      )}
      {erreur && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">{erreur}</div>
      )}
    </div>
  );
}
