// Auras de début de combat des monstres : états posés AUTOMATIQUEMENT au
// lancement (avant tout tour), indépendamment de l'initiative du porteur.
// Chaque adversaire fait un test de la caractéristique indiquée ; les échecs
// reçoivent l'état.
//
// Note caractéristiques : l'app n'a pas de « SAG » (elle stocke les stats COF
// AGI/CON/FOR/PER/CHA/INT/VOL). Les vieilles cartes listent SAG (Sagesse), et
// le projet convertit SAG -> PER (cf. caracteristiquesDepuisLegacy). On teste
// donc PER et on l'affiche « SAG » (statNom) pour rester lisible sur la carte.
export interface AuraDebutCombat {
  /** Capacité portée par le monstre (comparaison normalisée : casse, suffixe (L)/(A)...). */
  capacite: string;
  /** Clé de caractéristique testée chez la victime (clé moteur : PER...). */
  carac: string;
  /** Libellé affiché de cette caractéristique (ex. « SAG » pour PER). */
  statNom: string;
  /** Difficulté du test (d20 + carac >= difficulte = réussi). */
  difficulte: number;
  /** Nom de l'état posé en cas d'échec. */
  effetNom: string;
  /** Dé de durée de l'état, ex. "1d4". */
  dureeDe: string;
}

export const AURAS_DEBUT_COMBAT: AuraDebutCombat[] = [
  {
    capacite: "Effroi",
    carac: "PER", // SAG des vieilles cartes = PER (conversion du projet)
    statNom: "SAG",
    difficulte: 10,
    effetNom: "Effroi",
    dureeDe: "1d4",
  },
];
