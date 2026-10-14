"use client";
import { useMemo, useState } from "react";
import type { ArmeFamille, Item, ItemCategorie } from "@/src/lib/rules/world/types";
import { ARME_FAMILLES, ITEM_CATEGORIES } from "@/src/lib/rules/world/types";
import { ECHELLE_ARMURES } from "@/src/lib/rules/limitesArmures";
import { optionsProprieteArme, texteEffetProprieteArme } from "@/src/lib/rules/armesMagiques";
import { decrireProprieteArmure, optionsProprieteArmure, type SorteProprieteArmure } from "@/src/lib/rules/armuresMagiques";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
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
  // Propriétés prédéfinies (remplissent l'effet + cochent Magique ; "" = libre).
  const [propArme, setPropArme] = useState("");
  const [paradeDef, setParadeDef] = useState("1");
  const [propArmure, setPropArmure] = useState("");
  const [armureVariante, setArmureVariante] = useState<"simple" | "superieure">("simple");
  // Effet de combat au toucher (catalogue d'effets).
  const [effetCle, setEffetCle] = useState(initial?.effetCle ?? "");
  const [effetDuree, setEffetDuree] = useState(initial?.effetDuree != null ? String(initial.effetDuree) : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const optsArme = useMemo(() => optionsProprieteArme(), []);
  const optsArmure = useMemo(() => optionsProprieteArmure(), []);

  /** Pré-remplit nom / DEF / description depuis un modèle de la table des armures. */
  const appliquerModeleArmure = (defTexte: string) => {
    if (defTexte === "") return;
    const modele = ECHELLE_ARMURES.find((e) => String(e.def) === defTexte);
    if (!modele) return;
    setBonusDefense(String(modele.def));
    setNom((n) => (n.trim() ? n : `${modele.nom} (+${modele.def} DEF)`));
    setDescription((d) => (d.trim() ? d : modele.note));
  };

  const appliquerPropArme = (valeur: string, defParade: string) => {
    if (valeur === "") return;
    const t = texteEffetProprieteArme(valeur, Number(defParade));
    if (!t) return;
    setEffet(t.effet);
    setMagique(true);
  };

  const appliquerPropArmure = (valeur: string, variante: "simple" | "superieure") => {
    if (valeur === "") return;
    const d = decrireProprieteArmure(valeur as Exclude<SorteProprieteArmure, "double">, variante);
    setEffet(d.effet);
    setMagique(true);
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
          effetCle: effetCle || undefined,
          effetDuree: effetCle && effetDuree.trim() !== "" ? Number(effetDuree) : undefined,
        },
        initial?.id
      );
      onEnregistrer(item);
      setErreur(null);
      if (!initial) {
        setMessage(`Créé : ${item.nom} (visible dans le catalogue, Personnages, Combat).`);
        setNom("");
        setDescription("");
        setEffet("");
        setFamilles([]);
        setPropArme("");
        setPropArmure("");
        setEffetCle("");
        setEffetDuree("");
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
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-sm">Propriété magique (tables existantes)
              <select
                value={propArme}
                onChange={(e) => { setPropArme(e.target.value); appliquerPropArme(e.target.value, paradeDef); }}
                className={input}
              >
                <option value="">Libre (saisie manuelle de l&apos;effet)</option>
                <optgroup label="Contact">
                  {optsArme.filter((o) => o.groupe === "contact").map((o) => (
                    <option key={o.valeur} value={o.valeur}>{o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Distance">
                  {optsArme.filter((o) => o.groupe === "distance").map((o) => (
                    <option key={o.valeur} value={o.valeur}>{o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Commun">
                  {optsArme.filter((o) => o.groupe === "commun").map((o) => (
                    <option key={o.valeur} value={o.valeur}>{o.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {propArme === "parade" && (
              <label className="block text-sm">DEF de parade (N au choix du MJ)
                <input
                  type="number" min={0} value={paradeDef}
                  onChange={(e) => { setParadeDef(e.target.value); appliquerPropArme("parade", e.target.value); }}
                  className={input}
                />
              </label>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-sm">Effet au toucher (combat, optionnel)
              <select value={effetCle} onChange={(e) => setEffetCle(e.target.value)} className={input}>
                <option value="">Aucun</option>
                {EFFECT_CATALOG.map((fx) => (
                  <option key={fx.key} value={fx.key} title={fx.description}>
                    {fx.nom} (durée {fx.dureeDefaut ?? "—"})
                  </option>
                ))}
              </select>
            </label>
            {effetCle && (
              <label className="block text-sm">Durée (tours)
                <input type="number" min={1} value={effetDuree} onChange={(e) => setEffetDuree(e.target.value)} placeholder="Défaut du catalogue" className={input} />
              </label>
            )}
          </div>
          <p className="text-xs text-zinc-500">Choisir une propriété remplit l&apos;effet ci-dessus et coche Magique. Champ Effet reste modifiable.</p>
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
            <label className="block text-sm">Propriété (tirage 1d12)
              <select
                value={propArmure}
                onChange={(e) => { setPropArmure(e.target.value); appliquerPropArmure(e.target.value, armureVariante); }}
                className={input}
              >
                <option value="">Libre (saisie manuelle de l&apos;effet)</option>
                {optsArmure.map((o) => (
                  <option key={o.valeur} value={o.valeur}>{o.label}</option>
                ))}
              </select>
            </label>
            {propArmure === "defense" && (
              <label className="block text-sm">Variante Défense (MJ)
                <select
                  value={armureVariante}
                  onChange={(e) => { const v = e.target.value as "simple" | "superieure"; setArmureVariante(v); appliquerPropArmure("defense", v); }}
                  className={input}
                >
                  <option value="simple">Défense (RD 2)</option>
                  <option value="superieure">Défense supérieure (RD 4)</option>
                </select>
              </label>
            )}
          </div>
          <p className="text-xs text-zinc-500">Choisir une propriété remplit l&apos;effet ci-dessus et coche Magique. Résistances : −20 % fixes (règle maison). 12 = tirage MJ (saisie libre).</p>
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
