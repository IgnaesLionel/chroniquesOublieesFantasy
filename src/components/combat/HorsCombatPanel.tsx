"use client";
import { useState } from "react";
import type { Character, Sort } from "@/src/lib/rules/types";
import {
  lancerRetablissement,
  lancerSortHorsCombat,
  sortLancableHorsCombat,
  sortUtilisable,
} from "@/src/lib/rules/combat/attack";
import {
  patientsMaxRetablissement,
  quotaMineureParJour,
  usagesMineureRestants,
} from "@/src/lib/rules/soins";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";

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
  const [brulure, setBrulure] = useState(false);
  const [concentration, setConcentration] = useState(false);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [repos, setRepos] = useState(true);
  const [rayon, setRayon] = useState(true);

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
  const coutBase = sort?.cout?.montant ?? 0;
  const estRetablissement = !!sort && normaliserNomCapacite(sort.nom) === "rétablissement";
  const estMineureHC = !!sort && normaliserNomCapacite(sort.nom) === "récupération mineure" && sort.voie === "Voie des soins";
  const concPossible = !!sort && !sort.concentrationInterdite && (sort.action ?? "attaque") === "attaque" && coutBase > 0;
  const concActive = concentration && concPossible;
  const coutEff = concActive ? Math.max(0, coutBase - 2) : coutBase;
  const chaLanceur = lanceur.caracteristiques?.CHA ?? 0;
  const maxPatients = patientsMaxRetablissement(chaLanceur);
  const retabUtilise = (lanceur.usagesJournaliers?.["rétablissement"] ?? 0) >= 1;
  const porteurHC = { capacites: lanceur.capacites ?? [], sorts: (lanceur.sorts ?? []).map((s) => ({ nom: s.nom, voie: s.voie, rang: s.rang })) };
  const quotaMH = estMineureHC ? quotaMineureParJour(porteurHC) : null;
  const restantsMH = estMineureHC ? usagesMineureRestants(porteurHC, lanceur.usagesJournaliers) : null;

  const lancerRetab = () => {
    setMessage(null);
    setErreur(null);
    if (!sort) return;
    try {
      const ids = patientIds.length > 0 ? patientIds : [lanceur.id];
      const pats = ids.map((id) => characters.find((c) => c.id === id)!).filter(Boolean);
      const { lanceur: l2, patients: apres, resolution } = lancerRetablissement(lanceur, pats, sort, Math.random, { dureeMin: 10, auRepos: repos, rayonOk: rayon });
      const parId = new Map(apres.map((p) => [p.id, p]));
      parId.set(l2.id, l2);
      onUpdate(characters.map((c) => parId.get(c.id) ?? c));
      const lignes = apres.map((p, i) => {
        const r = resolution.patients[i];
        return `${p.nom} +${r.soinTotal} PV [${r.soinDetails.join(", ")}] : ${r.pvAvant} → ${r.pvApres}`;
      });
      setMessage(`${resolution.lanceurNom} : ${resolution.sortNom} (10 min, −${resolution.manaPaye} mana, CHA ${chaLanceur} → ${apres.length}/${maxPatients} patients, +1d4°×${resolution.nbRang5} R5, jet par patient) · ${lignes.join(" · ")}`);
      setPatientIds([]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Rituel impossible.");
    }
  };

  const lancer = () => {
    setMessage(null);
    setErreur(null);
    if (!sort) return;
    // Brûlure de mana : à 0 PM, 1 DR par PM effectif en PV (jamais pour les soins).
    const brulurePossible = coutEff > 0 && (mana?.actuel ?? 0) === 0 && !sort.soin;
    const mode: "mana" | "brulure" = brulure && brulurePossible ? "brulure" : "mana";
    try {
      const { lanceur: l2, cible: c2, resolution } = lancerSortHorsCombat(lanceur, cible, sort, Math.random, mode, { concentration: concActive });
      onUpdate(
        characters.map((c) => {
          if (c.id === l2.id && c.id === c2.id) return l2;
          if (c.id === l2.id) return l2;
          if (c.id === c2.id) return c2;
          return c;
        })
      );
      const parties = [`${resolution.lanceurNom} lance ${resolution.sortNom} sur ${resolution.cibleNom}`];
      if (resolution.concentre) parties.push("concentration accrue (−2 PM)");
      if (resolution.manaPaye > 0) parties.push(`−${resolution.manaPaye} mana`);
      if (resolution.pvBrules > 0) parties.push(`🔥 brûlure : −${resolution.pvBrules} PV [${resolution.detailsBrulure.join(", ")}]`);
      if (resolution.pvSacrifie > 0) parties.push(`−${resolution.pvSacrifie} PV sacrifiés`);
      if (resolution.soinTotal > 0) {
        parties.push(`+${resolution.soinTotal} PV (${resolution.soinDetails.join(", ")}) : ${resolution.pvAvant} → ${resolution.pvApres}`);
      } else {
        parties.push("effet narratif (MJ)");
      }
      if (resolution.effetNom) parties.push(`✦ ${resolution.effetNom}`);
      if (resolution.attaqueAccordee) parties.push(`⚔ ${resolution.attaqueAccordee}`);
      if (resolution.invoque) parties.push(`👹 ${resolution.invoque} (MJ : cadavre valide, ajouter le serviteur)`);
      if (resolution.avertissement) parties.push(`⚠ ${resolution.avertissement}`);
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
      s.rituelHorsCombat ? "rituel 10 min" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const raison = !lancable.ok ? lancable.raison : !niv.ok ? niv.raison : null;
    return `${s.nom} · ${flags}${ok ? "" : ` (${raison})`}`;
  };

  if (estRetablissement) {
    const pats = patientIds.length > 0 ? patientIds : [lanceur.id];
    return (
      <div className="rounded-lg border border-emerald-900 bg-zinc-900 p-4 space-y-2.5">
        <h2 className="font-bold text-sm uppercase text-emerald-300">
          Rétablissement — rituel hors combat
          {mana ? <span className="ml-2 font-mono normal-case">mana {mana.actuel}/{mana.max}</span> : null}
        </h2>
        <p className="text-xs text-zinc-500">
          1/jour, 10 min, une créature par point de CHA ({chaLanceur} → max {maxPatients}, prêtre inclus),
          patients au repos dans 5 m. Chacune comme une majeure (3d4°+CHA +1d4°/R5, jet par patient).
          Concentration interdite, brûlure interdite (soin).
          {retabUtilise ? " — déjà utilisé aujourd'hui." : ""}
        </p>
        <label className="block text-sm">Lanceur
          <select
            value={lanceur.id}
            onChange={(e) => { setLanceurId(e.target.value); setSortId(null); setMessage(null); setErreur(null); setPatientIds([]); }}
            className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
          >
            {lanceurs.map((c) => (
              <option key={c.id} value={c.id}>{c.nom} — {c.pv}/{c.pvMax} PV · CHA {c.caracteristiques?.CHA ?? 0}</option>
            ))}
          </select>
        </label>
        <div className="text-sm space-y-1">
          <div className="text-xs uppercase text-zinc-500 font-bold">Patients ({pats.length}/{maxPatients})</div>
          {characters.map((c) => {
            const coche = patientIds.includes(c.id) || (patientIds.length === 0 && c.id === lanceur.id);
            return (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={patientIds.includes(c.id)}
                  disabled={!patientIds.includes(c.id) && patientIds.length >= maxPatients}
                  onChange={(e) => {
                    setPatientIds((prev) => e.target.checked ? [...prev, c.id].slice(0, maxPatients) : prev.filter((x) => x !== c.id));
                    setMessage(null); setErreur(null);
                  }}
                />
                <span>{c.nom} — {c.pv}/{c.pvMax} PV{c.id === lanceur.id ? " (prêtre)" : ""}{coche && patientIds.length === 0 ? " (défaut)" : ""}</span>
              </label>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={repos} onChange={(e) => setRepos(e.target.checked)} />
          <span>Patients au repos (10 min)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rayon} onChange={(e) => setRayon(e.target.checked)} />
          <span>Patients dans 5 m autour du prêtre</span>
        </label>
        {sort && <p className="text-xs text-zinc-500">{sort.description ?? "Aucune description."}</p>}
        <button
          onClick={lancerRetab}
          disabled={!sort || retabUtilise || pats.length === 0 || pats.length > maxPatients || !repos || !rayon}
          className="w-full py-2.5 rounded bg-emerald-700 hover:bg-emerald-600 font-bold disabled:opacity-40"
        >
          Lancer {sort ? sort.nom : "—"} ({pats.length} patient(s), jet par patient)
        </button>
        {message && (<div className="text-xs text-emerald-300 bg-emerald-950 border border-emerald-800 rounded px-2 py-1.5">{message}</div>)}
        {erreur && (<div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">{erreur}</div>)}
        <button
          onClick={() => { setSortId(null); setMessage(null); setErreur(null); }}
          className="w-full py-1.5 rounded bg-zinc-800 text-xs text-zinc-400"
        >
          ← Autre sort
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-emerald-300">
        Sorts hors combat
        {mana ? <span className="ml-2 font-mono normal-case">mana {mana.actuel}/{mana.max}</span> : null}
      </h2>
      <p className="text-xs text-zinc-500">
        Soutien hors combat : action (A/M/L) ignorée, pas de limite d&apos;action ni de mouvement.
        Niveau, mana et PV sacrifiés appliqués. Concentration accrue possible (sorts A : −2 PM).
        Offensifs et zones : en combat uniquement. Invocations : possibles avec validation MJ.
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
      {estMineureHC && quotaMH != null && restantsMH != null && (
        <div className="text-xs text-zinc-400">
          Récupération mineure : {(lanceur.usagesJournaliers?.["récupération mineure"] ?? 0)}/{quotaMH} aujourd&apos;hui — reste {restantsMH}.
        </div>
      )}
      {sort && (sort.cout?.montant ?? 0) > 0 && (
        <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
          <div className="text-xs uppercase text-zinc-500 font-bold">Lancement du sort</div>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!brulure} onChange={() => setBrulure(false)} />
            <span>Incantation ({coutEff} PM{concActive && coutEff !== coutBase ? `, concentré depuis ${coutBase}` : ""})</span>
          </label>
          {(() => {
            const raison = sort.soin
              ? "brûlure interdite pour les soins"
              : coutEff <= 0
                ? "brûlure inutile (coût 0)"
                : (mana?.actuel ?? 0) !== 0
                  ? "brûlure réservée au 0 mana"
                  : null;
            return (
              <label className={`flex items-center gap-2 ${raison ? "opacity-40" : ""}`} title={raison ?? "Brûlure de mana : paie en PV (1 DR par PM, sans RD, KO possible)"}>
                <input type="radio" checked={brulure} disabled={!!raison} onChange={() => setBrulure(true)} />
                <span>Brûlure de mana ({coutEff} DR de PV)</span>
              </label>
            );
          })()}
          {concPossible && (
            <label className="flex items-center gap-2" title="Sort (A) : le lanceur prend le temps de se concentrer (−2 PM, plancher 0).">
              <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
              <span>Concentration accrue (−2 PM → {Math.max(0, coutBase - 2)} PM)</span>
            </label>
          )}
          {sort?.concentrationInterdite && (
            <div className="text-xs text-zinc-500">Concentration interdite (rituel).</div>
          )}
          {brulure && (mana?.actuel ?? 0) !== 0 && (
            <div className="text-xs text-amber-300/90">⚠ Brûlure possible uniquement à 0 mana.</div>
          )}
        </div>
      )}
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
