import type { Character, MonsterTemplate } from "@/src/lib/rules/types";
import monstresNotion from "@/src/lib/data/monstres-notion.json";

// Personnages COF Fantasy transcrits des 4 fiches (niv. 1).
// Formules appliquées :
//   INIT = 10+PER · DEF = 10+AGI+Équip+Mod · PV = base famille+CON
//   (Combattant 10 / Aventurier 8 / Mystique 8 / Mage 6)
//   Chance = 2+CHA (+1 si Aventurier), réserve complète à la création.
//   DR : d10 Combattant, d8 Aventurier, d8+1 Mystique, d6 Mage,
//   nombre max = 2+CON (+1 si Mystique, soit 3+CON à la création),
//   mais réserve initiale = base sans CON : 2 dés (3 si Mystique).
//   Ex : Guerrier CON+3 -> 2/5, Prêtre CON+1 -> 3/4.
//   Contact = niv+FOR · Distance = niv+AGI · Magique = niv+VOL
//   Mana = VOL + nb sorts connus (min 0), réserve complète à la création.
//   Idéal héroïque / travers : narratifs, aucun bonus.
//   Création niv. 1 (voir src/lib/rules/creation.ts) : 2 pts -> 2 capacités
//   de rang 1 du profil + rang 1 de peuple gratuit (+ rang 2 gratuit : les 4 Mages).
//   Les cases non cochées des fiches (capacités futures des voies) ne sont pas apprises.

export const SEED_CHARACTERS: Character[] = [
  {
    id: "pj-sorcier-humain", kind: "personnage", nom: "Mirabel", classe: "Sorcier", niveau: 1,
    peuple: "Humain", famille: "Mage", profil: "Sorcier",
    caracteristiques: { AGI: 1, CON: 1, FOR: -1, PER: 0, CHA: -1, INT: 2, VOL: 4 },
    idealHeroique: "Sens du sacrifice", travers: "Hautain",
    // Fiche : "Occultisme" ; nom DRS canonique (Voie du mage, rang 1).
    traitsPeuple: ["Capacité de peuple + occultisme", "Diversité"],
    voieMage: true,
    pvMax: 7, pv: 7, defense: 11, initMod: 0,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Malédiction + Saignements (rang 1 Sorcier),
    // + Maîtrise de la magie (rang 2 gratuit, Voie du mage adoptée).
    capacites: ["Malédiction", "Saignements", "Maîtrise de la magie"],
    ressources: {
      mana: { max: 4, actuel: 4 },
      chance: { max: 1, actuel: 1 },
    },
    desRecuperation: { type: "d6", max: 3, actuel: 2 },
    effets: [], notes: "", exemple: false,
    inventaire: [
      { itemId: "item-dague", quantite: 1, equipe: true },
      { itemId: "item-grimoire", quantite: 1, equipe: true },
    ],
    sorts: [],
  },
  {
    id: "pj-rodeur-demi-elfe", kind: "personnage", nom: "Faelyn", classe: "Rôdeur", niveau: 1,
    peuple: "Demi-Elfe", famille: "Aventurier", profil: "Rôdeur",
    caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: -1 },
    idealHeroique: "Liberté", travers: "Distrait",
    traitsPeuple: ["Lumière des étoiles"],
    pvMax: 9, pv: 9, defense: 13, initMod: 2,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Archer émérite + Survie (rang 1 Rôdeur).
    capacites: ["Archer émérite", "Survie"],
    ressources: {
      mana: { max: 0, actuel: 0 },
      chance: { max: 3, actuel: 3 },
    },
    desRecuperation: { type: "d8", max: 3, actuel: 2 },
    effets: [], notes: "Magique fiche = 1 (formule niv+VOL = 0 ; écart conservé de la fiche).", exemple: false,
    inventaire: [{ itemId: "item-arc-court", quantite: 1, equipe: true }],
    sorts: [],
  },
  {
    id: "pj-pretre-elfe-haut", kind: "personnage", nom: "Aelion", classe: "Prêtre", niveau: 1,
    peuple: "Elfe haut", famille: "Mystique", profil: "Prêtre",
    caracteristiques: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 4, INT: 0, VOL: 2 },
    idealHeroique: "Pacifisme", travers: "Phobie du feu",
    traitsPeuple: ["Lumière intérieure"],
    pvMax: 9, pv: 9, defense: 10, initMod: 0,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Bénédiction + Récupération mineure (rang 1 Prêtre).
    capacites: ["Bénédiction", "Récupération mineure"],
    ressources: {
      mana: { max: 2, actuel: 2 },
      chance: { max: 6, actuel: 6 },
    },
    desRecuperation: { type: "d8", max: 4, actuel: 3 },
    effets: [], notes: "", exemple: false,
    inventaire: [{ itemId: "item-baton-ferre", quantite: 1, equipe: true }],
    sorts: [],
  },
  {
    id: "pj-guerrier-nain", kind: "personnage", nom: "Dorain", classe: "Guerrier", niveau: 1,
    peuple: "Nain", famille: "Combattant", profil: "Guerrier",
    caracteristiques: { AGI: 1, CON: 3, FOR: 2, PER: 1, CHA: 0, INT: 0, VOL: -1 },
    idealHeroique: "Honneur", travers: "Impatient",
    // Fiche : "Habitants des tunnels" (pluriel) ; nom DRS canonique au singulier
    // pour matcher la voie (cases du modal, règle de création).
    traitsPeuple: ["Habitant des tunnels"],
    // Fiche affiche 14 PV (10+CON = 13) : écart de 1 conservé en note, valeur recalculée 13.
    pvMax: 13, pv: 13, defense: 11, initMod: 1,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Protéger un allié + Robustesse (rang 1 Guerrier).
    capacites: ["Protéger un allié", "Robustesse"],
    ressources: {
      mana: { max: 0, actuel: 0 },
      chance: { max: 2, actuel: 2 },
    },
    desRecuperation: { type: "d10", max: 5, actuel: 2 },
    effets: [], notes: "Fiche d'origine : 14 PV affichés pour 10+CON (10+3=13).", exemple: false,
    inventaire: [{ itemId: "item-hache-1main", quantite: 1, equipe: true }],
    sorts: [],
  },
];

/** Bestiaire Notion de l'utilisateur (95 créatures, exemple:false). Régénéré via bestiaire/import_notion.py. */
export const SEED_MONSTERS: MonsterTemplate[] = monstresNotion as MonsterTemplate[];
