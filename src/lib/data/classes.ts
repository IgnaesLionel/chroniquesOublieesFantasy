import type { FamilleCOF } from "@/src/lib/rules/personnage";

// Les 14 profils COF Fantasy — transcription du DRS :
//   https://drs.chroniques-oubliees.fr/fantasy/profils
// Par profil : caractéristiques de création, armes & armures, équipement de
// départ et les 5 voies (arbres de talents). Les sorts issus des voies sont
// dans le grimoire (src/lib/data/sorts.ts).

export interface ClasseInfo {
  profil: string;
  famille: FamilleCOF;
  /** Page DRS du profil. */
  sourceUrl: string;
  /** Ex. "10 + CON". */
  pvNiveau1: string;
  /** PV gagnés par niveau (DRS). */
  pvParNiveau: number;
  /** Ex. "d10". */
  deRecuperation: string;
  /** Ex. "2 + CHA". */
  chance: string;
  /** Armes maîtrisées (résumé). */
  armes: string;
  /** Armure maximale (résumé). */
  armure: string;
  /** Bouclier (résumé). */
  bouclier: string;
  /** Équipement de départ (résumé). */
  equipement: string;
  /** Particularités DRS (ex. "+1 capacité de rang 2"). */
  particularites: string[];
  /** Les 5 voies du profil. */
  voies: [string, string, string, string, string];
}

const DRS = "https://drs.chroniques-oubliees.fr/fantasy/profils";

export const CLASSES: ClasseInfo[] = [
  {
    profil: "Barbare", famille: "Combattant", sourceUrl: `${DRS}/barbare`,
    pvNiveau1: "10 + CON", pvParNiveau: 5, deRecuperation: "d10", chance: "2 + CHA",
    armes: "Toutes au contact, toutes à distance (sauf arbalètes et techniques complexes)",
    armure: "Cuir renforcé maximum", bouclier: "Tous",
    equipement: "Hache à deux mains (2d6) ou arme 1 main (d8) + bouclier (+2 DEF), 2 javelots (1d6, 20 m), dague (1d4), cuir (DEF+2)",
    particularites: [],
    voies: ["Voie de la brute", "Voie du pagne", "Voie du pourfendeur", "Voie du primitif", "Voie de la rage"],
  },
  {
    profil: "Chevalier", famille: "Combattant", sourceUrl: `${DRS}/chevalier`,
    pvNiveau1: "10 + CON", pvParNiveau: 5, deRecuperation: "d10", chance: "2 + CHA",
    armes: "Toutes au contact (dédaigne les armes à distance)",
    armure: "Plaque maximum", bouclier: "Tous",
    equipement: "Épée longue (1d8), grand bouclier (+2 DEF), lance de cavalerie (2d6), dague (1d4), cotte de mailles (+5)",
    particularites: [],
    voies: ["Voie du cavalier", "Voie de la guerre", "Voie du meneur d'hommes", "Voie de la noblesse", "Voie du preux"],
  },
  {
    profil: "Guerrier", famille: "Combattant", sourceUrl: `${DRS}/guerrier`,
    pvNiveau1: "10 + CON", pvParNiveau: 5, deRecuperation: "d10", chance: "2 + CHA",
    armes: "Toutes au contact et à distance",
    armure: "Cotte de mailles maximum", bouclier: "Tous",
    equipement: "Épée longue (1d8), épée ou hache à deux mains (2d6), dague ou hachette de lancer, grand bouclier (+2 DEF), chemise de mailles (+4)",
    particularites: [],
    voies: ["Voie du bouclier", "Voie du combat", "Voie du maître d'armes", "Voie de la résistance", "Voie du soldat"],
  },
  {
    profil: "Arquebusier", famille: "Aventurier", sourceUrl: `${DRS}/arquebusier`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8", chance: "3 + CHA",
    armes: "Contact à une main, distance dont armes à poudre (fabrique sa poudre)",
    armure: "Chemise de mailles maximum", bouclier: "Aucun",
    equipement: "Pétoire (1d10, 20 m), épée longue (1d8), dague (1d4), cuir renforcé (+3)",
    particularites: ["Variante Arbalétrier sans poudre (voie des explosifs remplacée)"],
    voies: ["Voie de l'artilleur", "Voie des explosifs", "Voie du mercenaire", "Voie du pistolero", "Voie de la précision"],
  },
  {
    profil: "Barde", famille: "Aventurier", sourceUrl: `${DRS}/barde`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8", chance: "3 + CHA",
    armes: "Armes à une main (main libre requise pour les capacités)",
    armure: "Cuir renforcé maximum", bouclier: "Aucun",
    equipement: "Rapière (1d6, crit 19-20), dague (1d4), instrument de musique, cuir (+2)",
    particularites: [],
    voies: ["Voie de l'escrime", "Voie du musicien", "Voie du saltimbanque", "Voie de la séduction", "Voie du vagabond"],
  },
  {
    profil: "Rôdeur", famille: "Aventurier", sourceUrl: `${DRS}/rodeur`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8", chance: "3 + CHA",
    armes: "Contact à une main, toutes à distance",
    armure: "Cuir renforcé maximum", bouclier: "Aucun",
    equipement: "Épée longue (1d8), arc court + carquois (1d6, 30 m), dague (1d4), cuir renforcé (+3)",
    particularites: ["Voie du traqueur (rang 1) : peut prendre +1 DR au lieu de +1 PC"],
    voies: ["Voie de l'archer", "Voie du combat à deux armes", "Voie du compagnon animal", "Voie de la survie", "Voie du traqueur"],
  },
  {
    profil: "Voleur", famille: "Aventurier", sourceUrl: `${DRS}/voleur`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8", chance: "3 + CHA",
    armes: "Contact à une main, toutes à distance",
    armure: "Cuir simple maximum", bouclier: "Aucun",
    equipement: "Rapière (1d6, crit 19-20), 5 dagues (1d4, 5 m), outils de crochetage, cuir (+2), corde 10 m",
    particularites: [],
    voies: ["Voie de l'assassin", "Voie de l'aventurier", "Voie du déplacement", "Voie du roublard", "Voie du spadassin"],
  },
  {
    profil: "Druide", famille: "Mystique", sourceUrl: `${DRS}/druide`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8 (+1 DR)", chance: "2 + CHA",
    armes: "Dague, bâton noueux, épieu, javelot, arc court",
    armure: "Cuir simple maximum", bouclier: "Petit en bois (+1 DEF)",
    equipement: "Bâton noueux (1d6) ou épieu (1d6/1d10), dague (1d4), arc court (1d6, 30 m), cuir (+2)",
    particularites: [],
    voies: ["Voie des animaux", "Voie du fauve", "Voie de la nature", "Voie du protecteur", "Voie des végétaux"],
  },
  {
    profil: "Prêtre", famille: "Mystique", sourceUrl: `${DRS}/pretre`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8 (+1 DR)", chance: "2 + CHA",
    armes: "Contondantes à une main + bâton ferré (pas de tranchant/perçant, interdiction du sang)",
    armure: "Chemise de mailles maximum", bouclier: "Petit (+1 DEF)",
    equipement: "Masse ou marteau (1d6) ou bâton ferré (1d6, 2 mains), petit bouclier (+1 DEF), chemise de mailles (+4)",
    particularites: ["Prêtre spécialiste : arme sacrée + capacité divine d'un autre profil"],
    voies: ["Voie de la foi", "Voie de la guerre sainte", "Voie de la prière", "Voie des soins", "Voie de la spiritualité"],
  },
  {
    profil: "Moine", famille: "Mystique", sourceUrl: `${DRS}/moine`,
    pvNiveau1: "8 + CON", pvParNiveau: 4, deRecuperation: "d8 (+1 DR)", chance: "2 + CHA",
    armes: "Toutes sauf poudre (plus efficace à mains nues, DM létaux)",
    armure: "Aucune", bouclier: "Aucun",
    equipement: "Bâton (1d6)",
    particularites: ["Capacités déclinables avec une arme de prédilection (voie renommée)"],
    voies: ["Voie de l'énergie vitale", "Voie de la maîtrise", "Voie de la méditation", "Voie du poing", "Voie du vent"],
  },
  {
    profil: "Ensorceleur", famille: "Mage", sourceUrl: `${DRS}/ensorceleur`,
    pvNiveau1: "6 + CON", pvParNiveau: 3, deRecuperation: "d6", chance: "2 + CHA",
    armes: "Dague, bâton ferré + 1 arme au choix (≤1d6)",
    armure: "Aucune", bouclier: "Aucun",
    equipement: "Bâton ferré (1d6), dague (1d4) ou autre arme maîtrisée",
    particularites: ["+1 capacité de rang 2 à la création", "Accès à la voie du mage (remplace la voie de peuple)"],
    voies: ["Voie de l'air", "Voie de la divination", "Voie de l'envoûteur", "Voie des illusions", "Voie de l'invocation"],
  },
  {
    profil: "Forgesort", famille: "Mage", sourceUrl: `${DRS}/forgesort`,
    pvNiveau1: "6 + CON", pvParNiveau: 3, deRecuperation: "d6", chance: "2 + CHA",
    armes: "Dague, bâton, marteau, arbalète légère",
    armure: "Cuir simple maximum", bouclier: "Aucun",
    equipement: "Dague (1d4), bâton ferré (1d6), marteau (1d6)",
    particularites: ["+1 capacité de rang 2 à la création", "Accès à la voie du mage (remplace la voie de peuple)", "Seul mage en armure"],
    voies: ["Voie des artefacts", "Voie des élixirs", "Voie du golem", "Voie du métal", "Voie des runes"],
  },
  {
    profil: "Magicien", famille: "Mage", sourceUrl: `${DRS}/magicien`,
    pvNiveau1: "6 + CON", pvParNiveau: 3, deRecuperation: "d6", chance: "2 + CHA",
    armes: "Dague, bâton",
    armure: "Aucune", bouclier: "Aucun",
    equipement: "Bâton ferré (1d6), dague (1d4), grimoire",
    particularites: ["+1 capacité de rang 2 à la création", "Accès à la voie du mage (remplace la voie de peuple)"],
    voies: ["Voie de la magie des arcanes", "Voie de la magie destructrice", "Voie de la magie élémentaire", "Voie de la magie protectrice", "Voie de la magie universelle"],
  },
  {
    profil: "Sorcier", famille: "Mage", sourceUrl: `${DRS}/sorcier`,
    pvNiveau1: "6 + CON", pvParNiveau: 3, deRecuperation: "d6", chance: "2 + CHA",
    armes: "Dague, bâton",
    armure: "Aucune", bouclier: "Aucun",
    equipement: "Bâton ferré (1d6), dague (1d4), grimoire ou parchemins",
    particularites: ["+1 capacité de rang 2 à la création", "Accès à la voie du mage (remplace la voie de peuple)"],
    voies: ["Voie du démon", "Voie de la mort", "Voie de l'outre-tombe", "Voie du sang", "Voie de la sombre magie"],
  },
];
