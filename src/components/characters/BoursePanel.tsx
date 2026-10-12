"use client";
import { useState } from "react";
import type { Bourse } from "@/src/lib/rules/bourse";
import {
  ajouterBourse,
  ajusterCoupure,
  consoliderBourse,
  depenserBourse,
  normaliserBourse,
  totalPaBourse,
} from "@/src/lib/rules/bourse";
import { formaterPa } from "@/src/lib/rules/tresors";
import type { UniteMonnaie } from "@/src/lib/rules/tresors";

interface Props {
  bourse?: Bourse;
  onChange: (b: Bourse) => void;
}

const COUPURES: { unite: UniteMonnaie; label: string }[] = [
  { unite: "pp", label: "pp" },
  { unite: "po", label: "po" },
  { unite: "pa", label: "pa" },
];

export function BoursePanel({ bourse, onChange }: Props) {
  const b = normaliserBourse(bourse);
  const [montant, setMontant] = useState("10");
  const [unite, setUnite] = useState<UniteMonnaie>("pa");
  const [erreur, setErreur] = useState<string | null>(null);

  const saisir = (uniteCoupure: UniteMonnaie, texte: string) => {
    const n = Math.max(0, Math.floor(Number(texte)));
    if (!Number.isFinite(n)) return;
    setErreur(null);
    onChange({ ...b, [uniteCoupure]: n });
  };

  const operer = (ajout: boolean) => {
    const n = Math.max(0, Math.floor(Number(montant)));
    if (!Number.isFinite(n) || n <= 0) {
      setErreur("Montant invalide.");
      return;
    }
    try {
      onChange(ajout ? ajouterBourse(b, { [unite]: n }) : depenserBourse(b, { [unite]: n }));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Opération impossible.");
    }
  };

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase text-zinc-500">🪙 Bourse</span>
        <span className="text-[11px] font-mono text-zinc-400">≈ {formaterPa(totalPaBourse(b))}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {COUPURES.map(({ unite: u, label }) => (
          <span key={u} className="flex items-center gap-1 text-sm">
            <button
              onClick={() => { setErreur(null); onChange(ajusterCoupure(b, u, -1)); }}
              title={`−1 ${label}`}
              className="px-2 py-0.5 rounded bg-zinc-800 text-xs"
            >
              −
            </button>
            <input
              type="number" min={0} value={b[u]}
              onChange={(e) => saisir(u, e.target.value)}
              className="w-16 bg-zinc-800 rounded px-1.5 py-0.5 text-center font-mono"
            />
            <span className="text-xs text-zinc-500">{label}</span>
            <button
              onClick={() => { setErreur(null); onChange(ajusterCoupure(b, u, 1)); }}
              title={`+1 ${label}`}
              className="px-2 py-0.5 rounded bg-zinc-800 text-xs"
            >
              +
            </button>
          </span>
        ))}
        <button
          onClick={() => { setErreur(null); onChange(consoliderBourse(b)); }}
          title="Regroupe vers le haut (100 pa → 1 pp…)"
          className="px-2 py-0.5 rounded bg-zinc-800 text-xs"
        >
          Convertir
        </button>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="number" min={1} value={montant}
          onChange={(e) => setMontant(e.target.value)}
          className="w-20 bg-zinc-800 rounded px-1.5 py-0.5 text-sm font-mono"
        />
        <select value={unite} onChange={(e) => setUnite(e.target.value as UniteMonnaie)} className="bg-zinc-800 rounded px-1.5 py-0.5 text-sm">
          <option value="pa">pa</option>
          <option value="po">po</option>
          <option value="pp">pp</option>
        </select>
        <button onClick={() => operer(true)} className="px-2 py-0.5 rounded bg-green-900 text-xs font-semibold hover:bg-green-800">Recevoir</button>
        <button onClick={() => operer(false)} className="px-2 py-0.5 rounded bg-red-900 text-xs font-semibold hover:bg-red-800">Payer</button>
      </div>
      {erreur && <div className="text-xs text-red-400">{erreur}</div>}
    </div>
  );
}
