// Usages par défaut des talents en combat : quel effet appliquer quand on
// utilise tel talent, et sur qui par défaut. Le MJ peut toujours choisir un
// autre effet (ou aucun : usage noté au journal) dans le panneau Capacités.
// Les cas mécaniquement directs sont listés ci-dessous ; tous les autres
// talents actifs reçoivent un usage générique (question MJ + journal), afin
// qu'aucun talent de classe, de voie ou de peuple ne reste inutilisable.
import { CAPACITES } from "./capacites";
import { VOIES_PEUPLE, VOIE_MAGE } from "./peuples";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";

export type CibleCapacite = "allies" | "ennemis" | "tous" | "soi";

export interface CapaciteUsable {
  /** Nom exact du talent (comparaison insensible à la casse, suffixes (L)/(A)... ignorés). */
  talent: string;
  /** Clé du catalogue d'effets appliquée par défaut (null = aucun, narratif seul). */
  effetCle?: string | null;
  /** Durée par défaut (null = jusqu'à suppression manuelle). */
  dureeTours: number | null;
  /** Cibles suggérées par défaut. */
  cibles: CibleCapacite;
  /** Modificateurs supplémentaires de l'effet (ex: { deMalus: 1 }). */
  mods?: Record<string, number>;
  /** Sacrifice de PV du lanceur en dés (ex: "1d4°", Pacte démoniaque). */
  coutPV?: string;
  /** Soin en dés du lanceur (ex: "4d4°+CON", Increvable). */
  soin?: string;
  /**
   * Dégâts automatiques infligés à la cible (sans jet d'attaque), en dés
   * (ex: "3d4+FOR", Fureur du dragon). Les talents qui demandent un jet
   * d'attaque passent par le panneau Attaque.
   */
  degats?: string;
  /** Montant saisi par le MJ au lieu d'un jet (ex: Siphon = NC PV) : "soin". */
  montantMJ?: "soin" | "lien";
  /** Purge les états non permanents de la cible (ex: Increvable). */
  nettoie?: boolean;
  /**
   * Action moteur spéciale (ex: "renvoi" du Renvoi de sort, "proteger" de Protéger un allié,
   * "animer" du pouvoir de créature Animer un cadavre).
   */
  actionSpeciale?: "renvoi" | "proteger" | "vigueur" | "lien-empathique" | "animer";
  /**
   * Question posée au MJ en pop-up avant d'utiliser le talent (positions,
   * contact, jugement au cas par cas) : le moteur ne suit pas les positions.
   * Absent = utilisable sans validation.
   */
  questionMJ?: string;
  /** Écart éventuel avec le texte DRS (approximation moteur). */
  note?: string;
  /**
   * Nature de l'usage. `actif` = bouton dans le panneau Capacités (même sans
   * effet mécanique : le MJ tranche via la question). `passif` = appliqué aux
   * dérivés ou seulement décrit, jamais proposé comme action. `narratif` =
   * hors combat / géré ailleurs (sort lié, panneau Attaque...).
   */
  mode?: "actif" | "passif" | "narratif";
}

export const CAPACITES_USABLES: CapaciteUsable[] = [ {
    talent: "Protéger un allié",
    effetCle: "protection",
    dureeTours: 1,
    cibles: "allies",
    actionSpeciale: "proteger",
    questionMJ: "L'allié protégé est-il au contact de la créature qui va l'attaquer ?",
    note: "Guerrier (G, bouclier requis) : mod. DEF du bouclier à un allié au contact (MJ) contre la prochaine attaque (1/round, annoncée avant le résultat) ; le guerrier garde son bonus ; pas si surpris.",
  },
  {
    talent: "Pacte démoniaque",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    coutPV: "1d4°",
    note: "Sorcier (G) : +INT à un d20 ou en DEF (avant résolution, MJ) + VOL aux DR auto (max).",
  },
  {
    talent: "Siphon des âmes",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    montantMJ: "soin",
    note: "Sorcier, 1/round : mort d'un humanoïde vivant à 20 m = +NC PV (NC saisi par le MJ ; variante 1 PM si niv. 3+ et NC>4 : manuelle).",
  },
  {
    talent: "Armure d'os",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +3 DEF auto (+1 par rang 4 en voie sorcier, auto), 10 min d'entretien/jour, sans malus AGI.",
  },
  {
    talent: "Exsangue",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +2 DEF auto (+3 si rang 5 en Voie du sang, −1 si torse mundane sans Armure d'os) ; à 0 PV agit avec dé malus (MJ).",
  },
  {
    talent: "Pacte ténébreux",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "Sorcier : CON +1 auto (PV, DR), vision nocturne, dé bonus CON (MJ) ; +2d4° aux DM du prochain sort : coût auto, bonus via le champ +DM du panneau Attaque (MJ).",
  },
  {
    talent: "Prouesse",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "1/round (G) : sacrifier 1d4° PV pour +5 à un test de FOR ou CON, même après le jet (MJ : test manuel).",
  },
  {
    talent: "Tour de force",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "+10 à un test de FOR (pas DM ni attaque) pour 1d4° PV (MJ : test manuel).",
  },
  {
    talent: "Feindre la mort",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    soin: "1d4°",
    note: "1/combat (G) : passe pour mort (INT 20 pour percer, MJ), se relève avec adversaire surpris.",
  },
  {
    talent: "Phénix",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    soin: "2d4°+CHA",
    note: "Automatique 1/jour (moteur : déclenché à 0 PV, jet unique, prêtre au double). Pop-up MJ pour cocher les alliés à 20 m. Le bouton reste en secours MJ (1 cible).",
  },
  {
    talent: "Attaque puissante",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Cocher Puissante dans le panneau Attaque (dé malus +2d4° DM, L +3d4°).",
  },
  {
    talent: "Attaque brutale",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : +1d4 DM, ou −3 en attaque pour +2d4 ; recul 3 m ou renversé NC < rang (MJ).",
  },
  {
    talent: "Double attaque",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : case « Double attaque » au panneau — 2 lancers à −2 automatiques, aucun −2 à saisir en Mod.",
  },
  {
    talent: "Attaque circulaire",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : case « Circulaire » au panneau — 1 lancer à −2 par ennemi pré-coché (tous par défaut, contact au MJ).",
  },
  {
    talent: "Charge",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Charge 5-10 m (10-20 m à cheval) : cocher Parfaite (dé bonus +1d4°) ; bloqueur FOR 20 ou passage cédé (MJ).",
  },
  {
    talent: "Attaque bondissante",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Charge druide/félin 5-10 m : Parfaite (dé bonus +1d4°) ; pas au contact.",
  },
  {
    talent: "Tir de barrage",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Surveillance 20 m (L) : DM arme ×2 ou stoppé sans DM (MJ : +DM).",
  },
  {
    talent: "Tir de grenaille",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Cône (L), 1 test contre tous : moitié DM (MJ : diviser).",
  },
  {
    talent: "Attaque tourbillon",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (L) : DM de l'arme à tous dans 5 m (MJ : résoudre chacun).",
  },
  {
    talent: "Frappe du justicier",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Attaque ratée = moitié DM, 1 naturel = rien (MJ : diviser).",
  },
  {
    talent: "As de la gâchette",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Poudre/arbalète, jet ≥ DEF+10 : +2d4 DM (MJ : +DM).",
  },
  {
    talent: "Ouverture mortelle",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (L) : critique auto + sournoise non doublée (MJ).",
  },
  {
    talent: "Maître du poison",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "3 doses/jour : arme +2d4 DM (création) + affaibli CON 10+INT, inconscience 2d6 min si ingéré (MJ).",
  },
  {
    talent: "Esquive acrobatique",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test distance vs attaque = 0 DM, critique = DM normaux (MJ).",
  },
  {
    talent: "Esquive de la magie",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test distance opposé pour échapper à un sort à DM (MJ).",
  },
  {
    talent: "Feinte",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(L) : CHA vs PER puis +2×rang en attaque et +2d4 DM si réussie (MJ : Mod.).",
  },
  {
    talent: "Intelligence du combat",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(M) 1/combat : désarmer/renverser/aveugler 1 round, NC inférieur, INT opposé (MJ).",
  },
  {
    talent: "Baratin",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    note: "Rang+2 baratin/séduction/marché noir ; parchemins et baguettes, test magique diff 10+2×rang (MJ).",
  },
  {
    talent: "Provocation",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(L) : CHA vs INT (humanoïde 10 m) forcé à l'attaquer + riposte gratuite sournoise ou +1d4 (MJ).",
  },
  {
    talent: "Pression mortelle",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(M) : mains nues, +1d4/attaque comptabilisés puis libérés sur test contact (L) dans l'heure (MJ).",
  },
  {
    talent: "Défier la mort",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/combat : DM létaux → 1 PV sur CON 10, auto si enragé (MJ).",
  },
  {
    talent: "Repli",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "(L) en nature : 30 m + AGI 10 (15 à découvert) pour disparaître (MJ).",
  },
  {
    talent: "Acrobaties",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : AGI 15 pour franchir ou dos + sournoise/+1d4 (MJ).",
  },
  {
    talent: "Piège explosif",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1 min, rayon 5 m : 5d4+INT feu, moitié si AGI 15, détection INT 15+INT (MJ : poser + résoudre).",
  },
  {
    talent: "Disparition",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "(M) 1/combat : disparaît sauf DM de zone, réapparaît ≤20 m (MJ).",
  },
  {
    talent: "Démolition",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "3 rounds : 3d4+INT structure (RD/2), 2d4 dans 2 m, charges/jour = rang (MJ).",
  },
  {
    talent: "Résistance à la magie",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test d'attaque magique opposé pour ignorer un sort, dé malus si hybride (MJ).",
  },
  {
    talent: "Manœuvre",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    note: "Dé bonus aux manœuvres (MJ : jets manuels).",
  },
  {
    talent: "Vigueur divine",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    actionSpeciale: "vigueur",
    nettoie: true,
    note: "Limitée (L) au contact, sans PM : guérit poison/maladie. Auto = purge ; Test MJ = test d'attaque magique (opposé si surnaturel) puis purge si réussi. Rang+2 vs maladies/poisons (MJ).",
  },
  {
    talent: "Parer un coup",
    effetCle: "Parade",
    dureeTours: 1,
    cibles: "soi",
    mods: { parade: 1 },
    questionMJ: "La parade est-elle préparée maintenant, avant l'attaque adverse ? (bouclier en main, guerrier non surpris)",
    note: "Guerrier (M, bouclier requis) : posture sur soi — la prochaine attaque réussie (contact ou distance, pas les touches auto) est bloquée sur test opposé d'attaque au contact (niv + FOR/AGI + arme + mods). Rang 5 : (G) 1/round avec dé malus (MJ). Énorme/colossale : moitié DM (MJ).",
  },
  {
    talent: "Absorber un sort",
    effetCle: "Absorption",
    dureeTours: 1,
    cibles: "soi",
    mods: { absorption: 1 },
    note: "Guerrier (après parade préparée, bouclier requis) : remplace cette parade — test d'attaque au contact opposé à l'attaque magique. Annule le sort sur le guerrier (sur zone, lui seul est protégé). Un sort de zone n'est jamais renvoyable ; un sort ciblé est stocké pour un Renvoi immédiat.",
  },
  {
    talent: "Renvoi de sort",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    actionSpeciale: "renvoi",
    note: "Guerrier (G, bouclier requis) : renvoie immédiatement le sort ciblé absorbé à son lanceur d'origine, effets appliqués. Un sort de zone ne peut pas être renvoyé.",
  },
  {
    talent: "Science du critique",
    effetCle: "Critique 19-20",
    dureeTours: null,
    cibles: "soi",
    mods: { seuilCrit: 19 },
    note: "Guerrier (arme de prédilection) : critique sur 19-20. AUTO en combat quand la fiche porte la famille (Maître d'armes) et l'arme matche ; ce bouton reste le secours MJ (arme non posée, monstre).",
  },
  {
    talent: "Increvable",
    effetCle: "Increvable",
    dureeTours: 1,
    cibles: "soi",
    mods: { defense: 5 },
    soin: "4d4°+CON",
    nettoie: true,
    note: "Rôdeur (L), 1/combat (MJ) : à 0 PV, +4d4°+CON au prochain tour, +5 DEF 1 round, purge des états non permanents.",
  },
  {
    talent: "Lien empathique",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    montantMJ: "lien",
    actionSpeciale: "lien-empathique",
    note: "Rôdeur (L) : télépathie + 1 PV rôdeur = 1 PV loup (2 PV avec Tactiques), sans limite. Saisir les PV dépensés.",
  },
  {
    talent: "Mon armure est une arme",
    effetCle: null,
    dureeTours: 1,
    cibles: "ennemis",
    degats: "1d4+FOR",
    questionMJ: "Mon armure est une arme : la cible est-elle au contact et de FOR inférieure au chevalier ? Le coup d'armure est-il utilisable (1/combat) ?",
    note: "Chevalier (G), 1/combat : coup d'armure automatique 1d4+FOR ; cible de FOR inférieure renversée, étourdie 1 round ou reculée de 3 m (choix MJ).",
  },
  {
    talent: "Fureur du dragon",
    effetCle: null,
    dureeTours: 1,
    cibles: "ennemis",
    degats: "3d4+FOR",
    questionMJ: "Fureur du dragon : toutes les cibles au contact sont-elles dans la zone de 5 m ? Appliquer 3d4+FOR à chacune ; FOR 10 ou renversées.",
    note: "Moine (L), 1/combat : 3d4+FOR automatiques à toutes les cibles au contact ; FOR 10 ou renversées. Utiliser le bouton cible par cible.",
  },
  {
    talent: "Cri de guerre",
    effetCle: "cri-de-guerre",
    dureeTours: 1,
    cibles: "ennemis",
    mods: { attaque: -1 },
    questionMJ: "Cri de guerre : les ennemis dans 10 m ont-ils une FOR inférieure au barbare ?",
    note: "Barbare (G), 1/combat : hurlement 10 m ; FOR inférieure = dé malus aux attaques au contact. Sans peur : rang+2 en VOL contre la peur (MJ).",
  },
  {
    talent: "Rage du berserk",
    effetCle: "rage",
    dureeTours: null,
    cibles: "soi",
    mods: { attaque: 2, defense: -2 },
    questionMJ: "Rage du berserk : la rage est-elle déclenchée (1/jour, jusqu'à la fin du combat) ?",
    note: "Barbare (L), 1/jour : rage jusqu'à la fin du combat, +1d4° DM au contact via le sélecteur de talent d'attaque, −2 DEF, pas de fuite ni de distance, ni sorts ni concentration.",
  },
  {
    talent: "Furie du berserk",
    effetCle: "rage-furieuse",
    dureeTours: null,
    cibles: "soi",
    mods: { attaque: 2, defense: -4 },
    questionMJ: "Furie du berserk : coûte 2 rages, −4 DEF, fin prématurée sur VOL 20 ; la rage est-elle active ?",
    note: "Barbare (L) : +2d4° DM au contact via le sélecteur de talent d'attaque, −4 DEF, fin sur VOL 20.",
  },
  {
    talent: "Charge fantastique",
    effetCle: "charge-fantastique",
    dureeTours: 1,
    cibles: "allies",
    mods: { attaque: 1, degats: 1 },
    questionMJ: "Charge fantastique : les alliés en vue sont-ils à portée du +10 m de déplacement, puis dé bonus et +1d4 DM à leurs attaques ?",
    note: "Chevalier (G), 1/combat : alliés en vue + lui, +10 m de déplacement puis dé bonus et +1d4° DM aux attaques (1 round).",
  },
  {
    talent: "Animer un cadavre",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    actionSpeciale: "animer",
    questionMJ: "Le cadavre de zombie visé (cadavre du combat ou profil du bestiaire, NC ≤ 2) est-il à 10 m ou moins ?",
    note: "Pouvoir de créature (Sorcier, Shaman orc) : ne relève que des cadavres de zombies (NC ≤ 2) — zombie hors combat déjà présent, ou profil de zombie du bestiaire déclaré mort sur place (il entre alors en jeu à la fin de l'ordre). Le cadavre conserve son profil mais subit -2 en attaque, en DEF et en Initiative ; une fois vaincu à nouveau, il ne peut plus être réanimé. Les PJ à 0 PV (inconscients) ne sont pas des cadavres.",
  },
];

/**
 * Un talent est-il lançable en combat (au moins une mécanique : effet,
 * coût PV, soin, purge, renvoi) ? Les passifs (Armure d'os, Exsangue...),
 * les manœuvres gérées par le panneau Attaque et les talents narratifs
 * sont exclus du panneau Capacités (ni sorts ni effets à appliquer).
 */
const PASSIFS_AUTOMATIQUES = new Set(
  [
    "Travail d'équipe", "Tactiques de meute", "Archer émérite", "Tir chirurgical",
    "Parade croisée", "Attaque à suivre", "Droite-gauche", "Double peine",
    "Instinct de survie", "Force d'âme", "Immortel", "Fils du roc", "Ténacité",
    "Haches et marteaux", "Lumière intérieure", "Lumière des étoiles",
    "Habitant des tunnels", "Supériorité elfique", "Esprit supérieur",
    "Robustesse", "Vivacité", "Résilient", "Dur à cuire", "Rempart",
    "Armes de prédilection", "Spécialisation", "Riposte", "Piqûre de rappel",
    "Teigneux", "Enchaînement", "Attaque sournoise", "Attaque par surprise",
    "Discrétion", "Doigts agiles", "Aux aguets", "Attaque en finesse",
    "Frappe chirurgicale", "Ambidextrie", "Botte secrète", "Précision",
    "Grâce féline", "Agile", "Réflexes félins", "Souplesse du félin",
    "Liberté d'action", "Éclectique", "Charmant", "Dentelle et rapière",
    "Enfant de la forêt", "Talent pour la magie", "Touche-à-tout",
    "Polyvalence", "Pacte ténébreux", "Exsangue", "Armure d'os",
    "Armure lourde", "Combattant aguerri", "Combattant héroïque",
    "Constitution héroïque", "Force héroïque", "Charisme héroïque",
    "Agilité héroïque", "Perception héroïque", "Volonté héroïque",
    "Pilier de bar", "Proche de la nature", "Vigueur", "Argument de taille",
    "Mécanismes", "Arme à répétition", "Canon double", "Poudre puissante",
    "Plus vite que son ombre", "Joli coup", "Tir précis", "As de la gâchette",
    "Petit compagnon", "Le loup", "Loup alpha",
    "Langage des animaux", "Peau de pierre", "Tatouages", "Peau d'acier",
    "Réflexes éclair", "Course du vent", "Pas du vent", "Peau de fer",
    "Mains d'énergie", "Poings de fer", "Griffes du tigre", "Puissance du ki",
    "Maîtrise du ki", "Runes de défense", "Grosse tête", "Endurer",
    "Bâton de mage", "Morsure de la forge", "Métal brûlant", "Magnétisme",
    "Armure de mana", "Peau d'écorce", "Maîtrise des éléments", "Familier",
    "Tour de magie", "Murmures dans le vent", "Divination", "Armure de pierre",
    "Déphasage", "Invisibilité", "Vol", "Ailes célestes", "Forme éthérée",
    "Forme gazeuse", "Lévitation", "Respiration aquatique", "Accélération",
    "Interruption du temps", "Marche des plans", "Téléportation", "Clairvoyance",
    "Détection de l'invisible", "Compréhension des langues", "Déguisement",
    "Mirage", "Imitation", "Serviteur invisible", "Porte dimensionnelle",
    "Mur de mana", "Ouverture-fermeture", "Statuette", "Rune de puissance",
    "Rune de protection", "Rune d'énergie", "Rune de garde",
    "Cercle de protection", "Chute ralentie", "Lumière", "Baies magiques",
    "Régénération", "Forêt vivante", "Forme d'arbre", "Animation d'un arbre",
    "Porte végétale", "Prison végétale", "Nuée d'insectes",
    "Masque du prédateur", "Forme animale",
  ].map(normaliserNomCapacite)
);

/** Toutes les capacités de profil + de peuple (recherche du texte DRS). */
function toutesLesCapacites(): { nom: string; resume: string; action?: string; sortId?: string }[] {
  const out: { nom: string; resume: string; action?: string; sortId?: string }[] = [];
  for (const voies of Object.values(CAPACITES)) {
    for (const v of voies) for (const c of v.capacites) out.push(c);
  }
  for (const v of [...VOIES_PEUPLE, VOIE_MAGE]) {
    for (const c of v.capacites) out.push(c);
  }
  return out;
}

let indexCapacites: Map<string, { nom: string; resume: string; action?: string; sortId?: string }> | null = null;
function capaciteParNom(nom: string) {
  if (!indexCapacites) {
    indexCapacites = new Map();
    for (const c of toutesLesCapacites()) {
      const q = normaliserNomCapacite(c.nom);
      if (!indexCapacites.has(q)) indexCapacites.set(q, c);
    }
  }
  return indexCapacites.get(normaliserNomCapacite(nom));
}

/** Heuristique : le résumé décrit-il une action utilisable en combat ? */
function resumeActif(resume: string): boolean {
  return /(^|\b)(action\s+(gratuite|limitée|limitee|mouvement|d'?attaque)|sort\s+(d'?attaque|de|\(|\p{L})|test\s+oppos|jet\s+d'?attaque|utilise\s+une\s+action|en\s+action)/iu.test(
    resume
  );
}

function ciblesDepuisResume(resume: string): CibleCapacite {
  if (/\b(soi|sur soi|seul|lanceur|personnel)\b/i.test(resume)) return "soi";
  if (/\b(alli|compagnon|groupe|patients|protég|protege)/i.test(resume)) return "allies";
  if (/\b(ennemi|adversaire|victime|cible|créature|creature|mort-vivant|demon|démon)/i.test(resume)) return "ennemis";
  return "tous";
}

/**
 * Usage d'un talent : entrée spécifique si elle existe, sinon fallback
 * générique construit depuis le texte DRS. Le fallback actif ouvre une
 * question MJ et journalise l'usage ; il ne prétend pas automatiser une
 * règle complexe (portée, contact, choix de caractéristique...).
 */
/** Talents déjà résolus par le panneau Attaque (cases Coup spécial ou sélecteur). */
const NARRATIFS_ATTAQUE = new Set([
  "attaque puissante",
  "attaque brutale",
  "double attaque",
  "attaque circulaire",
  "charge",
  "attaque bondissante",
  "tir de barrage",
  "tir de grenaille",
  "attaque tourbillon",
  "frappe du justicier",
  "as de la gâchette",
  "ouverture mortelle",
  "maître du poison",
  "feinte",
  "provocation",
  "pression mortelle",
]);

/** Passifs explicites : appliqués aux dérivés, jamais proposés comme action. */
const PASSIFS_EXPLICITES = new Set(["armure d'os", "exsangue"]);

/** Actions explicitement narratives mais non couvertes par le panneau Attaque. */
const ACTIFS_EXPLICITES = new Set([
  "résistance à la magie",
  "défier la mort",
  "manœuvre",
  "manouvre",
  "intelligence du combat",
  "esquive acrobatique",
  "repli",
  "disparition",
  "baratin",
  "acrobaties",
  "esquive de la magie",
  "démolition",
  "piège explosif",
]);

export function usageTalent(nom: string, profil?: string): CapaciteUsable | undefined {
  const q = normaliserNomCapacite(nom);
  const direct = CAPACITES_USABLES.find((u) => normaliserNomCapacite(u.talent) === q);
  if (direct) {
    const mode: CapaciteUsable["mode"] = PASSIFS_EXPLICITES.has(q)
      ? "passif"
      : NARRATIFS_ATTAQUE.has(q)
        ? "narratif"
        : ACTIFS_EXPLICITES.has(q)
          ? "actif"
          : (direct.mode ??
            (direct.effetCle ||
            direct.coutPV ||
            direct.soin ||
            direct.degats ||
            direct.montantMJ ||
            direct.nettoie ||
            direct.actionSpeciale
              ? "actif"
              : "passif"));
    if (mode === direct.mode && direct.questionMJ) return direct;
    return {
      ...direct,
      mode,
      ...(mode === "actif" && !direct.questionMJ
        ? {
            questionMJ: `Le MJ valide les conditions, la cible et l'effet exact de « ${direct.talent} » (texte DRS).`,
          }
        : {}),
    };
  }
  const c = capaciteParNom(nom);
  if (!c) return undefined;
  const mode: CapaciteUsable["mode"] = c.sortId
    ? "narratif"
    : PASSIFS_AUTOMATIQUES.has(q) || (!c.action && !resumeActif(c.resume))
      ? "passif"
      : "actif";
  return {
    talent: c.nom,
    effetCle: null,
    dureeTours: null,
    cibles: ciblesDepuisResume(c.resume),
    mode,
    ...(mode === "actif"
      ? {
          questionMJ: `Le MJ valide les conditions, la cible et l'effet exact de « ${c.nom} » (texte DRS).`,
        }
      : {}),
    note: c.resume,
  };
}

/**
 * Un talent est-il utilisable depuis le panneau Capacités ? Les passifs et
 * les sorts liés (panneau des sorts / Attaque) en sont exclus. Un talent
 * actif sans effet automatisé reste utilisable : le MJ tranche dans la
 * pop-up et l'usage est journalisé.
 */
export function estLancable(u: CapaciteUsable | undefined): boolean {
  if (!u) return false;
  if (u.mode === "passif" || u.mode === "narratif") return false;
  if (u.mode === "actif") return true;
  return !!(u.effetCle || u.mods || u.coutPV || u.soin || u.degats || u.montantMJ || u.nettoie || u.actionSpeciale);
}

/** Talents lançables parmi des noms connus (panneau Capacités, badge). */
export function talentsLancables(talents: string[], profil?: string): string[] {
  return talents.filter((t) => estLancable(usageTalent(t, profil)));
}
