"use client";
import { useState } from "react";
import Link from "next/link";
import { CLASSES } from "@/src/lib/data/classes";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { VOIES_PEUPLE, VOIE_MAGE } from "@/src/lib/data/peuples";
import { voiesDe, type Capacite } from "@/src/lib/data/capacites";
import { PROFILS_PAR_FAMILLE } from "@/src/lib/rules/personnage";

function VoieBloc({ voie, capacites, ouvert, onToggle }: {
  voie: string;
  capacites: Capacite[];
  ouvert: boolean;
  onToggle: () => void;
}) {
  const sorts = SEED_SORTS.filter((s) => s.voie === voie);
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950">
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2 text-sm flex justify-between items-center gap-2"
      >
        <span className="font-semibold">{voie}</span>
        <span className="text-xs text-zinc-400 shrink-0">
          {sorts.length > 0 ? `✦ ${sorts.length} sort${sorts.length > 1 ? "s" : ""}` : "talents uniquement"}
          {" "}{ouvert ? "▾" : "▸"}
        </span>
      </button>
      {ouvert && (
        <div className="px-3 pb-2.5 space-y-1.5">
          {capacites.map((c) => {
            const sort = c.sortId ? SEED_SORTS.find((s) => s.id === c.sortId) : undefined;
            return (
              <div key={`${c.rang}-${c.nom}`} className="text-xs border-t border-zinc-800/60 pt-1.5">
                <div className="flex justify-between gap-2 items-baseline">
                  <span>
                    <span className="font-mono text-amber-300 font-bold">R{c.rang}</span>
                    {" "}<span className="font-semibold">{c.nom}</span>
                  </span>
                  {sort && (
                    <span className="font-mono text-violet-300 shrink-0">✦ {sort.cout ? `${sort.cout.montant} PM` : "sort"}</span>
                  )}
                </div>
                <p className="text-zinc-400 pt-0.5">{c.resume}</p>
                {sort && (
                  <Link href="/sorts" className="inline-block text-violet-300 underline pt-0.5">
                    Voir dans le grimoire →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const [profil, setProfil] = useState<string>("Guerrier");
  const [voieOuverte, setVoieOuverte] = useState<string | null>(null);
  const [peupleOuvert, setPeupleOuvert] = useState<string | null>(null);
  const classe = CLASSES.find((c) => c.profil === profil) ?? CLASSES[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Classes ({CLASSES.length})</h1>
        <select
          value={classe.profil} onChange={(e) => { setProfil(e.target.value); setVoieOuverte(null); setPeupleOuvert(null); }}
          className="bg-zinc-800 rounded px-3 py-2 text-sm font-semibold"
        >
          {Object.entries(PROFILS_PAR_FAMILLE).map(([fam, profils]) => (
            <optgroup key={fam} label={fam}>
              {profils.map((p) => <option key={p} value={p}>{p}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <p className="text-xs text-zinc-500">
        Les 14 profils du DRS : caractéristiques de création, équipement et leurs 5 voies (arbres de talents).
        Seules les capacités à PM des voies sont des sorts (voir le grimoire).
      </p>

      <div key={classe.profil} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <div className="font-bold text-xl">{classe.profil}</div>
            <div className="text-sm text-zinc-400">Famille {classe.famille}</div>
          </div>
          <a href={classe.sourceUrl} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700">
            Page DRS ↗
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
            <div className="text-[11px] uppercase text-zinc-500">Vigueur niv.1</div>
            <div className="font-bold font-mono">{classe.pvNiveau1}</div>
            <div className="text-[11px] text-zinc-500">+{classe.pvParNiveau}/niveau</div>
          </div>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
            <div className="text-[11px] uppercase text-zinc-500">Récupération</div>
            <div className="font-bold font-mono">{classe.deRecuperation}</div>
          </div>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
            <div className="text-[11px] uppercase text-zinc-500">Chance</div>
            <div className="font-bold font-mono">{classe.chance}</div>
          </div>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
            <div className="text-[11px] uppercase text-zinc-500">Armure / Bouclier</div>
            <div className="text-xs pt-1">{classe.armure} · {classe.bouclier}</div>
          </div>
        </div>

        <div className="text-sm space-y-1">
          <div><span className="text-zinc-500">Armes : </span>{classe.armes}</div>
          <div><span className="text-zinc-500">Départ : </span>{classe.equipement}</div>
          {classe.particularites.map((p) => (
            <div key={p} className="text-xs text-amber-200/90">◈ {p}</div>
          ))}
        </div>

        <div>
          <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Voies (5)</div>
          <div className="space-y-1.5">
            {voiesDe(classe.profil).map(({ voie, capacites }) => (
              <VoieBloc
                key={voie}
                voie={voie}
                capacites={capacites}
                ouvert={voieOuverte === voie}
                onToggle={() => setVoieOuverte(voieOuverte === voie ? null : voie)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div>
          <div className="font-bold text-xl">Voies du peuple</div>
          <div className="text-xs text-zinc-500 pt-1">
            Chaque peuple suit sa voie (5 rangs).
            {classe.famille === "Mage" && (
              <>
                {" "}La Voie du mage est une option spéciale, pas un peuple : réservée à la famille Mage,
                elle remplace la voie du peuple (garde son rang 1, bloque ses rangs 2-5).
                Choix définitif, avant le rang 2.
              </>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {VOIES_PEUPLE.map((v) => (
            <div key={v.voie}>
              <div className="text-xs uppercase text-zinc-400 font-bold mb-1">
                {v.voie} — {v.peuple}
              </div>
              <VoieBloc
                voie={v.voie}
                capacites={v.capacites}
                ouvert={peupleOuvert === v.voie}
                onToggle={() => setPeupleOuvert(peupleOuvert === v.voie ? null : v.voie)}
              />
            </div>
          ))}
          <div>
            {classe.famille === "Mage" && (
              <>
                <div className="text-xs uppercase text-zinc-400 font-bold mb-1">
                  {VOIE_MAGE.voie} — Ensorceleur, Forgesort, Magicien, Sorcier (pas un peuple)
                </div>
                <VoieBloc
                  voie={VOIE_MAGE.voie}
                  capacites={VOIE_MAGE.capacites}
                  ouvert={peupleOuvert === VOIE_MAGE.voie}
                  onToggle={() => setPeupleOuvert(peupleOuvert === VOIE_MAGE.voie ? null : VOIE_MAGE.voie)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
