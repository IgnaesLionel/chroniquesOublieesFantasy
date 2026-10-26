"use client";
import { useEffect, useRef, useState } from "react";
import { useCharacters } from "@/src/lib/store/collections";
import { BOURSE_VIDE, ajouterBourse, consoliderBourse, partagerEgale, totalPaBourse } from "@/src/lib/rules/bourse";
import { formaterPa, totalDistribuable } from "@/src/lib/rules/tresors";
import type { ResultatTresor } from "@/src/lib/rules/tresors";

interface Props {
  resultat: ResultatTresor;
}

type Mode = "egales" | "choix";

export function VersementTresor({ resultat }: Props) {
  const { items: characters, setItems: setCharacters } = useCharacters("tresors/versement");
  const total = totalDistribuable(resultat);
  const [selection, setSelection] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("egales");
  const [montants, setMontants] = useState<Record<string, number>>({});
  // Message associé au trésor affiché : un nouveau tirage change `resultat`
  // (nouvelle référence) et le message précédent disparaît de lui-même, sans
  // effet de remise à zéro.
  const [message, setMessage] = useState<{ texte: string; pour: ResultatTresor } | null>(null);
  const messageVisible = message && message.pour === resultat ? message.texte : null;
  // Nouveaux personnages cochés d'office, décochés conservés, disparus retirés.
  const vus = useRef<Set<string>>(new Set());
  useEffect(() => {
    setSelection((prev) => {
      const ids = characters.map((c) => c.id);
      const presents = new Set(ids);
      const nouveaux = ids.filter((id) => !vus.current.has(id));
      nouveaux.forEach((id) => vus.current.add(id));
      return [...prev.filter((id) => presents.has(id)), ...nouveaux];
    });
  }, [characters]);

  const selectionnes = characters.filter((c) => selection.includes(c.id));
  const { part: partEgale, reste: resteEgal } = partagerEgale(total, selectionnes.length);

  const basculer = (id: string) =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const passerAuChoix = () => {
    setMode("choix");
    setMontants(Object.fromEntries(selectionnes.map((c) => [c.id, partEgale])));
    setMessage(null);
  };

  const montantDe = (id: string): number =>
    mode === "egales" ? partEgale : Math.max(0, Math.floor(Number(montants[id] ?? 0)));
  const distribue = selectionnes.reduce((somme, c) => somme + montantDe(c.id), 0);
  const reste = mode === "egales" ? resteEgal : total - distribue;
  const valide = selectionnes.length > 0 && distribue > 0 && reste >= 0;

  const verser = () => {
    if (!valide) return;
    const parts = Object.fromEntries(selectionnes.map((c) => [c.id, montantDe(c.id)]));
    setCharacters((prev) =>
      prev.map((c) =>
        parts[c.id]
          ? { ...c, bourse: ajouterBourse(c.bourse ?? BOURSE_VIDE, consoliderBourse({ pa: parts[c.id] })) }
          : c
      )
    );
    const resume = selectionnes.map((c) => `${c.nom} +${formaterPa(parts[c.id])}`).join(", ");
    setMessage({ texte: `Versé — ${resume} (reste ${formaterPa(reste)} non distribué).`, pour: resultat });
  };

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-2">
      <div className="text-[11px] uppercase text-zinc-500">
        Verser aux personnages — {formaterPa(total)} à partager
        {resultat.joyaux.gain ? <span> (dont joyaux {formaterPa(resultat.joyaux.gain.totalPa)})</span> : null}
      </div>
      {characters.length === 0 && (
        <p className="text-xs text-zinc-500">Aucun personnage (onglet Personnages).</p>
      )}
      {characters.map((c) => {
        const coche = selection.includes(c.id);
        return (
          <div key={c.id} className="flex items-center gap-2 text-sm flex-wrap">
            <label className="flex items-center gap-2 flex-1 min-w-40">
              <input type="checkbox" checked={coche} onChange={() => { basculer(c.id); setMessage(null); }} />
              <span>
                {c.nom}{" "}
                <span className="text-zinc-500 text-xs">({formaterPa(totalPaBourse(c.bourse ?? BOURSE_VIDE))})</span>
              </span>
            </label>
            {mode === "choix" && coche && (
              <span className="flex items-center gap-1 text-xs">
                <input
                  type="number" min={0} value={montants[c.id] ?? partEgale}
                  onChange={(e) => setMontants((m) => ({ ...m, [c.id]: Math.max(0, Math.floor(Number(e.target.value))) }))}
                  className="w-24 bg-zinc-800 rounded px-1.5 py-0.5 font-mono"
                />
                pa
              </span>
            )}
            {mode === "egales" && coche && (
              <span className="text-xs font-mono text-amber-300">+{formaterPa(partEgale)}</span>
            )}
          </div>
        );
      })}
      {characters.length > 0 && (
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => { setMode("egales"); setMessage(null); }}
            className={`px-2.5 py-1 rounded text-xs ${mode === "egales" ? "bg-amber-400 text-black font-bold" : "bg-zinc-800"}`}
          >
            Parts égales
          </button>
          <button
            onClick={passerAuChoix}
            className={`px-2.5 py-1 rounded text-xs ${mode === "choix" ? "bg-amber-400 text-black font-bold" : "bg-zinc-800"}`}
          >
            Au choix
          </button>
          <span className="text-xs text-zinc-500 font-mono">Reste : {formaterPa(reste)}</span>
          <button
            onClick={verser} disabled={!valide}
            title={valide ? "Ajoute les parts aux bourses (persisté)" : "Sélectionnez au moins un personnage avec un total ≤ au trésor"}
            className="px-4 py-1.5 rounded bg-green-800 text-xs font-bold hover:bg-green-700 disabled:opacity-40"
          >
            Verser
          </button>
        </div>
      )}
      {messageVisible && <div className="text-xs text-green-300/90">{messageVisible}</div>}
    </div>
  );
}
