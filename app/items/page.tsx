"use client";
import { useState } from "react";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { exportJson } from "@/src/lib/store/repository";
import { ARME_FAMILLES, DEGAT_LABEL, ITEM_CATEGORIES, labelFamilleArme, type ArmeFamille, type DegatType, type ItemCategorie } from "@/src/lib/rules/world/types";

const CAT_LABEL: Record<ItemCategorie, string> = {
  arme: "Armes", armure: "Armures", potion: "Potions", quete: "Quête", outil: "Outils", argent: "Argent", divers: "Divers",
};

/** Catalogue d'objets figé dans le code (worldSeeds) : lecture seule, pas de stock modifiable. */
export default function ItemsPage() {
  const items = SEED_ITEMS;
  const [filter, setFilter] = useState<"toutes" | ItemCategorie>("toutes");
  const [famille, setFamille] = useState<"toutes" | ArmeFamille>("toutes");

  const visible = items.filter((o) =>
    (filter === "toutes" || o.categorie === filter) &&
    (filter !== "arme" || famille === "toutes" || o.familles?.includes(famille))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Objets ({items.length})</h1>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-zinc-500">Catalogue en dur (code)</span>
          <button onClick={() => exportJson("objets.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="text-sm text-zinc-500 p-4">Aucun objet dans cette catégorie.</p>}
      </div>
    </div>
  );
}
