/** Indicateur de chargement pendant la navigation entre les segments. */
export default function Loading() {
  return (
    <div className="space-y-4 py-6" role="status" aria-live="polite" aria-label="Chargement">
      <div className="h-7 w-56 rounded bg-zinc-800/70 animate-pulse" />
      <div className="h-4 w-80 max-w-full rounded bg-zinc-800/50 animate-pulse" />
      <div className="grid sm:grid-cols-2 gap-3 pt-2">
        <div className="panel h-28 animate-pulse" />
        <div className="panel h-28 animate-pulse" />
        <div className="panel h-28 animate-pulse" />
        <div className="panel h-28 animate-pulse" />
      </div>
      <span className="sr-only">Chargement de la page…</span>
    </div>
  );
}
