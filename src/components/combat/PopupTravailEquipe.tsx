"use client";

interface Props {
  loupNom: string;
  maitreNom: string;
  /** Le MJ déclare le contact : dé bonus au test d'attaque du loup. */
  onOui: () => void;
  /** Pas de contact : attaque normale, sans dé bonus. */
  onNon: () => void;
  /** Abandonne l'attaque. */
  onAnnuler: () => void;
}

/**
 * Pop-up posé à chaque attaque du loup compagnon quand son maître connaît
 * Travail d'équipe. Le moteur ne suit pas les positions : le MJ constate le
 * contact. La réponse vaut pour cette attaque uniquement (pas de mémoire de
 * session), conformément à la règle « tant que le rôdeur et son loup sont au
 * contact ».
 */
export function PopupTravailEquipe({ loupNom, maitreNom, onOui, onNon, onAnnuler }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Travail d'équipe : ${loupNom} au contact de ${maitreNom} ?`}
        className="w-full max-w-md rounded-lg border border-amber-800 bg-zinc-950 p-4 space-y-3"
      >
        <h3 className="font-bold text-sm uppercase text-amber-300">🐺 Travail d&apos;équipe — {loupNom}</h3>
        <p className="text-sm">
          {loupNom} attaque. Est-il au contact de {maitreNom} ?
        </p>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs space-y-1">
          <p><strong className="text-green-400">Oui</strong> : le loup gagne un dé bonus à ce test d&apos;attaque (2d20, garder le meilleur).</p>
          <p><strong className="text-zinc-300">Non</strong> : attaque normale, sans dé bonus.</p>
          <p className="text-zinc-500">
            Le contact vaut aussi pour le rôdeur : dé bonus pour pister et éviter la surprise (Vigilance), mais jamais pour ses attaques. Ces tests restent manuels.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOui}
            className="py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold"
          >
            ✅ Oui, au contact
          </button>
          <button
            type="button"
            onClick={onNon}
            className="py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 font-semibold"
          >
            Non, pas au contact
          </button>
        </div>
        <button
          type="button"
          onClick={onAnnuler}
          className="w-full py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-400"
        >
          Annuler l&apos;attaque
        </button>
      </div>
    </div>
  );
}
