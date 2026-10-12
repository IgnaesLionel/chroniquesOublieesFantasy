"use client";
import { GenerateurTresor } from "@/src/components/tresors/GenerateurTresor";
import { CreateurObjet } from "@/src/components/tresors/CreateurObjet";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";

export default function TresorsPage() {
  const { setMaison } = useCatalogueObjets();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Trésors</h1>
        <p className="text-zinc-400 text-sm">
          Générateurs : trésor par niveau (monétaire, joyaux, objets magiques
          mineurs / moyens / majeurs avec tirage du contenu).
        </p>
      </div>
      <GenerateurTresor />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-bold text-sm uppercase text-zinc-400 mb-1">Création manuelle d&apos;objet</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Objet maison persisté (sauvegardé comme le reste) : visible dans Objets, ajoutable aux
          personnages et utilisable en combat. Modifiable / supprimable dans Objets.
        </p>
        <CreateurObjet
          key="creation"
          onEnregistrer={(item) => setMaison((prev) => [...prev, item])}
        />
      </div>
    </div>
  );
}
