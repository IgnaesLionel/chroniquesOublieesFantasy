"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Filet de sécurité des routes : une erreur de rendu affiche un écran lisible
 * (et non la page blanche par défaut), avec la possibilité de réessayer sans
 * perdre les données locales.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[Assistant MJ] erreur de rendu :", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto py-10 space-y-4">
      <p className="overline-rune">Incident de la veillée</p>
      <h1 className="text-2xl font-bold font-display text-gold-200">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <div className="panel p-4 space-y-2 text-sm text-zinc-300">
        <p>
          Une erreur inattendue a interrompu le rendu. Vos données locales (personnages, monstres,
          scénarios, objets…) ne sont pas effacées.
        </p>
        {error.message && (
          <p className="font-mono text-xs text-zinc-500 break-words">{error.message}</p>
        )}
        {error.digest && <p className="font-mono text-[11px] text-zinc-600">référence : {error.digest}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="btn-gold">
          Réessayer
        </button>
        <Link href="/" className="btn-dark">
          Retour à la campagne
        </Link>
      </div>
    </div>
  );
}
