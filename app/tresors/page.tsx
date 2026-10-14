"use client";
import { GenerateurTresor } from "@/src/components/tresors/GenerateurTresor";
import { CatalogueObjets } from "@/src/components/tresors/CatalogueObjets";
import { CreateurObjet } from "@/src/components/tresors/CreateurObjet";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";

export default function TresorsPage() {
  const { setMaison } = useCatalogueObjets();

  return (
    <div className="space-y-6">
      <div>
        <p className="overline-rune">Butin & équipement</p>
        <h1 className="text-2xl font-bold">Trésors & Objets</h1>
        <p className="text-zinc-400 text-sm">
          Générateurs de trésors par niveau, catalogue complet (armes, armures,
          potions, quête…) et création manuelle d&apos;objets maison.
        </p>
      </div>
      <GenerateurTresor />
      <div className="hr-rune" aria-hidden="true"><span>❖</span></div>
      <CatalogueObjets />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-bold text-sm uppercase text-zinc-400 mb-1">Création manuelle d&apos;objet</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Objet maison persisté (sauvegardé comme le reste) : visible dans le catalogue
          ci-dessus, ajoutable aux personnages et utilisable en combat.
        </p>
        <CreateurObjet
          key="creation"
          onEnregistrer={(item) => setMaison((prev) => [...prev, item])}
        />
      </div>
    </div>
  );
}
