import type { VoieDetail } from "./capacites";

// Voies du peuple — transcription du DRS Chroniques Oubliées Fantasy :
//   https://drs.chroniques-oubliees.fr/fantasy/voies?group=peuple
// Chaque peuple a sa voie (5 rangs). La Voie du mage est une option spéciale
// (famille Mage uniquement, pas un peuple) : elle remplace la voie du peuple
// en gardant son rang 1 et bloque ses rangs 2-5. Choix définitif, avant le rang 2.
// Le Demi-Elfe suit la Voie de l'elfe sylvain (fiche : "Demi-Elfe - Elfe sylvain").
// Les descriptions sont des résumés ; voir le DRS pour le texte intégral.

export interface VoiePeuple extends VoieDetail {
  /** Peuple concerné ("Demi-Elfe" suit la voie sylvain). */
  peuple: string;
  /** Page DRS de la voie. */
  sourceUrl: string;
}

const VOIES_URL = "https://drs.chroniques-oubliees.fr/fantasy/voies";

export const VOIES_PEUPLE: VoiePeuple[] = [
  {
    peuple: "Humain",
    voie: "Voie de l'humain",
    sourceUrl: `${VOIES_URL}/humain`,
    capacites: [
        { nom: "Diversité", rang: 1, resume: "+3 dans deux domaines d'origine (table d6 : montagnard, citadin, campagnard, riverain, sauvage, nomade) + 1 PC supplémentaire." },
        { nom: "Instinct de survie", rang: 2, resume: "1/combat : des DM qui mettraient à 0 PV sont divisés par 2 (min 1), puis +2 DEF pour le reste du combat." },
        { nom: "Touche-à-tout", rang: 3, resume: "Une capacité de rang 1 ou 2 de n'importe quel profil (rang 2 ou bonus DEF : respecter les limites d'armure)." },
        { nom: "Loup parmi les loups", rang: 4, resume: "1/round : +1d4 aux DM initiaux contre un humanoïde de taille moyenne." },
        { nom: "Polyvalence", rang: 5, resume: "+1 à la plus faible caractéristique et +1 en VOL." },
    ],
  },
  {
    peuple: "Nain",
    voie: "Voie du nain",
    sourceUrl: `${VOIES_URL}/nain`,
    capacites: [
        { nom: "Habitant des tunnels", rang: 1, resume: "Voit dans le noir total comme en pénombre (30 m), +3 en pierre, architecture, mines, passages secrets et pièges rocheux." },
        { nom: "Haches et marteaux", rang: 2, resume: "+1 en attaque et DM à la hache et au marteau, utilisables quel que soit le profil." },
        { nom: "Résistance à la magie", rang: 3, resume: "1/jour : ignore un sort qui le cible (pas de zone, pas de NC >= 2× niveau)." },
        { nom: "Fils du roc", rang: 4, resume: "RD 2 sur tous les DM subis (min 1, passe à 3 au niveau 10)." },
        { nom: "Ténacité", rang: 5, resume: "CON +1 et VOL +1." },
    ],
  },
  {
    peuple: "Elfe haut",
    voie: "Voie de l'elfe haut",
    sourceUrl: `${VOIES_URL}/elfe-haut`,
    capacites: [
        { nom: "Lumière intérieure", rang: 1, resume: "Nuit étoilée = pénombre, +3 en érudition (INT) et artistiques (CHA)." },
        { nom: "Force d'âme", rang: 2, resume: "Immunisé à la peur et au sommeil magique, +rang en test opposé contre les sorts." },
        { nom: "Talent pour la magie", rang: 3, resume: "Une capacité de rang 1 magicien/ensorceleur utilisable en armure (ou rang 2 sans armure)." },
        { nom: "Immortel", rang: 4, resume: "Moitié repos, nourriture et boisson ; immunisé aux poisons et maladies." },
        { nom: "Supériorité elfique", rang: 5, resume: "VOL +1 et INT ou CHA +1." },
    ],
  },
  {
    peuple: "Demi-Elfe",
    voie: "Voie de l'elfe sylvain",
    sourceUrl: `${VOIES_URL}/elfe-sylvain`,
    capacites: [
        { nom: "Lumière des étoiles", rang: 1, resume: "Nuit étoilée = pénombre, +3 en survie en forêt (escalade, discrétion, chasse...)." },
        { nom: "Enfant de la forêt", rang: 2, resume: "Une capacité de rang 1 druide/rôdeur, utilisable jusqu'au cuir renforcé." },
        { nom: "Archer émérite", rang: 3, resume: "Critique à l'arc sur 19-20, +1d4 aux DM en critique. Arcs courts utilisables quel que soit le profil." },
        { nom: "Flèche sanglante", rang: 4, resume: "Attaque à distance + saignement 1d4/round jusqu'à soin (non cumulable)." },
        { nom: "Supériorité elfique", rang: 5, resume: "AGI +1 et PER +1." },
    ],
  },
];

/** Voie de remplacement (option spéciale, famille Mage uniquement, pas un peuple).
 * Remplace la voie du peuple : garde sa capacité de rang 1, bloque ses rangs 2-5.
 * Choix définitif, avant le rang 2 de la voie du peuple. Réservée aux
 * Ensorceleur, Forgesort, Magicien et Sorcier : consécration aux arts occultes
 * au détriment de l'héritage culturel. */
export const VOIE_MAGE: VoieDetail & { sourceUrl: string } = {
  voie: "Voie du mage",
  sourceUrl: `${VOIES_URL}/mage`,
  capacites: [
      { nom: "Capacité de peuple + occultisme", rang: 1, resume: "Conserve sa capacité de peuple de rang 1 + rang+2 en érudition et connaissances de la magie." },
      { nom: "Maîtrise de la magie", rang: 2, resume: "Sort (limitée) : détecte la magie à 10 m (INT 10+rang = fonction), dissipe un sort non permanent (test opposé).", sortId: "sort-maitrise-magie" },
      { nom: "Tour de magie", rang: 3, resume: "Sort (gratuite) : tour de magie à 10 m/round sans PM (pas de DM, carac ≤ 0), +1 DEF et +2 PM.", sortId: "sort-tour-magie" },
      { nom: "Esprit supérieur", rang: 4, resume: "INT +1 et VOL +1, dé bonus aux tests d'INT." },
      { nom: "Tempête de mana", rang: 5, resume: "+1d4 aux DM d'un sort pour +1 PM (cible unique) ou +3 PM (zone)." },
  ],
};

/** Peuple de l'app → voie du peuple suivie. */
export const VOIE_PAR_PEUPLE: Record<string, string> = {
  Humain: "Voie de l'humain",
  Nain: "Voie du nain",
  "Elfe haut": "Voie de l'elfe haut",
  "Demi-Elfe": "Voie de l'elfe sylvain",
};

/** Voie du peuple suivie par un peuple (indéfini si inconnu). */
export function voiePeupleDe(peuple: string): VoiePeuple | undefined {
  const nom = VOIE_PAR_PEUPLE[peuple];
  if (!nom) return undefined;
  return VOIES_PEUPLE.find((v) => v.voie === nom);
}

/**
 * Traits initiaux à la création / au changement de peuple : le rang 1 de la
 * voie du peuple (rien si peuple inconnu). La Voie du mage est un choix
 * séparé et explicite (voir `adopterVoieMage`), jamais automatique.
 */
export function traitsInitiaux(peuple: string): string[] {
  const voie = voiePeupleDe(peuple);
  return voie ? [voie.capacites[0].nom] : [];
}

/**
 * Adoption de la Voie du mage (famille Mage, avant le rang 2 de peuple) :
 * garde la capacité de peuple de rang 1 et ajoute le rang 1 du mage.
 * Les rangs 2-5 de la voie du peuple deviennent inaccessibles.
 */
export function adopterVoieMage(peuple: string): string[] {
  return [...traitsInitiaux(peuple), VOIE_MAGE.capacites[0].nom];
}

/** Noms des capacités de la voie du mage (pour ajuster les traits au changement de famille). */
export const NOMS_VOIE_MAGE: ReadonlySet<string> = new Set(VOIE_MAGE.capacites.map((c) => c.nom));
