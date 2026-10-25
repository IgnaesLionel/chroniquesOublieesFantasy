"use client";

import { useMemo, useState } from "react";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import { genererPnj, regenererChamp, validerPnj } from "@/src/lib/npcgen/engine";
import {
  DETAILS,
  DETAIL_LABEL,
  TABLE_IDS,
  type Faction,
  type NpcGen,
  type NpcGenerationOptions,
  type NpcProfile,
  type NpcStatBlock,
  type PalierPuissance,
  type ReferenceEntry,
  type ReferenceTable,
  type ResultatGeneration,
} from "@/src/lib/npcgen/types";
import { estimerCombat } from "@/src/lib/npcgen/engine";
import { ouvrirImpressionPnj } from "@/src/lib/npcgen/statblock";
import { exportJson } from "@/src/lib/store/repository";
import { NpcFiche } from "@/src/components/npcgen/NpcFiche";

interface Props {
  tables: ReferenceTable[];
  entries: ReferenceEntry[];
  factions: Faction[];
  profiles: NpcProfile[];
  saved: NpcGen[];
  setSaved: React.Dispatch<React.SetStateAction<NpcGen[]>>;
  statBlocks: NpcStatBlock[];
  setStatBlocks: React.Dispatch<React.SetStateAction<NpcStatBlock[]>>;
  monsters: MonsterTemplate[];
  onOpenLibrary?: () => void;
}

const selectClass =
  "w-full bg-zinc-950/60 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";

function normaliser(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function valeurs(entries: ReferenceEntry[], tableId: string): string[] {
  return [...new Set(entries.filter((e) => e.tableId === tableId && e.actif).map((e) => e.valeur))];
}

function labelEnum(valeur: string): string {
  return valeur.charAt(0).toUpperCase() + valeur.slice(1);
}

export function NpcGenerator({
  tables,
  entries,
  factions,
  profiles,
  saved,
  setSaved,
  statBlocks,
  setStatBlocks,
  monsters,
  onOpenLibrary,
}: Props) {
  const [options, setOptions] = useState<NpcGenerationOptions>({
    detail: "standard",
    genererCombat: false,
    palierPuissance: "faible",
  });
  const [tagsSaisis, setTagsSaisis] = useState("");
  const [resultat, setResultat] = useState<ResultatGeneration | null>(null);
  const [message, setMessage] = useState("");
  const [critèresOuverts, setCriteresOuverts] = useState(false);

  const especes = useMemo(() => valeurs(entries, TABLE_IDS.especes), [entries]);
  const cultures = useMemo(() => valeurs(entries, TABLE_IDS.cultures), [entries]);
  const sexes = useMemo(() => valeurs(entries, TABLE_IDS.sexes), [entries]);
  const professions = useMemo(() => valeurs(entries, TABLE_IDS.professions), [entries]);
  const niveaux = useMemo(() => valeurs(entries, TABLE_IDS.niveauxSociaux), [entries]);
  const importances = useMemo(() => valeurs(entries, TABLE_IDS.importances), [entries]);
  const lieux = useMemo(() => valeurs(entries, TABLE_IDS.lieux), [entries]);
  const paliers = useMemo(
    () =>
      entries
        .filter((e) => e.tableId === TABLE_IDS.paliersPuissance && e.actif)
        .map((e) => ({ code: normaliser(e.valeur) as PalierPuissance, label: e.valeur })),
    [entries]
  );
  const profilesActifs = useMemo(() => profiles.filter((p) => p.actif), [profiles]);
  const factionsActives = useMemo(() => factions.filter((f) => f.actif), [factions]);

  const donnees = useMemo(() => ({ tables, entries, factions, profiles }), [tables, entries, factions, profiles]);
  const npc = resultat?.npc;
  const statBlock = resultat?.statBlock;

  const setChamp = (cle: keyof NpcGenerationOptions, valeur: string) => {
    setOptions((o) => ({
      ...o,
      [cle]: valeur.trim() ? valeur : undefined,
    }));
  };

  const choisirProfil = (profileId: string) => {
    const profil = profileId ? profilesActifs.find((p) => p.id === profileId) : undefined;
    if (!profil) {
      setOptions({ detail: "standard", genererCombat: false, palierPuissance: "faible" });
      setTagsSaisis("");
      return;
    }
    // Le profil pré-remplit les critères visibles ; les modifications
    // ultérieures du MJ restent prioritaires lors de la génération.
    setOptions({
      detail: "standard",
      genererCombat: false,
      palierPuissance: "faible",
      ...profil.options,
      profileId: profil.id,
    });
    setTagsSaisis(
      [...new Set([...profil.tags, ...(profil.options.tags ?? [])])].filter(Boolean).join(", ")
    );
  };

  const lancer = (conserverVerrous = false) => {
    setMessage("");
    const tags = tagsSaisis.split(",").map((t) => t.trim()).filter(Boolean);
    const base = conserverVerrous ? resultat?.npc : undefined;
    const verrous = base
      ? Object.entries(base.champs).filter(([, e]) => e.verrouille).map(([chemin]) => chemin)
      : [];
    const result = genererPnj(
      { ...options, tags, base, verrous },
      donnees
    );
    setResultat(result);
    setCriteresOuverts(false);
  };

  const regenererUnChamp = (chemin: string) => {
    if (!resultat) return;
    const result = regenererChamp(resultat.npc, chemin, donnees, options);
    setResultat({
      ...result,
      statBlock: resultat.statBlock,
      npc: { ...result.npc, statBlockId: resultat.npc.statBlockId },
    });
  };

  const changerNpc = (suivant: NpcGen) => {
    if (!resultat) return;
    setResultat({ ...resultat, npc: suivant });
  };

  const changerStatBlock = (bloc: NpcStatBlock | undefined) => {
    if (!resultat) return;
    setResultat({
      ...resultat,
      statBlock: bloc,
      npc: { ...resultat.npc, statBlockId: bloc?.id },
    });
  };

  const genererEstimation = () => {
    if (!resultat) return;
    const warnings: string[] = [];
    const bloc = estimerCombat(
      resultat.npc,
      options.palierPuissance ?? "faible",
      donnees,
      warnings
    );
    setResultat({
      ...resultat,
      statBlock: bloc,
      npc: { ...resultat.npc, statBlockId: bloc.id },
      warnings: [...new Set([...resultat.warnings, ...warnings])],
    });
  };

  const enregistrer = () => {
    if (!resultat) return;
    const npcASauver = {
      ...resultat.npc,
      updatedAt: new Date().toISOString(),
      statBlockId: resultat.statBlock?.id,
    };
    setSaved((prev) => {
      const existe = prev.some((n) => n.id === npcASauver.id);
      return existe ? prev.map((n) => (n.id === npcASauver.id ? npcASauver : n)) : [...prev, npcASauver];
    });
    if (resultat.statBlock) {
      const bloc = { ...resultat.statBlock, npcId: npcASauver.id, updatedAt: new Date().toISOString() };
      setStatBlocks((prev) => {
        const sansAncien = prev.filter((b) => b.npcId !== npcASauver.id && b.id !== bloc.id);
        return [...sansAncien, bloc];
      });
    } else {
      setStatBlocks((prev) => prev.filter((b) => b.npcId !== npcASauver.id));
    }
    setMessage("PNJ enregistré dans la bibliothèque.");
    setResultat({ ...resultat, npc: npcASauver });
  };

  const dejaSauve = npc ? saved.some((n) => n.id === npc.id) : false;
  const problemes = useMemo(
    () => (npc ? validerPnj(npc, tables, entries) : []),
    [npc, tables, entries]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bronze-700/60 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-gold-300">Génération rapide</h2>
            <p className="text-sm text-zinc-400">
              Un clic produit une fiche complète. Toutes les listes proviennent des tables administrables.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => lancer(false)}
              className="px-5 py-2.5 rounded bg-amber-400 text-black font-bold text-sm hover:bg-amber-300"
            >
              ⚄ Générer un PNJ
            </button>
            <button
              type="button"
              onClick={() => setCriteresOuverts((v) => !v)}
              className="px-3 py-2.5 rounded bg-zinc-800 border border-zinc-700 text-sm"
            >
              {critèresOuverts ? "Masquer les critères" : "Critères personnalisés"}
            </button>
          </div>
        </div>

        {critèresOuverts && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
            <label className="text-sm">Profil
              <select value={options.profileId ?? ""} onChange={(e) => choisirProfil(e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aucun profil</option>
                {profilesActifs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </label>
            <label className="text-sm">Espèce
              <select value={options.espece ?? ""} onChange={(e) => setChamp("espece", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {especes.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">Culture
              <select value={options.culture ?? ""} onChange={(e) => setChamp("culture", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {cultures.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">Sexe
              <select value={options.sexe ?? ""} onChange={(e) => setChamp("sexe", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {sexes.map((v) => <option key={v} value={v}>{labelEnum(v)}</option>)}
              </select>
            </label>
            <label className="text-sm">Profession
              <select value={options.profession ?? ""} onChange={(e) => setChamp("profession", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {professions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">Niveau social
              <select value={options.niveauSocial ?? ""} onChange={(e) => setChamp("niveauSocial", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Selon le métier</option>
                {niveaux.map((v) => <option key={v} value={v}>{labelEnum(v)}</option>)}
              </select>
            </label>
            <label className="text-sm">Importance
              <select value={options.importance ?? ""} onChange={(e) => setChamp("importance", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {importances.map((v) => <option key={v} value={v}>{labelEnum(v)}</option>)}
              </select>
            </label>
            <label className="text-sm">Faction
              <select value={options.factionId ?? ""} onChange={(e) => setChamp("factionId", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire / aucune</option>
                {factionsActives.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </label>
            <label className="text-sm">Lieu
              <select value={options.lieu ?? ""} onChange={(e) => setChamp("lieu", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Aléatoire</option>
                {lieux.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">Niveau de détail
              <select value={options.detail ?? "standard"} onChange={(e) => setChamp("detail", e.target.value)} className={`${selectClass} mt-1`}>
                {DETAILS.map((d) => <option key={d} value={d}>{DETAIL_LABEL[d]}</option>)}
              </select>
            </label>
            <label className="text-sm">Tags souhaités (virgules)
              <input value={tagsSaisis} onChange={(e) => setTagsSaisis(e.target.value)} placeholder="crime, ville…" className={`${selectClass} mt-1`} />
            </label>
            <div className="text-sm space-y-1">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.genererCombat ?? false}
                  onChange={(e) => setOptions((o) => ({ ...o, genererCombat: e.target.checked }))}
                />
                Générer un bloc de combat estimé
              </label>
              <select
                value={options.palierPuissance ?? "faible"}
                onChange={(e) => setOptions((o) => ({ ...o, palierPuissance: e.target.value as PalierPuissance }))}
                className={selectClass}
                disabled={!options.genererCombat}
              >
                {paliers.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
              <p className="text-[11px] text-zinc-500">
                Valeurs estimées configurables, pas une règle officielle COF2.
              </p>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-emerald-300">{message}</p>}
      </div>

      {!npc && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center text-zinc-400">
          <p className="text-lg">Aucun brouillon.</p>
          <p className="text-sm mt-1">Cliquez sur « Générer un PNJ » ou ouvrez les critères personnalisés.</p>
        </div>
      )}

      {npc && resultat && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 order-2 lg:order-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display text-xl font-bold text-gold-200">{npc.nom || "PNJ sans nom"}</h2>
                <p className="text-sm text-zinc-400">
                  {npc.profession || "Sans profession"} · {npc.espece} · {npc.importance}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => lancer(true)} className="px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
                  Régénérer (verrous conservés)
                </button>
                <button type="button" onClick={enregistrer} className="px-3 py-1.5 rounded bg-amber-400 text-black text-xs font-bold">
                  {dejaSauve ? "Mettre à jour" : "Enregistrer"}
                </button>
                <button type="button" onClick={() => exportJson(`pnj-${npc.nom || "brouillon"}.json`, { npc, statBlock })} className="px-3 py-1.5 rounded bg-zinc-800 text-xs">
                  Export JSON
                </button>
                <button type="button" onClick={() => ouvrirImpressionPnj(npc, statBlock, npc.factionNom)} className="px-3 py-1.5 rounded bg-zinc-800 text-xs">
                  Imprimer
                </button>
              </div>
            </div>
            <NpcFiche
              npc={npc}
              onChange={changerNpc}
              entries={entries}
              tables={tables}
              factions={factions}
              monsters={monsters}
              statBlock={statBlock}
              onStatBlockChange={changerStatBlock}
              onGenererEstimation={genererEstimation}
              onRegen={regenererUnChamp}
              warnings={[...new Set([...(resultat.warnings ?? []), ...problemes])]}
            />
          </div>

          <aside className="rounded-lg border border-bronze-700/50 bg-zinc-950 p-3 space-y-2 text-sm lg:sticky lg:top-4 order-1 lg:order-2">
            <h3 className="font-display font-bold text-gold-300">Aperçu de scène</h3>
            <p className="text-zinc-300">{npc.description}</p>
            <p className="text-xs text-zinc-500">Graine reproductible : <code className="text-amber-300">{npc.seed}</code></p>
            <div className="text-xs text-zinc-400 space-y-1">
              <p><b>Objectif :</b> {npc.motivations.objectifImmediat || "—"}</p>
              <p><b>Accroche :</b> {npc.roleplay.accroche || "—"}</p>
              <p className="text-red-300"><b>Secret MJ :</b> {npc.motivations.secret || "—"}</p>
            </div>
            {resultat.tablesUtilisees.length > 0 && (
              <p className="text-[11px] text-zinc-600">Tables sollicitées : {resultat.tablesUtilisees.length}</p>
            )}
            {onOpenLibrary && dejaSauve && (
              <button type="button" onClick={onOpenLibrary} className="w-full px-3 py-1.5 rounded bg-zinc-800 text-xs">
                Voir la bibliothèque
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
