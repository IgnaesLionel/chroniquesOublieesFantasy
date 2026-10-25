import type { ActionDRS } from "@/src/lib/rules/types";
import { ACTION_DESCRIPTION, ACTION_LETTER } from "@/src/lib/data/capacites";

// Badge compact d'économie d'action : A (attaque), M (mouvement),
// L (limitée), G (gratuite), P (passif). La lettre seule reste lisible dans
// les listes denses ; l'infobulle donne le libellé complet.

const STYLE: Record<ActionDRS, string> = {
  attaque: "border-red-800 bg-red-950/80 text-red-300",
  mouvement: "border-sky-800 bg-sky-950/80 text-sky-300",
  limitee: "border-amber-800 bg-amber-950/80 text-amber-300",
  gratuite: "border-emerald-800 bg-emerald-950/80 text-emerald-300",
};

const STYLE_PASSIF = "border-zinc-700 bg-zinc-800 text-zinc-400";

export function ActionBadge({
  action,
  className = "",
  titre,
  passif = true,
}: {
  action?: ActionDRS | null;
  className?: string;
  /** Infobulle personnalisée (par défaut : libellé complet de l'action). */
  titre?: string;
  /** Afficher « P » quand aucune action n'est connue (capacité passive). */
  passif?: boolean;
}) {
  if (!action && !passif) return null;
  const letter = action ? ACTION_LETTER[action] : "P";
  const label = action ? ACTION_DESCRIPTION[action] : "Passif";
  return (
    <span
      role="img"
      aria-label={label}
      title={titre ?? label}
      className={`inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded border px-1 align-middle font-mono text-[10px] font-bold leading-none ${action ? STYLE[action] : STYLE_PASSIF} ${className}`.trim()}
    >
      {letter}
    </span>
  );
}
