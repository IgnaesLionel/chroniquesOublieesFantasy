"use client";
import { useState } from "react";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import { CAPACITES_PARTAGEES } from "@/src/lib/data/capacites-partagees";
import { SOUS_CATEGORIES_SUGGEREES } from "@/src/lib/rules/categories";
import { monsterSchema } from "@/src/lib/data/validation";
import { parseDiceExpression } from "@/src/lib/rules/dice/roller";

interface Props {
  draft: MonsterTemplate;
  onChange: (d: MonsterTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
}

function diceOk(expr: string): boolean {
  try {
    parseDiceExpression(expr);
    return true;
  } catch {
    return false;
  }
}

export function MonsterEditor({ draft, onChange, onSave, onCancel }: Props) {
  const [atkNom, setAtkNom] = useState("");
  const [atkBonus, setAtkBonus] = useState("3");
  const [atkDegats, setAtkDegats] = useState("1d6");
  const [capNom, setCapNom] = useState("");
  const [sousCatNom, setSousCatNom] = useState("");
  const [erreur, setErreur] = useState("");

  const set = (p: Partial<MonsterTemplate>) => onChange({ ...draft, ...p });

  const sousCategories = draft.sousCategories ?? [];
  const toggleSousCategorie = (nom: string) => {
    set({ sousCategories: sousCategories.includes(nom) ? sousCategories.filter((x) => x !== nom) : [...sousCategories, nom] });
  };
  const addSousCategorie = () => {
    const nom = sousCatNom.trim();
    if (!nom || sousCategories.includes(nom)) return;
    set({ sousCategories: [...sousCategories, nom] });
    setSousCatNom("");
  };

  const save = () => {
    const clamped = { ...draft, pv: Math.max(0, Math.min(draft.pvMax, draft.pv)) };
    const parsed = monsterSchema.safeParse(clamped);
    if (!parsed.success) {
      setErreur(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "));
      return;
    }
    onChange(clamped);
    onSave();
  };

  const addAttaque = () => {
    if (!atkNom.trim() || !diceOk(atkDegats)) return;
    onChange({
      ...draft,
      attaques: [...draft.attaques, {
        id: `atk-${Date.now().toString(36)}`,
        nom: atkNom.trim(), bonus: Number(atkBonus) || 0, degats: atkDegats.trim(),
      }],
    });
    setAtkNom("");
  };

  const togglePartagee = (cle: string) => {
    const refs = draft.capacitesPartagees ?? [];
    set({ capacitesPartagees: refs.includes(cle) ? refs.filter((r) => r !== cle) : [...refs, cle] });
  };

  const input = "mt-1 w-full bg-zinc-800 rounded px-2 py-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-3 max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-lg">{draft.id ? `Éditer ${draft.nom}` : "Nouveau monstre"}</h2>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="col-span-2">Nom*<input value={draft.nom} onChange={(e) => set({ nom: e.target.value })} className={input} /></label>
          <label>Type<input value={draft.type} onChange={(e) => set({ type: e.target.value })} className={input} placeholder="Humanoïde, Animal…" /></label>
          <label>Catégorie<input value={draft.categorie ?? ""} onChange={(e) => set({ categorie: e.target.value })} className={input} placeholder="Monstres/Créatures…" /></label>
          <label>Taille<input value={draft.taille ?? ""} onChange={(e) => set({ taille: e.target.value })} className={input} placeholder="Petite, Moyenne…" /></label>
          <label>Niveau (NC)<input type="number" min={0} step={0.5} value={draft.niveau} onChange={(e) => set({ niveau: Number(e.target.value) })} className={input} /></label>
        </div>

        <div className="text-sm space-y-1.5">
          <div className="font-semibold" title="Une créature garde sa catégorie (ex : Monstres/Créatures) et peut cumuler des espèces : mort-vivant, démon... (dégâts bonus de certains sorts)">Sous-catégories ({sousCategories.length})</div>
          <div className="flex flex-wrap gap-1">
            {SOUS_CATEGORIES_SUGGEREES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSousCategorie(s)}
                title={sousCategories.includes(s) ? "Retirer" : "Ajouter"}
                className={`text-xs px-2 py-1 rounded border ${sousCategories.includes(s) ? "bg-amber-400/20 border-amber-400/60 text-amber-200" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
              >
                {sousCategories.includes(s) ? "✓ " : "+ "}{s}
              </button>
            ))}
          </div>
          {sousCategories.filter((x) => !(SOUS_CATEGORIES_SUGGEREES as readonly string[]).includes(x)).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sousCategories.filter((x) => !(SOUS_CATEGORIES_SUGGEREES as readonly string[]).includes(x)).map((x) => (
                <span key={x} className="text-xs px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200">
                  {x} <button onClick={() => toggleSousCategorie(x)} className="text-red-400 ml-1">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={sousCatNom} onChange={(e) => setSousCatNom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSousCategorie(); }} placeholder="Autre espèce (ex : Géant)…" className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
            <button onClick={addSousCategorie} disabled={!sousCatNom.trim()} className="px-3 py-1.5 rounded bg-zinc-700 text-sm disabled:opacity-40">+ Ajouter</button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
          <label>PV<input type="number" min={0} value={draft.pv} onChange={(e) => set({ pv: Number(e.target.value) })} className={input} /></label>
          <label>PV max<input type="number" min={1} value={draft.pvMax} onChange={(e) => set({ pvMax: Math.max(1, Number(e.target.value)) })} className={input} /></label>
          <label>Défense<input type="number" value={draft.defense} onChange={(e) => set({ defense: Number(e.target.value) })} className={input} /></label>
          <label>Init mod<input type="number" value={draft.initMod} onChange={(e) => set({ initMod: Number(e.target.value) })} className={input} /></label>
          <label>RD<input type="number" min={0} value={draft.rd ?? 0} onChange={(e) => set({ rd: Number(e.target.value) })} className={input} /></label>
          <label>Dépl. (m)<input type="number" min={0} value={draft.deplacement ?? ""} onChange={(e) => set({ deplacement: e.target.value === "" ? null : Number(e.target.value) })} className={input} placeholder="—" /></label>
        </div>

        <div className="text-sm space-y-1.5">
          <div className="font-semibold">Attaques ({draft.attaques.length})</div>
          {draft.attaques.map((a, i) => (
            <div key={a.id} className="flex gap-2 items-center">
              <input value={a.nom} onChange={(e) => set({ attaques: draft.attaques.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)) })} className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
              <input type="number" value={a.bonus} onChange={(e) => set({ attaques: draft.attaques.map((x, j) => (j === i ? { ...x, bonus: Number(e.target.value) } : x)) })} title="Bonus" className="w-16 bg-zinc-800 rounded px-2 py-1.5" />
              <input
                value={a.degats} onChange={(e) => set({ attaques: draft.attaques.map((x, j) => (j === i ? { ...x, degats: e.target.value } : x)) })}
                title="Dégâts" className={`w-24 bg-zinc-800 rounded px-2 py-1.5 font-mono ${diceOk(a.degats) ? "" : "outline outline-1 outline-red-500"}`}
              />
              <button onClick={() => set({ attaques: draft.attaques.filter((_, j) => j !== i) })} className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-red-900">✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={atkNom} onChange={(e) => setAtkNom(e.target.value)} placeholder="Nouvelle attaque" className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
            <input type="number" value={atkBonus} onChange={(e) => setAtkBonus(e.target.value)} title="Bonus" className="w-16 bg-zinc-800 rounded px-2 py-1.5" />
            <input value={atkDegats} onChange={(e) => setAtkDegats(e.target.value)} title="Dégâts (1d6+2)" className={`w-24 bg-zinc-800 rounded px-2 py-1.5 font-mono ${diceOk(atkDegats) ? "" : "outline outline-1 outline-red-500"}`} />
            <button onClick={addAttaque} disabled={!atkNom.trim() || !diceOk(atkDegats)} className="px-3 py-1.5 rounded bg-zinc-700 text-sm disabled:opacity-40">+ Ajouter</button>
          </div>
        </div>

        <div className="text-sm space-y-1.5">
          <div className="font-semibold">Capacités libres ({draft.capacites.length})</div>
          {draft.capacites.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="flex-1 text-zinc-300">{c}</span>
              <button onClick={() => set({ capacites: draft.capacites.filter((_, j) => j !== i) })} className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-900 text-xs">✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={capNom} onChange={(e) => setCapNom(e.target.value)} placeholder="Ex : Embuscade" className="flex-1 bg-zinc-800 rounded px-2 py-1.5" />
            <button onClick={() => { if (capNom.trim()) { set({ capacites: [...draft.capacites, capNom.trim()] }); setCapNom(""); } }} className="px-3 py-1.5 rounded bg-zinc-700 text-sm">+ Ajouter</button>
          </div>
        </div>

        <div className="text-sm">
          <div className="font-semibold mb-1">Capacités partagées ({(draft.capacitesPartagees ?? []).length})</div>
          <div className="grid sm:grid-cols-2 gap-1 max-h-40 overflow-auto rounded border border-zinc-800 p-2">
            {CAPACITES_PARTAGEES.map((c) => (
              <label key={c.cle} title={c.resume} className="flex items-center gap-2 text-xs bg-zinc-950 rounded px-2 py-1 cursor-pointer">
                <input type="checkbox" checked={(draft.capacitesPartagees ?? []).includes(c.cle)} onChange={() => togglePartagee(c.cle)} />
                ⛓ {c.nom}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          <label>Description<textarea value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} rows={2} className={input} /></label>
          <label>Notes MJ<textarea value={draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} rows={2} className={input} /></label>
        </div>

        {erreur && <p className="text-xs text-red-400">{erreur}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
          <button onClick={save} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
