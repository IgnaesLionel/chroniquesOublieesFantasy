import { ActionBadge } from "@/src/components/ui/ActionBadge";

/**
 * Rappel visuel de l'économie d'action COF. Le logiciel affiche les types,
 * mais ne décrémente pas automatiquement l'action et le mouvement : le MJ
 * garde le suivi.
 */
export function ActionEconomie({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const titre =
    "Chaque tour : une action (A) et un mouvement (M), ou une action limitée (L). " +
    "Les actions gratuites (G) ne consomment rien. Le logiciel ne décrémente pas " +
    "automatiquement : le MJ valide.";
  return (
    <div
      title={titre}
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-300 ${
        compact ? "" : "rounded border border-zinc-700 bg-zinc-950/70 px-2.5 py-2"
      } ${className}`.trim()}
    >
      {!compact && <span className="font-bold uppercase text-zinc-400">Tour</span>}
      <span className="inline-flex items-center gap-1">
        <ActionBadge action="attaque" size={compact ? "sm" : "md"} /> Action
      </span>
      <span className="text-zinc-500">+</span>
      <span className="inline-flex items-center gap-1">
        <ActionBadge action="mouvement" size={compact ? "sm" : "md"} /> Mouvement
      </span>
      <span className="text-zinc-500">ou</span>
      <span className="inline-flex items-center gap-1">
        <ActionBadge action="limitee" size={compact ? "sm" : "md"} /> Limitée
      </span>
      <span className="text-zinc-600">·</span>
      <span className="inline-flex items-center gap-1">
        <ActionBadge action="gratuite" size={compact ? "sm" : "md"} /> Gratuite
      </span>
      {!compact && (
        <span className="ml-auto text-[11px] text-zinc-400">suivi manuel</span>
      )}
    </div>
  );
}
