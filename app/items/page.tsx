"use client";
import { useState } from "react";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import { exportJson } from "@/src/lib/store/repository";
import { ARME_FAMILLES, DEGAT_LABEL, ITEM_CATEGORIES, labelFamilleArme, type ArmeFamille, type DegatType, type Item, type ItemCategorie } from "@/src/lib/rules/world/types";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { parseDiceExpression } from "@/src/lib/rules/dice/roller";

function degatsValide(expr: string): boolean {
  try {
    parseDiceExpression(expr);
    return true;
  } catch {
    return false;
  }
}

const EMPTY: Item = {
  id: "", nom: "", categorie: "divers", description: "", effet: "",
  quantite: 1, poids: undefined, valeur: undefined, exemple: false,
};

const CAT_LABEL: Record<ItemCategorie, string> = {
  arme: "Armes", armure: "Armures", potion: "Potions", quete: "Quête", outil: "Outils", argent: "Argent", divers: "Divers",
};

export default function ItemsPage() {
  const { items, setItems } = useLocalCollection<Item>("cof.items.v2", SEED_ITEMS);
  const [editing, setEditing] = useState<Item | null>(null);
  const [filter, setFilter] = useState<"toutes" | ItemCategorie>("toutes");
  const [famille, setFamille] = useState<"toutes" | ArmeFamille>("toutes");

  const visible = items.filter((o) =>
    (filter === "toutes" || o.categorie === filter) &&
    (filter !== "arme" || famille === "toutes" || o.familles?.includes(famille))
  );

  const save = () => {
    if (!editing || !editing.nom.trim()) return;
    setItems((prev) => {
      if (!editing.id) return [...prev, { ...editing, id: `item-${Date.now().toString(36)}` }];
      return prev.map((o) => (o.id === editing.id ? editing : o));
    });
    setEditing(null);
  };

  const bump = (id: string, d: number) =>
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, quantite: Math.max(0, o.quantite + d) } : o)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Objets ({items.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => exportJson("objets.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={() => setEditing({ ...EMPTY })} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Nouveau</button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["toutes", ...ITEM_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-2.5 py-1 rounded text-xs ${filter === c ? "bg-amber-400 text-black font-bold" : "bg-zinc-800 text-zinc-300"}`}
          >
            {c === "toutes" ? "Tout" : CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {filter === "arme" && (
        <label className="flex items-center gap-2 text-sm text-zinc-400">Famille
          <select value={famille} onChange={(e) => setFamille(e.target.value as "toutes" | ArmeFamille)} className="bg-zinc-800 rounded px-2 py-1.5 text-sm">
            <option value="toutes">Toutes familles</option>
            {(Object.keys(DEGAT_LABEL) as DegatType[]).map((d) => (
              <optgroup key={d} label={DEGAT_LABEL[d]}>
                {ARME_FAMILLES.filter((f) => f.degat === d).map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Objet</th>
              <th className="text-left px-3 py-2">Catégorie</th>
              <th className="text-left px-3 py-2">Effet</th>
              <th className="text-left px-3 py-2">Qté</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id} className="border-t border-zinc-800 bg-zinc-950">
                <td className="px-3 py-2">
                  <span className="font-semibold">{o.nom}</span>
                  {o.exemple && <span className="text-xs text-amber-400 ml-1">· ex</span>}
                  {o.description && <span className="block text-xs text-zinc-500">{o.description}</span>}
                </td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{CAT_LABEL[o.categorie]}</span>{o.familles?.map((f) => (<span key={f} title={ARME_FAMILLES.find((x) => x.key === f)?.exemples} className="ml-1 text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-200">{labelFamilleArme(f)}</span>))}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {o.estArme && <span className="block text-amber-300 font-mono">🗡 +{o.bonusAttaque ?? 0} · {o.degats ?? "1d6"}{o.effetCle ? ` · ✦${o.effetCle}` : ""}</span>}
                  {o.effet ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono font-bold">×{o.quantite}</span>
                  <span className="ml-2 inline-flex gap-1">
                    <button onClick={() => bump(o.id, -1)} className="px-1.5 rounded bg-zinc-800 text-xs">−</button>
                    <button onClick={() => bump(o.id, 1)} className="px-1.5 rounded bg-zinc-800 text-xs">+</button>
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setEditing({ ...o })} className="text-xs px-2 py-1 rounded bg-zinc-800 mr-1">Éditer</button>
                  <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== o.id))} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-red-900">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="text-sm text-zinc-500 p-4">Aucun objet dans cette catégorie.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-md space-y-2.5 max-h-[90vh] overflow-auto">
            <h2 className="font-bold">{editing.id ? `Éditer ${editing.nom}` : "Nouvel objet"}</h2>
            <label className="block text-sm">Nom*<input value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Catégorie
                <select value={editing.categorie} onChange={(e) => setEditing({ ...editing, categorie: e.target.value as ItemCategorie })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </label>
              <label className="text-sm">Quantité<input type="number" min={0} value={editing.quantite} onChange={(e) => setEditing({ ...editing, quantite: Math.max(0, Number(e.target.value)) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <label className="block text-sm">Effet (texte libre)<input value={editing.effet ?? ""} onChange={(e) => setEditing({ ...editing, effet: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <label className="flex items-center gap-2 text-sm bg-zinc-950 border border-zinc-800 rounded px-2.5 py-2">
              <input
                type="checkbox" checked={!!editing.estArme}
                onChange={(e) => setEditing({ ...editing, estArme: e.target.checked || undefined, familles: e.target.checked ? editing.familles : undefined })}
              />
              🗡 C'est une arme (utilisable en combat)
            </label>
            {editing.estArme && (
              <div className="rounded border border-zinc-700 p-2.5 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <label>Bonus d'attaque<input type="number" value={editing.bonusAttaque ?? 0} onChange={(e) => setEditing({ ...editing, bonusAttaque: Number(e.target.value) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
                  <label>Dégâts (ex: 1d8+3)<input
                    value={editing.degats ?? ""} onChange={(e) => setEditing({ ...editing, degats: e.target.value })}
                    placeholder="1d6" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono"
                  /></label>
                </div>
                {editing.degats && !degatsValide(editing.degats) && (
                  <p className="text-xs text-red-400">Expression invalide (attendu : 1d6, 2d6+3...).</p>
                )}
                <div className="space-y-1.5">
                  <span className="text-zinc-400">Familles (cumul possible : ex. hachette de lancer = Haches + Jet)</span>
                  {(Object.keys(DEGAT_LABEL) as DegatType[]).map((d) => (
                    <div key={d}>
                      <span className="text-xs uppercase text-zinc-500">{DEGAT_LABEL[d]} <span className="normal-case">({ARME_FAMILLES.find((f) => f.degat === d)?.verbes})</span></span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {ARME_FAMILLES.filter((f) => f.degat === d).map((f) => {
                          const on = editing.familles?.includes(f.key) ?? false;
                          return (
                            <label key={f.key} title={f.exemples} className={`flex items-center gap-1 text-xs px-2 py-1 rounded cursor-pointer ${on ? "bg-amber-500 text-black font-bold" : "bg-zinc-800"}`}>
                              <input
                                type="checkbox" checked={on}
                                onChange={() => {
                                  const next = on
                                    ? (editing.familles ?? []).filter((x) => x !== f.key)
                                    : [...(editing.familles ?? []), f.key];
                                  setEditing({ ...editing, familles: next.length > 0 ? next : undefined });
                                }}
                                className="accent-amber-500"
                              />
                              {f.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label>Effet si TOUCHÉ
                    <select
                      value={editing.effetCle ?? ""} onChange={(e) => setEditing({ ...editing, effetCle: e.target.value || undefined })}
                      className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
                    >
                      <option value="">Aucun</option>
                      {EFFECT_CATALOG.map((t) => <option key={t.key} value={t.key}>{t.nom}</option>)}
                    </select>
                  </label>
                  <label>Durée (tours)<input
                    type="number" min={1} value={editing.effetDuree ?? ""}
                    onChange={(e) => setEditing({ ...editing, effetDuree: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="défaut" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
                  /></label>
                </div>
              </div>
            )}
            <label className="block text-sm">Description<textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
