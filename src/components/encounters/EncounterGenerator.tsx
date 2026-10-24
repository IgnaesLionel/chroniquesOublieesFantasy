"use client";

import { useMemo, useState } from "react";
import { useCharacters, useMonsters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { avecSousCategoriesGraines } from "@/src/lib/data/seeds";
import type {
  ContexteRencontre,
  DifficulteRencontre,
  EtatGroupe,
  ResultatGeneration,
  ResultatSimulation,
  SlotRencontre,
  SlotResolu,
  SurpriseRencontre,
  TerrainRencontre,
  TypeRencontre,
} from "@/src/lib/encounters/types";
import {
  CONFIGURATION_PAR_DEFAUT,
  DESCRIPTIONS_SURPRISE,
  DESCRIPTIONS_TYPE,
  LIBELLES_DIFFICULTE,
  LIBELLES_EDITION,
  LIBELLES_TYPE,
  SOURCES,
  TERRAINS,
} from "@/src/lib/encounters/rules";
import { groupeDepuisFiches, groupeSimplifie } from "@/src/lib/encounters/party";
import { genererRencontre, reevaluerComposition } from "@/src/lib/encounters/generate";
import { simulerRencontre } from "@/src/lib/encounters/calibration";

const TYPES: TypeRencontre[] = ["bataille", "embuscade", "assaut", "defense", "poursuite", "boss"];
const TERRAINS_LISTE: TerrainRencontre[] = [
  "plaine",
  "foret",
  "ruines",
  "souterrain",
  "interieur",
  "montagne",
  "neige",
  "eau",
  "obscurite",
];

function versSlot(s: SlotResolu): SlotRencontre {
  return { monstreId: s.monstreId, quantite: s.quantite, verrouille: s.verrouille };
}

function Badge({ children, ton = "zinc" }: { children: React.ReactNode; ton?: "zinc" | "amber" | "emerald" | "red" | "sky" | "violet" }) {
  const classes: Record<string, string> = {
    zinc: "bg-zinc-800 border-zinc-700 text-zinc-300",
    amber: "bg-amber-950/60 border-amber-800 text-amber-200",
    emerald: "bg-emerald-950/60 border-emerald-800 text-emerald-200",
    red: "bg-red-950/60 border-red-800 text-red-200",
    sky: "bg-sky-950/60 border-sky-800 text-sky-200",
    violet: "bg-violet-950/60 border-violet-800 text-violet-200",
  };
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${classes[ton]}`}>{children}</span>;
}

function origineBadge(origine: "regle" | "estimation" | "donnee") {
  if (origine === "regle") return <Badge ton="emerald">Règle</Badge>;
  if (origine === "donnee") return <Badge ton="sky">Donnée</Badge>;
  return <Badge ton="amber">Estimation</Badge>;
}

function impactBadge(impact: "hausse" | "baisse" | "neutre") {
  if (impact === "hausse") return <span className="text-red-300">▲</span>;
  if (impact === "baisse") return <span className="text-emerald-300">▼</span>;
  return <span className="text-zinc-500">•</span>;
}

function pourcentage(v: number): string {
  return `${Math.round(v * 100)} %`;
}

function nombre(v: number): string {
  return `${Math.round(v * 10) / 10}`;
}

/** Le ratio tactique est souvent petit (×0,07) : deux décimales évitent d'afficher ×0. */
function nombreRatio(v: number): string {
  return `${Math.round(v * 100) / 100}`;
}

export function EncounterGenerator({
  onConvertirEnCombat,
  integre = false,
}: {
  /** Fourni par la page Combat : affiche « Transformer en combat ». */
  onConvertirEnCombat?: (slots: SlotResolu[]) => void;
  /** Intégré dans un écran qui porte déjà son titre : en-tête réduit. */
  integre?: boolean;
} = {}) {
  const { items: characters } = useCharacters("rencontres");
  const { items: monsters } = useMonsters();
  const { catalogue } = useCatalogueObjets();
  const bestiaire = useMemo(() => avecSousCategoriesGraines(monsters), [monsters]);

  const [mode, setMode] = useState<"fiches" | "simplifie">("fiches");
  const [selection, setSelection] = useState<string[]>([]);
  const [nombreSimplifie, setNombreSimplifie] = useState(4);
  const [niveauSimplifie, setNiveauSimplifie] = useState(3);
  const [difficulte, setDifficulte] = useState<DifficulteRencontre>("normal");
  const [type, setType] = useState<TypeRencontre>("bataille");
  const [terrain, setTerrain] = useState<TerrainRencontre>("plaine");
  const [surprise, setSurprise] = useState<SurpriseRencontre>("aucune");
  const [etat, setEtat] = useState<EtatGroupe>("frais");
  const [theme, setTheme] = useState("toutes");
  const [nbMin, setNbMin] = useState("");
  const [nbMax, setNbMax] = useState("");
  const [inclureV1, setInclureV1] = useState(false);
  const [inclureHorsDrs, setInclureHorsDrs] = useState(false);
  const [verrous, setVerrous] = useState<SlotRencontre[]>([]);
  const [graine, setGraine] = useState(1);
  const [resultat, setResultat] = useState<ResultatGeneration | null>(null);
  const [composition, setComposition] = useState<SlotRencontre[] | null>(null);
  const [indexVariante, setIndexVariante] = useState(0);
  const [simulation, setSimulation] = useState<ResultatSimulation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const themes = useMemo(() => {
    const set = new Set<string>();
    for (const m of bestiaire) {
      if (!m.drsSlug && !inclureV1 && !inclureHorsDrs) continue;
      if (m.categorie) set.add(m.categorie);
      for (const s of m.sousCategories ?? []) set.add(s);
    }
    return ["toutes", ...Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))];
  }, [bestiaire, inclureV1, inclureHorsDrs]);

  const personnagesSelectionnes = useMemo(
    () => characters.filter((c) => selection.includes(c.id)),
    [characters, selection]
  );

  const groupe = useMemo(() => {
    if (mode === "simplifie") {
      return groupeSimplifie(nombreSimplifie, niveauSimplifie, {
        etat,
        progressionDegatsParNiveau: CONFIGURATION_PAR_DEFAUT.progressionDegatsParNiveau,
        progressionDefParNiveau: CONFIGURATION_PAR_DEFAUT.progressionDefParNiveau,
      });
    }
    return groupeDepuisFiches(personnagesSelectionnes, { catalogue, etat });
  }, [mode, nombreSimplifie, niveauSimplifie, etat, personnagesSelectionnes, catalogue]);

  const contexte: ContexteRencontre = useMemo(
    () => ({
      type,
      terrain,
      surprise,
      theme,
      inclureV1,
      inclureHorsDrs,
      ...(nbMin.trim() !== "" ? { nbMin: Math.max(1, Number(nbMin)) } : {}),
      ...(nbMax.trim() !== "" ? { nbMax: Math.max(1, Number(nbMax)) } : {}),
    }),
    [type, terrain, surprise, theme, inclureV1, inclureHorsDrs, nbMin, nbMax]
  );

  // Toute modification manuelle de la composition est immédiatement réévaluée.
  const evaluation = useMemo(() => {
    if (!composition) return null;
    return reevaluerComposition({
      groupe,
      slots: composition,
      difficulte,
      contexte,
      bestiaire,
    });
  }, [composition, groupe, difficulte, contexte, bestiaire]);

  const generer = (nouvelleGraine = graine) => {
    setErreur(null);
    if (groupe.nombre === 0) {
      setErreur("Sélectionner au moins un personnage (ou passer en mode simplifié).");
      return;
    }
    if (mode === "fiches" && personnagesSelectionnes.length === 0) {
      setErreur("Aucun personnage sélectionné.");
      return;
    }
    const res = genererRencontre({
      groupe,
      bestiaire,
      difficulte,
      contexte,
      verrous,
      graine: nouvelleGraine,
    });
    setResultat(res);
    setGraine(nouvelleGraine);
    const premier = res.candidats[0];
    setComposition(premier ? premier.slots.map(versSlot) : null);
    setIndexVariante(0);
    setSimulation(null);
  };

  const relancer = () => generer(Math.floor(Math.random() * 1_000_000_000));

  const choisirVariante = (i: number) => {
    setIndexVariante(i);
    const c = resultat?.candidats[i];
    setComposition(c ? c.slots.map(versSlot) : null);
    setSimulation(null);
  };

  const modifierQuantite = (id: string, delta: number) => {
    setComposition((prev) => {
      if (!prev) return prev;
      return prev.map((s) =>
        s.monstreId === id ? { ...s, quantite: Math.max(1, Math.min(20, s.quantite + delta)) } : s
      );
    });
    setSimulation(null);
    setVerrous((prev) => {
      const verrou = prev.find((v) => v.monstreId === id);
      if (!verrou) return prev;
      return prev.map((v) =>
        v.monstreId === id ? { ...v, quantite: Math.max(1, Math.min(20, v.quantite + delta)) } : v
      );
    });
  };

  const basculerVerrou = (slot: SlotRencontre) => {
    const deja = verrous.find((v) => v.monstreId === slot.monstreId);
    if (deja) {
      setVerrous((prev) => prev.filter((v) => v.monstreId !== slot.monstreId));
      setComposition((prev) =>
        prev ? prev.map((s) => (s.monstreId === slot.monstreId ? { ...s, verrouille: false } : s)) : prev
      );
    } else {
      setVerrous((prev) => [...prev, { monstreId: slot.monstreId, quantite: slot.quantite, verrouille: true }]);
      setComposition((prev) =>
        prev ? prev.map((s) => (s.monstreId === slot.monstreId ? { ...s, verrouille: true } : s)) : prev
      );
    }
  };

  const retirer = (id: string) => {
    setComposition((prev) => (prev ? prev.filter((s) => s.monstreId !== id) : prev));
    setVerrous((prev) => prev.filter((v) => v.monstreId !== id));
    setSimulation(null);
  };

  const remplacer = (ancienId: string, nouveauId: string) => {
    setComposition((prev) =>
      prev ? prev.map((s) => (s.monstreId === ancienId ? { ...s, monstreId: nouveauId } : s)) : prev
    );
    setVerrous((prev) => prev.map((v) => (v.monstreId === ancienId ? { ...v, monstreId: nouveauId } : v)));
    setSimulation(null);
  };

  const ajouter = (monstreId: string) => {
    if (!monstreId) return;
    setComposition((prev) => {
      if (!prev) return [{ monstreId, quantite: 1 }];
      const existant = prev.find((s) => s.monstreId === monstreId);
      if (existant) {
        return prev.map((s) => (s.monstreId === monstreId ? { ...s, quantite: s.quantite + 1 } : s));
      }
      return [...prev, { monstreId, quantite: 1 }];
    });
    setSimulation(null);
  };

  const lancerSimulation = () => {
    if (!evaluation) return;
    setSimulation(simulerRencontre(evaluation, groupe, { iterations: 250, graine: graine + 17 }));
  };

  const candidat = resultat?.candidats[indexVariante] ?? null;
  const groupePret = mode === "simplifie" ? nombreSimplifie > 0 : personnagesSelectionnes.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className={integre ? "text-lg font-bold" : "text-2xl font-bold"}>Générateur de rencontres COF2</h1>
          {!integre && (
            <p className="text-sm text-zinc-400 max-w-3xl">
              Budget sur la table NC → Pm du DRS, corrigé par un modèle tactique explicite. Facile, Normal et Boss
              sont des objectifs du logiciel, pas des catégories officielles de l&apos;éditeur.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generer(graine)}
            disabled={!groupePret}
            className="px-4 py-2 rounded bg-amber-400 text-black font-bold text-sm disabled:opacity-40"
          >
            Générer
          </button>
          <button
            onClick={relancer}
            disabled={!groupePret}
            className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm disabled:opacity-40"
          >
            Relancer
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[380px_1fr] gap-4 items-start">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Groupe</h2>
              <div className="flex gap-1">
                {(["fiches", "simplifie"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-1 rounded text-xs border ${
                      mode === m ? "bg-amber-400 text-black border-amber-300 font-bold" : "bg-zinc-800 border-zinc-700"
                    }`}
                  >
                    {m === "fiches" ? "Fiches" : "Simplifié"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "fiches" ? (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setSelection(characters.map((c) => c.id))} className="underline text-zinc-400">
                    Tout sélectionner
                  </button>
                  <button onClick={() => setSelection([])} className="underline text-zinc-400">
                    Tout désélectionner
                  </button>
                </div>
                <div className="max-h-56 overflow-auto space-y-1">
                  {characters.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm bg-zinc-950/50 border border-zinc-800 rounded px-2 py-1.5">
                      <input
                        id={`rencontre-pj-${c.id}`}
                        name={`pj-${c.id}`}
                        type="checkbox"
                        checked={selection.includes(c.id)}
                        onChange={(e) =>
                          setSelection((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                        }
                      />
                      <span className="flex-1 truncate">{c.nom}</span>
                      <span className="text-xs text-zinc-500">Niv. {c.niveau} · {c.profil || c.classe}</span>
                      <span className="text-xs font-mono text-green-400">{c.pv}/{c.pvMax} PV</span>
                    </label>
                  ))}
                </div>
                {selection.length === 0 && <p className="text-xs text-amber-300">Aucun PJ sélectionné.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">
                  Nombre de PJ
                  <input
                    id="rencontre-nombre-pj"
                    name="nombrePj"
                    type="number"
                    min={1}
                    max={8}
                    value={nombreSimplifie}
                    onChange={(e) => setNombreSimplifie(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Niveau
                  <input
                    id="rencontre-niveau"
                    name="niveau"
                    type="number"
                    min={1}
                    max={20}
                    value={niveauSimplifie}
                    onChange={(e) => setNiveauSimplifie(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            )}

            <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-2 space-y-1">
              <div>
                Niveau effectif <span className="text-zinc-100 font-mono">{groupe.niveauEffectif}</span> ·{" "}
                {groupe.nombre} PJ · {groupe.pvActuel}/{groupe.pvTotal} PV
              </div>
              <div>
                DPR {nombre(groupe.dpr)} · DEF moyenne {nombre(groupe.defenseMoyenne)} · soins {nombre(groupe.soinsDisponibles)}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-zinc-500 font-bold mb-1">État du groupe</div>
              <div className="flex gap-1">
                {(["frais", "entame", "epuise"] as EtatGroupe[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEtat(e)}
                    className={`flex-1 px-2 py-1 rounded text-xs border ${
                      etat === e ? "bg-amber-400 text-black border-amber-300 font-bold" : "bg-zinc-800 border-zinc-700"
                    }`}
                  >
                    {e === "frais" ? "Frais" : e === "entame" ? "Entamé" : "Épuisé"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h2 className="font-bold">Paramètres</h2>
            <div>
              <div className="text-xs uppercase text-zinc-500 font-bold mb-1">Difficulté</div>
              <div className="grid grid-cols-3 gap-1">
                {(["facile", "normal", "boss"] as DifficulteRencontre[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulte(d)}
                    title={LIBELLES_DIFFICULTE[d].description}
                    className={`px-2 py-2 rounded text-xs border ${
                      difficulte === d
                        ? d === "facile"
                          ? "bg-emerald-400 text-black border-emerald-300 font-bold"
                          : d === "normal"
                            ? "bg-amber-400 text-black border-amber-300 font-bold"
                            : "bg-red-400 text-black border-red-300 font-bold"
                        : "bg-zinc-800 border-zinc-700"
                    }`}
                  >
                    {LIBELLES_DIFFICULTE[d].nom}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{LIBELLES_DIFFICULTE[difficulte].description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-400">
                Type
                <select id="rencontre-type" name="type" value={type} onChange={(e) => setType(e.target.value as TypeRencontre)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>)}
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Terrain
                <select id="rencontre-terrain" name="terrain" value={terrain} onChange={(e) => setTerrain(e.target.value as TerrainRencontre)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm">
                  {TERRAINS_LISTE.map((t) => <option key={t} value={t}>{TERRAINS[t].nom}</option>)}
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Surprise
                <select id="rencontre-surprise" name="surprise" value={surprise} onChange={(e) => setSurprise(e.target.value as SurpriseRencontre)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm">
                  <option value="aucune">Aucune</option>
                  <option value="pj">Les PJ surprennent</option>
                  <option value="ennemis">Les ennemis surprennent</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Thème / famille
                <select id="rencontre-theme" name="theme" value={theme} onChange={(e) => setTheme(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm">
                  {themes.map((t) => <option key={t} value={t}>{t === "toutes" ? "Toutes" : t}</option>)}
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Créatures min.
                <input id="rencontre-nb-min" name="nbMin" inputMode="numeric" value={nbMin} onChange={(e) => setNbMin(e.target.value.replace(/\D/g, ""))} placeholder="auto" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-zinc-400">
                Créatures max.
                <input id="rencontre-nb-max" name="nbMax" inputMode="numeric" value={nbMax} onChange={(e) => setNbMax(e.target.value.replace(/\D/g, ""))} placeholder="auto" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm" />
              </label>
            </div>

            <p className="text-[11px] text-zinc-500">{DESCRIPTIONS_TYPE[type]}</p>
            <p className="text-[11px] text-zinc-500">{DESCRIPTIONS_SURPRISE[surprise]}</p>

            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input id="rencontre-v1" name="inclureV1" type="checkbox" checked={inclureV1} onChange={(e) => setInclureV1(e.target.checked)} />
                Autoriser V1 (signalée)
              </label>
              <label className="flex items-center gap-1.5">
                <input id="rencontre-hors-drs" name="inclureHorsDrs" type="checkbox" checked={inclureHorsDrs} onChange={(e) => setInclureHorsDrs(e.target.checked)} />
                Autoriser hors DRS
              </label>
            </div>

            {verrous.length > 0 && (
              <div className="text-xs text-violet-200 bg-violet-950/40 border border-violet-900 rounded p-2">
                {verrous.length} verrou(s) conservé(s) : {verrous.map((v) => `${bestiaire.find((m) => m.id === v.monstreId)?.nom ?? v.monstreId} ×${v.quantite}`).join(", ")}
                <button onClick={() => { setVerrous([]); setComposition((prev) => prev?.map((s) => ({ ...s, verrouille: false })) ?? prev); }} className="ml-2 underline">
                  tout déverrouiller
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 min-w-0">
          {erreur && <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{erreur}</div>}
          {!resultat && !evaluation && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
              Choisir un groupe et une difficulté, puis « Générer ». Le résultat explique le budget, les facteurs de
              danger, les risques tactiques et les hypothèses. Chaque composition peut être modifiée, verrouillée ou
              relancée sans perdre les choix du MJ.
            </div>
          )}

          {resultat && resultat.candidats.length === 0 && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200 space-y-1">
              <div className="font-bold">Aucune composition trouvée.</div>
              <div>
                Les filtres ne laissent aucune créature compatible avec ce budget. Essayez le thème « Toutes »,
                autorisez les sources V1 / hors DRS, ou agrandissez le groupe. Le détail des filtres est ci-dessous.
              </div>
            </div>
          )}

          {resultat && resultat.candidats.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {resultat.candidats.map((c, i) => (
                <button
                  key={i}
                  onClick={() => choisirVariante(i)}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    indexVariante === i ? "bg-amber-400 text-black border-amber-300 font-bold" : "bg-zinc-900 border-zinc-700"
                  }`}
                >
                  Variante {i + 1} · NR {nombre(c.nrEstime)} · {c.nombreEnnemis} créature(s)
                </button>
              ))}
            </div>
          )}

          {resultat && resultat.avertissements.length > 0 && (
            <div className="rounded border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200 space-y-1">
              {resultat.avertissements.map((a, i) => <div key={i}>• {a}</div>)}
            </div>
          )}

          {evaluation && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-bold text-lg">Composition proposée</h2>
                    <div className="text-xs text-zinc-500">
                      Graine {resultat?.graine ?? "—"} · Cible NR {nombre(resultat?.cibleNr ?? evaluation.cibleNrRegle)} ·
                      Cible {nombre(resultat?.ciblePm ?? 0)} Pm
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {onConvertirEnCombat && (
                      <button
                        onClick={() => onConvertirEnCombat(evaluation.slots)}
                        title="Reprend cette composition comme camp ennemi en préparation de combat (les PJ déjà posés sont conservés)"
                        className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-bold border border-red-500"
                      >
                        ⚔ Transformer en combat
                      </button>
                    )}
                    <Badge ton={evaluation.difficulteEstimee === "facile" ? "emerald" : evaluation.difficulteEstimee === "normal" ? "amber" : "red"}>
                      Estimé : {LIBELLES_DIFFICULTE[evaluation.difficulteEstimee].nom}
                    </Badge>
                    <Badge ton={evaluation.fiabilite === "haute" ? "emerald" : evaluation.fiabilite === "moyenne" ? "amber" : "red"}>
                      Fiabilité {evaluation.fiabilite}
                    </Badge>
                    {Math.abs(evaluation.ecartBudget) <= CONFIGURATION_PAR_DEFAUT.toleranceNr[difficulte] ? (
                      <Badge ton="emerald">Cible atteinte</Badge>
                    ) : (
                      <Badge ton="amber">Hors tolérance</Badge>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-4 gap-2 mt-3 text-sm">
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded p-2">
                    <div className="text-[11px] uppercase text-zinc-500">NR budget</div>
                    <div className="font-mono text-lg">{nombre(evaluation.nrBudget)}</div>
                    <div className="text-[11px] text-zinc-500">écart {evaluation.ecartBudget >= 0 ? "+" : ""}{nombre(evaluation.ecartBudget)}</div>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded p-2">
                    <div className="text-[11px] uppercase text-zinc-500">NR estimé</div>
                    <div className="font-mono text-lg">{nombre(evaluation.nrEstime)}</div>
                    <div className="text-[11px] text-zinc-500">
                      delta {evaluation.deltaDanger >= 0 ? "+" : ""}{nombre(evaluation.deltaDanger)}
                      {evaluation.nrEstime < 0 ? " · sous NC 0" : ""}
                    </div>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded p-2">
                    <div className="text-[11px] uppercase text-zinc-500">Ratio tactique</div>
                    <div className="font-mono text-lg">× {nombreRatio(evaluation.ratioPuissance)}</div>
                    <div className="text-[11px] text-zinc-500">1 = équilibré</div>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded p-2">
                    <div className="text-[11px] uppercase text-zinc-500">Estimation</div>
                    <div className="font-mono text-lg">
                      {evaluation.estimationRounds} round{evaluation.estimationRounds > 1 ? "s" : ""}
                    </div>
                    <div className="text-[11px] text-zinc-500">−{nombre(evaluation.estimationPertesPv)} PV</div>
                  </div>
                </div>

                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-zinc-500 border-b border-zinc-800">
                        <th className="py-1.5">Créature</th>
                        <th>NC</th>
                        <th>Qté</th>
                        <th>PV</th>
                        <th>DEF</th>
                        <th>Rôle</th>
                        <th>Source</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluation.slots.map((s) => (
                        <tr key={s.monstreId} className="border-b border-zinc-800/60 align-top">
                          <td className="py-2">
                            <div className="font-semibold">{s.profil.nom}</div>
                            {s.profil.signature.slice(0, 3).map((sig) => (
                              <span key={sig} className="inline-block mt-0.5 mr-1 text-[10px] px-1 py-0.5 rounded bg-violet-950/60 border border-violet-900 text-violet-200">{sig}</span>
                            ))}
                          </td>
                          <td className="font-mono">{s.profil.nc}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button onClick={() => modifierQuantite(s.monstreId, -1)} className="px-1.5 rounded bg-zinc-800">−</button>
                              <span className="font-mono w-5 text-center">{s.quantite}</span>
                              <button onClick={() => modifierQuantite(s.monstreId, 1)} className="px-1.5 rounded bg-zinc-800">+</button>
                            </div>
                          </td>
                          <td className="font-mono text-green-400">{s.profil.pvMax * s.quantite}</td>
                          <td className="font-mono">{s.profil.defense}</td>
                          <td className="text-xs">{s.profil.roles.join(", ")}</td>
                          <td className="text-xs text-zinc-400">{LIBELLES_EDITION[s.profil.edition]}</td>
                          <td>
                            <div className="flex justify-end gap-1 flex-wrap">
                              <button
                                onClick={() => basculerVerrou(s)}
                                title={s.verrouille ? "Déverrouiller" : "Verrouiller ce choix"}
                                className={`px-2 py-1 rounded text-xs border ${s.verrouille ? "bg-violet-500 text-black border-violet-300" : "bg-zinc-800 border-zinc-700"}`}
                              >
                                {s.verrouille ? "🔒" : "🔓"}
                              </button>
                              <select
                                value=""
                                name={`remplacer-${s.monstreId}`}
                                aria-label={`Remplacer ${s.profil.nom} par une autre créature`}
                                onChange={(e) => { if (e.target.value) remplacer(s.monstreId, e.target.value); }}
                                title="Remplacer par une autre créature"
                                className="bg-zinc-800 border border-zinc-700 rounded text-xs max-w-28"
                              >
                                <option value="">Remplacer…</option>
                                {bestiaire
                                  .filter((m) => m.id !== s.monstreId)
                                  .sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, "fr"))
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>NC {m.niveau} · {m.nom}</option>
                                  ))}
                              </select>
                              <button onClick={() => retirer(s.monstreId)} title="Retirer" className="px-2 py-1 rounded bg-zinc-800 text-xs hover:bg-red-900">✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 flex-wrap mt-3 items-center">
                  <select
                    value=""
                    name="ajouter-creature"
                    aria-label="Ajouter une créature à la composition"
                    onChange={(e) => { if (e.target.value) ajouter(e.target.value); }}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Ajouter une créature…</option>
                    {bestiaire
                      .slice()
                      .sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, "fr"))
                      .map((m) => <option key={m.id} value={m.id}>NC {m.niveau} · {m.nom}</option>)}
                  </select>
                  <button onClick={lancerSimulation} className="px-3 py-1.5 rounded bg-sky-500/20 border border-sky-500/50 text-sky-200 text-sm font-semibold">
                    Simuler 250 combats
                  </button>
                  <button onClick={relancer} className="px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm">
                    Relancer (verrous conservés)
                  </button>
                </div>

                {evaluation.slots.length === 0 && <p className="text-sm text-amber-300 mt-2">Composition vide : ajouter ou générer une créature.</p>}
              </div>

              {simulation && (
                <div className="rounded-lg border border-sky-900 bg-sky-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sky-200">Simulation Monte-Carlo</h3>
                    <span className="text-xs text-zinc-400">{simulation.iterations} itérations · modèle simplifié</span>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-2 mt-2 text-sm">
                    <div><span className="text-zinc-500 text-xs block">Victoires</span><span className="font-mono text-emerald-300">{pourcentage(simulation.tauxVictoire)}</span></div>
                    <div><span className="text-zinc-500 text-xs block">Défaites</span><span className="font-mono text-red-300">{pourcentage(simulation.tauxDefaite)}</span></div>
                    <div><span className="text-zinc-500 text-xs block">Nuls</span><span className="font-mono">{pourcentage(simulation.tauxNul)}</span></div>
                    <div><span className="text-zinc-500 text-xs block">Au moins un KO</span><span className="font-mono">{pourcentage(simulation.tauxAuMoinsUnKo)}</span></div>
                    <div><span className="text-zinc-500 text-xs block">Rounds moyens</span><span className="font-mono">{simulation.roundsMoyens}</span></div>
                    <div><span className="text-zinc-500 text-xs block">PV perdus</span><span className="font-mono">{simulation.pvPerdusMoyens} ({simulation.pvPerdusPct} %)</span></div>
                    <div><span className="text-zinc-500 text-xs block">KO moyens</span><span className="font-mono">{simulation.koMoyens}</span></div>
                    <div><span className="text-zinc-500 text-xs block">Ressources</span><span className="font-mono">{simulation.ressourcesDepenseesPct} %</span></div>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Modèle d&apos;usure : pas de positions ni de couverts, sorts pondérés par le mana, contrôle et soutien
                    approximés. Utiliser ces chiffres comme tendance, pas comme verdict.
                  </p>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="font-bold mb-2">Facteurs de difficulté</h3>
                  <div className="space-y-2">
                    {evaluation.facteurs.map((f) => (
                      <div key={f.cle} className="text-sm border-b border-zinc-800/60 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {impactBadge(f.impact)}
                          <span className="font-semibold">{f.libelle}</span>
                          <span className="font-mono text-xs text-zinc-300">{f.valeur}</span>
                          {origineBadge(f.origine)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="font-bold mb-2">Indicateurs</h3>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div>DPR du groupe : <span className="font-mono">{nombre(evaluation.dprParti)}</span></div>
                      <div>DPR ennemi : <span className="font-mono">{nombre(evaluation.dprEnnemis)}</span></div>
                      <div>Touche PJ : <span className="font-mono">{pourcentage(evaluation.tauxToucheParti)}</span></div>
                      <div>Touche ennemis : <span className="font-mono">{pourcentage(evaluation.tauxToucheEnnemis)}</span></div>
                      <div>PV effectifs PJ : <span className="font-mono">{nombre(evaluation.pvEffectifsParti)}</span></div>
                      <div>PV effectifs ennemis : <span className="font-mono">{nombre(evaluation.pvEffectifsEnnemis)}</span></div>
                      <div>Actions PJ : <span className="font-mono">{nombre(evaluation.actionsParti)}</span></div>
                      <div>Actions ennemies : <span className="font-mono">{nombre(evaluation.actionsEnnemis)}</span></div>
                      <div>Contrôle ennemi : <span className="font-mono">{pourcentage(evaluation.pressionControleEnnemie)}</span></div>
                      <div>Contrôle PJ : <span className="font-mono">{pourcentage(evaluation.pressionControlePartie)}</span></div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="font-bold mb-2 text-amber-200">Risques</h3>
                    <ul className="text-sm space-y-1 list-disc pl-4 text-zinc-300">
                      {evaluation.risques.map((r, i) => <li key={i}>{r}</li>)}
                      {evaluation.risques.length === 0 && <li className="text-zinc-500">Aucun risque majeur détecté.</li>}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="font-bold mb-2 text-emerald-200">Tactiques conseillées</h3>
                    <ul className="text-sm space-y-1 list-disc pl-4 text-zinc-300">
                      {evaluation.tactiques.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {candidat?.raisonsScore && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="font-bold mb-2">Pourquoi cette composition ?</h3>
                  <ul className="text-sm space-y-1 list-disc pl-4 text-zinc-300">
                    {candidat.raisonsScore.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid lg:grid-cols-3 gap-4">
                <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4" open>
                  <summary className="font-bold cursor-pointer">Hypothèses</summary>
                  <ul className="text-xs space-y-1 list-disc pl-4 text-zinc-400 mt-2">
                    {evaluation.hypotheses.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </details>
                <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <summary className="font-bold cursor-pointer">Limites du modèle</summary>
                  <ul className="text-xs space-y-1 list-disc pl-4 text-zinc-400 mt-2">
                    {evaluation.limites.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </details>
                <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <summary className="font-bold cursor-pointer">Avertissements</summary>
                  <ul className="text-xs space-y-1 list-disc pl-4 text-zinc-400 mt-2">
                    {evaluation.avertissements.map((a, i) => <li key={i}>{a}</li>)}
                    {evaluation.avertissements.length === 0 && <li>Aucun.</li>}
                  </ul>
                </details>
              </div>

              <p className="text-[11px] text-zinc-600">
                Sources : {SOURCES.tablePm.libelle} · {SOURCES.nombrePj.libelle} · {SOURCES.conditions.libelle} ·{" "}
                {SOURCES.surprise.libelle}. La table POP 2024 de l&apos;auteur n&apos;est pas utilisée comme règle officielle.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
