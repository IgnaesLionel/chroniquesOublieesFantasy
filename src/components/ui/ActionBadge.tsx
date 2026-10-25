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

const TAILLE = {
  sm: "h-[1.15rem] min-w-[1.15rem] px-1 text-[10px]",
  md: "h-6 min-w-6 px-1.5 text-xs",
} as const;

export function ActionBadge({
  action,
  className = "",
  titre,
  passif = true,
  size = "sm",
}: {
  action?: ActionDRS | null;
  className?: string;
  /** Infobulle personnalisée (par défaut : libellé complet de l'action). */
  titre?: string;
  /** Afficher « P » quand aucune action n'est connue (capacité passive). */
  passif?: boolean;
  /** `sm` dans les listes denses, `md` pour le type d'action sélectionné. */
  size?: "sm" | "md";
}) {
  if (!action && !passif) return null;
  const letter = action ? ACTION_LETTER[action] : "P";
  const label = action ? ACTION_DESCRIPTION[action] : "Passif";
  return (
    <span
      role="img"
      aria-label={label}
      title={titre ?? label}
      className={`inline-flex items-center justify-center rounded border align-middle font-mono font-bold leading-none ${TAILLE[size]} ${action ? STYLE[action] : STYLE_PASSIF} ${className}`.trim()}
    >
      {letter}
    </span>
  );
}
