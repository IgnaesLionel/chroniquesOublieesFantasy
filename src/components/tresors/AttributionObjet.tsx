"use client";
import { useState } from "react";
import { useCharacters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { objetTresorVersItem, type ObjetMagiqueTire } from "@/src/lib/rules/objetsMagiques";

interface Props {
  objet: ObjetMagiqueTire;
}

/** Attribue un objet du trésor à un personnage (inventaire, non équipé, modifiable dans Objets). */
export function AttributionObjet({ objet }: Props) {
  const { items: characters, setItems: setCharacters } = useCharacters();
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
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== beneficiaireId) return c;
        const inv = [...(c.inventaire ?? [])];
        const i = inv.findIndex((e) => e.itemId === item.id);
        if (i >= 0) inv[i] = { ...inv[i], quantite: inv[i].quantite + item.quantite };
        else inv.push({ itemId: item.id, quantite: item.quantite, equipe: false });
        return { ...c, inventaire: inv };
      })
    );
    setMessage(`${item.nom} → ${cible.nom} (inventaire, non équipé ; ajustable dans Objets).`);
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
