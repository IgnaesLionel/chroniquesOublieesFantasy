"use client";

import { useMemo, useState } from "react";
import {
  DETAILS,
  DETAIL_LABEL,
  TABLE_IDS,
  type DetailPnj,
  type Faction,
  type ImportancePnj,
  type NiveauSocial,
  type NpcGenerationOptions,
  type NpcProfile,
  type PalierPuissance,
  type ReferenceEntry,
  type ReferenceTable,
  type SexePnj,
} from "@/src/lib/npcgen/types";
import { idUnique, identifiantLisible } from "@/src/lib/npcgen/operations";
import { exportJson } from "@/src/lib/store/repository";

interface Props {
  profiles: NpcProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<NpcProfile[]>>;
  tables: ReferenceTable[];
  entries: ReferenceEntry[];
  factions: Faction[];
}

const champ =
  "w-full bg-zinc-950/70 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";
const bouton = "px-3 py-1.5 rounded text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

interface Form {
  id: string;
  nom: string;
  description: string;
  tags: string;
  actif: boolean;
  espece: string;
  culture: string;
  sexe: string;
  profession: string;
  niveauSocial: string;
  importance: string;
  factionId: string;
  lieu: string;
  detail: DetailPnj;
  genererCombat: boolean;
  palierPuissance: PalierPuissance;
  tagsOptions: string;
  exclureTags: string;
}

function normaliser(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function vide(): Form {
  return {
    id: "", nom: "", description: "", tags: "", actif: true,
    espece: "", culture: "", sexe: "", profession: "",
    niveauSocial: "", importance: "", factionId: "", lieu: "",
    detail: "standard", genererCombat: false, palierPuissance: "faible",
    tagsOptions: "", exclureTags: "",
  };
}

function depuisProfil(profil: NpcProfile): Form {
  const o = profil.options;
  return {
    id: profil.id,
    nom: profil.nom,
    description: profil.description,
    tags: profil.tags.join(", "),
    actif: profil.actif,
    espece: o.espece ?? "",
    culture: o.culture ?? "",
    sexe: o.sexe ?? "",
    profession: o.profession ?? "",
    niveauSocial: o.niveauSocial ?? "",
    importance: o.importance ?? "",
    factionId: o.factionId ?? "",
    lieu: o.lieu ?? "",
    detail: o.detail ?? "standard",
    genererCombat: o.genererCombat ?? false,
    palierPuissance: o.palierPuissance ?? "faible",
    tagsOptions: (o.tags ?? []).join(", "),
    exclureTags: (o.exclureTags ?? []).join(", "),
  };
}

function optionsDepuis(form: Form): NpcGenerationOptions {
  const nettoyer = (v: string) => (v.trim() ? v : undefined);
  return {
    espece: nettoyer(form.espece),
    culture: nettoyer(form.culture),
    sexe: nettoyer(form.sexe) as SexePnj | undefined,
    profession: nettoyer(form.profession),
    niveauSocial: nettoyer(form.niveauSocial) as NiveauSocial | undefined,
    importance: nettoyer(form.importance) as ImportancePnj | undefined,
    factionId: nettoyer(form.factionId),
    lieu: nettoyer(form.lieu),
    detail: form.detail,
    genererCombat: form.genererCombat,
    palierPuissance: form.palierPuissance,
    tags: form.tagsOptions.split(",").map((t) => t.trim()).filter(Boolean),
    exclureTags: form.exclureTags.split(",").map((t) => t.trim()).filter(Boolean),
  };
}

export function ProfileManager({ profiles, setProfiles, entries, factions }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");

  const listes = useMemo(() => {
    const vals = (id: string) => [...new Set(entries.filter((e) => e.tableId === id && e.actif).map((e) => e.valeur))];
    return {
      especes: vals(TABLE_IDS.especes),
      cultures: vals(TABLE_IDS.cultures),
      sexes: vals(TABLE_IDS.sexes),
      professions: vals(TABLE_IDS.professions),
      niveaux: vals(TABLE_IDS.niveauxSociaux),
      importances: vals(TABLE_IDS.importances),
      lieux: vals(TABLE_IDS.lieux),
      paliers: entries
        .filter((e) => e.tableId === TABLE_IDS.paliersPuissance && e.actif)
        .map((e) => ({ code: normaliser(e.valeur) as PalierPuissance, label: e.valeur })),
    };
  }, [entries]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return profiles
      .filter((p) => !q || [p.nom, p.description, p.tags.join(" ")].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [profiles, recherche]);

  const sauver = () => {
    if (!form) return;
    if (!form.nom.trim()) {
      setErreur("Le nom du profil est requis.");
      return;
    }
    const maintenant = new Date().toISOString();
    if (form.id) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === form.id
            ? { ...p, nom: form.nom.trim(), description: form.description.trim(), tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), options: optionsDepuis(form), actif: form.actif, updatedAt: maintenant }
            : p
        )
      );
    } else {
      setProfiles((prev) => [
        ...prev,
        {
          id: idUnique(`profil-${identifiantLisible(form.nom)}`, prev),
          nom: form.nom.trim(),
          description: form.description.trim(),
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          options: optionsDepuis(form),
          actif: form.actif,
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      ]);
    }
    setForm(null);
    setErreur("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bronze-700/60 bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-gold-300">Profils de génération</h2>
            <p className="text-sm text-zinc-400">Presets de critères réutilisables : marchand, garde, antagoniste…</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setErreur(""); setForm(vide()); }} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Profil</button>
            <button type="button" onClick={() => exportJson("profils-pnj.json", profiles)} className={bouton}>Export JSON</button>
          </div>
        </div>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un profil…" className={champ} />
        {erreur && <p className="text-sm text-red-400">{erreur}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtres.map((profil) => (
          <div key={profil.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-bold ${profil.actif ? "text-zinc-100" : "text-zinc-500 line-through"}`}>{profil.nom}</h3>
                <p className="text-xs text-zinc-500">{profil.tags.join(" · ") || "Sans tags"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <button type="button" onClick={() => { setErreur(""); setForm(depuisProfil(profil)); }} className={bouton}>Éditer</button>
                <button type="button" onClick={() => setProfiles((prev) => prev.map((p) => p.id === profil.id ? { ...p, actif: !p.actif, updatedAt: new Date().toISOString() } : p))} className={bouton}>{profil.actif ? "Désactiver" : "Activer"}</button>
                <button type="button" onClick={() => { if (confirm(`Supprimer le profil « ${profil.nom} » ?`)) setProfiles((prev) => prev.filter((p) => p.id !== profil.id)); }} className="px-2 py-1 rounded text-xs bg-zinc-800 text-red-300">✕</button>
              </div>
            </div>
            {profil.description && <p className="text-sm text-zinc-300">{profil.description}</p>}
            <div className="text-xs text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
              {profil.options.importance && <span>Importance : {profil.options.importance}</span>}
              {profil.options.niveauSocial && <span>Niveau : {profil.options.niveauSocial}</span>}
              {profil.options.profession && <span>Métier : {profil.options.profession}</span>}
              {profil.options.detail && <span>Détail : {DETAIL_LABEL[profil.options.detail]}</span>}
              {profil.options.genererCombat && <span className="text-amber-300">Combat : {profil.options.palierPuissance ?? "faible"}</span>}
            </div>
          </div>
        ))}
        {filtres.length === 0 && <p className="text-sm text-zinc-500">Aucun profil.</p>}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-2 max-h-[92vh] overflow-auto">
            <h3 className="font-bold">{form.id ? "Éditer le profil" : "Nouveau profil"}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Nom
                <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Tags du profil
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="quotidien, ville…" className={`${champ} mt-1`} />
              </label>
            </div>
            <label className="block text-sm">Description
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${champ} mt-1`} />
            </label>
            <div className="grid sm:grid-cols-2 gap-2 border-t border-zinc-800 pt-2">
              <label className="block text-sm">Espèce
                <select value={form.espece} onChange={(e) => setForm({ ...form, espece: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.especes.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Culture
                <select value={form.culture} onChange={(e) => setForm({ ...form, culture: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.cultures.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Sexe
                <select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.sexes.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Profession
                <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.professions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Niveau social
                <select value={form.niveauSocial} onChange={(e) => setForm({ ...form, niveauSocial: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Selon le métier</option>
                  {listes.niveaux.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Importance
                <select value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.importances.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Faction
                <select value={form.factionId} onChange={(e) => setForm({ ...form, factionId: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire / aucune</option>
                  {factions.filter((f) => f.actif).map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </label>
              <label className="block text-sm">Lieu
                <select value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} className={`${champ} mt-1`}>
                  <option value="">Aléatoire</option>
                  {listes.lieux.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Détail
                <select value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value as DetailPnj })} className={`${champ} mt-1`}>
                  {DETAILS.map((d) => <option key={d} value={d}>{DETAIL_LABEL[d]}</option>)}
                </select>
              </label>
              <label className="block text-sm">Tags souhaités
                <input value={form.tagsOptions} onChange={(e) => setForm({ ...form, tagsOptions: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Tags exclus
                <input value={form.exclureTags} onChange={(e) => setForm({ ...form, exclureTags: e.target.value })} className={`${champ} mt-1`} />
              </label>
              <label className="block text-sm">Palier de combat
                <select value={form.palierPuissance} onChange={(e) => setForm({ ...form, palierPuissance: e.target.value as PalierPuissance })} className={`${champ} mt-1`}>
                  {listes.paliers.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.genererCombat} onChange={(e) => setForm({ ...form, genererCombat: e.target.checked })} />
                Générer un bloc de combat estimé
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
                Profil actif
              </label>
            </div>
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setForm(null); setErreur(""); }} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button type="button" onClick={sauver} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
