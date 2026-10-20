import type { FamilleCOF } from "@/src/lib/rules/personnage";
import { classeFamille } from "@/src/lib/ui/famille";

// Badges de famille : couleur + nom (jamais la couleur seule, pour rester
// lisible pour un daltonien et sur une capture d'écran en noir et blanc).
// Les variables --fam-* sont posées par app/globals.css (classes fam-*).

/** Badge complet : pastille colorée + nom de la famille. */
export function FamilleBadge({
  famille,
  className = "",
  titre,
}: {
  famille?: FamilleCOF | null;
  className?: string;
  titre?: string;
}) {
  if (!famille) return null;
  return (
    <span
      className={`fam-chip ${classeFamille(famille)} ${className}`.trim()}
      title={titre ?? `Famille ${famille}`}
    >
      <span className="fam-pastille" aria-hidden="true" />
      {famille}
    </span>
  );
}

/** Pastille seule (sans le nom) : listes denses, table de combat. */
export function FamillePastille({
  famille,
  className = "",
  titre,
}: {
  famille?: FamilleCOF | null;
  className?: string;
  titre?: string;
}) {
  if (!famille) return null;
  return (
    <span
      role="img"
      aria-label={`Famille ${famille}`}
      title={titre ?? `Famille ${famille}`}
      className={`fam-pastille ${classeFamille(famille)} ${className}`.trim()}
    />
  );
}
