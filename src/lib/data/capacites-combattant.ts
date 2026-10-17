import type { VoieDetail } from "./capacites";

// Capacités (talents) des voies Combattant — résumés du DRS :
//   https://drs.chroniques-oubliees.fr/fantasy/profils
// Aucun sort à PM dans ces voies : que des talents. Voir le DRS pour le texte intégral.

export const CAPACITES_COMBATTANT: Record<string, VoieDetail[]> = {
  Barbare: [
    {
      voie: "Voie de la brute",
      capacites: [
        { nom: "Argument de taille", rang: 1, resume: "Ajoute sa FOR au max de PV et aux tests de CHA (négociation, persuasion, intimidation), alliés au contact inclus." },
        { nom: "Tour de force", rang: 2, resume: "Action gratuite : +10 à un test de FOR (pas DM ni attaque) pour 1d4 PV. Peut porter la chemise de mailles avec ses voies." },
        { nom: "Attaque brutale", rang: 3, resume: "Action limitée : contact +1d4 DM, ou -3 en attaque pour +2d4. Peut sacrifier des DM pour reculer (3 m) ou renverser (NC < rang)." },
        { nom: "Force héroïque", rang: 4, resume: "FOR +1 et dé bonus aux tests de FOR." },
        { nom: "Briseur d'os", rang: 5, resume: "Critique au contact sur 19-20, doublé + étourdi 1 round. Peut porter la cotte de mailles avec ses voies." },
      ],
    },
    {
      voie: "Voie du pagne",
      capacites: [
        { nom: "Vigueur", rang: 1, resume: "Rang+2 aux tests de course, saut et escalade, +1 PV par rang atteint dans la voie." },
        { nom: "Peau de pierre", rang: 2, resume: "Peut remplacer AGI par CON pour calculer sa DEF (limite d'armure sur CON). Sinon +1 DEF (+2 au rang 4)." },
        { nom: "Tatouages", rang: 3, resume: "Tatouage magique au choix : +3 aux tests d'une caractéristique. L'état étourdi devient ralenti." },
        { nom: "Constitution héroïque", rang: 4, resume: "CON +1 et dé bonus aux tests de CON." },
        { nom: "Peau d'acier", rang: 5, resume: "Réduit tous les DM subis de 3 (RD 3, minimum 1 DM)." },
      ],
    },
    {
      voie: "Voie du pourfendeur",
      capacites: [
        { nom: "Réflexes éclair", rang: 1, resume: "Rang+2 en AGI pour esquiver, +3 en Init et +1 en DEF (+2 au rang 5)." },
        { nom: "Charge", rang: 2, resume: "Action limitée : charge de 5 à 10 m en ligne droite, attaque au contact avec dé bonus et +1d4 DM. Pas au contact." },
        { nom: "Enchaînement", rang: 3, resume: "Adversaire réduit à 0 PV au contact : signal ⚔ poussé automatiquement sur la ligne (lancer = attaque gratuite sur un autre au contact, contact au MJ)." },
        { nom: "Déchaînement d'acier", rang: 4, resume: "Action limitée : traverse 10 m en ligne droite, une attaque à -2 contre chaque adversaire sur le passage." },
        { nom: "Attaque tourbillon", rang: 5, resume: "Action limitée, 1/combat : DM de l'arme automatiques à toutes les cibles dans 5 m." },
      ],
    },
    {
      voie: "Voie du primitif",
      capacites: [
        { nom: "Proche de la nature", rang: 1, resume: "Rang+2 en survie (dont récupération) et discrétion en milieu naturel, +1 PV." },
        { nom: "Armure de vent", rang: 2, resume: "Sans armure : se relever en mouvement et +2 DEF (+3 au rang 5). Avec armure : +1 DEF." },
        { nom: "Vigilance", rang: 3, resume: "Rang+2 pour détecter pièges et embuscades. Immunisé aux attaques sournoises (niveau inférieur)." },
        { nom: "Résistance à la magie", rang: 4, resume: "Action gratuite, 1/round : test d'attaque magique opposé pour ignorer un sort qui le cible (dé malus si hybride lanceur)." },
        { nom: "Vitalité débordante", rang: 5, resume: "Entre 1 et un tiers de ses PV max : récupère 1d4 PV par heure, jour et nuit." },
      ],
    },
    {
      voie: "Voie de la rage",
      capacites: [
        { nom: "Cri de guerre", rang: 1, resume: "Action gratuite, 1/combat : hurlement (10 m), FOR inférieure = dé malus aux attaques au contact. Sans peur : rang+2 en VOL contre la peur." },
        { nom: "Défier la mort", rang: 2, resume: "1/combat : des DM qui mettraient à 0 PV deviennent 1 PV sur test de CON diff 10 (automatique si enragé)." },
        { nom: "Rage du berserk", rang: 3, resume: "Action limitée, 1/jour : rage jusqu'à la fin du combat (+1d4 DM au contact, -2 DEF, pas de fuite ni distance, dé bonus en VOL). Ni sorts ni concentration en rage." },
        { nom: "Même pas mal", rang: 4, resume: "1/combat : ignore les DM d'un critique et entre en Rage en action gratuite." },
        { nom: "Furie du berserk", rang: 5, resume: "Action limitée (coûte 2 rages) : +2d4 DM au lieu d'1d4, -4 DEF, fin prématurée sur VOL 20." },
      ],
    },
  ],
  Chevalier: [
    {
      voie: "Voie du cavalier",
      capacites: [
        { nom: "Fidèle monture", rang: 1, resume: "Cheval de guerre dressé (DEF 12+rang, PV 10+niv×4, ruade 1d4+5) : +10 m de déplacement à cheval, rang+2 en équitation. Remplacée au niveau suivant." },
        { nom: "Cavalier émérite", rang: 2, resume: "En selle : +1 DM au contact (+2 au rang 5), monture à sa DEF, monter/descendre en action gratuite." },
        { nom: "Charge", rang: 3, resume: "Action limitée, à cheval : charge de 10 à 20 m + attaque placée (dé bonus, +1d4 DM). Bloqueur : FOR 20 ou passage cédé." },
        { nom: "Monture magique", rang: 4, resume: "Monture invocable depuis un autre plan (action limitée), guérit tout en 1 h dans son plan." },
        { nom: "Monture fantastique", rang: 5, resume: "Monture puissante (DEF 20, PV 10+niv×6, 2d4+5, attaque gratuite 1/round en selle). Volante dès le niveau 9 (MJ)." },
      ],
    },
    {
      voie: "Voie de la guerre",
      capacites: [
        { nom: "Armure sur mesure", rang: 1, resume: "La DEF d'armure lourde ne compte que moitié dans les pénalités ; +1 DEF en lourde par rang 5 atteint dans une voie." },
        { nom: "Encaisser un coup", rang: 2, resume: "Action de mouvement : retranche la DEF de l'armure aux DM d'une attaque au contact (min 1), ni étourdi ni renversé. Rang 5 : + bouclier." },
        { nom: "Frappe du justicier", rang: 3, resume: "Action limitée : une attaque au contact ratée inflige quand même la moitié des DM (1 naturel = rien)." },
        { nom: "Force héroïque", rang: 4, resume: "FOR +1 et dé bonus aux tests de FOR." },
        { nom: "Mon armure est une arme", rang: 5, resume: "Action gratuite, 1/combat : coup d'armure automatique (1d4+FOR), cible de FOR inférieure renversée, étourdie 1 round ou reculée de 3 m." },
      ],
    },
    {
      voie: "Voie du meneur d'hommes",
      capacites: [
        { nom: "Sans peur", rang: 1, resume: "Immunisé à la peur, alliés +CHA contre la peur, rang+2 en stratégie et commandement." },
        { nom: "Intercepter", rang: 2, resume: "Action gratuite, 1/round : encaisse une attaque (contact ou distance) d'un allié au contact (sa DEF, -rang aux DM)." },
        { nom: "Exemplaire", rang: 3, resume: "Action gratuite, 1/round : donne un dé bonus à un allié attaquant un adversaire à son contact." },
        { nom: "Charge fantastique", rang: 4, resume: "Action gratuite, 1/combat : alliés en vue + lui : +10 m de déplacement puis dé bonus et +1d4 DM aux attaques." },
        { nom: "Ordre de bataille", rang: 5, resume: "Action gratuite, 1/round : offre une action gratuite (mouvement ou attaque) à un allié en vue (1/combat par allié)." },
      ],
    },
    {
      voie: "Voie de la noblesse",
      capacites: [
        { nom: "Éduqué", rang: 1, resume: "Sait lire, écrire et parler une langue de plus ; rang+2 en histoire, héraldique, géographie et mondanités." },
        { nom: "Écuyer", rang: 2, resume: "Serviteur loyal (DEF 10+rang, PV niv×4, 1d4+1) : critique au contact sur 19-20, +1d4 PV après récupération complète (monture + CHA alliés)." },
        { nom: "Autorité naturelle", rang: 3, resume: "Rang+2 pour donner des ordres ou intimider ; maîtrise la plaque complète (+7) utilisable avec ses voies." },
        { nom: "Massacrer la piétaille", rang: 4, resume: "+1d4 DM contre la piétaille (4+ créatures semblables, jamais les cavaliers)." },
        { nom: "Formation d'élite", rang: 5, resume: "Une capacité de rang 1 à 3 d'un profil combattant ou aventurier, + dé bonus dans une caractéristique au choix." },
      ],
    },
    {
      voie: "Voie du preux",
      capacites: [
        { nom: "Ignorer la douleur", rang: 1, resume: "Action gratuite, 1/combat : reporte les DM d'une attaque (non critique) à la fin du combat. Rang+2 pour haranguer les foules." },
        { nom: "Piqûres d'insectes", rang: 2, resume: "RD contre attaques à distance selon l'armure (plaque 3, intermédiaire 2, cuir 1), minimum 1 DM." },
        { nom: "Laissez-le-moi", rang: 3, resume: "+1d4 DM au contact contre le leader identifié (4+ créatures) ; blessé : INT 15 ou il ne l'attaque que lui." },
        { nom: "Charisme héroïque", rang: 4, resume: "CHA +1 et dé bonus aux tests de CHA." },
        { nom: "Seul contre tous", rang: 5, resume: "Si 3+ adversaires l'attaquent au contact au round : action d'attaque supplémentaire." },
      ],
    },
  ],
  Guerrier: [
    {
      voie: "Voie du bouclier",
      capacites: [
        { nom: "Protéger un allié", rang: 1, resume: "Bouclier requis. Action gratuite (G) : mod. DEF du bouclier à un allié au contact contre la prochaine attaque (1/round, annoncer avant le résultat) ; le guerrier garde son bonus ; pas si surpris. Rang+2 anti-surprise (MJ)." },
        { nom: "Parer un coup", rang: 2, resume: "Bouclier requis. (M) : posture — la prochaine attaque réussie (contact ou distance, pas les touches auto) est bloquée sur test opposé d'attaque au contact auto (niv + FOR/AGI + arme + mods). Énorme/colossale : moitié DM (MJ). Rang 5 : (G) 1/round avec dé malus (MJ)." },
        { nom: "Défense au bouclier", rang: 3, resume: "Bouclier manié requis. Passif : +1 DEF auto (+2 au rang 5) ; -rang aux DM de zone et souffles, sauf surpris." },
        { nom: "Absorber un sort", rang: 4, resume: "Bouclier requis. Remplace une parade préparée : test d'attaque au contact (FOR/AGI) opposé à l'attaque magique ; sort annulé sur le guerrier et absorbé par le bouclier (zones : autres affectés). Stocké pour Renvoi." },
        { nom: "Renvoi de sort", rang: 5, resume: "Bouclier requis. Action gratuite (G) : renvoie le sort absorbé contre son lanceur, effets appliqués (zones rejouées en mono-cible, MJ)." },
      ],
    },
    {
      voie: "Voie du combat",
      capacites: [
        { nom: "Vivacité", rang: 1, resume: "Passif : +3 Init auto et +3 pour éviter immobilisé/renversé (MJ), +1 mouvement/combat (MJ, réel)." },
        { nom: "Manœuvre", rang: 2, resume: "Dé bonus aux manœuvres en combat (MJ : jets manuels)." },
        { nom: "Attaque puissante", rang: 3, resume: "Avec une attaque (A) : dé malus + +2d4° DM (cumulable Double, Circulaire, Parfaite). En limitée (L) : +3d4°. Cocher dans le panneau Attaque." },
        { nom: "Double attaque", rang: 4, resume: "Action limitée (L) : deux attaques au contact à -2 (saisir -2 en Mod. attaque, 2 lancers)." },
        { nom: "Attaque circulaire", rang: 5, resume: "Action limitée (L) : une attaque à -2 par adversaire au contact (saisir -2, 1 lancer chacun)." },
      ],
    },
    {
      voie: "Voie du maître d'armes",
      capacites: [
        { nom: "Armes de prédilection", rang: 1, resume: "Catégorie au choix (MJ : annoncer, ex. haches) : +1 en attaque auto si la fiche porte la famille (Éditer : Maître d'armes) + rang+2 pour estimer armes et réputations (MJ). Mains nues incluses (correction LDB)." },
        { nom: "Science du critique", rang: 2, resume: "Avec prédilection : critique 19-20 auto (fiche : famille + talent) ; bouton secours MJ pour arme non posée." },
        { nom: "Spécialisation", rang: 3, resume: "Avec prédilection : +1 DM auto (Éditer : Spécialisation) ; +1 par rang 5 en voie, max +6, ou nouvelle catégorie (MJ)." },
        { nom: "Attaque parfaite", rang: 4, resume: "Action limitée (L), prédilection : dé bonus + +1d4° DM, cocher dans le panneau (ou désarmer si NC < bonus de spécialisation, MJ)." },
        { nom: "Riposte", rang: 5, resume: "Action gratuite (G) : un adversaire qui rate au contact est signalé pour riposte immédiate (1/round, MJ : attaque manuelle)." },
      ],
    },
    {
      voie: "Voie de la résistance",
      capacites: [
        { nom: "Robustesse", rang: 1, resume: "Passif : PV max +rang+2 auto (+3 au rang 1) ; rang+2 contre efforts, chaleur, froid (MJ)." },
        { nom: "Résilient", rang: 2, resume: "Récupération rapide en 10 min (5 au rang 4, MJ : narratif), +rang contre étourdi et affaibli (MJ)." },
        { nom: "Armure lourde", rang: 3, resume: "Au choix (MJ) : +1 DEF (Éditer) OU maîtrise de la plaque (+6) utilisable avec ses voies (hybride : catégorie au-dessus)." },
        { nom: "Constitution héroïque", rang: 4, resume: "CON +1 (Éditer) et dé bonus aux tests de CON (MJ)." },
        { nom: "Dur à cuire", rang: 5, resume: "+1 DEF auto ; 1/combat agit encore 1 round à 0 PV (MJ) ; étourdi/immobilisé : attaque avec dé malus (MJ)." },
      ],
    },
    {
      voie: "Voie du soldat",
      capacites: [
        { nom: "Teigneux", rang: 1, resume: "Action gratuite (G), 1/round : un fuyard au contact subit une attaque (bouton ⚔+ sur la ligne, puis ⚔ pour lancer ; Rempart : AGI+2/manche). Rang+2 contre alcool et privations (MJ)." },
        { nom: "Prouesse", rang: 2, resume: "Action gratuite (G), 1/round : sacrifier 1d4° PV pour +5 à un test de FOR ou CON, même après le jet (MJ : tests et PV manuels)." },
        { nom: "Piqûre de rappel", rang: 3, resume: "Action gratuite (G), 1/round : un adversaire au contact qui attaque un autre subit une attaque — signal ⚔ automatique sur la ligne (contact au MJ). INT négative + DM = focus." },
        { nom: "Force héroïque", rang: 4, resume: "FOR +1 (Éditer) et dé bonus aux tests de FOR (MJ)." },
        { nom: "Rempart", rang: 5, resume: "+1 DEF auto ; Teigneux contre AGI+2 adversaires/round, déplacement stoppé si touché (MJ)." },
      ],
    },
  ],
};
