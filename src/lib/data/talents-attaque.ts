/**
 * Talents qui modifient une attaque (jet ou DM) et ne sont pas déjà couverts
 * par les cases « Coup spécial » du panneau Attaque. Chaque entrée est une
 * approximation de table : la question MJ précise les conditions que le moteur
 * ne connaît pas (contact, distance, cible, monture, arme de prédilection...).
 */
export interface TalentAttaqueOption {
  talent: string;
  /** Type d'action annoncé (A/L) ; null = dépend de l'arme ou du choix MJ. */
  action?: "A" | "L" | null;
  /** Armes compatibles : contact, distance, mains nues, arme légère, toutes. */
  arme?: "contact" | "distance" | "mains-nues" | "legere" | "toutes";
  modAttaque?: number;
  deBonus?: boolean;
  deMalus?: boolean;
  /** Dés de DM supplémentaires (notation COF : 1d4°, 2d4...). */
  degatsBonus?: string[];
  /** Bonus fixe aux DM. */
  bonusDM?: number;
  /** Effet appliqué au toucher. */
  effetSupp?: { cle: string; duree: number | null };
  questionMJ?: string;
  /** Précision affichée sous le sélecteur. */
  note: string;
}

export const TALENTS_ATTAQUE: TalentAttaqueOption[] = [
  {
    talent: "Attaque brutale",
    action: "L",
    arme: "contact",
    degatsBonus: ["1d4°"],
    questionMJ: "Attaque brutale : variante +1d4 DM (sans malus) ou −3 en attaque pour +2d4 DM ?",
    note: "Contact, action limitée : +1d4° DM ; variante −3 en attaque pour +2d4° DM (choix MJ).",
  },
  {
    talent: "Charge",
    action: "L",
    arme: "contact",
    deBonus: true,
    degatsBonus: ["1d4°"],
    questionMJ: "Charge : le déplacement de 5 à 10 m en ligne droite est-il possible, et la cible est-elle libre au contact ?",
    note: "Charge (Barbare/Chevalier) : dé bonus et +1d4° DM si la course est possible.",
  },
  {
    talent: "Attaque bondissante",
    action: "L",
    arme: "contact",
    deBonus: true,
    degatsBonus: ["1d4°"],
    questionMJ: "Attaque bondissante : le bond de 5 à 10 m jusqu'à la cible est-il possible, sans être au contact au départ ?",
    note: "Druide/félin : bond de 5 à 10 m, dé bonus et +1d4° DM au contact.",
  },
  {
    talent: "Déchaînement d'acier",
    action: "L",
    arme: "contact",
    modAttaque: -2,
    questionMJ: "Déchaînement d'acier : quelles cibles sont sur la ligne de 10 m ? Résoudre une attaque à −2 par cible.",
    note: "Traverse 10 m : une attaque à −2 contre chaque adversaire sur le passage (une cible à la fois).",
  },
  {
    talent: "Attaque tourbillon",
    action: "L",
    arme: "contact",
    questionMJ: "Attaque tourbillon : toutes les cibles dans 5 m subissent les DM de l'arme (1/combat).",
    note: "1/combat : DM automatiques de l'arme à toutes les cibles dans 5 m (MJ).",
  },
  {
    talent: "Rage du berserk",
    action: "L",
    arme: "contact",
    deBonus: false,
    bonusDM: 0,
    degatsBonus: ["1d4°"],
    questionMJ: "Rage du berserk : la rage est-elle active (1/jour, jusqu'à la fin du combat, −2 DEF) ?",
    note: "Rage : +1d4° DM au contact, −2 DEF, pas de fuite ni de distance, ni sorts ni concentration.",
  },
  {
    talent: "Furie du berserk",
    action: "L",
    arme: "contact",
    degatsBonus: ["2d4°"],
    questionMJ: "Furie du berserk : coûte 2 rages, −4 DEF, fin sur VOL 20 ; la rage est-elle active ?",
    note: "Furie : +2d4° DM au contact, −4 DEF (remplace le bonus de rage).",
  },
  {
    talent: "Frappe du justicier",
    action: "L",
    arme: "contact",
    questionMJ: "Frappe du justicier : si l'attaque rate (hors 1 naturel), appliquer la moitié des DM.",
    note: "Attaque ratée : moitié des DM (1 naturel = rien) ; le moteur ne le fait pas automatiquement.",
  },
  {
    talent: "Massacrer la piétaille",
    arme: "contact",
    degatsBonus: ["1d4°"],
    questionMJ: "Massacrer la piétaille : y a-t-il au moins 4 créatures semblables (hors cavaliers) ?",
    note: "+1d4° DM contre la piétaille (4+ créatures semblables).",
  },
  {
    talent: "Laissez-le-moi",
    arme: "contact",
    degatsBonus: ["1d4°"],
    questionMJ: "Laissez-le-moi : le leader est-il identifié parmi 4+ créatures ?",
    note: "+1d4° DM au contact contre le leader identifié.",
  },
  {
    talent: "Attaque sournoise",
    action: "L",
    arme: "legere",
    degatsBonus: ["2d4°"],
    questionMJ: "Attaque sournoise : la cible est-elle surprise ou dos tourné, et l'arme est-elle légère ?",
    note: "Surpris ou de dos, arme légère : +2d4° DM (+1d4° par rang 4 atteint, max 7d4° ; /2 sinon).",
  },
  {
    talent: "Attaque par surprise",
    arme: "legere",
    degatsBonus: ["2d4°"],
    questionMJ: "Attaque par surprise : la cible est-elle surprise (action d'attaque, pas limitée) ?",
    note: "Sournoise contre une cible surprise : +2d4° DM, sans coût d'action limitée.",
  },
  {
    talent: "Provocation",
    action: "L",
    arme: "contact",
    questionMJ: "Provocation : CHA contre INT (humanoïde à 10 m) ; la cible doit vous attaquer et vous obtenez une riposte gratuite.",
    note: "Riposte gratuite (sournoise ou +1d4°) si la provocation réussit.",
  },
  {
    talent: "Attaque paralysante",
    action: "L",
    arme: "contact",
    effetSupp: { cle: "immobilise", duree: 2 },
    questionMJ: "Attaque paralysante : la cible est-elle un humanoïde ? NC < moitié du niveau = paralysé, sinon immobilisé 1d4 rounds.",
    note: "1/combat, sans DM : humanoïde immobilisé 1d4 rounds (paralysé si NC < moitié du niveau).",
  },
  {
    talent: "Feinte",
    action: "L",
    arme: "legere",
    modAttaque: 2,
    degatsBonus: ["2d4°"],
    questionMJ: "Feinte : test de CHA contre PER réussi ? Le bonus s'applique à la première attaque au contact du round suivant.",
    note: "Feinte réussie : +2×rang en attaque et +2d4° DM à la première attaque au contact.",
  },
  {
    talent: "Botte mortelle",
    arme: "legere",
    degatsBonus: ["2d4°"],
    note: "Arme légère, attaque = DEF+10 : +2d4° DM (non multipliés au critique).",
  },
  {
    talent: "Attaque flamboyante",
    action: "L",
    arme: "legere",
    questionMJ: "Attaque flamboyante : l'arme est-elle légère ? Le bonus de CHA est déjà appliqué par les passifs.",
    note: "Action limitée : +CHA en attaque et DM (déjà compté dans les passifs).",
  },
  {
    talent: "Tir rapide",
    action: "L",
    arme: "distance",
    modAttaque: -2,
    questionMJ: "Tir rapide : deux attaques à distance à −2 ; résoudre la première, puis relancer la seconde.",
    note: "Deux attaques à distance à −2 (le moteur ne fait qu'une résolution ; relancer).",
  },
  {
    talent: "Tir de barrage",
    action: "L",
    arme: "distance",
    questionMJ: "Tir de barrage : une cible qui bouge dans 20 m subit une attaque (double DM ou stoppée sans DM).",
    note: "Surveille 20 m : attaque à distance contre qui bouge (double DM ou stoppé sans DM).",
  },
  {
    talent: "Tir de grenaille",
    action: "L",
    arme: "distance",
    modAttaque: 0,
    questionMJ: "Tir de grenaille : cône de 10 × 5 m ; un seul test contre toutes les cibles, moitié DM.",
    note: "Cône : un test contre toutes les cibles, moitié DM (résoudre cible par cible).",
  },
  {
    talent: "Mort-ou-vif",
    action: "L",
    arme: "toutes",
    questionMJ: "Mort-ou-vif : choisir désarmer, renverser ou affaiblir 1d4 rounds (NC < rang).",
    note: "Attaque + désarmer, renverser ou affaiblir 1d4 rounds ; critique = deux effets.",
  },
  {
    talent: "Défaut dans la cuirasse",
    arme: "distance",
    questionMJ: "Défaut dans la cuirasse : l'analyse est-elle faite ? Au round suivant, les tirs visent DEF 10+AGI et ignorent RD/RM.",
    note: "Analyse (A) : au round suivant, DEF 10+AGI, ignore RD/RM (sauf immatériel).",
  },
  {
    talent: "Tireur d'élite",
    action: "L",
    arme: "distance",
    degatsBonus: ["2d4°"],
    questionMJ: "Tireur d'élite : cible à 10 m ou plus, portée doublée, pas au contact ni instable ?",
    note: "Cible à 10 m+ : +2d4° DM, portée doublée.",
  },
  {
    talent: "Tir fatal",
    action: "L",
    arme: "distance",
    questionMJ: "Tir fatal : NC < moitié du niveau ; test d'INT difficulté 10+NC = mort, sinon DM normaux.",
    note: "1/combat : test d'INT 10+NC pour tuer (NC < moitié du niveau), sinon DM normaux.",
  },
  {
    talent: "As de la gâchette",
    arme: "distance",
    degatsBonus: ["2d4°"],
    questionMJ: "As de la gâchette : le jet d'attaque dépasse-t-il DEF+10 ?",
    note: "Si le jet atteint DEF+10 : +2d4° DM (poudre/arbalète).",
  },
  {
    talent: "Dans le mille",
    arme: "distance",
    degatsBonus: ["2d4°"],
    note: "Déjà couvert par la case Dans le mille (A +2d4°, L +3d4°).",
  },
  {
    talent: "Puissance du ki",
    arme: "mains-nues",
    deMalus: true,
    degatsBonus: ["2d4°"],
    questionMJ: "Puissance du ki : dépenser 1 point de ki pour un dé malus et +2d4° DM à mains nues.",
    note: "Mains nues : dé malus, +2d4° DM (1 point de ki).",
  },
  {
    talent: "Pression mortelle",
    action: "L",
    arme: "mains-nues",
    degatsBonus: ["1d4°"],
    questionMJ: "Pression mortelle : les DM sont comptabilisés puis libérés sur un test de contact dans l'heure.",
    note: "Mains nues : +1d4° DM par attaque, libérés sur test de contact (MJ).",
  },
  {
    talent: "Morsure du serpent",
    arme: "mains-nues",
    note: "Critique 19-20 à mains nues ; critique = cible affaiblie 1 round (déjà appliqué au seuil).",
  },
  {
    talent: "Poings de fer",
    arme: "mains-nues",
    note: "Mains nues : AGI au lieu de FOR en attaque, dé de DM amélioré par le rang (passif).",
  },
  {
    talent: "Griffes du tigre",
    arme: "mains-nues",
    note: "Les 1 aux DM à mains nues deviennent le maximum ; tranchant ou perçant au choix (MJ).",
  },
  {
    talent: "Chasseur émérite",
    arme: "toutes",
    degatsBonus: ["1d4°"],
    questionMJ: "Chasseur émérite : la cible est-elle un animal ou un ennemi juré noté sur la fiche ?",
    note: "+1d4° DM contre animaux et ennemis jurés.",
  },
  {
    talent: "Maître du poison",
    arme: "toutes",
    degatsBonus: ["2d4°"],
    effetSupp: { cle: "affaibli", duree: 2 },
    questionMJ: "Maître du poison : une dose est-elle appliquée (3/jour) ? CON 10+INT pour résister à l'affaiblissement.",
    note: "Arme empoisonnée : +2d4° DM et affaibli (CON 10+INT), 3 doses/jour.",
  },
];
