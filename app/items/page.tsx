import { redirect } from "next/navigation";

// Onglet fusionné dans /tresors (« Trésors & Objets ») : redirection pour les favoris.
export default function ItemsRedirect() {
  redirect("/tresors");
}
