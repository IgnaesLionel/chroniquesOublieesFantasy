import type { Character } from "@/src/lib/rules/types";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";
import { aptitudesSort, aptitudesTalent } from "@/src/lib/data/aptitudes";

interface Props {
  character: Character;
  /** Les sorts ont leur propre section ; désactivable pour une fiche condensée. */
  inclureSorts?: boolean;
  className?: string;
}

/**
 * Effets et bonus lisibles des talents, traits de peuple et sorts connus.
 * Les textes viennent du référentiel (résumé DRS / description du grimoire) :
 * même un bonus non automatisé par le moteur doit rester visible sur la fiche
 * (érudition, artistiques, survie, résistance, etc.).
 */
export function AptitudesPersonnage({ character, inclureSorts = true, className = "" }: Props) {
  const talents = aptitudesTalent(character);
  // Un sort-talent est déjà décrit par son talent : on ne répète pas sa
  // description dans « Sorts connus ». Les sorts appris séparément restent là.
  const nomsTalents = new Set((character.capacites ?? []).map((nom) => normaliserNomCapacite(nom)));
  const sorts = inclureSorts
    ? aptitudesSort(character).filter((s) => !nomsTalents.has(normaliserNomCapacite(s.nom)))
    : [];
  if (talents.length === 0 && sorts.length === 0) return null;

  return (
    <div className={`text-xs text-zinc-400 space-y-1 ${className}`}>
      {talents.length > 0 && (
        <div className="text-[11px] uppercase text-zinc-500 font-bold">Aptitudes &amp; bonus</div>
      )}
      {talents.map((a) => (
        <div key={`${a.source}-${a.nom}`} className="leading-snug">
          <span className="text-zinc-300">
            {a.source === "peuple" ? "◈ Peuple : " : a.source === "mage" ? "◈ Mage : " : "◈ "}
            {a.nom}
          </span>
          {a.voie && (
            <span className="text-zinc-500">
              {" "}· {a.voie}
              {a.rang ? ` R${a.rang}` : ""}
            </span>
          )}
          <span> — {a.resume}</span>
          {a.noteMoteur && (
            <span className="text-zinc-500"> · Moteur : {a.noteMoteur}</span>
          )}
        </div>
      ))}

      {sorts.length > 0 && (
        <div className="text-[11px] uppercase text-zinc-500 font-bold pt-1">Sorts connus</div>
      )}
      {sorts.map((s, i) => (
        <div key={`sort-${s.nom}-${i}`} className="leading-snug">
          <span className="text-zinc-300">✦ {s.nom}</span>
          <span className="text-zinc-500">
            {" "}· {s.type}
            {s.voie ? ` · ${s.voie}` : ""}
            {s.rang ? ` R${s.rang}` : ""}
            {s.cout ? ` · ${s.cout}` : ""}
          </span>
          {s.description ? (
            <span> — {s.description}</span>
          ) : (
            <span className="text-zinc-500"> — description non renseignée</span>
          )}
          {s.noteMoteur && (
            <span className="text-zinc-500"> · Moteur : {s.noteMoteur}</span>
          )}
        </div>
      ))}
    </div>
  );
}
