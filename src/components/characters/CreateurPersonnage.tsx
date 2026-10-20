"use client";
import { useMemo, useState } from "react";
import { voiesDe } from "@/src/lib/data/capacites";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { VOIE_MAGE, adopterVoieMage, traitsInitiaux, voiePeupleDe } from "@/src/lib/data/peuples";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import type { Character } from "@/src/lib/rules/types";
import {
  FAMILLES,
  PROFILS_PAR_FAMILLE,
  deriverPersonnage,
  type FamilleCOF,
} from "@/src/lib/rules/personnage";
import {
  compterCapacites,
  creerPersonnage,
  talentsRang2Gratuits,
} from "@/src/lib/rules/creation";
import { classeFamille } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

const CARACS = ["AGI", "CON", "FOR", "PER", "CHA", "INT", "VOL"] as const;
type Carac = (typeof CARACS)[number];
const PEUPLES = ["Humain", "Demi-Elfe", "Elfe haut", "Nain"];

const CARACS_DEFAUT: Record<Carac, number> = {
  AGI: 1, CON: 1, FOR: 1, PER: 1, CHA: 0, INT: 0, VOL: 0,
};

interface Props {
  onCreer: (c: Character) => void;
  onAnnuler: () => void;
}

export function CreateurPersonnage({ onCreer, onAnnuler }: Props) {
  const { catalogue: stock } = useCatalogueObjets();
  const [etape, setEtape] = useState(1);
  const [nom, setNom] = useState("");
  const [peuple, setPeuple] = useState("Humain");
  const [famille, setFamille] = useState<FamilleCOF>("Aventurier");
  const [profil, setProfil] = useState("Rôdeur");
  const [ideal, setIdeal] = useState("");
  const [travers, setTravers] = useState("");
  const [voieMage, setVoieMage] = useState(false);
  const [caracs, setCaracs] = useState<Record<Carac, number>>({ ...CARACS_DEFAUT });
  const [traits, setTraits] = useState<string[]>(() => traitsInitiaux("Humain"));
  const [talents, setTalents] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const changerPeuple = (p: string) => {
    setPeuple(p);
    setTraits(voieMage ? adopterVoieMage(p) : traitsInitiaux(p));
  };

  const changerFamille = (f: FamilleCOF) => {
    setFamille(f);
    const profils = PROFILS_PAR_FAMILLE[f] ?? [];
    if (!profils.includes(profil)) setProfil(profils[0] ?? profil);
    if (f !== "Mage" && voieMage) {
      setVoieMage(false);
      setTraits(traitsInitiaux(peuple));
    }
    setTalents([]);
  };

  const toggleVoieMage = () => {
    if (voieMage) {
      setVoieMage(false);
      setTraits(traitsInitiaux(peuple));
    } else {
      setVoieMage(true);
      setTraits(adopterVoieMage(peuple));
    }
    setTalents([]);
  };

  const toggleTrait = (t: string) =>
    setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleTalent = (t: string) =>
    setTalents((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // Brouillon pour l'aperçu et la comptabilité (non persisté).
  const brouillon = useMemo<Character>(() => {
    const base: Character = {
      id: "brouillon",
      kind: "personnage",
      nom: nom.trim() || "Sans nom",
      classe: profil,
      niveau: 1,
      pvMax: 1,
      pv: 1,
      defense: 10,
      initMod: 0,
      caracteristiques: { ...caracs },
      peuple,
      famille,
      profil,
      traitsPeuple: traits,
      voieMage: voieMage ? true : undefined,
      attaques: [],
      capacites: talents,
      ressources: {},
      effets: [],
      inventaire: [],
      sorts: [],
      exemple: false,
      migreSorts: true,
    };
    return base;
  }, [nom, profil, caracs, peuple, famille, traits, voieMage, talents]);

  const derive = useMemo(() => {
    try {
      return deriverPersonnage(brouillon, stock);
    } catch {
      return null;
    }
  }, [brouillon, stock]);

  const compte = useMemo(() => {
    try {
      return compterCapacites(brouillon);
    } catch {
      return null;
    }
  }, [brouillon]);

  const voiePeuple = voiePeupleDe(peuple);
  const voiesProfil = voiesDe(profil);
  const rangs1 = voiesProfil.flatMap((v) =>
    v.capacites.filter((c) => c.rang === 1).map((c) => ({ ...c, voie: v.voie }))
  );
  const rangs2 = talentsRang2Gratuits(brouillon);
  const peutSuivant =
    etape === 1 ? nom.trim().length > 0 && profil.trim().length > 0 : true;

  const creer = () => {
    setErreur(null);
    try {
      const c = creerPersonnage(
        {
          id: `pj-${Date.now().toString(36)}`,
          nom,
          peuple,
          famille,
          profil,
          caracteristiques: { ...caracs },
          traitsPeuple: traits,
          voieMage,
          talents,
          idealHeroique: ideal,
          travers,
        },
        SEED_SORTS,
        stock
      );
      onCreer(c);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className={`bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto fam-rail ${classeFamille(famille)}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-lg">Nouveau personnage <FamilleBadge famille={famille} /></h2>
            <div className="text-xs text-zinc-400">
              Étape {etape}/5 : {["Identité", "Caractéristiques", "Peuple", "Talents", "Récapitulatif"][etape - 1]}
            </div>
          </div>
          <button onClick={onAnnuler} className="px-2.5 py-1 rounded bg-zinc-800">✕</button>
        </div>

        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((e) => (
            <button
              key={e}
              onClick={() => setEtape(e)}
              className={`flex-1 h-1.5 rounded ${e <= etape ? "bg-amber-400" : "bg-zinc-800"}`}
              title={`Étape ${e}`}
            />
          ))}
        </div>

        {etape === 1 && (
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-sm">
              Nom*
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Kaelis" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" />
            </label>
            <label className="block text-sm">
              Peuple
              <select value={peuple} onChange={(e) => changerPeuple(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                {PEUPLES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Famille <FamilleBadge famille={famille} />
              <select value={famille} onChange={(e) => changerFamille(e.target.value as FamilleCOF)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                {FAMILLES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Profil
              <select value={profil} onChange={(e) => { setProfil(e.target.value); setTalents([]); }} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                {(PROFILS_PAR_FAMILLE[famille] ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Idéal héroïque (narratif)
              <input value={ideal} onChange={(e) => setIdeal(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" />
            </label>
            <label className="block text-sm">
              Travers (narratif)
              <input value={travers} onChange={(e) => setTravers(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" />
            </label>
            {famille === "Mage" && (
              <label className="flex items-start gap-2 text-sm sm:col-span-2 rounded border border-zinc-800 p-2.5">
                <input type="checkbox" className="mt-1" checked={voieMage} onChange={toggleVoieMage} />
                <span>
                  <b>Adopter la {VOIE_MAGE.voie}</b>
                  <span className="text-zinc-400"> — remplace la voie du peuple (garde son rang 1). Débloque 1 capacité de rang 2 gratuite.</span>
                </span>
              </label>
            )}
          </div>
        )}

        {etape === 2 && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {CARACS.map((k) => (
                <label key={k} className="text-sm text-center">
                  {k}
                  <input
                    type="number" min={-2} max={5} value={caracs[k]}
                    onChange={(e) => setCaracs((c) => ({ ...c, [k]: Math.max(-2, Math.min(5, Number(e.target.value))) }))}
                    className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 text-center font-mono"
                  />
                </label>
              ))}
            </div>
            {derive && (
              <div className="text-xs text-zinc-400 font-mono rounded border border-zinc-800 p-2.5">
                INIT {derive.initiative} · DEF {derive.defense} · PV {derive.pvMax} · Chance {derive.chanceMax} ·
                DR {derive.drType}×{derive.drNombre} · Mana {derive.manaMax} ·
                C {derive.attaques.contact >= 0 ? "+" : ""}{derive.attaques.contact} /
                D {derive.attaques.distance >= 0 ? "+" : ""}{derive.attaques.distance} /
                M {derive.attaques.magique >= 0 ? "+" : ""}{derive.attaques.magique}
              </div>
            )}
            <p className="text-xs text-zinc-500">Repères : FOR contact, AGI distance/défense, CON vigueur, PER initiative, CHA chance, VOL mana/magie.</p>
          </div>
        )}

        {etape === 3 && (
          <div className="rounded border border-zinc-800 p-2.5 space-y-1">
            <div className="text-sm font-semibold">Voie du peuple{voiePeuple ? ` — ${voiePeuple.voie}` : ""} (gratuit : rang 1)</div>
            {voiePeuple ? (
              voiePeuple.capacites.map((c) => {
                const verrouille = voieMage && c.rang > 1;
                return (
                  <label key={c.nom} className={`flex items-start gap-2 text-sm ${verrouille ? "opacity-40" : ""}`}>
                    <input type="checkbox" className="mt-1" checked={traits.includes(c.nom)} disabled={verrouille} onChange={() => toggleTrait(c.nom)} />
                    <span><b>R{c.rang} · {c.nom}</b> — <span className="text-zinc-400">{c.resume}</span></span>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-zinc-500">Peuple inconnu : aucun trait proposé.</p>
            )}
            {voieMage && (
              <div className="mt-2 border-t border-zinc-800 pt-2 space-y-1">
                <div className="text-sm font-semibold">{VOIE_MAGE.voie}</div>
                {VOIE_MAGE.capacites.map((c) => (
                  <label key={c.nom} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={traits.includes(c.nom)} onChange={() => toggleTrait(c.nom)} />
                    <span><b>R{c.rang} · {c.nom}</b> — <span className="text-zinc-400">{c.resume}</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {etape === 4 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">
              Talents du profil — {profil} ({talents.length} choisi{talents.length > 1 ? "s" : ""}, 2 pts : R1 = 1 pt)
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto rounded border border-zinc-800 p-2.5">
              {rangs1.map((c) => (
                <label key={c.nom} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={talents.includes(c.nom)} onChange={() => toggleTalent(c.nom)} />
                  <span><b>{c.nom}</b> <span className="text-zinc-500">— {c.voie}</span><span className="block text-xs text-zinc-500">{c.resume}</span></span>
                </label>
              ))}
              {rangs1.length === 0 && <p className="text-xs text-zinc-500">Aucune capacité rang 1 pour ce profil.</p>}
            </div>
            {rangs2.length > 0 && (
              <div className={`rounded border border-zinc-800 p-2.5 space-y-1 fam-rail ${classeFamille("Mage")}`}>
                <div className="text-sm font-semibold fam-texte">Rang 2 gratuit (Voie du mage adoptée — 1 seul)</div>
                {rangs2.map((c) => (
                  <label key={c.nom} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={talents.includes(c.nom)} onChange={() => toggleTalent(c.nom)} />
                    <span><b>{c.nom}</b> <span className="text-zinc-500">— {c.voie}</span></span>
                  </label>
                ))}
              </div>
            )}
            {compte && (
              <div className={`text-xs rounded px-2.5 py-1.5 border ${compte.alertes.length === 0 ? "text-green-300/90 bg-green-950/30 border-green-800/40" : "text-amber-300/90 bg-amber-950/30 border-amber-800/40"}`}>
                {compte.depense}/{compte.points} pts
                {compte.alertes.map((a) => <div key={a}>⚠ {a}</div>)}
              </div>
            )}
          </div>
        )}

        {etape === 5 && (
          <div className="space-y-2 text-sm">
            <div className="rounded border border-zinc-800 p-3">
              <div className="font-bold text-base">{nom.trim() || "Sans nom"} <FamilleBadge famille={famille} /> <span className="font-normal text-zinc-400 text-xs">{peuple} · {profil} · Niv. 1{voieMage ? " · Voie du mage" : ""}</span></div>
              <div className="font-mono text-xs mt-1 flex flex-wrap gap-1.5">
                {CARACS.map((k) => <span key={k} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">{k} <b>{caracs[k] >= 0 ? `+${caracs[k]}` : caracs[k]}</b></span>)}
              </div>
              {derive && <div className="text-xs text-zinc-400 font-mono mt-1.5">INIT {derive.initiative} · DEF {derive.defense} · PV {derive.pvMax} · Chance {derive.chanceMax} · DR {derive.drType}×{derive.drNombre} · Mana {derive.manaMax}</div>}
              {traits.length > 0 && <div className="text-xs text-zinc-400 mt-1.5">◈ Peuple : {traits.join(", ")}</div>}
              {talents.length > 0 && <div className="text-xs text-zinc-400">✦ Talents : {talents.join(" · ")}</div>}
            </div>
            {compte && compte.alertes.length > 0 && (
              <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded px-2.5 py-1.5">
                {compte.alertes.map((a) => <div key={a}>⚠ {a}</div>)}
                <div className="text-zinc-500 mt-1">Non bloquant :modifiable après création (onglet Sorts, Éditer).</div>
              </div>
            )}
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
          </div>
        )}

        <div className="flex gap-2 justify-between">
          <button onClick={() => (etape > 1 ? setEtape(etape - 1) : onAnnuler())} className="px-4 py-2 rounded bg-zinc-800 text-sm">
            {etape > 1 ? "◀ Retour" : "Annuler"}
          </button>
          {etape < 5 ? (
            <button onClick={() => setEtape(etape + 1)} disabled={!peutSuivant} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold text-sm disabled:opacity-40">
              Suivant ▶
            </button>
          ) : (
            <button onClick={creer} disabled={!peutSuivant} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold text-sm disabled:opacity-40">
              Créer {nom.trim() ? `« ${nom.trim()} »` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
