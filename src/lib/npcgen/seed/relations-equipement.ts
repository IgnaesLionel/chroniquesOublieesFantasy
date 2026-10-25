import { TABLE_IDS } from "@/src/lib/npcgen/types";
import { fabrique } from "@/src/lib/npcgen/seed/helpers";

const { E, many, entries } = fabrique();

const ajouterAvecTags = (
  tableId: string,
  valeurs: string[],
  tags: string[],
  description?: string,
  exigerTags = true
) =>
  valeurs.forEach((valeur) =>
    entries.push(
      E(tableId, valeur, {
        tags,
        description,
        // Les objets courants restent accessibles à tous ; les groupes
        // spécialisés (militaire, artisanat, savoir…) exigent leur affinité.
        conditions: exigerTags && tags.length > 0 ? { tagsRequis: tags } : {},
      })
    )
  );

entries.push(
  ...many(TABLE_IDS.attitudesInitiales, [
    "Méfiance ouverte", "Neutralité prudente", "Curiosité polie",
    "Chaleur intéressée", "Hostilité contenue", "Indifférence distante",
    "Respect formel", "Camaraderie spontanée", "Peur mal dissimulée",
    "Jugement silencieux", "Soulagement visible", "Impatience à peine voilée",
  ]),
  ...many(TABLE_IDS.raisonsAttitude, [
    "Il a besoin d'aide et le cache sous une apparence sévère",
    "Il craint que les PJ soient envoyés par son rival",
    "Leur réputation l'impressionne",
    "Ils ressemblent à quelqu'un qu'il a perdu",
    "Il n'a rien à gagner à les aider",
    "Ils ont payé d'avance ou portent sa marque",
    "Il veut tester leur valeur avant de s'engager",
    "Il a reçu l'ordre de les surveiller",
    "Il se sent redevable envers leur faction",
    "Leur simple présence le met mal à l'aise",
    "Il espère obtenir leur appui plus tard",
    "Il aime les gens directs et les PJ le sont",
  ]),
  ...many(TABLE_IDS.premieresReactions, [
    "Il s'arrête, les détaille de la tête aux pieds, puis les salue avec réserve.",
    "Il fait comme s'il ne les avait pas vus et continue sa tâche.",
    "Il leur offre immédiatement quelque chose à boire.",
    "Il pose la main sur le manche de son arme sans le dégainer.",
    "Il éclate d'un rire trop fort et détourne la conversation.",
    "Il demande qui ils sont avant même de se présenter.",
    "Il les fait attendre volontairement quelques instants.",
    "Il leur indique une table à l'écart puis vient les rejoindre.",
    "Il se lève pour les accueillir comme des invités attendus.",
    "Il ferme discrètement un registre ou une porte.",
    "Il appelle un serviteur pour qu'il reste à portée de voix.",
    "Il les invite à le suivre hors de portée des oreilles.",
  ]),
  ...many(TABLE_IDS.offres, [
    "Un repas chaud et une chambre pour la nuit",
    "Une information contre une promesse de discrétion",
    "Un passage sûr à travers un territoire dangereux",
    "Une lettre d'introduction auprès d'un notable",
    "Un objet utile mais reconnaissable",
    "Un travail temporaire contre une paie honnête",
    "Un remède rare provenant de sa réserve",
    "Une cachette pour quelques jours",
    "Une part du butin d'une affaire à venir",
    "Son témoignage devant un juge",
    "Une monture à emprunter et à rendre",
    "Une carte approximative mais précieuse",
    "Un contact parmi les contrebandiers",
    "Une place dans une expédition",
    "Une faveur qu'il devra honorer plus tard",
  ]),
  ...many(TABLE_IDS.demandes, [
    "Retrouver quelqu'un sans prévenir la garde",
    "Livrer un paquet sans regarder dedans",
    "Escorter un convoi jusqu'au prochain village",
    "Témoigner sur ce qu'ils ont vu",
    "Acheter un objet précieux à un prix dérisoire",
    "Faire parler une personne qui se méfie d'eux",
    "Détourner l'attention d'un rival",
    "Retourner une relique à son propriétaire",
    "Ne pas mentionner son nom en ville",
    "Payer une dette à sa place",
    "Récupérer une lettre avant qu'elle ne soit lue",
    "Convaincre un garde de les laisser passer",
    "Découvrir qui a fourni de fausses informations",
    "Protéger un enfant pendant quelques heures",
    "L'aider à quitter la région",
  ]),
  ...many(TABLE_IDS.leviers, [
    "Sa fierté ne supporte pas d'être ignorée",
    "Il a besoin d'argent pour payer une dette urgente",
    "Il craint pour la sécurité d'un proche",
    "Un souvenir de son passé peut le faire céder",
    "Il espère retrouver une position perdue",
    "Il ne supporte pas l'injustice envers les siens",
    "Une preuve de loyauté le désarmera",
    "La menace d'un scandale le fait reculer",
    "Il est sensible aux flatteries intelligentes",
    "Il obéit à une promesse faite à un mort",
    "Une occasion de prouver sa valeur le tente",
    "Il craint une malédiction ou un présage",
  ]),
  ...many(TABLE_IDS.declencheursHostilite, [
    "On insulte sa famille ou son peuple",
    "On menace un enfant devant lui",
    "On fouille ses affaires sans permission",
    "On salit sa réputation devant des témoins",
    "On touche à une relique qu'il protège",
    "On lui promet de l'argent puis on se moque",
    "On le traite de menteur publiquement",
    "On blesse un animal qu'il aime",
    "On révèle son secret sans le vouloir",
    "On refuse de reconnaître sa fonction",
    "On entre dans un lieu sacré armé",
    "On prétend agir au nom d'un ennemi",
  ]),
  ...many(TABLE_IDS.fuites, [
    "Se fondre dans la foule et changer de rue",
    "Gagner les toits par une échelle cachée",
    "Se réfugier derrière une porte verrouillée",
    "Renverser une table et courir",
    "Appeler ses alliés ou la garde",
    "Jeter une bourse pour distraire ses poursuivants",
    "Prendre un cheval attaché à proximité",
    "Descendre vers les caves ou les égouts",
    "Sauter sur un bateau prêt à partir",
    "Se cacher sous une charrette",
    "Négocier une retraite immédiate",
    "Laisser un leurre et disparaître dans la foule",
  ])
);

// ---------------------------------------------------------------------------
// Équipement
// ---------------------------------------------------------------------------
const COMMUNS = ["quotidien"];
ajouterAvecTags(TABLE_IDS.equipements, [
  "Un couteau usé à la ceinture",
  "Une besace de toile et une gourde",
  "Des vêtements de rechange roulés dans un linge",
  "Une couverture de laine mitée",
  "Un briquet à silex et de l'amadou",
  "Une corde de chanvre de dix mètres",
  "Un bâton de marche ferré",
  "Une petite bourse de cuir cachée sous la tunique",
], COMMUNS, undefined, false);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une épée longue à fourreau de cuir",
  "Une dague de parade",
  "Un écu bosselé",
], ["militaire"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une cotte de mailles entretenue",
  "Une lance de patrouille",
  "Un heaume sans plume, marqué d'une rayure",
], ["militaire", "ordre"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un arc court et un carquois de douze flèches",
  "Un couteau de chasse",
  "Une cape de couleur sombre",
], ["chasse"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une arbalète légère et ses carreaux",
  "Une dague de ceinture",
], ["distance"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un marteau de forge et des pinces",
  "Un tablier de cuir brûlé",
  "Une dague à tout faire",
], ["forge", "artisanat"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une trousse d'herbes médicinales",
  "Des bandages propres",
  "Une fiole de remède amer",
], ["soin"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un stylet et un encrier de voyage",
  "Un carnet de notes à moitié rempli",
  "Un étui de plumes taillées",
], ["savoir", "écriture"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un registre de comptes relié de cuir",
  "Une bourse plate dissimulée sous la veste",
  "Un sceau de cire et un cachet personnel",
], ["commerce", "argent"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un bâton noueux gravé de signes",
  "Une bourse de poudres odorantes",
  "Un miroir de poche en laiton",
], ["occulte"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une dague à lame noircie",
  "Un jeu de crochets et de petites limes",
  "Une corde fine et solide",
], ["crime", "discrétion"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Une rapière au pommeau ouvragé",
  "Un manteau de voyage de bonne coupe",
  "Une dague de duel",
], ["noble", "cour"]);

ajouterAvecTags(TABLE_IDS.equipements, [
  "Un harpon et une ligne de pêche",
  "Des bottes de mer imperméables",
  "Un couteau à poisson",
], ["mer", "rivière"]);

entries.push(
  ...many(TABLE_IDS.objetsValeurs, [
    "Une bourse de vingt pièces d'argent",
    "Un anneau de cuivre gravé",
    "Une broche en ambre",
    "Trois perles de verre coloré",
    "Un lingot d'argent de la taille d'un pouce",
    "Une pièce ancienne à l'effigie effacée",
    "Un peigne d'ivoire",
    "Un fermoir de cape en argent",
    "Une petite statuette de bronze",
    "Un collier de perles de rivière",
  ]),
  ...many(TABLE_IDS.objetsPersonnels, [
    "Une mèche de cheveux nouée d'un ruban",
    "Un dé à coudre hérité de sa mère",
    "Une pipe de bois noirci",
    "Un caillou lisse ramassé sur une plage",
    "Une lettre d'amour jamais envoyée",
    "Un dé en os qui ne tombe jamais sur six",
    "Un mouchoir brodé d'initiales",
    "Une dent de loup percée",
    "Un petit couteau de poche sans valeur",
    "Un ruban décoloré autour du poignet",
  ]),
  ...many(TABLE_IDS.objetsSuspects, [
    "Une clé sans étiquette",
    "Un sceau brisé en deux",
    "Une carte annotée de noms inconnus",
    "Une fiole de poudre noire",
    "Un masque de cuir souple",
    "Une liste de dettes où un nom a été gratté",
    "Un mouchoir taché de sang séché",
    "Un anneau portant les armes d'une maison ennemie",
    "Une lettre dont le cachet vient d'ailleurs",
    "Un plan des égouts avec une croix rouge",
    "Une bourse contenant des pièces frappées à l'étranger",
    "Un poignard à lame triangulaire",
  ]),
  ...many(TABLE_IDS.documents, [
    "Un sauf-conduit signé par un officier",
    "Une lettre de recommandation",
    "Un contrat de livraison",
    "Un registre de comptes tenu à jour",
    "Un acte de propriété ancien",
    "Une reconnaissance de dette",
    "Un permis de commerce à moitié brûlé",
    "Une carte du pays avec des annotations personnelles",
    "Un poème inachevé sur le revers d'une facture",
    "Une liste de noms sans titre",
    "Un mandat d'arrêt non exécuté",
    "Une généalogie familiale avec une branche barrée",
  ]),
  ...many(TABLE_IDS.objetsMagiques, [
    "Une amulette qui reste froide même au feu",
    "Un anneau de cuivre qui noircit près du mensonge",
    "Une lanterne dont la flamme ne vacille pas",
    "Un miroir qui montre la pièce quelques secondes plus tard",
    "Une plume qui écrit sans encre",
    "Une boussole qui indique autre chose que le nord",
    "Un dé en os qui tombe toujours sur le même nombre",
    "Une cape qui ne garde ni pluie ni poussière",
    "Une pierre de lune qui luit à la lumière des bougies",
    "Un sifflet dont le son n'est audible que des chiens",
    "Un coffret qui ne s'ouvre qu'à la tombée de la nuit",
    "Une bague qui laisse une marque de givre sur la peau",
  ])
);

// Objets de valeur plus probables pour certains milieux.
["noble", "commerce"].forEach((tag) =>
  ajouterAvecTags(TABLE_IDS.objetsValeurs, [
    tag === "noble"
      ? "Un sceau de cire aux armes d'une maison"
      : "Un bordereau de cargaison marqué d'un cachet de guilde",
  ], [tag])
);
["crime"].forEach((tag) =>
  ajouterAvecTags(TABLE_IDS.objetsSuspects, [
    "Un jeu de dés pipés enveloppé dans un chiffon",
    "Une fiole de poison sans étiquette",
  ], [tag])
);
["occulte"].forEach((tag) =>
  ajouterAvecTags(TABLE_IDS.documents, [
    "Un grimoire incomplet dont les marges sont couvertes de notes fiévreuses",
    "Un parchemin couvert d'un alphabet que personne ne lit",
  ], [tag])
);

export const ENTRIES_RELATIONS_EQUIPEMENT = entries;
