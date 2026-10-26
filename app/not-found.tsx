import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto py-10 space-y-4 text-center">
      <p className="overline-rune">Page introuvable</p>
      <h1 className="text-3xl font-bold font-display text-gold-200">Ce chemin ne figure pas au grimoire</h1>
      <p className="text-sm text-zinc-400">
        La page demandée n&apos;existe pas ou a été déplacée. Vos données locales sont intactes.
      </p>
      <div className="flex flex-wrap gap-2 justify-center pt-2">
        <Link href="/" className="btn-gold">
          Retour à la campagne
        </Link>
        <Link href="/settings" className="btn-dark">
          Sauvegarde
        </Link>
      </div>
    </div>
  );
}
