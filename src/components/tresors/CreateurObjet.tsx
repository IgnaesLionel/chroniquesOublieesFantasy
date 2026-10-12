"use client";
import { useState } from "react";
import type { ArmeFamille, Item, ItemCategorie } from "@/src/lib/rules/world/types";
import { ARME_FAMILLES, ITEM_CATEGORIES } from "@/src/lib/rules/world/types";
import { ECHELLE_ARMURES } from "@/src/lib/rules/limitesArmures";
import { construireObjetMaison } from "@/src/lib/rules/objetsMaison";

interface Props {
  /** Édition (sinon création). Le parent force `key` pour réinitialiser. */
  initial?: Item | null;
  onEnregistrer: (item: Item) => void;
  onAnnuler?: () => void;
}

const input = "mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 text-sm";

export function CreateurObjet({ initial, onEnregistrer, onAnnuler }: Props) {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [categorie, setCategorie] = useState<ItemCategorie>(initial?.categorie ?? "arme");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [effet, setEffet] = useState(initial?.effet ?? "");
  const [quantite, setQuantite] = useState(String(initial?.quantite ?? 1));
  const [bonusAttaque, setBonusAttaque] = useState(String(initial?.bonusAttaque ?? 0));
  const [degats, setDegats] = useState(initial?.degats ?? "1d6");
  const [familles, setFamilles] = useState<ArmeFamille[]>([...(initial?.familles ?? [])]);
  const [mains, setMains] = useState<0 | 1 | 2>((initial?.mains as 0 | 1 | 2 | undefined) ?? 1);
  const [bonusDefense, setBonusDefense] = useState(String(initial?.bonusDefense ?? 0));
  const [emplacement, setEmplacement] = useState<"torse" | "bouclier" | "accessoire">(initial?.emplacement ?? "torse");
  const [magique, setMagique] = useState(!!initial?.magique);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Pré-remplit nom / DEF / description depuis un modèle de la table des armures. */
  const appliquerModeleArmure = (defTexte: string) => {
    if (defTexte === "") return;
    const modele = ECHELLE_ARMURES.find((e) => String(e.def) === defTexte);
    if (!modele) return;
    setBonusDefense(String(modele.def));
    setNom((n) => (n.trim() ? n : `${modele.nom} (+${modele.def} DEF)`));
    setDescription((d) => (d.trim() ? d : modele.note));
  };

  const basculerFamille = (f: ArmeFamille) =>
    setFamilles((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const enregistrer = () => {
    try {
      const item = construireObjetMaison(
        {
          nom,
          categorie,
          description,
          effet,
          quantite: Number(quantite),
          bonusAttaque: Number(bonusAttaque),
          degats,
          familles,
          mains,
          bonusDefense: Number(bonusDefense),
          emplacement,
          magique,
        },
        initial?.id
      );
      onEnregistrer(item);
      setErreur(null);
      if (!initial) {
        setMessage(`Créé : ${item.nom} (visible dans Objets, Personnages, Combat).`);
        setNom("");
        setDescription("");
        setEffet("");
        setFamilles([]);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Objet invalide.");
      setMessage(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block text-sm">Nom*
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Épée runique" className={input} />
        </label>
        <label className="block text-sm">Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value as ItemCategorie)} className={input}>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block text-sm">Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
        </label>
        <label className="block text-sm">Effet
          <input value={effet} onChange={(e) => setEffet(e.target.value)} placeholder="DEF +1 si équipé…" className={input} />
        </label>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="block text-sm">Quantité
          <input type="number" min={0} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={input} />
        </label>
        <label className="flex items-start gap-2 text-sm pt-6">
          <input type="checkbox" checked={magique} onChange={(e) => setMagique(e.target.checked)} className="mt-1" />
          <span>✦ Magique <span className="text-zinc-500">(DEF non cumulée)</span></span>
        </label>
      </div>

      {categorie === "arme" && (
        <div className="rounded border border-zinc-800 p-2.5 space-y-2">
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="block text-sm">Bonus d&apos;attaque
              <input type="number" value={bonusAttaque} onChange={(e) => setBonusAttaque(e.target.value)} className={input} />
            </label>
            <label className="block text-sm">Dégâts (ex. 1d8+2)
              <input value={degats} onChange={(e) => setDegats(e.target.value)} className={`${input} font-mono`} />
            </label>
            <label className="block text-sm">Mains
              <select value={mains} onChange={(e) => setMains(Number(e.target.value) as 0 | 1 | 2)} className={input}>
                <option value={1}>1 main</option>
                <option value={2}>2 mains</option>
              </select>
            </label>
          </div>
          <div className="text-sm">
            <div className="mb-1 text-zinc-400">Familles (talents liés)</div>
            <div className="flex flex-wrap gap-1.5">
              {ARME_FAMILLES.map((f) => (
                <label key={f.key} title={f.exemples} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${familles.includes(f.key) ? "bg-amber-400 text-black font-semibold" : "bg-zinc-800"}`}>
                  <input type="checkbox" checked={familles.includes(f.key)} onChange={() => basculerFamille(f.key)} className="hidden" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {categorie === "armure" && (
        <div className="rounded border border-zinc-800 p-2.5 space-y-2">
          <label className="block text-sm">Modèle (table des armures)
            <select defaultValue="" onChange={(e) => appliquerModeleArmure(e.target.value)} className={input}>
              <option value="">Libre (saisie manuelle)</option>
              {ECHELLE_ARMURES.map((e) => (
                <option key={e.def} value={e.def}>{e.nom} (+{e.def} DEF)</option>
              ))}
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
          <label className="block text-sm">Bonus DEF
            <input type="number" min={0} value={bonusDefense} onChange={(e) => setBonusDefense(e.target.value)} className={input} />
          </label>
          <label className="block text-sm">Emplacement
            <select value={emplacement} onChange={(e) => setEmplacement(e.target.value as "torse" | "bouclier" | "accessoire")} className={input}>
              <option value="torse">Torse (0 main)</option>
              <option value="bouclier">Bouclier (1 main)</option>
              <option value="accessoire">Accessoire (ni torse ni bouclier)</option>
            </select>
          </label>
          </div>
        </div>
      )}

      {erreur && <div className="text-sm text-red-400">{erreur}</div>}
      {message && <div className="text-sm text-green-300/90">{message}</div>}
      <div className="flex gap-2 justify-end">
        {onAnnuler && <button onClick={onAnnuler} className="px-4 py-2 rounded bg-zinc-800 text-sm">Annuler</button>}
        <button onClick={enregistrer} className="px-4 py-2 rounded bg-amber-400 text-black text-sm font-bold">
          {initial ? "Enregistrer" : "Créer l'objet"}
        </button>
      </div>
    </div>
  );
}
