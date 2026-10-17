import type { VoieDetail } from "./capacites";

// Capacités (talents) des voies Mage — résumés du DRS :
//   https://drs.chroniques-oubliees.fr/fantasy/profils
// Les sorts (capacités à PM, *) renvoient au grimoire via sortId. Voir le DRS pour le texte intégral.

export const CAPACITES_MAGE: Record<string, VoieDetail[]> = {
  Ensorceleur: [
    {
      voie: "Voie de l'air",
      capacites: [
        { nom: "Murmures dans le vent", rang: 1, resume: "Sort (gratuite) : message de 10 mots (CHA×100 m, réponse immédiate). +1 Init et DEF permanents.", sortId: "sort-murmures-vent" },
        { nom: "Sous tension", rang: 2, resume: "Sort (mouvement) : chargé d'électricité (CHA minutes), 1d4 à qui le blesse + décharge à 10 m (1d4+CHA, sans coût).", sortId: "sort-sous-tension" },
        { nom: "Télékinésie", rang: 3, resume: "Sort d'attaque : déplace objet ou volontaire (50 kg par rang, 20 m, CHA minutes). Chute sur surpris : 1d6 par 50 kg.", sortId: "sort-telekinesie" },
        { nom: "Foudre", rang: 4, resume: "Sort d'attaque : éclair sur une ligne de 10 m, 4d4+CHA (moitié si AGI 10+CHA).", sortId: "sort-foudre" },
        { nom: "Forme éthérée", rang: 5, resume: "Sort (limitée) : intangible (CHA minutes), traverse tout, insensible aux DM physiques, mais ni dégâts ni sorts.", sortId: "sort-forme-etheree" },
      ],
    },
    {
      voie: "Voie de la divination",
      capacites: [
        { nom: "Divination", rang: 1, resume: "Sort (limitée) : test opposé (10 m, NC < niveau) devine nom, métier et infos publiques. +1 Init et DEF permanents.", sortId: "sort-divination" },
        { nom: "Détection de l'invisible", rang: 2, resume: "Sort (limitée) : détecte invisible et caché à 20 m (CHA minutes), même aveuglé.", sortId: "sort-detection-invisible" },
        { nom: "Clairvoyance", rang: 3, resume: "Sort d'attaque : voit et entend à distance un lieu connu (CHA rounds, PER 12+CHA pour sentir l'observation).", sortId: "sort-clairvoyance" },
        { nom: "Perception héroïque", rang: 4, resume: "PER +1, dé bonus en PER, et ajoute sa PER aux PM." },
        { nom: "Prescience", rang: 5, resume: "1/combat, début de round : +10 attaque/Défense/PER, DM subis divisés par 2, agit à tout moment, tout le round." },
      ],
    },
    {
      voie: "Voie de l'envoûteur",
      capacites: [
        { nom: "Injonction", rang: 1, resume: "Sort d'attaque : test opposé (20 m), la cible exécute un ordre simple à son prochain tour. Résisté : immunisé 24 h.", sortId: "sort-injonction" },
        { nom: "Sommeil", rang: 2, resume: "Sort (limitée), 1/combat : zone 10 m (20 m), jusqu'à 1d4+CHA vivants de NC < 1 endormis (CHA minutes).", sortId: "sort-sommeil" },
        { nom: "Confusion", rang: 3, resume: "Sort d'attaque : test opposé (20 m), victime désorientée CHA rounds (1d6 : inaction ou frappe le plus proche).", sortId: "sort-confusion" },
        { nom: "Amitié", rang: 4, resume: "Sort (limitée) : test opposé (10 m, humanoïde inférieur) devient un ami (résiste 1/jour sur VOL 10+CHA).", sortId: "sort-amitie" },
        { nom: "Domination", rang: 5, resume: "Sort d'attaque : test opposé (20 m, niveau inférieur), contrôle la cible CHA minutes (corps inactif, 1d4 DM si elle meurt).", sortId: "sort-domination" },
      ],
    },
    {
      voie: "Voie des illusions",
      capacites: [
        { nom: "Mirage", rang: 1, resume: "Sort (limitée) : illusion visuelle et sonore immobile (CHA minutes, 2 m par rang, 50 m). Animée au rang 4.", sortId: "sort-mirage" },
        { nom: "Image décalée", rang: 2, resume: "Sort (mouvement) : images superposées (1d4+CHA rounds), sur 5-6 au d6 une attaque touchée ne fait rien.", sortId: "sort-image-decalee" },
        { nom: "Sort illusoire", rang: 3, resume: "Sort d'attaque : fausse attaque au choix (3d4+CHA ou 2d4+CHA multi), PER 10+CHA pour l'éviter. Sans-esprit immunisés.", sortId: "sort-illusoire" },
        { nom: "Imitation", rang: 4, resume: "Sort d'attaque : apparence d'une créature proche en taille (CHA minutes), INT 10+CHA au contact pour percer.", sortId: "sort-imitation" },
        { nom: "Exécution mentale", rang: 5, resume: "Sort d'attaque : test opposé (20 m), la victime croit mourir (0 PV, ou étourdie 1 round si niveau >=). 1/jour par cible.", sortId: "sort-execution-mentale" },
      ],
    },
    {
      voie: "Voie de l'invocation",
      capacites: [
        { nom: "Choc", rang: 1, resume: "Sort d'attaque : test magique contre DEF (20 m), 1d4+CHA (+ renversé si NC < rang, sauf FOR 10).", sortId: "sort-choc" },
        { nom: "Serviteur invisible", rang: 2, resume: "Sort (limitée) : force invisible (CHA minutes, 20 m) pour tâches simples (FOR = CHA). Ni combat ni existence.", sortId: "sort-serviteur-invisible" },
        { nom: "Arme de mana", rang: 3, resume: "Sort d'attaque : lame d'énergie (rang rounds), attaque gratuite à 20 m (test magique, 1d4+CHA). Une seule à la fois.", sortId: "sort-arme-mana" },
        { nom: "Porte dimensionnelle", rang: 4, resume: "Sort d'attaque : téléporte le lanceur + un allié par CHA (60 m, arrivée en vue).", sortId: "sort-porte-dimensionnelle" },
        { nom: "Mur de mana", rang: 5, resume: "Sort d'attaque : mur indestructible ou hémisphère (10 m, CHA minutes), bloque matière et forces.", sortId: "sort-mur-mana" },
      ],
    },
  ],
  Forgesort: [
    {
      voie: "Voie des artefacts",
      capacites: [
        { nom: "Bâton de mage", rang: 1, resume: "Bâton : 1d4+INT magiques ; rang 3+ (limitée) : attaque magique au contact 2d4+INT." },
        { nom: "Ouverture-fermeture", rang: 2, resume: "Sort (mouvement) : ouvre une serrure (test magique) ou scelle porte/coffre (INT minutes). Permanent au rang 4 (gemme 100 pa).", sortId: "sort-ouverture-fermeture" },
        { nom: "Sac sans fond", rang: 3, resume: "Sac de 50 kg par rang (1 kg apparent) + 1/heure : objets ≤25 pa qui disparaissent en 1 h." },
        { nom: "Frappe des arcanes", rang: 4, resume: "Sort d'attaque : onde dans 10 m, 3d4+INT automatiques + FOR 10+INT ou renversé.", sortId: "sort-frappe-arcanes" },
        { nom: "Artefact étrange", rang: 5, resume: "Action limitée : crée un artefact à 4 pouvoirs (1/jour chacun, panne sur 1-2 au d6 jusqu'à récup rapide)." },
      ],
    },
    {
      voie: "Voie des élixirs",
      capacites: [
        { nom: "Fortifiant", rang: 1, resume: "Action limitée : breuvage 1d4 PV + dé bonus aux 3 prochains tests (30 min). Rang+2 en alchimie." },
        { nom: "Feu grégeois", rang: 2, resume: "Action limitée : fiole à 10 m (auto), 2d4 rayon 3 m (AGI 10+INT = moitié ; 3d4 rang 4, 4d4 rang 5)." },
        { nom: "Élixir de guérison", rang: 3, resume: "Action limitée : 2d4+INT PV en 1 min ou anti-poison instantané." },
        { nom: "Élixirs mineurs", rang: 4, resume: "Action limitée : INT élixirs (max 4) parmi Forme gazeuse, Maîtrise des éléments, Chute ralentie, Masque mortuaire." },
        { nom: "Élixirs majeurs", rang: 5, resume: "Action limitée : INT élixirs (max 4, comptent double) parmi Invisibilité, Vol, Accélération, Masque du prédateur." },
      ],
    },
    {
      voie: "Voie du golem",
      capacites: [
        { nom: "Grosse tête", rang: 1, resume: "INT au lieu de FOR + INT aux PV (au choix, à l'acquisition) + rang+2 en bricolage et science." },
        { nom: "Golem", rang: 2, resume: "Serviteur humanoïde (DEF 10+rang, PV niv×5, 1d4+1), ordres simples. Réparable (1d6/rang+INT par heure)." },
        { nom: "Protecteur", rang: 3, resume: "Action gratuite, 1/round : le golem au contact encaisse une attaque à la place d'un personnage." },
        { nom: "Statuette", rang: 4, resume: "Sort d'attaque : golem en statuette (RD 10, inactif), restauré en mouvement.", sortId: "sort-statuette" },
        { nom: "Golem supérieur", rang: 5, resume: "Amélioration au choix (armure, félin, baliste, taille, vol, cerveau, puissance, arme), +1 par rang 5 atteint dans une voie." },
      ],
    },
    {
      voie: "Voie du métal",
      capacites: [
        { nom: "Morsure de la forge", rang: 1, resume: "Sort (mouvement) : enflamme bâton ou marteau (INT minutes), +2 DM de feu (+1 par rang 4 atteint dans une voie).", sortId: "sort-morsure-forge" },
        { nom: "Métal brûlant", rang: 2, resume: "Sort (mouvement) : test opposé (20 m), chauffe un métal porté 1d4+INT rounds (arme : 1 DM/round et -2 ; armure : 1d4/round).", sortId: "sort-metal-brulant" },
        { nom: "Magnétisme", rang: 3, resume: "Sort d'attaque : contrôle magnétique (INT minutes), +2 DEF contre métal, projectiles à pointe divisés par 2.", sortId: "sort-magnetisme" },
        { nom: "Métal hurlant", rang: 4, resume: "Sort d'attaque : test opposé (10 m), déforme un équipement métallique (arme HS, armure : dé malus). 3d4 sur structure (RD/2).", sortId: "sort-metal-hurlant" },
        { nom: "Endurer", rang: 5, resume: "Feu divisé par 2, CON +1 et dé bonus en CON, +CON aux PM." },
      ],
    },
    {
      voie: "Voie des runes",
      capacites: [
        { nom: "Runes de défense", rang: 1, resume: "+2 DEF runique (+1 rangs 3 et 5, /2 si hybride en grosse armure). 1 rune/type à la fois, requiert INT +1." },
        { nom: "Rune de puissance", rang: 2, resume: "Sort (limitée) : arme enchantée 24 h, 1/combat : DM maximaux sur une attaque.", sortId: "sort-rune-puissance" },
        { nom: "Rune de protection", rang: 3, resume: "Sort d'attaque : armure enchantée 24 h, 1/jour ignore une attaque subie (critique = DM normaux).", sortId: "sort-rune-protection" },
        { nom: "Rune d'énergie", rang: 4, resume: "Sort d'attaque : bijou enchanté 24 h, 1/combat : d20 bonus sur un test au choix.", sortId: "sort-rune-energie" },
        { nom: "Rune de garde", rang: 5, resume: "Sort : rituel 10 min, zone 10 m (12 h, concentration, 3 PM) — Alarme (étourdi sauf CON 15) ou Feu (3d4+INT).", sortId: "sort-rune-garde" },
      ],
    },
  ],
  Magicien: [
    {
      voie: "Voie de la magie des arcanes",
      capacites: [
        { nom: "Projectile de mana", rang: 1, resume: "Sort d'attaque : cible visible à 30 m, 1d4 automatiques (+1 par rang 4 atteint dans une voie, max INT ; dé max relancé).", sortId: "sort-projectile-mana" },
        { nom: "Lévitation", rang: 2, resume: "Sort (mouvement) : déplacement vertical (5 m haut, 10 m bas par mouvement) pendant INT minutes.", sortId: "sort-levitation" },
        { nom: "Forme gazeuse", rang: 3, resume: "Sort d'attaque : gaz 1 min (5 m/mouvement, interstices), insensible aux armes ordinaires, aucune capacité.", sortId: "sort-forme-gazeuse" },
        { nom: "Accélération", rang: 4, resume: "Sort d'attaque : métabolisme accéléré 1d4+INT rounds (+1 mouvement/round, ou +3 DEF, ou -1 PM sur un sort).", sortId: "sort-acceleration" },
        { nom: "Désintégration", rang: 5, resume: "Sort d'attaque : test magique (20 m), 5d4+INT, réduit en poussière (objets ≤100 kg, cadavres à 0 PV).", sortId: "sort-desintegration" },
      ],
    },
    {
      voie: "Voie de la magie destructrice",
      capacites: [
        { nom: "Arc de feu", rang: 1, resume: "Sort d'attaque : 3 cibles au contact max, 1d4+INT (moitié si AGI 10+INT ; 2d4 au rang 4). Élément substituable.", sortId: "sort-arc-feu" },
        { nom: "Saper les forces", rang: 2, resume: "Sort d'attaque : test opposé (10 m, vivant), -2 FOR/attaque/DM jusqu'à fin de combat. Non cumulable.", sortId: "sort-saper-forces" },
        { nom: "Flèche de feu", rang: 3, resume: "Sort d'attaque : magique contre DEF (30 m), 3d4+INT puis 1d6/round (fin sur 1-2).", sortId: "sort-fleche-feu" },
        { nom: "Explosion de feu", rang: 4, resume: "Sort d'attaque : point à 30 m, rayon 5 m (alliés inclus), 4d4+INT (moitié si AGI 10+INT).", sortId: "sort-explosion-feu" },
        { nom: "Appel de la foudre", rang: 5, resume: "Sort d'attaque : un test, toutes cibles choisies dans 10 m atteintes subissent 2d4+INT.", sortId: "sort-appel-foudre" },
      ],
    },
    {
      voie: "Voie de la magie élémentaire",
      capacites: [
        { nom: "Asphyxie", rang: 1, resume: "Sort d'attaque : test opposé (20 m), étouffe 1d4/round pendant INT rounds (RD ignorées, non-respirants immunisés).", sortId: "sort-asphyxie" },
        { nom: "Maîtrise des éléments", rang: 2, resume: "Sort (mouvement) : -[rang+2] aux DM élémentaires (INT minutes) + échange l'élément d'un sort lancé.", sortId: "sort-maitrise-elements" },
        { nom: "Arme élémentaire", rang: 3, resume: "Sort (attaque/limitée) : arme +1d4 d'élément (INT minutes), sorts de cet élément à -1 PM en main.", sortId: "sort-arme-elementaire" },
        { nom: "Respiration aquatique", rang: 4, resume: "Sort d'attaque : respire sous l'eau 10 min (+ un compagnon par INT).", sortId: "sort-respiration-aquatique" },
        { nom: "Armure de pierre", rang: 5, resume: "Sort d'attaque : -5 aux DM (INT minutes) jusqu'à niv×3 absorbés. Incompatible avec Déphasage.", sortId: "sort-armure-pierre" },
      ],
    },
    {
      voie: "Voie de la magie protectrice",
      capacites: [
        { nom: "Armure de mana", rang: 1, resume: "Sort (mouvement) : +3 DEF (INT minutes, +4 rang 3, +1 par rang 5 atteint dans une voie). Compte comme armure.", sortId: "sort-armure-mana" },
        { nom: "Chute ralentie", rang: 2, resume: "Sort (gratuite) : jusqu'à INT cibles (10 m, même hors tour) chutent sans DM (INT 15 par compagnon surpris).", sortId: "sort-chute-ralentie" },
        { nom: "Déphasage", rang: 3, resume: "Sort d'attaque : 1d4+INT rounds, DM contact/distance subis et infligés /2 (sorts non réduits).", sortId: "sort-dephasage" },
        { nom: "Cercle de protection", rang: 4, resume: "Sort d'attaque : cercle 2 m (INT protégés), 1/round annule un sort ciblé (test opposé) ; invoqués et morts en dé malus.", sortId: "sort-cercle-protection" },
        { nom: "Interruption du temps", rang: 5, resume: "Sort d'attaque : INT rounds hors du temps (sorts/objets sur soi, ni déplacement ni interaction).", sortId: "sort-interruption-temps" },
      ],
    },
    {
      voie: "Voie de la magie universelle",
      capacites: [
        { nom: "Lumière", rang: 1, resume: "Sort (limitée) : objet à 10 m éclaire 10 m (INT heures). 1/combat : aveugle 1 round sur test opposé (NC ≤ rang).", sortId: "sort-lumiere" },
        { nom: "Familier", rang: 2, resume: "Sort d'attaque : petit animal lié (sens partagés, +2 Init/DEF en vue). À 0 PV : 1d4 en contrecoup, réinvoqué après récup complète.", sortId: "sort-familier" },
        { nom: "Invisibilité", rang: 3, resume: "Sort (attaque/limitée) : invisible 1d4+INT min (attaque = visible). Rang 5 : sur un allié en limitée.", sortId: "sort-invisibilite" },
        { nom: "Vol", rang: 4, resume: "Sort (attaque/limitée) : vole 2d4+INT min à vitesse normale, stationnaire gratuit.", sortId: "sort-vol" },
        { nom: "Téléportation", rang: 5, resume: "Sort (limitée), 1/jour : disparaît et réapparaît (niv×INT km, en vue ou connu). Alliés aux niveaux 10/13/16/19.", sortId: "sort-teleportation" },
      ],
    },
  ],
  Sorcier: [
    {
      voie: "Voie du démon",
      capacites: [
        { nom: "Malédiction", rang: 1, resume: "Sort (mouvement/limitée) : test opposé (20 m), dé malus au prochain test (3 prochains en limitée). 1/combat par cible.", sortId: "sort-malediction" },
        { nom: "Beauté de la succube", rang: 2, resume: "Sort (limitée) : beauté fascinante (INT minutes, dé bonus en CHA) + contact magique 1d4°+INT avec vol de PV.", sortId: "sort-beaute-succube" },
        { nom: "Pacte démoniaque", rang: 3, resume: "Action gratuite : sacrifie 1d4° PV pour +INT à un d20 ou en DEF (avant résolution) + ajoute sa VOL à ses DR (MJ)." },
        { nom: "Aspect du démon", rang: 4, resume: "Sort d'attaque : démon ailé (INT minutes, sans arme), dé bonus au contact, +5 DEF et physiques, 2 griffes 1d4°+INT (1 jet + MJ), vol 10 m. Non cumulable avec Beauté.", sortId: "sort-aspect-demon" },
        { nom: "Invocation d'un démon", rang: 5, resume: "Sort (limitée) : sacrifie 1d4° PV, démon servo (INT minutes, PV niveau×5, DEF 18, DM non magiques /2, vol, 2d4°+5). Niv. 15 : 2 attaques.", sortId: "sort-invocation-demon" },
      ],
    },
    {
      voie: "Voie de la mort",
      capacites: [
        { nom: "Siphon des âmes", rang: 1, resume: "1/round : mort d'un humanoïde vivant à 20 m = NC PV (1 PM au lieu si NC>4, dès le rang 3). Inefficace sur non-vivants (toute la voie). MJ : boutons +PV." },
        { nom: "Masque mortuaire", rang: 2, resume: "Sort (mouvement) : apparence de mort (INT minutes), pris pour un mort-vivant, froid /2. Aucun soin sous l'effet.", sortId: "sort-masque-mortuaire" },
        { nom: "Baiser du vampire", rang: 3, resume: "Sort d'attaque : test opposé (30 m), 2d4°+INT avec vol de PV. Vivants uniquement.", sortId: "sort-baiser-vampire" },
        { nom: "Peur", rang: 4, resume: "Sort (attaque/limitée) : test opposé (20 m), fuite INT rounds (1 si NC >= niveau ; limitée = tous les contacts).", sortId: "sort-peur" },
        { nom: "Briser les cœurs", rang: 5, resume: "Sort d'attaque : test opposé (20 m, vivant), 5d4°+INT (moitié si raté). 1/combat par cible.", sortId: "sort-briser-coeurs" },
      ],
    },
    {
      voie: "Voie de l'outre-tombe",
      capacites: [
        { nom: "Un pied dans la tombe", rang: 1, resume: "Sort d'attaque : test opposé (10 m, vivant), 1d4°+INT + ralenti 1 round (CON 10, test auto).", sortId: "sort-pied-tombe" },
        { nom: "Armure d'os", rang: 2, resume: "Passif : armure d'os +3 DEF (+1 par rang 4 en voie sorcier), sans malus AGI, 10 min d'entretien/jour. MJ : Équip. DEF via Éditer." },
        { nom: "Animation des morts", rang: 3, resume: "Sort (limitée) : anime un cadavre humanoïde récent (zombie : DEF 10, contact 1d4°+2, PV 10+niveau), 1 contrôlé +1 par rang 5 (MJ).", sortId: "sort-animation-morts" },
        { nom: "Ensevelissement", rang: 4, resume: "Sort (limitée), 1/combat : test opposé (20 m), enterré vivant (2d4°/round, inactif, inciblable), sortie FOR/AGI 15 (aides +2, max +10).", sortId: "sort-ensevelissement" },
        { nom: "Armée des morts", rang: 5, resume: "Sort (limitée), 1/jour : squelettes (niveau rounds), 2d4° auto/round aux ennemis dans 10 m, déplacements /2 (MJ).", sortId: "sort-armee-morts" },
      ],
    },
    {
      voie: "Voie du sang",
      capacites: [
        { nom: "Saignements", rang: 1, resume: "Sort d'attaque : test magique diff 10+CON (10 m), 1d4°/round pendant INT rounds, sans dégâts immédiats.", sortId: "sort-saignements" },
        { nom: "Sang mordant", rang: 2, resume: "Sort (mouvement) : sang acide (INT minutes), riposte auto 1d4° d'acide à qui le blesse au contact (sorts et distance : MJ).", sortId: "sort-sang-mordant" },
        { nom: "Exsangue", rang: 3, resume: "Passif : corps cadavérique +2 DEF (+3 rang 5, -1 si autre armure qu'os, MJ : Éditer) ; à 0 PV agit avec dé malus (1 DM = inconscience)." },
        { nom: "Rituel du sang", rang: 4, resume: "Sort d'attaque : sacrifie 1d4° PV (20 m, vivant, sans test), +1d4° aux DM tranchants/perçants subis pendant INT rounds (MJ).", sortId: "sort-rituel-sang" },
        { nom: "Lien de sang", rang: 5, resume: "Sort d'attaque : test opposé (20 m), pendant INT minutes la moitié de ses DM est aussi subie par la cible (MJ : moitié, sorts sans vue).", sortId: "sort-lien-sang" },
      ],
    },
    {
      voie: "Voie de la sombre magie",
      capacites: [
        { nom: "Ténèbres", rang: 1, resume: "Sort (limitée) : zone de ténèbres 10 m (20 m, INT minutes), aveugle même la vision nocturne.", sortId: "sort-tenebres" },
        { nom: "Reptation", rang: 2, resume: "Sort (mouvement) : rampe sur murs et plafonds (5 m/mouvement) pendant INT minutes, sorts lançables.", sortId: "sort-reptation" },
        { nom: "Strangulation", rang: 3, resume: "Sort d'attaque : test opposé (20 m, vivant), dé malus + 1d4°+INT/round, concentration (mouvement + 1 PM/round, MJ).", sortId: "sort-strangulation" },
        { nom: "Manteau de l'ombre", rang: 4, resume: "Sort (limitée) : ombre (INT minutes), dé bonus discrétion, dé malus attaques distance ; à 0 PV : fuite à 1d6 km avec 1d4° PV (MJ).", sortId: "sort-manteau-ombre" },
        { nom: "Pacte ténébreux", rang: 5, resume: "Passif : CON +1 (MJ : Éditer), dé bonus en CON, vision nocturne ; 1d4° PV sacrifiés = +2d4° aux DM d'un sort (+1d4°/round pour les durables)." },
      ],
    },
  ],
};
