import type { Item, Npc } from "@/src/lib/rules/world/types";

// PNJ et objets d'exemple liés au scénario du Val Brumeux. NON officiels.
export const SEED_NPCS: Npc[] = [
  {
    id: "npc-tobin", nom: "Tobin", role: "Tavernier", exemple: true,
    description: "Tavernier bedonnant, tablier taché de bière.",
    personnalite: "Jovial mais nerveux depuis les attaques.",
    statistiques: "Niv. 1, PV 12, Déf 11 (exemple).",
    dialogues: [
      "« Les gobelins ont pris la route de la forêt... »",
      "« Mon cousin a vu leur chef, un cimeterre rouillé à la main. »",
    ],
    secret: "Cache la clé du passage secret sous son comptoir (flag : cle).",
    relations: "Apprécie la garde Mira.",
    notesMJ: "Donne la clé si les PJ gagnent sa confiance.",
  },
  {
    id: "npc-mira", nom: "Mira", role: "Garde du village", exemple: true,
    description: "Jeune garde, lance ébréchée.",
    personnalite: "Directe, courageuse.",
    statistiques: "Niv. 2, PV 24, Déf 15 (exemple).",
    dialogues: ["« Restez sur la route, la forêt grouille de gobelins. »"],
    secret: "A repéré des traces vers la vieille porte (indice).",
    relations: "Protège Tobin.",
    notesMJ: "Peut accompagner les PJ jusqu'à la lisière.",
  },
  {
    id: "npc-ermite", nom: "Vieil Ermite", role: "Ermite", exemple: true,
    description: "Silhouette encapuchonnée qui vit près de la forêt.",
    personnalite: "Énigmatique, parle par proverbes.",
    statistiques: "Niv. 3 (exemple).",
    dialogues: ["« Ce qui saigne peut être suivi. Ce qui est mort peut être fouillé. »"],
    secret: "Connaît l'existence de la salle secrète.",
    notesMJ: "Donne l'indice X si les PJ l'aident.",
  },
];

export const SEED_ITEMS: Item[] = [
  {
    id: "item-cle", nom: "Clé rouillée", categorie: "quete", quantite: 1, exemple: true,
    description: "Petite clé rouillée cachée sous le comptoir de Tobin.",
    effet: "Ouvre le passage secret (flag : cle).",
  },
  {
    id: "item-potion", nom: "Potion de soin", categorie: "potion", quantite: 3, exemple: true,
    description: "Fiole de liquide rouge.",
    effet: "Rend des PV (exemple : +2d4, à valider COF V2).",
    valeur: 25,
  },
  {
    id: "item-torche", nom: "Torche", categorie: "outil", quantite: 5, exemple: true,
    description: "Bâton enduit de résine.",
    effet: "Éclaire 10 m pendant 1 h (exemple).",
    poids: 0.5, valeur: 1,
  },
  {
    id: "item-tresor", nom: "Coffret du chef", categorie: "quete", quantite: 1, exemple: true,
    description: "Coffret cabossé de la salle secrète.",
    effet: "Récompense de fin : 150 po à partager (exemple).",
    valeur: 150,
  },
  {
    id: "item-epee", nom: "Épée longue", categorie: "arme", quantite: 1, exemple: true,
    description: "Épée d'infanterie bien équilibrée.",
    estArme: true, bonusAttaque: 6, degats: "1d8+3",
    familles: ["epees"],
    valeur: 30,
  },
  {
    id: "item-arc", nom: "Arc long", categorie: "arme", quantite: 1, exemple: true,
    description: "Grand arc en if.",
    estArme: true, bonusAttaque: 5, degats: "1d8+2",
    familles: ["arcs"],
    valeur: 25,
  },
  {
    id: "item-masse", nom: "Masse", categorie: "arme", quantite: 1, exemple: true,
    description: "Masse de guerre à tête ronde.",
    estArme: true, bonusAttaque: 4, degats: "1d6+2",
    familles: ["masses"],
    valeur: 12,
  },
  {
    id: "item-baton", nom: "Bâton de marche", categorie: "arme", quantite: 1, exemple: true,
    description: "Solide bâton de chêne.",
    estArme: true, bonusAttaque: 3, degats: "1d6+1",
    familles: ["batons"],
    valeur: 2,
  },
  {
    id: "item-dague-poison", nom: "Dague empoisonnée", categorie: "arme", quantite: 1, exemple: true,
    description: "Lame enduite de poison gobelin.",
    effet: "Empoisonne si TOUCHÉ.",
    estArme: true, bonusAttaque: 4, degats: "1d6+2",
    familles: ["dagues"],
    effetCle: "empoisonne", effetDuree: 3,
    valeur: 40,
  },
  // Armes des 4 fiches COF Fantasy (dégâts bruts des fiches, bonus = attaque de base au niv 1).
  {
    id: "item-dague", nom: "Dague (1d4)", categorie: "arme", quantite: 1, exemple: false,
    description: "Dague — fiche Mage/Sorcier (Contact).",
    estArme: true, bonusAttaque: 0, degats: "1d4",
    familles: ["dagues"],
  },
  {
    id: "item-grimoire", nom: "Grimoire (1d4)", categorie: "arme", quantite: 1, exemple: false,
    description: "Grimoire — fiche Mage/Sorcier.",
    estArme: true, bonusAttaque: 0, degats: "1d4",
    familles: ["gourdins"],
  },
  {
    id: "item-arc-court", nom: "Arc court (1d6)", categorie: "arme", quantite: 1, exemple: false,
    description: "Arc court — fiche Rôdeur (Distance).",
    estArme: true, bonusAttaque: 4, degats: "1d6",
    familles: ["arcs"],
  },
  {
    id: "item-baton-ferre", nom: "Bâton ferré (1d6)", categorie: "arme", quantite: 1, exemple: false,
    description: "Bâton ferré — fiche Prêtre (Contact).",
    estArme: true, bonusAttaque: 1, degats: "1d6",
    familles: ["batons"],
  },
  {
    id: "item-hache-1main", nom: "Hache à une main (1d8)", categorie: "arme", quantite: 1, exemple: false,
    description: "Hache à une main — fiche Guerrier (Contact, DM +FOR).",
    estArme: true, bonusAttaque: 3, degats: "1d8+2",
    familles: ["haches"],
  },
];
