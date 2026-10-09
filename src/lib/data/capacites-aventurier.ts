import type { VoieDetail } from "./capacites";

// Capacités (talents) des voies Aventurier — résumés du DRS :
//   https://drs.chroniques-oubliees.fr/fantasy/profils
// Les sorts (capacités à PM, *) renvoient au grimoire via sortId. Voir le DRS pour le texte intégral.

export const CAPACITES_AVENTURIER: Record<string, VoieDetail[]> = {
  Arquebusier: [
    {
      voie: "Voie de l'artilleur",
      capacites: [
        { nom: "Mécanismes", rang: 1, resume: "Rang+2 pour réparer/comprendre mécanismes, pièges et sièges ; dé bonus en attaque aux engins de siège." },
        { nom: "Arme à répétition", rang: 2, resume: "Dote 2 armes de chargeurs (2+INT projectiles, +1 par rang 3 atteint dans une voie), recharge limitée par projectile." },
        { nom: "Tir de barrage", rang: 3, resume: "Action limitée : surveille 20 m, attaque à distance contre qui bouge (double DM ou stoppé sans DM)." },
        { nom: "Canon double", rang: 4, resume: "Double le dé de DM (pas les bonus), 2 projectiles, critique ×3, détentes indépendantes (sauf couleuvrine)." },
        { nom: "Couleuvrine", rang: 5, resume: "Action limitée : petit canon portatif (test distance avec dé bonus, 5d4+INT à 100 m, recharge 2 rounds)." },
      ],
    },
    {
      voie: "Voie des explosifs",
      capacites: [
        { nom: "Tir de grenaille", rang: 1, resume: "Action limitée : cône 10×5 m, 1 test contre tous, moitié DM. Rang+2 en artificier." },
        { nom: "Démolition", rang: 2, resume: "3 rounds : 3d4+INT à une structure (RD/2), 2d4 dans 2 m. Charges/jour = rang (partagées piège/boulet)." },
        { nom: "Poudre puissante", rang: 3, resume: "+10 m de portée et +1 DM aux armes à poudre (+1 par rang 5 atteint dans une voie), poudre magique." },
        { nom: "Piège explosif", rang: 4, resume: "1 min : rayon 5 m, 5d4+INT feu (AGI 15 = moitié), détection INT 15+INT." },
        { nom: "Boulet explosif", rang: 5, resume: "Action limitée : 20 m, rayon 5 m, 4d4+INT perforants (/2 si AGI 10), raté = aveuglé 1 round." },
      ],
    },
    {
      voie: "Voie du mercenaire",
      capacites: [
        { nom: "Pilier de bar", rang: 1, resume: "Rang+2 en social de taverne et contre l'alcool ; 1d4 non-létal à mains nues, non-létaux subis divisés par 2." },
        { nom: "Mort-ou-vif", rang: 2, resume: "Action limitée : attaque contact/distance + désarmer, renverser ou affaiblir 1d4 rounds (NC < rang). Critique = 2 effets." },
        { nom: "Combattant aguerri", rang: 3, resume: "Une capacité de rang 1 guerrier/voleur (cuir)/rôdeur (cuir renforcé) + +1 DEF." },
        { nom: "Constitution héroïque", rang: 4, resume: "CON +1 et dé bonus aux tests de CON." },
        { nom: "Combat de masse", rang: 5, resume: "Si 10+ créatures : action d'attaque ou de mouvement supplémentaire + +1 DEF." },
      ],
    },
    {
      voie: "Voie du pistolero",
      capacites: [
        { nom: "Plus vite que son ombre", rang: 1, resume: "Arme chargée en main : +5 Init, pas de malus de tir au contact (sauf couleuvrine)." },
        { nom: "Ajuster le tir", rang: 2, resume: "Après un raté : +5 au prochain tir sur la même cible (avant fin du prochain round)." },
        { nom: "Tir double", rang: 3, resume: "Action limitée : deux pétoires à -2 chacune (aucun malus si même cible)." },
        { nom: "Agilité héroïque", rang: 4, resume: "AGI +1 et dé bonus aux tests d'AGI." },
        { nom: "As de la gâchette", rang: 5, resume: "Attaque ≥ DEF+10 (poudre/arbalète) : +2d4 DM." },
      ],
    },
    {
      voie: "Voie de la précision",
      capacites: [
        { nom: "Joli coup", rang: 1, resume: "Ignore le couvert partiel, couvert important réduit à -2 (au lieu de -5)." },
        { nom: "Défaut dans la cuirasse", rang: 2, resume: "Action d'attaque d'analyse : au round suivant, tirs contre DEF 10+AGI, ignore RD/RM (sauf immatériel)." },
        { nom: "Tir précis", rang: 3, resume: "Critique sur 19-20 à distance (18-20 au rang 5)." },
        { nom: "Tireur d'élite", rang: 4, resume: "Action limitée, cible à 10 m+ : portée doublée, +2d4 DM. Pas au contact ni instable." },
        { nom: "Tir fatal", rang: 5, resume: "Action limitée, NC < moitié niveau : test INT 10+NC = mort, sinon DM normaux." },
      ],
    },
  ],
  Barde: [
    {
      voie: "Voie de l'escrime",
      capacites: [
        { nom: "Précision", rang: 1, resume: "AGI au lieu de FOR en attaque au contact (pas DM) avec arme légère à une main." },
        { nom: "Feinte", rang: 2, resume: "Action limitée : test CHA vs PER, puis +2×rang en attaque (1re attaque contact au round suivant) et +2d4 DM si feinte réussie." },
        { nom: "Intelligence du combat", rang: 3, resume: "Action de mouvement, 1/combat : désarmer, renverser ou aveugler 1 round (NC inférieur, test INT opposé, +5 si feinte au tour précédent)." },
        { nom: "Attaque flamboyante", rang: 4, resume: "Action limitée : attaque légère +CHA en attaque et DM (en plus de FOR/AGI)." },
        { nom: "Botte mortelle", rang: 5, resume: "Attaque légère ≥ DEF+10 : +2d4 DM (non multipliés au critique)." },
      ],
    },
    {
      voie: "Voie du musicien",
      capacites: [
        { nom: "Chant des héros", rang: 1, resume: "Sort : chant (limitée), alliés à portée de voix +1 aux tests pendant CHA minutes (+2 au rang 5).", sortId: "sort-chant-heros" },
        { nom: "Chant du réconfort", rang: 2, resume: "Sort : chant pendant une récupération rapide, alliés dans 10 m récupèrent 1d4 PV (2d4 au rang 4).", sortId: "sort-chant-reconfort" },
        { nom: "Attaque sonore", rang: 3, resume: "Sort d'attaque : cri en cône de 10 m, 2d4+CHA DM (moitié si CON 10+CHA).", sortId: "sort-attaque-sonore" },
        { nom: "Zone de silence", rang: 4, resume: "Sort d'attaque : sphère de silence 5 m (30 m, CHA minutes), INT 10 pour lancer un sort dedans.", sortId: "sort-zone-silence" },
        { nom: "Danse irrésistible", rang: 5, resume: "Sort d'attaque : test opposé (10 m), la cible danse 1d4+CHA rounds (dé malus, -5 DEF).", sortId: "sort-danse-irresistible" },
      ],
    },
    {
      voie: "Voie du saltimbanque",
      capacites: [
        { nom: "Acrobate", rang: 1, resume: "Rang+2 en acrobaties, équilibre, sauts et escalade." },
        { nom: "Grâce féline", rang: 2, resume: "+CHA en Init et +1 DEF (+2 au rang 4), rang+2 en danse, mime et jonglerie." },
        { nom: "Lanceur de couteaux", rang: 3, resume: "Action gratuite, 1/round : couteau à 10 m (test distance, 1d4+AGI, 1d4 au rang 5), même au contact." },
        { nom: "Liberté d'action", rang: 4, resume: "Immunisé à la peur, à l'asservissement mental, à ralenti et immobilisé." },
        { nom: "Esquive acrobatique", rang: 5, resume: "Action gratuite, 1/round : test distance vs attaque = 0 DM (critique = DM normaux)." },
      ],
    },
    {
      voie: "Voie de la séduction",
      capacites: [
        { nom: "Charmant", rang: 1, resume: "Rang+2 en séduction et mensonges ; 1 PC donne +1d4+CHA à l'action d'un compagnon (au lieu de +10)." },
        { nom: "Dentelle et rapière", rang: 2, resume: "Sans armure : +CHA en DEF en plus d'AGI (max = rang)." },
        { nom: "Baratineur de génie", rang: 3, resume: "10 min + humanoïde NC ≤1 : 1 PC pour le charmer durablement (2 PC sans langue commune)." },
        { nom: "Charisme héroïque", rang: 4, resume: "CHA +1, dé bonus en CHA ; peut calculer ses PM avec CHA au lieu de VOL." },
        { nom: "Suggestion", rang: 5, resume: "Sort d'attaque : test opposé, la créature obéit à une suggestion pendant 1 h (niveau inférieur uniquement).", sortId: "sort-suggestion" },
      ],
    },
    {
      voie: "Voie du vagabond",
      capacites: [
        { nom: "Rumeurs et légendes", rang: 1, resume: "Rang+2 en INT pour souvenirs historiques/politiques/occultes et identifier la magie (diff 25-2×niveau)." },
        { nom: "Éclectique", rang: 2, resume: "+1 à tous les tests de compétence (+1 par rang 4 atteint dans une voie)." },
        { nom: "Attirail", rang: 3, resume: "1 PC : sort un objet improbable (≤10 pa) ou bricole avec trois bouts de ficelle." },
        { nom: "Compréhension des langues", rang: 4, resume: "Sort d'attaque : lit, écrit et parle une langue vivante (CHA heures, CHA minutes sur allié ; mortes au rang 5).", sortId: "sort-comprehension-langues" },
        { nom: "Déguisement", rang: 5, resume: "Sort d'attaque : apparence d'un humanoïde proche en taille (CHA heures, test de CHA pour imiter quelqu'un).", sortId: "sort-deguisement" },
      ],
    },
  ],
  Rôdeur: [
    {
      voie: "Voie de l'archer",
      capacites: [
        { nom: "Archer émérite", rang: 1, resume: "+PER aux DM à l'arc et +1 Init par rang (variante lancer : +FOR aux DM, portée doublée, sans Init)." },
        { nom: "Tir chirurgical", rang: 2, resume: "Tir en mêlée sans pénalité, jamais d'allié touché même en critique." },
        { nom: "Dans le mille", rang: 3, resume: "Dé malus en attaque à distance pour +2d4 DM (limitée : +3d4). Cumulable Tir rapide et Flèche de mort." },
        { nom: "Tir rapide", rang: 4, resume: "Action limitée : deux attaques à distance à -2." },
        { nom: "Flèche de mort", rang: 5, resume: "Action limitée : dé bonus + +1d4 DM, ou un état au choix 1 round (NC inférieur, 1/combat chacun)." },
      ],
    },
    {
      voie: "Voie du combat à deux armes",
      capacites: [
        { nom: "Attaque à suivre", rang: 1, resume: "Action gratuite, 1/round : une attaque principale ratée donne une attaque de l'autre main (dague, hachette, épée courte)." },
        { nom: "Parade croisée", rang: 2, resume: "+1 DEF à deux armes (+2 au rang 5, doublé si renonce à la secondaire)." },
        { nom: "Droite-gauche", rang: 3, resume: "Action gratuite, 1/round : attaque principale + secondaire gratuite (dé malus si cible différente). Remplace Attaque à suivre." },
        { nom: "Combattant héroïque", rang: 4, resume: "AGI +1 et dé bonus en AGI, ou FOR +1 (sans dé bonus) + même arme en secondaire sans malus." },
        { nom: "Double peine", rang: 5, resume: "Deux armes touchant la même cible au même tour : +1d4 DM à l'une." },
      ],
    },
    {
      voie: "Voie du compagnon animal",
      capacites: [
        { nom: "Le loup", rang: 1, resume: "Compagnon loup (DEF 12+rang, PV niv×4, contact 1d4+2), ordres simples. Fuit à 0 PV en nature (revient en 8 h)." },
        { nom: "Travail d'équipe", rang: 2, resume: "Au contact : loup en dé bonus d'attaque, rôdeur en dé bonus de pistage et anti-surprise." },
        { nom: "Lien empathique", rang: 3, resume: "Action limitée : télépathie + soigne le loup avec ses propres PV (1 pour 1)." },
        { nom: "Loup alpha", rang: 4, resume: "Spécimen puissant (DEF 12+rang, PV niv×4, 1d4+5)." },
        { nom: "Tactiques de meute", rang: 5, resume: "Même cible : loup +1d4 DM, PV donnés doublés, +1 DEF chacun par rang 5 atteint dans une voie (incluse)." },
      ],
    },
    {
      voie: "Voie de la survie",
      capacites: [
        { nom: "Survie", rang: 1, resume: "Rang+2 en escalade et survie nature (dont récupération) ; la nuit en nature, 1 DR dépensé = +1d4 PV." },
        { nom: "Nature nourricière", rang: 2, resume: "1/jour, 1d6 h en nature sauvage : nourriture pour rang personnes + plantes (PER 10) soignant 1d4 PV par rang." },
        { nom: "Grand pas", rang: 3, resume: "Action gratuite, en nature : +1 DEF (+2 au rang 5), +10 m gratuits, ignore les terrains difficiles." },
        { nom: "Constitution héroïque", rang: 4, resume: "CON +1 et dé bonus aux tests de CON." },
        { nom: "Increvable", rang: 5, resume: "Action limitée, 1/combat : à 0 PV, récupère 4d4+CON au prochain tour, +5 DEF 1 round, purge des états non permanents." },
      ],
    },
    {
      voie: "Voie du traqueur",
      capacites: [
        { nom: "Éclaireur", rang: 1, resume: "En nature : rang+2 en discrétion, vigilance et pistage ; peut prendre +1 DR au lieu de +1 PC aventurier." },
        { nom: "Attaque éclair", rang: 2, resume: "Action limitée : attaque contact très rapide (+AGI en attaque et DM, +10 m au rang 5)." },
        { nom: "Chasseur émérite", rang: 3, resume: "+1d4 DM contre les animaux (+ un ennemi juré par rang 5 atteint dans une voie)." },
        { nom: "Perception héroïque", rang: 4, resume: "PER +1 et dé bonus aux tests de PER." },
        { nom: "Repli", rang: 5, resume: "Action limitée, en nature : 30 m + test AGI 10 (15 à découvert) pour disparaître." },
      ],
    },
  ],
  Voleur: [
    {
      voie: "Voie de l'assassin",
      capacites: [
        { nom: "Discrétion", rang: 1, resume: "Rang+2 en discrétion, déguisement et armes cachées + argot des voleurs + dé bonus contre surpris." },
        { nom: "Attaque sournoise", rang: 2, resume: "Action limitée, 1/round : surpris ou de dos, arme légère = +2d4 DM (+1d4 par rang 4 atteint, max 7d4 ; /2 sinon)." },
        { nom: "Attaque par surprise", rang: 3, resume: "Action d'attaque : sournoise contre surpris (pas limitée) + +2d4 DM." },
        { nom: "Disparition", rang: 4, resume: "Action de mouvement, 1/combat : disparaît (sauf DM de zone), réapparaît à ≤20 m (+ sournoise si init)." },
        { nom: "Ouverture mortelle", rang: 5, resume: "Action limitée, 1/combat : critique automatique + sournoise (non doublée)." },
      ],
    },
    {
      voie: "Voie de l'aventurier",
      capacites: [
        { nom: "Baratin", rang: 1, resume: "Rang+2 en baratin, séduction et marché noir + utilise parchemins et baguettes (test magique diff 10+2×rang)." },
        { nom: "Provocation", rang: 2, resume: "Action limitée : CHA vs INT (humanoïde 10 m) le force à l'attaquer + riposte gratuite (sournoise ou +1d4)." },
        { nom: "Souplesse du félin", rang: 3, resume: "+2 DEF et Init (+3 au rang 5), se relever en mouvement." },
        { nom: "Charisme héroïque", rang: 4, resume: "CHA +1 et dé bonus aux tests de CHA." },
        { nom: "Attaque paralysante", rang: 5, resume: "Action limitée, 1/combat : attaque contact sans DM, humanoïde immobilisé 1d4 rounds (paralysé si NC < moitié niveau)." },
      ],
    },
    {
      voie: "Voie du déplacement",
      capacites: [
        { nom: "Agile", rang: 1, resume: "Rang+2 aux déplacements (esquive, saut, course, escalade...) + +1 DEF et Init (+2 rang 3, +3 rang 5)." },
        { nom: "Réflexes félins", rang: 2, resume: "DM de chute divisés par 2, +1 mouvement gratuit/combat (2 au rang 5, max 1/round)." },
        { nom: "Acrobaties", rang: 3, resume: "Action gratuite, 1/round : AGI 15 pour franchir ou attaquer de dos (+sournoise ou +1d4)." },
        { nom: "Agilité héroïque", rang: 4, resume: "AGI +1 et dé bonus aux tests d'AGI." },
        { nom: "Esquive de la magie", rang: 5, resume: "Action gratuite, 1/round : test distance opposé à la magie pour échapper à un sort à DM." },
      ],
    },
    {
      voie: "Voie du roublard",
      capacites: [
        { nom: "Doigts agiles", rang: 1, resume: "Rang+2 en précision manuelle et évaluation + +1 DM aux dagues à distance (+2 rang 3, +3 rang 5)." },
        { nom: "Aux aguets", rang: 2, resume: "Rang+2 en fouille, pièges (même magiques), passages et embuscades ; DM de pièges divisés par 2." },
        { nom: "Feindre la mort", rang: 3, resume: "Action gratuite, 1/combat : passe pour mort (INT 20 pour percer), se relève avec 1d4 PV + adversaire surpris." },
        { nom: "Expert en criminalité", rang: 4, resume: "Dé bonus en indices et fausses pistes + 1 PC pour obtenir du MJ un indice manqué (non dépensé si aucun)." },
        { nom: "Maître du poison", rang: 5, resume: "3 doses/jour sans risque : arme +2d4 DM + affaibli (CON 10+INT), ou nourriture = inconscience 2d6 min." },
      ],
    },
    {
      voie: "Voie du spadassin",
      capacites: [
        { nom: "Attaque en finesse", rang: 1, resume: "+AGI en Init, AGI au lieu de FOR en attaque légère 1 main (pas DM), rang+2 en intimidation." },
        { nom: "Esquive fatale", rang: 2, resume: "Action gratuite, 1/combat : redirige une attaque vers un autre adversaire au contact (pas les critiques)." },
        { nom: "Frappe chirurgicale", rang: 3, resume: "Critique légère à 18-20 (min 16)." },
        { nom: "Ambidextrie", rang: 4, resume: "Action gratuite : attaque main gauche (dague/épée courte, sans sournoise) chaque round." },
        { nom: "Botte secrète", rang: 5, resume: "Critique légère main principale : un état au choix 1 round (1/combat chacun) ou sournoise ajoutée au critique." },
      ],
    },
  ],
};
