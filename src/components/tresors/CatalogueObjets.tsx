"use client";
import { useState } from "react";
import { exportJson } from "@/src/lib/store/repository";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { CreateurObjet } from "@/src/components/tresors/CreateurObjet";
import { DonObjet } from "@/src/components/tresors/DonObjet";
import { ARME_FAMILLES, DEGAT_LABEL, ITEM_CATEGORIES, labelFamilleArme, type ArmeFamille, type DegatType, type Item, type ItemCategorie } from "@/src/lib/rules/world/types";
import { libelleMains } from "@/src/lib/rules/equipement";

const CAT_LABEL: Record<ItemCategorie, string> = {
  arme: "Armes", armure: "Armures", potion: "Potions", quete: "Quête", outil: "Outils", argent: "Argent", divers: "Divers",
};

export interface FiltreCatalogue {
  recherche: string;
  categorie: "toutes" | ItemCategorie;
  famille: "toutes" | ArmeFamille;
}

function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Filtre pur (nom insensible casse/accents + catégorie + famille). Testable. */
export function filtrerCatalogue(items: Item[], filtre: FiltreCatalogue): Item[] {
  const aiguille = normaliser(filtre.recherche.trim());
  return items.filter((o) =>
    (filtre.categorie === "toutes" || o.categorie === filtre.categorie) &&
    (filtre.categorie !== "arme" || filtre.famille === "toutes" || o.familles?.includes(filtre.famille)) &&
    (aiguille === "" || normaliser(o.nom).includes(aiguille))
  );
}

/** Catalogue : seeds en dur + créations MJ (persistées, modifiables). */
export function CatalogueObjets() {
  const { catalogue: items, setMaison, idsMaison } = useCatalogueObjets();
  const [filter, setFilter] = useState<"toutes" | ItemCategorie>("toutes");
  const [famille, setFamille] = useState<"toutes" | ArmeFamille>("toutes");
  const [recherche, setRecherche] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);

  const visible = filtrerCatalogue(items, { recherche, categorie: filter, famille });

  const supprimer = (id: string) => {
    if (!window.confirm("Supprimer cet objet maison ? Les inventaires qui le citent garderont son id brut.")) return;
    setMaison((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold font-display">Catalogue ({items.length})</h2>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-zinc-500">Seeds + créations MJ</span>
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
      <div className="flex gap-2 items-center">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un objet par son nom…"
          className="flex-1 bg-zinc-800 rounded px-2.5 py-1.5 text-sm"
        />
        {recherche.trim() !== "" && (
          <span className="text-xs text-zinc-400 whitespace-nowrap">{visible.length} résultat{visible.length > 1 ? "s" : ""}</span>
        )}
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
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const maison = idsMaison.has(o.id);
              return (
                <tr key={o.id} className="border-t border-zinc-800 bg-zinc-950">
                  <td className="px-3 py-2">
                    <span className="font-semibold">{o.nom}</span>
                    {o.exemple && <span className="text-xs text-amber-400 ml-1">· ex</span>}
                    {maison && <span className="text-xs text-violet-300 ml-1">· maison</span>}
                    {o.description && <span className="block text-xs text-zinc-500">{o.description}</span>}
                  </td>
                  <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{CAT_LABEL[o.categorie]}</span>{o.familles?.map((f) => (<span key={f} title={ARME_FAMILLES.find((x) => x.key === f)?.exemples} className="ml-1 text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-200">{labelFamilleArme(f)}</span>))}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {o.estArme && <span className="block text-amber-300 font-mono">🗡 +{o.bonusAttaque ?? 0} · {o.degats ?? "1d6"}{o.effetCle ? ` · ✦${o.effetCle}` : ""} · {libelleMains(o)}</span>}
                    {o.bonusDefense != null && <span className="block text-sky-300 font-mono">🛡 +{o.bonusDefense} DEF{o.emplacement ? ` · ${o.emplacement === "bouclier" ? "bouclier (1 main)" : o.emplacement === "accessoire" ? "accessoire" : "torse"}` : ""}{o.magique ? " · ✦ magique (non cumulé)" : ""}</span>}
                    {!o.estArme && o.bonusDefense == null && o.mains != null && o.mains > 0 && <span className="block text-zinc-500 font-mono">{libelleMains(o)}</span>}
                    {o.effet ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono font-bold">×{o.quantite}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 items-center">
                      {maison && (
                        <>
                          <button onClick={() => setEditing(o)} className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 mr-1">Éditer</button>
                          <button onClick={() => supprimer(o.id)} className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900">✕</button>
                        </>
                      )}
                      <DonObjet item={o} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="text-sm text-zinc-500 p-4">Aucun objet dans cette catégorie.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold">Éditer {editing.nom}</h2>
            <CreateurObjet
              key={editing.id}
              initial={editing}
              onEnregistrer={(item) => {
                setMaison((prev) => prev.map((o) => (o.id === item.id ? item : o)));
                setEditing(null);
              }}
              onAnnuler={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
