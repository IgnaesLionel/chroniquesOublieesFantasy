import type { Sort } from "@/src/lib/rules/types";

/**
 * Compléments mécaniques des sorts dont le texte DRS ne se prête pas à une
 * automatisation complète. Les sorts purement narratifs reçoivent un marqueur
 * (nom + description + durée) via `enrichirSort` : ils restent lançables et
 * le MJ tranche les cas de position, de cible ou de dissipation.
 *
 * Les clés `marqueur:*` ne sont volontairement pas dans EFFECT_CATALOG : le
 * nom et la description du sort sont passés à `createEffect`, ce qui évite de
 * dupliquer 117 entrées dans le catalogue.
 */
export const SORTS_COMPLEMENTS: Record<string, Partial<Sort>> = {
  "sort-sanctuaire": {
    effetCle: "sanctuaire",
    effetDuree: 10,
    questionMJ: "Sanctuaire : le prêtre est-il encore en position défensive (aucune action offensive depuis le lancer) ?",
  },
  "sort-delivrance": {
    nettoie: true,
    questionMJ: "Délivrance : purger les états non permanents de la cible (peur, poison, étourdissement, paralysie, ralentissement, immobilisation) ; les mutilations permanentes restent.",
  },
  "sort-tenebres": {
    effetCle: "tenebres",
    effetDuree: "INT*6",
    questionMJ: "Ténèbres : les creatures dans la zone sont-elles soumises à l'effet Aveuglé (même vision nocturne) ?",
  },
  "sort-zone-silence": {
    effetCle: "zone-silence",
    effetDuree: "CHA*6",
    questionMJ: "Zone de silence : les lanceurs dans la sphère doivent-ils réussir INT difficulté 10 pour lancer un sort ?",
  },
  "sort-danse-irresistible": {
    effetCle: "danse",
    effetDuree: "CHA+2",
    effetMods: { attaque: -2, defense: -5 },
    questionMJ: "Danse irrésistible : la cible est-elle de NC inférieur au niveau du lanceur ? Sinon la durée est de 1 round.",
  },
  "sort-suggestion": {
    effetCle: "suggestion",
    effetDuree: "CHA*6",
    questionMJ: "Suggestion : la cible peut-elle accomplir la suggestion sans danger suicidaire et son niveau est-il inférieur à celui du lanceur ?",
  },
  "sort-comprehension-langues": {
    effetCle: "comprehension-langues",
    effetDuree: "CHA*6",
  },
  "sort-deguisement": {
    effetCle: "deguisement",
    effetDuree: "CHA*36",
    questionMJ: "Déguisement : un observateur peut-il tenter un test de CHA pour percer l'apparence ?",
  },
  "sort-masque-predateur": {
    effetCle: "masque-predateur",
    effetDuree: "PER*6",
    effetMods: { defense: 2, attaque: 2, degats: 2 },
    questionMJ: "Masque du prédateur : appliquer aussi +2 en Initiative et la vision nocturne (non suivis par le moteur).",
  },
  "sort-forme-animale": {
    effetCle: "forme-animale",
    effetDuree: "PER*6",
    questionMJ: "Forme animale : le PJ garde PV, INT et VOL, gagne les caractéristiques et attaques de l'animal, sans équipement ni capacité.",
  },
  "sort-foret-vivante": {
    effetCle: "foret-vivante",
    effetDuree: "PER*6",
    questionMJ: "Forêt vivante (rituel 30 min, 1/jour) : les ennemis dans 1 km par rang sont ralentis et subissent un dé malus.",
  },
  "sort-forme-arbre": {
    effetCle: "forme-arbre",
    effetDuree: "PER*6",
    questionMJ: "Forme d'arbre : utiliser les PV de l'arbre et autoriser les sorts des voies Protecteur et Végétaux.",
  },
  "sort-prison-vegetale": {
    effetCle: "immobilise",
    effetDuree: "PER*6",
    zone: true,
    questionMJ: "Prison végétale : les ennemis dans la zone sont immobilisés (libération sur test de FOR difficulté 10+PER).",
  },
  "sort-animation-arbre": {
    effetCle: "animation-arbre",
    effetDuree: "NIVEAU",
    questionMJ: "Animation d'un arbre : ajouter un serviteur DEF 10+rang, PV niveau×5, contact 1d4+3 (un seul à la fois).",
  },
  "sort-porte-vegetale": {
    effetCle: "porte-vegetale",
    effetDuree: 1,
    questionMJ: "Porte végétale : indiquer l'arbre de sortie (même forêt, PER×10 km maximum).",
  },
  "sort-telekinesie": {
    effetCle: "telekinesie",
    effetDuree: "CHA*6",
    questionMJ: "Télékinésie : objet ou volontaire de 50 kg par rang, déplacement de 5 m par action de mouvement.",
  },
  "sort-forme-etheree": {
    effetCle: "forme-etheree",
    effetDuree: "CHA*6",
    questionMJ: "Forme éthérée : intangible, insensible aux DM physiques, mais ne peut ni blesser ni lancer de sorts.",
  },
  "sort-injonction": {
    effetCle: "injonction",
    effetDuree: 1,
    questionMJ: "Injonction : ordre simple exécutable au prochain tour ; la cible résistante est immunisée 24 h.",
  },
  "sort-sommeil": {
    effetCle: "sommeil",
    effetDuree: "CHA*6",
    zone: true,
    questionMJ: "Sommeil : jusqu'à 1d4+CHA vivants de NC < 1 (NC < 2 au rang 4, < 3 au rang 5) dans la zone s'endorment.",
  },
  "sort-confusion": {
    effetCle: "confusion",
    effetDuree: "CHA",
    effetMods: { attaque: -2 },
    questionMJ: "Confusion : lancer 1d6 au début du tour de la cible (1-3 inaction, 4-6 attaque le plus proche) ; test de VOL difficulté 12+CHA pour finir.",
  },
  "sort-amitie": {
    effetCle: "amitie",
    effetDuree: "CHA*6",
    questionMJ: "Amitié : humanoïde de niveau inférieur ; la cible se comporte en ami tant qu'elle n'est pas attaquée.",
  },
  "sort-domination": {
    effetCle: "domination",
    effetDuree: "CHA*6",
    questionMJ: "Domination : la cible de niveau inférieur obéit ; son corps reste inactif et elle subit 1d4 DM si elle meurt.",
  },
  "sort-mirage": {
    effetCle: "mirage",
    effetDuree: "CHA*6",
    questionMJ: "Mirage : illusion visuelle et sonore immobile de 2 m par rang, jusqu'à 50 m.",
  },
  "sort-image-decalee": {
    effetCle: "image-decalee",
    effetDuree: "CHA+2",
    questionMJ: "Image décalée : sur 5-6 au d6, une attaque qui touche ne fait aucun DM (1d4+CHA rounds).",
  },
  "sort-imitation": {
    effetCle: "imitation",
    effetDuree: "CHA*6",
    questionMJ: "Imitation : un contact permet un test d'INT difficulté 10+CHA pour percer l'illusion.",
  },
  "sort-serviteur-invisible": {
    effetCle: "serviteur-invisible",
    effetDuree: "CHA*6",
  },
  "sort-porte-dimensionnelle": {
    effetCle: "porte-dimensionnelle",
    effetDuree: 1,
    questionMJ: "Porte dimensionnelle : un point de CHA par 10 m, arrivée en vue, lanceur et un allié.",
  },
  "sort-mur-mana": {
    effetCle: "mur-mana",
    effetDuree: "CHA*6",
    questionMJ: "Mur de mana : bloque matière et forces, pas le mental ni la téléportation.",
  },
  "sort-ouverture-fermeture": {
    effetCle: "ouverture-fermeture",
    effetDuree: "INT*6",
    questionMJ: "Ouverture-fermeture : porte verrouillée ouverte, ou porte/coffre scellé (+5 solidité et RD).",
  },
  "sort-morsure-forge": {
    effetCle: "arme-feu",
    effetDuree: "INT*6",
    effetMods: { degats: 2 },
    questionMJ: "Morsure de la forge : +2 DM de feu au contact, +1 par rang 4 atteint dans une autre voie ; s'éteint si l'échée quitte la main.",
  },
  "sort-magnetisme": {
    effetCle: "magnetisme",
    effetDuree: "INT*6",
    effetMods: { defense: 2 },
    questionMJ: "Magnétisme : +2 DEF contre les armes métalliques ; projectiles à pointe divisés par 2.",
  },
  "sort-metal-hurlant": {
    effetCle: "metal-hurlant",
    effetDuree: 3,
    questionMJ: "Métal hurlant : l'arme visée devient inutilisable, ou l'armure subit un dé malus (structure : 3d4 DM, RD /2).",
  },
  "sort-statuette": {
    effetCle: "statuette",
    effetDuree: "INT*6",
  },
  "sort-rune-puissance": {
    effetCle: "rune-puissance",
    effetDuree: "24*6",
    questionMJ: "Rune de puissance : 1/combat, maximiser les dés de DM d'une attaque (les dés bonus ne sont pas maximisés).",
  },
  "sort-rune-protection": {
    effetCle: "rune-protection",
    effetDuree: "24*6",
    questionMJ: "Rune de protection : 1/jour, ignorer les DM d'une attaque subie (critique : DM normaux).",
  },
  "sort-rune-energie": {
    effetCle: "rune-energie",
    effetDuree: "24*6",
    questionMJ: "Rune d'énergie : 1/combat, d20 bonus sur un test au choix (attaque ou caractéristique).",
  },
  "sort-rune-garde": {
    effetCle: "rune-garde",
    effetDuree: "12*6",
    questionMJ: "Rune de garde : alarme (étourdi 1 round sauf CON 15) ou feu (3d4+INT DM) dans une zone de 10 m.",
  },
  "sort-levitation": {
    effetCle: "levitation",
    effetDuree: "INT*6",
  },
  "sort-forme-gazeuse": {
    effetCle: "forme-gazeuse",
    effetDuree: 10,
    questionMJ: "Forme gazeuse : insensible aux armes ordinaires (magie OK), aucune capacité utilisable.",
  },
  "sort-acceleration": {
    effetCle: "acceleration",
    effetDuree: "INT+2",
    questionMJ: "Accélération : action de mouvement supplémentaire chaque round, ou +3 DEF, ou −1 PM sur un sort.",
  },
  "sort-saper-forces": {
    effetCle: "saper-forces",
    effetDuree: null,
    effetMods: { attaque: -2 },
    questionMJ: "Saper les forces : −2 FOR, attaque au contact et DM jusqu'à la fin du combat ; non cumulable.",
  },
  "sort-asphyxie": {
    questionMJ: "Asphyxie : la cible étouffe 1d4° DM par round (RD ignorées) ; les non-respirants sont immunisés.",
  },
  "sort-maitrise-elements": {
    effetCle: "maitrise-elements",
    effetDuree: "INT*6",
    questionMJ: "Maîtrise des éléments : retrancher rang+2 aux DM de feu, froid, électricité et acide ; permet d'échanger l'élément d'un sort.",
  },
  "sort-arme-elementaire": {
    effetCle: "arme-elementaire",
    effetDuree: "INT*6",
    effetMods: { degats: 1 },
    questionMJ: "Arme élémentaire : +1d4 DM de l'élément choisi ; les sorts de cet élément coûtent 1 PM de moins tant que l'arme est tenue.",
  },
  "sort-respiration-aquatique": {
    effetCle: "respiration-aquatique",
    effetDuree: "10*6",
  },
  "sort-armure-pierre": {
    effetCle: "armure-pierre",
    effetDuree: "INT*6",
    effetMods: { rd: 5 },
    questionMJ: "Armure de pierre : retrancher 5 aux DM subis jusqu'à niveau×3 DM absorbés ; incompatible avec Déphasage.",
  },
  "sort-chute-ralentie": {
    effetCle: "chute-ralentie",
    effetDuree: 1,
    questionMJ: "Chute ralentie : jusqu'à INT cibles, chute de toute hauteur sans DM ; test d'INT difficulté 15 pour un compagnon en chute inattendue.",
  },
  "sort-dephasage": {
    effetCle: "dephasage",
    effetDuree: "INT+2",
    questionMJ: "Déphasage : DM de contact et à distance subis et infligés divisés par 2 (sorts non réduits) ; incompatible avec Armure de pierre.",
  },
  "sort-cercle-protection": {
    effetCle: "cercle-protection",
    effetDuree: "INT*6",
    questionMJ: "Cercle de protection : 1/round, annuler un sort ciblant un protégé sur test opposé ; invoqués et morts-vivants en dé malus.",
  },
  "sort-interruption-temps": {
    effetCle: "interruption-temps",
    effetDuree: "INT",
    questionMJ: "Interruption du temps : sorts ou objets sur soi uniquement, ni déplacement ni interaction.",
  },
  "sort-lumiere": {
    effetCle: "lumiere",
    effetDuree: "INT*36",
    questionMJ: "Lumière : 1/combat, aveugler 1 round sur test opposé si NC ≤ rang.",
  },
  "sort-familier": {
    effetCle: "familier",
    effetDuree: "INT*6",
    effetMods: { defense: 2 },
    questionMJ: "Familier : +2 Init et DEF en vue ; à 0 PV il disparaît et inflige 1d4 PV en contrecoup.",
  },
  "sort-invisibilite": {
    effetCle: "invisibilite",
    effetDuree: "INT*6",
    questionMJ: "Invisibilité : l'attaque rend visible ; au rang 5, lançable sur un allié en action limitée.",
  },
  "sort-vol": {
    effetCle: "vol",
    effetDuree: "INT*6",
  },
  "sort-teleportation": {
    effetCle: "teleportation",
    effetDuree: 1,
    questionMJ: "Téléportation : niveau×INT km, lieu en vue ou connu ; alliés supplémentaires aux niveaux 10/13/16/19.",
  },
  "sort-augure": {
    effetCle: "augure",
    effetDuree: 1,
    questionMJ: "Augure : test de CHA difficulté 10 ; réponse bénéfique, incertaine, risquée ou préjudiciable.",
  },
  "sort-marche-plans": {
    effetCle: "marche-plans",
    effetDuree: "CHA",
    questionMJ: "Marche des plans : voyage de 10 km par round, maximum CHA rounds, sortie imprécise (1d6 km).",
  },
  "sort-maitrise-magie": {
    effetCle: "maitrise-magie",
    effetDuree: 10,
    questionMJ: "Maîtrise de la magie : détection à 10 m (INT 10+rang) et dissipation d'un sort non permanent sur test opposé.",
  },
  "sort-tour-magie": {
    effetCle: "tour-magie",
    effetDuree: 10,
  },
  "sort-arme-benie": {
    effetCle: "arme-benie",
    effetDuree: "24*6",
    questionMJ: "Arme bénie : relancer les 1 aux DM, DM magiques pendant 24 h ; perdue si une autre créature l'utilise.",
  },
  "sort-murmures-vent": {
    effetCle: "murmures-vent",
    effetDuree: 1,
  },
  "sort-divination": {
    effetCle: "divination",
    effetDuree: 1,
    questionMJ: "Divination : test opposé d'attaque magique (10 m, NC < niveau) pour deviner nom, métier et informations publiques.",
  },
  "sort-detection-invisible": {
    effetCle: "detection-invisible",
    effetDuree: "CHA*6",
  },
  "sort-clairvoyance": {
    effetCle: "clairvoyance",
    effetDuree: "CHA",
    questionMJ: "Clairvoyance : les présents sentent qu'on les observe sur test de PER difficulté 12+CHA.",
  },
  // Ciblages/états déjà mécanisés mais précisés par le DRS.
  "sort-mot-pouvoir": { zone: true, effetDuree: 1 },
  "sort-foudres-divines": { ciblesLibres: true, toucheAuto: true },
  "sort-appel-foudre": { ciblesLibres: true },
  "sort-arc-feu": { ciblesMax: 3 },
  "sort-benediction": { ciblesAllies: true },
  "sort-chant-des-heros": { ciblesAllies: true },
  "sort-frappe-arcanes": { zone: true, effetCle: "renverse", effetSauvegarde: { carac: "FOR", difficulte: "10+INT" } },
};

/** Un sort sans effet ni mécanique reçoit un marqueur narratif lançable. */
export function enrichirSort(sort: Sort): Sort {
  const complement = SORTS_COMPLEMENTS[sort.id];
  let enrichi: Sort = complement ? { ...sort, ...complement } : sort;
  const aUneMecanique = !!(
    enrichi.effetCle ||
    enrichi.degats ||
    enrichi.degatsParRangVoie ||
    enrichi.soin ||
    enrichi.invocation ||
    enrichi.attaqueAccordee ||
    enrichi.zone ||
    enrichi.zonePersistante ||
    enrichi.rituelHorsCombat ||
    enrichi.toucheAuto ||
    enrichi.nettoie ||
    enrichi.effetSauvegarde ||
    enrichi.effetDegats
  );
  if (!aUneMecanique) {
    enrichi = {
      ...enrichi,
      effetCle: `marqueur:${enrichi.id}`,
      effetDuree: enrichi.effetDuree ?? 10,
      questionMJ:
        enrichi.questionMJ ??
        `Le MJ précise la portée, les cibles et la fin de l'effet de « ${enrichi.nom} » (texte DRS).`,
    };
  }
  return enrichi;
}
