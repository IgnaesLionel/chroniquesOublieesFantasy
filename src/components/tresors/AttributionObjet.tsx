"use client";
import { useState } from "react";
import { useCharacters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { ajouterAInventaire } from "@/src/lib/rules/equipement";
import { chargesInitialesObjet, natureObjetCombat } from "@/src/lib/rules/combat/objets";
import { objetTresorVersItem, type ObjetMagiqueTire } from "@/src/lib/rules/objetsMagiques";

interface Props {
  objet: ObjetMagiqueTire;
}

/** Attribue un objet du trésor à un personnage (inventaire, non équipé, modifiable dans le catalogue). */
export function AttributionObjet({ objet }: Props) {
  const { items: characters, setItems: setCharacters } = useCharacters("tresors/attribution");
  const { setMaison } = useCatalogueObjets();
  const [beneficiaireId, setBeneficiaireId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const attribuer = () => {
    const cible = characters.find((c) => c.id === beneficiaireId);
    if (!cible) return;
    const item = objetTresorVersItem(
      objet,
      cible.caracteristiques?.FOR ?? 0,
      `custom-${Date.now().toString(36)}`
    );
    setMaison((prev) => [...prev, item]);
    const charges =
      natureObjetCombat(item) === "baguette" ? chargesInitialesObjet(item) ?? undefined : undefined;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== beneficiaireId) return c;
        return {
          ...c,
          inventaire: ajouterAInventaire(c.inventaire ?? [], item.id, item.quantite, charges),
        };
      })
    );
    setMessage(`${item.nom} → ${cible.nom} (inventaire, non équipé ; ajustable dans le catalogue).`);
  };

  return (
    <span className="ml-4 flex items-center gap-1.5 text-xs flex-wrap">
      <select
        value={beneficiaireId}
        onChange={(e) => { setBeneficiaireId(e.target.value); setMessage(null); }}
        className="bg-zinc-800 rounded px-1.5 py-0.5"
        title="Attribuer cet objet à…"
      >
        <option value="">Attribuer à…</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>
      <button
        onClick={attribuer} disabled={!beneficiaireId}
        className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-green-900 disabled:opacity-40"
      >
        Donner
      </button>
      {message && <span className="text-green-300/90">{message}</span>}
    </span>
  );
}
