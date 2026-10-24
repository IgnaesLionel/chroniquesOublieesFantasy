import { redirect } from "next/navigation";

/**
 * L'onglet « Rencontres » a fusionné avec « Combat » : le générateur vit
 * désormais dans la préparation de combat, avec conversion en un clic.
 * L'ancienne adresse reste valide (favoris, liens) et redirige.
 */
export default function EncountersPage() {
  redirect("/combat");
}
