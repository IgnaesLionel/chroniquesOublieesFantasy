import type { VoieDetail } from "./capacites";

// Capacités (talents) des voies Mystique — résumés du DRS :
//   https://drs.chroniques-oubliees.fr/fantasy/profils
// Les sorts (capacités à PM, *) renvoient au grimoire via sortId. Voir le DRS pour le texte intégral.

export const CAPACITES_MYSTIQUE: Record<string, VoieDetail[]> = {
  Druide: [
    {
      voie: "Voie des animaux",
      capacites: [
        { nom: "Langage des animaux", rang: 1, resume: "Communique avec les mammifères (+ une catégorie par rang 4), rang+2 pour les influencer." },
        { nom: "Petit compagnon", rang: 2, resume: "Familier non combattant (DEF 13+rang, PV niv×2) : sens partagés, +2 DEF en vue. Fuit à 0 PV (revient en 24 h)." },
        { nom: "Nuée d'insectes", rang: 3, resume: "Sort d'attaque : test magique contre DEF (20 m), 1 DM/round et -2 aux tests pendant 3+PER rounds.", sortId: "sort-nuee-insectes" },
        { nom: "Masque du prédateur", rang: 4, resume: "Sort d'attaque : traits de fauve (PER minutes), +2 Init, DEF, attaque et DM au contact, vision nocturne.", sortId: "sort-masque-predateur" },
        { nom: "Forme animale", rang: 5, resume: "Sort d'attaque : forme d'un animal connu (PER minutes), garde PV/INT/VOL, ni équipement ni capacités.", sortId: "sort-forme-animale" },
      ],
    },
    {
      voie: "Voie du fauve",
      capacites: [
        { nom: "Vitesse du félin", rang: 1, resume: "Rang+2 en course, escalade et saut, +3 Init, +1 DEF (+2 rang 3, +3 rang 5)." },
        { nom: "Panthère", rang: 2, resume: "Compagne obéissante (DEF 13+rang, PV niv×4, contact 1d4+2)." },
        { nom: "Attaque bondissante", rang: 3, resume: "Action limitée : charge de 5 à 10 m (druide ou félin), dé bonus et +1d4 DM. Pas au contact." },
        { nom: "Grand félin", rang: 4, resume: "Monture télépathe (DEF 15+rang, PV niv×5, 1d4+5), soignée avec les PV du druide." },
        { nom: "Les sept vies du chat", rang: 5, resume: "6 utilisations max (1/niveau) : ignore mort ou inconscience (scène convenue avec le MJ)." },
      ],
    },
    {
      voie: "Voie de la nature",
      capacites: [
        { nom: "Maître de la survie", rang: 1, resume: "En nature : rang+2 en survie (dont récupération) ; la nuit, 1 DR dépensé = +1d4 PV." },
        { nom: "Terrains difficiles", rang: 2, resume: "Aucune pénalité de déplacement, +3 en Init, +1 en attaque et DEF en conditions difficiles." },
        { nom: "Bâton de druide", rang: 3, resume: "Action limitée : deux attaques (FOR ou AGI) à 1d4+FOR/AGI + +2 DEF pendant 1 round." },
        { nom: "Constitution héroïque", rang: 4, resume: "CON +1 et dé bonus aux tests de CON." },
        { nom: "Résistant", rang: 5, resume: "DM naturels non magiques divisés par 2 (froid, feu, chutes, poisons, animaux), compagnons inclus." },
      ],
    },
    {
      voie: "Voie du protecteur",
      capacites: [
        { nom: "Baies magiques", rang: 1, resume: "Sort (limitée) : PER fruits (1/jour par personnage), repas + 1d4+rang PV après 1 min.", sortId: "sort-baies-magiques" },
        { nom: "Forêt vivante", rang: 2, resume: "Sort : rituel 30 min, 1/jour, la forêt s'éveille (1 km par rang, 24 h), ennemis ralentis et gênés.", sortId: "sort-foret-vivante" },
        { nom: "Régénération", rang: 3, resume: "Sort : rituel 10 min au toucher, 3d4+PER PV (membres au rang 5). 1/jour par cible.", sortId: "sort-regeneration" },
        { nom: "Perception héroïque", rang: 4, resume: "PER +1, dé bonus en PER, et ajoute sa PER aux PM (en plus de VOL)." },
        { nom: "Forme d'arbre", rang: 5, resume: "Sort d'attaque : devient un arbre animé (PER minutes, PV de l'arbre), sorts du protecteur et des végétaux lançables.", sortId: "sort-forme-arbre" },
      ],
    },
    {
      voie: "Voie des végétaux",
      capacites: [
        { nom: "Peau d'écorce", rang: 1, resume: "Sort (mouvement) : +2 DEF (PER minutes, +1 rangs 3 et 5). Ni armure métallique ni autre protection.", sortId: "sort-peau-ecorce" },
        { nom: "Prison végétale", rang: 2, resume: "Sort (limitée) : végétation bloque les ennemis (zone 10 m, 20 m, PER minutes), FOR 10+PER pour se libérer.", sortId: "sort-prison-vegetale" },
        { nom: "Flèche vivante", rang: 3, resume: "Sort d'attaque : flèche enchantée (arc, test distance), DM habituels puis 3d4 DM au round suivant.", sortId: "sort-fleche-vivante" },
        { nom: "Animation d'un arbre", rang: 4, resume: "Sort (limitée) : anime un arbre au toucher (niveau rounds, DEF 10+rang, PV niv×5, 1d4+3). Un seul à la fois.", sortId: "sort-animation-arbre" },
        { nom: "Porte végétale", rang: 5, resume: "Sort d'attaque : 1/jour, entre dans un arbre et ressort d'un autre (max PER×10 km).", sortId: "sort-porte-vegetale" },
      ],
    },
  ],
  Prêtre: [
    {
      voie: "Voie de la foi",
      capacites: [
        { nom: "Prédicateur", rang: 1, resume: "Rang+2 pour convaincre ou convertir + 1 PC/jour si conversion réussie." },
        { nom: "Miracle mineur", rang: 2, resume: "Sort d'attaque : petit miracle (purifie, apaise, soigne bénin) ou 1d4 PV à 0 PV.", sortId: "sort-miracle-mineur" },
        { nom: "Arme de lumière", rang: 3, resume: "Sort (mouvement ; limitée sur allié au rang 5) : arme enchantée (CHA minutes), lumière 5 m, dé bonus et +1d4 DM contre démons et morts-vivants (+2d4 au rang 5 sur soi). Fin si l'arme quitte les mains.", sortId: "sort-arme-lumiere" },
        { nom: "Ailes célestes", rang: 4, resume: "Sort d'attaque : vol à vitesse normale pendant CHA minutes.", sortId: "sort-ailes-celestes" },
        { nom: "Foudres divines", rang: 5, resume: "Sort d'attaque : foudre sur cibles désignées dans 10 m (2d4+CHA, sans test). Coût +1 PM par utilisation avant récup rapide.", sortId: "sort-foudres-divines" },
      ],
    },
    {
      voie: "Voie de la guerre sainte",
      capacites: [
        { nom: "Arme bénie", rang: 1, resume: "Sort d'attaque : rituel, arme bénie 24 h (relance les 1 aux DM, DM magiques, perdue si prêtée).", sortId: "sort-arme-benie" },
        { nom: "Bouclier de la foi", rang: 2, resume: "Symbole sur le bouclier : +1 DEF (+2 au rang 5), inutile à autrui." },
        { nom: "Châtiment divin", rang: 3, resume: "Action limitée : contact avec dé bonus + +CHA DM ; 1 PM = +1d4 (2 PM = +2d4 au rang 5)." },
        { nom: "Marteau de la foi", rang: 4, resume: "Sort d'attaque : test magique (30 m), 2d4+CHA DM (+1 par rang 4 atteint dans une autre voie).", sortId: "sort-marteau-foi" },
        { nom: "Mot de pouvoir", rang: 5, resume: "Sort d'attaque, 1/jour : ennemis dans 10 m étourdis 1 round (pas d'action, -5 DEF).", sortId: "sort-mot-pouvoir" },
      ],
    },
    {
      voie: "Voie de la prière",
      capacites: [
        { nom: "Bénédiction", rang: 1, resume: "Sort (limitée) : chant, alliés en vue +1 aux tests et attaques pendant CHA minutes (+2 au rang 5). Rang+2 en théologie et cosmologie (MJ).", sortId: "sort-benediction" },
        { nom: "Sanctuaire", rang: 2, resume: "Sort (limitée) : 10 rounds, attaquer le prêtre exige INT 10+CHA (auto si niveau < moitié). Fin sur action offensive, relançable après récup rapide (MJ).", sortId: "sort-sanctuaire" },
        { nom: "Destruction du mal", rang: 3, resume: "Sort d'attaque : morts-vivants et démons dans 10 m subissent 2d4+CHA automatiques (3d4 au rang 5).", sortId: "sort-destruction-mal" },
        { nom: "Volonté héroïque", rang: 4, resume: "VOL +1 et dé bonus aux tests de VOL." },
        { nom: "Intervention divine", rang: 5, resume: "Action gratuite, 1/combat : impose réussite ou échec d'un test (même après les dés), pas NC > niveau." },
      ],
    },
    {
      voie: "Voie des soins",
      capacites: [
        { nom: "Récupération mineure", rang: 1, resume: "Sort d'attaque : mains au contact (ou soi), 1d4+CHA PV. 1/jour par rang (+1 par rang 3 atteint dans une autre voie). Rang+2 en médecine et premiers soins (MJ).", sortId: "sort-recuperation-mineure" },
        { nom: "Vigueur divine", rang: 2, resume: "Guérit poison ou maladie au contact (+ test magique si surnaturel), rang+2 contre maladies et poisons." },
        { nom: "Récupération majeure", rang: 3, resume: "Sort (limitée) : soigne à 20 m (ou soi), 3d4+CHA PV (+1d4 par rang 5 atteint dans une voie).", sortId: "sort-recuperation-majeure" },
        { nom: "Phénix", rang: 4, resume: "1/jour : à 0 PV se relève + onde de 2d4+CHA aux alliés dans 20 m, lui le double." },
        { nom: "Rétablissement", rang: 5, resume: "Sort : 1/jour, 10 min, soigne une créature par point de CHA (effet majeure chacune), patients au repos dans 5 m.", sortId: "sort-retablissement" },
      ],
    },
    {
      voie: "Voie de la spiritualité",
      capacites: [
        { nom: "Vêtements sacrés", rang: 1, resume: "Sans armure (bouclier OK) : dé bonus contre contrôle mental + +2 DEF (+3 rang 3, +4 rang 5). Variante cotte de mailles (divinité guerrière)." },
        { nom: "Augure", rang: 2, resume: "Sort (limitée) : avis de l'au-delà sur une action (CHA 10) — bénéfique, incertain, risqué ou préjudiciable.", sortId: "sort-augure" },
        { nom: "Délivrance", rang: 3, resume: "Sort (limitée) : au toucher, annule pénalités et états (pas mutilations ; test opposé si permanent).", sortId: "sort-delivrance" },
        { nom: "Charisme héroïque", rang: 4, resume: "CHA +1 et dé bonus aux tests de CHA." },
        { nom: "Marche des plans", rang: 5, resume: "Sort (limitée), 1/jour : voyage inter-plans (10 km/round, max CHA rounds, sortie à 1d6 km près).", sortId: "sort-marche-plans" },
      ],
    },
  ],
  Moine: [
    {
      voie: "Voie de l'énergie vitale",
      capacites: [
        { nom: "Mains d'énergie", rang: 1, resume: "Action limitée : mains intangibles, attaque mains nues à rang+2. Toutes mains nues = magiques, FOR remplaçable par VOL aux DM." },
        { nom: "Projection de ki", rang: 2, resume: "Action limitée : test magique à 20 m, 1d4+VOL DM (2d4+VOL au rang 4)." },
        { nom: "Invulnérable", rang: 3, resume: "Moitié DM élémentaires, poisons et maladies (immunisé poisons/maladies au rang 5)." },
        { nom: "Pression mortelle", rang: 4, resume: "Action de mouvement : mains nues, DM comptabilisés +1d4/attaque puis libérés sur test contact (limitée) dans l'heure." },
        { nom: "Ascétisme", rang: 5, resume: "Subsiste 5+VOL jours sans eau ni sommeil + CON +1 et dé bonus en CON." },
      ],
    },
    {
      voie: "Voie de la maîtrise",
      capacites: [
        { nom: "Agilité du singe", rang: 1, resume: "Rang+2 en acrobaties et esquive, +2 DEF (+3 au rang 4), se relever gratuit." },
        { nom: "Griffes du tigre", rang: 2, resume: "Les 1 aux DM mains nues deviennent max ; tranchants ou perçants au choix." },
        { nom: "Morsure du serpent", rang: 3, resume: "Critique mains nues sur 19-20, et critique = affaibli 1 round." },
        { nom: "Fureur du dragon", rang: 4, resume: "Action limitée, 1/combat : 3d4+FOR automatiques à tous au contact + FOR 10 ou renversés." },
        { nom: "Moment de perfection", rang: 5, resume: "1/jour (1/combat max) : toutes attaques réussies + toutes esquivées 1 round + +1 à la plus faible carac." },
      ],
    },
    {
      voie: "Voie de la méditation",
      capacites: [
        { nom: "Pacifisme", rang: 1, resume: "Sans action offensive : +5 DEF, DM subis divisés par 2 + rang+2 en empathie et apaisement." },
        { nom: "Transe de guérison", rang: 2, resume: "Médite 10 min : 1d4+VOL PV (+1d4 par rang 4 atteint dans une voie), max 3/jour, récup rapide entre." },
        { nom: "Maîtrise du ki", rang: 3, resume: "+VOL en Init et PV, +2 DEF (+3 au rang 5)." },
        { nom: "Volonté héroïque", rang: 4, resume: "VOL +1 et dé bonus aux tests de VOL." },
        { nom: "Projection mentale", rang: 5, resume: "Action limitée, 1/jour : esprit projeté 1d4+VOL min (vol 10 m/round, traverse murs, ressent les DM du corps). +1/jour par rang 5 atteint dans une voie + +1 plus faible carac." },
      ],
    },
    {
      voie: "Voie du poing",
      capacites: [
        { nom: "Poings de fer", rang: 1, resume: "Mains nues : AGI au lieu de FOR en attaque au choix, 1d6+FOR létaux (1d8 r2, 1d10 r3, 1d12 r4, 2d6 r5)." },
        { nom: "Peau de fer", rang: 2, resume: "+2 DEF (+3 au rang 5), DM temporaires subis divisés par 2." },
        { nom: "Parade de projectiles", rang: 3, resume: "Action gratuite, 1/round : dévie un projectile (sauf critique et poudre)." },
        { nom: "Déluge de coups", rang: 4, resume: "Action limitée : deux attaques au contact (cibles au choix)." },
        { nom: "Puissance du ki", rang: 5, resume: "Dé malus au contact pour +2d4 DM (aussi avec Projection du ki)." },
      ],
    },
    {
      voie: "Voie du vent",
      capacites: [
        { nom: "Pas du vent", rang: 1, resume: "Mouvement avant et après l'attaque, +3 Init, rang+2 en saut, course et escalade." },
        { nom: "Course du vent", rang: 2, resume: "+1 DEF (+2 au rang 5), mouvement = 15 m (20 m au rang 5)." },
        { nom: "Course des airs", rang: 3, resume: "Se déplace sur eau, murs, feuillages... Ignore terrains difficiles, immunisé immobilisé." },
        { nom: "Agilité héroïque", rang: 4, resume: "AGI +1 et dé bonus aux tests d'AGI." },
        { nom: "Passe-muraille", rang: 5, resume: "Action limitée, 1/combat : traverse un mur (≤ VOL m) + +1 à la plus faible carac." },
      ],
    },
  ],
};
