"use client";
import { useState } from "react";
import { useCharacters } from "@/src/lib/store/collections";
import { ajouterAInventaire } from "@/src/lib/rules/equipement";
import { chargesInitialesObjet, natureObjetCombat } from "@/src/lib/rules/combat/objets";
import type { Item } from "@/src/lib/rules/world/types";

interface Props {
  item: Item;
}

/** Donne un objet du catalogue à un personnage (inventaire, non équipé). */
export function DonObjet({ item }: Props) {
  const { items: characters, setItems: setCharacters } = useCharacters("tresors/don");
  const [beneficiaireId, setBeneficiaireId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const donner = () => {
    const cible = characters.find((c) => c.id === beneficiaireId);
    if (!cible) return;
    const charges =
      natureObjetCombat(item) === "baguette" ? chargesInitialesObjet(item) ?? undefined : undefined;
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === beneficiaireId
          ? {
              ...c,
              inventaire: ajouterAInventaire(
                c.inventaire ?? [],
                item.id,
                item.quantite,
                charges
              ),
            }
          : c
      )
    );
    setMessage(`${item.nom} → ${cible.nom} (inventaire, non équipé).`);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={beneficiaireId}
        onChange={(e) => { setBeneficiaireId(e.target.value); setMessage(null); }}
        className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs max-w-28"
        title={`Donner ${item.nom} à…`}
      >
        <option value="">Donner à…</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>
      <button
        onClick={donner} disabled={!beneficiaireId}
        className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-green-900 disabled:opacity-40"
      >
        Donner
      </button>
      {message && <span className="text-green-300/90 text-xs">{message}</span>}
    </span>
  );
}
