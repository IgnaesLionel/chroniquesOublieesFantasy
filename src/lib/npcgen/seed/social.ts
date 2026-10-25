import { IMPORTANCES, NIVEAUX_SOCIAUX, TABLE_IDS } from "@/src/lib/npcgen/types";
import { fabrique } from "@/src/lib/npcgen/seed/helpers";

const { E, many, entries } = fabrique();

type ProfessionSeed = [
  nom: string,
  categorie: string,
  niveau: (typeof NIVEAUX_SOCIAUX)[number],
  tags: string[],
  description: string,
  extra?: Record<string, string | string[] | number | boolean>,
];

const PROFESSIONS: ProfessionSeed[] = [
  ["Mendiant", "Misère", "precaire", ["pauvre", "rue", "ville"], "Survit d'aumônes et connaît les rues mieux que les gardes."],
  ["Cueilleur", "Campagne", "precaire", ["pauvre", "nature", "campagne"], "Cueille baies, racines et plantes utiles pour les vendre au marché."],
  ["Porteur d'eau", "Misère", "precaire", ["pauvre", "ville", "effort"], "Transporte des seaux du puits aux maisons et aux ateliers."],
  ["Fossoyeur", "Misère", "precaire", ["pauvre", "mort", "ville"], "Enterre les morts et connaît tous les secrets du cimetière."],
  ["Ratier", "Misère", "precaire", ["pauvre", "égouts", "ville"], "Nettoie caves et égouts, et revend ce qu'il y trouve."],
  ["Paysan", "Campagne", "precaire", ["campagne", "nature", "travail"], "Travaille la terre d'un seigneur ou d'un domaine familial."],
  ["Berger", "Campagne", "precaire", ["campagne", "nature", "solitude"], "Garde les troupeaux et connaît les chemins de traverse."],
  ["Bûcheron", "Campagne", "precaire", ["campagne", "forêt", "effort"], "Abat le bois de la forêt et le descend jusqu'au village."],
  ["Pêcheur", "Maritime", "precaire", ["mer", "rivière", "nature"], "Vit de la pêche côtière ou fluviale."],
  ["Batelier", "Maritime", "modeste", ["rivière", "voyage", "transport"], "Conduit une barque de marchandises le long du fleuve."],
  ["Boulanger", "Artisanat", "modeste", ["ville", "nourriture", "artisanat"], "Cuit le pain du quartier et se lève avant l'aube."],
  ["Boucher", "Artisanat", "modeste", ["ville", "nourriture", "artisanat"], "Débite la viande et fournit les cuisines du bourg."],
  ["Poissonnier", "Artisanat", "modeste", ["ville", "marché", "nourriture"], "Vend le poisson frais à la criée."],
  ["Aubergiste", "Commerce", "modeste", ["ville", "auberge", "rumeurs"], "Tient une auberge où se croisent voyageurs et nouvelles."],
  ["Serveuse", "Commerce", "precaire", ["auberge", "ville", "rumeurs"], "Sert les clients et entend tout ce qui se dit aux tables."],
  ["Cuisinier", "Artisanat", "modeste", ["nourriture", "auberge", "ville"], "Cuisine pour une auberge, un château ou une maisonnée."],
  ["Charpentier", "Artisanat", "modeste", ["artisanat", "bois", "construction"], "Élève charpentes, ponts et échafaudages."],
  ["Maçon", "Artisanat", "modeste", ["artisanat", "pierre", "construction"], "Bâtit murs et remparts, tailleur de pierre à l'occasion."],
  ["Forgeron", "Artisanat", "modeste", ["artisanat", "forge", "guerre"], "Travaille le fer et répare les armes du voisinage.", { combat: "oui" }],
  ["Armurier", "Artisanat", "aise", ["artisanat", "forge", "guerre"], "Entretient et vend armes et armures.", { combat: "oui" }],
  ["Cordonnier", "Artisanat", "modeste", ["artisanat", "ville", "cuir"], "Fabrique et répare les chaussures."],
  ["Tisserand", "Artisanat", "modeste", ["artisanat", "textile", "ville"], "Tisse la laine et le lin à domicile ou à l'atelier."],
  ["Meunier", "Artisanat", "modeste", ["campagne", "nourriture", "rivière"], "Fait tourner le moulin et prélève sa part de farine."],
  ["Chasseur", "Campagne", "modeste", ["nature", "forêt", "chasse"], "Piste le gibier et connaît les signes de la forêt.", { combat: "oui" }],
  ["Dresseur", "Campagne", "modeste", ["nature", "animaux", "campagne"], "Élève chiens, chevaux ou oiseaux pour un maître."],
  ["Palefrenier", "Écurie", "precaire", ["chevaux", "ville", "travail"], "Soigne les chevaux et prépare les montures."],
  ["Servante", "Domesticité", "precaire", ["maison", "travail", "rumeurs"], "Entretient une maison noble et connaît ses habitudes."],
  ["Valet", "Domesticité", "modeste", ["maison", "service", "noble"], "Sert un maître, d'ordinaire avec discrétion."],
  ["Scribe public", "Savoir", "modeste", ["savoir", "ville", "écriture"], "Rédige lettres et actes pour ceux qui ne savent pas écrire."],
  ["Messager", "Voyage", "modeste", ["route", "voyage", "information"], "Porte plis et nouvelles de bourg en bourg."],
  ["Charretier", "Voyage", "modeste", ["route", "transport", "voyage"], "Conduit charrettes et marchandises sur les routes."],
  ["Marin", "Maritime", "modeste", ["mer", "voyage", "équipage"], "Travaille à bord d'un navire marchand ou de pêche.", { combat: "oui" }],
  ["Capitaine de navire", "Maritime", "aise", ["mer", "voyage", "commandement"], "Commande un navire, son équipage et sa cargaison.", { combat: "oui" }],
  ["Marchand", "Commerce", "aise", ["commerce", "ville", "voyage"], "Achète et revend des marchandises sur plusieurs marchés."],
  ["Colporteur", "Commerce", "modeste", ["route", "commerce", "voyage"], "Transporte sa boutique sur le dos de village en village."],
  ["Marchand d'étoffes", "Commerce", "aise", ["commerce", "textile", "ville"], "Négocie tissus précieux et commandes de la noblesse."],
  ["Aubergiste prospère", "Commerce", "aise", ["auberge", "ville", "rumeurs"], "Dirige plusieurs établissements et connaît les voyageurs importants."],
  ["Apothicaire", "Savoir", "aise", ["savoir", "soin", "ville"], "Prépare remèdes et poisons à partir de plantes et de minéraux."],
  ["Herboriste", "Savoir", "modeste", ["savoir", "nature", "soin"], "Connaît les plantes médicinales et leurs usages."],
  ["Guérisseur", "Savoir", "modeste", ["soin", "campagne", "croyance"], "Soigne par les simples, les prières ou les gestes appris."],
  ["Sage-femme", "Savoir", "modeste", ["soin", "campagne", "communauté"], "Accompagne les naissances et connaît les secrets des familles."],
  ["Bibliothécaire", "Savoir", "aise", ["savoir", "écriture", "ville"], "Garde des livres rares et sait qui les consulte."],
  ["Érudit", "Savoir", "aise", ["savoir", "écriture", "histoire"], "Étudie textes anciens, langues et chroniques."],
  ["Cartographe", "Savoir", "aise", ["savoir", "voyage", "cartographie"], "Dessine cartes et itinéraires pour marchands et armées."],
  ["Astronome", "Savoir", "aise", ["savoir", "étoiles", "magie"], "Observe les astres et interprète leurs cycles."],
  ["Alchimiste", "Occulte", "aise", ["occulte", "savoir", "laboratoire"], "Transforme minerais et plantes en remèdes, encres ou explosifs.", { combat: "oui" }],
  ["Sorcier de village", "Occulte", "modeste", ["occulte", "campagne", "croyance"], "Vend charmes, protections et conseils contre les maux ordinaires."],
  ["Devin", "Occulte", "modeste", ["occulte", "voyage", "rumeurs"], "Lit les cartes, les os ou les rêves pour prédire l'avenir."],
  ["Exorciste", "Occulte", "aise", ["occulte", "religion", "combat"], "Purge les lieux et les personnes des présences hostiles.", { combat: "oui" }],
  ["Mage de cour", "Occulte", "riche", ["occulte", "noble", "savoir"], "Conseille un seigneur et pratique une magie encadrée.", { combat: "oui" }],
  ["Prêtre", "Religion", "aise", ["religion", "soin", "communauté"], "Célèbre les rites et veille sur sa congrégation."],
  ["Grand prêtre", "Religion", "puissant", ["religion", "commandement", "noble"], "Dirige un temple et pèse sur les décisions de la cité."],
  ["Moine", "Religion", "modeste", ["religion", "savoir", "retraite"], "Vit selon une règle et copie des manuscrits.", { combat: "oui" }],
  ["Druide", "Religion", "modeste", ["nature", "religion", "occulte"], "Garde les équilibres sacrés des forêts et des sources.", { combat: "oui" }],
  ["Garde", "Militaire", "modeste", ["militaire", "ville", "ordre"], "Patrouille les rues et surveille les portes.", { combat: "oui" }],
  ["Soldat", "Militaire", "modeste", ["militaire", "guerre", "ordre"], "Sert dans une troupe, une milice ou une garnison.", { combat: "oui" }],
  ["Mercenaire", "Militaire", "modeste", ["militaire", "guerre", "route"], "Vend sa lame au plus offrant, sans se demander pourquoi.", { combat: "oui" }],
  ["Chevalier", "Militaire", "riche", ["militaire", "noble", "guerre"], "Guerrier de rang, lié par serment à un seigneur.", { combat: "oui" }],
  ["Capitaine", "Militaire", "aise", ["militaire", "commandement", "guerre"], "Commande une compagnie et répond de ses pertes.", { combat: "oui" }],
  ["Maître d'armes", "Militaire", "aise", ["militaire", "savoir", "guerre"], "Entraîne les jeunes nobles et les recrues.", { combat: "oui" }],
  ["Archer de la garde", "Militaire", "modeste", ["militaire", "distance", "ville"], "Surveille remparts et toits, arc ou arbalète à portée.", { combat: "oui" }],
  ["Voleur", "Crime", "precaire", ["crime", "ville", "discrétion"], "Vide les bourses et s'introduit là où il ne devrait pas."],
  ["Pickpocket", "Crime", "precaire", ["crime", "rue", "discrétion"], "Travaille dans les foules et les marchés."],
  ["Contrebandier", "Crime", "modeste", ["crime", "route", "commerce"], "Fait passer marchandises et gens à travers les contrôles.", { combat: "oui" }],
  ["Receleur", "Crime", "modeste", ["crime", "commerce", "ville"], "Achète discrètement ce qui ne peut pas être montré au marché."],
  ["Usurier", "Crime", "aise", ["crime", "argent", "ville"], "Prête à ceux que les banques refusent, avec ses propres garanties."],
  ["Assassin", "Crime", "aise", ["crime", "discrétion", "violence"], "Vend la mort d'une cible préparée avec patience.", { combat: "oui" }],
  ["Espion", "Crime", "aise", ["crime", "information", "noble"], "Collecte secrets et rumeurs pour un commanditaire.", { combat: "oui" }],
  ["Noble", "Noblesse", "riche", ["noble", "cour", "politique"], "Vit des revenus de ses terres et de ses relations."],
  ["Seigneur", "Noblesse", "puissant", ["noble", "politique", "commandement"], "Gouverne un domaine, rend la justice et lève des troupes."],
  ["Dame de compagnie", "Noblesse", "aise", ["noble", "cour", "rumeurs"], "Accompagne une personne de rang et connaît les intrigues du palais."],
  ["Conseiller", "Politique", "riche", ["politique", "noble", "savoir"], "Oriente les décisions d'un seigneur ou d'un conseil."],
  ["Magistrat", "Politique", "riche", ["politique", "justice", "savoir"], "Instruit les affaires et rend la justice au nom de la cité."],
  ["Ambassadeur", "Politique", "puissant", ["politique", "voyage", "noble"], "Représente une puissance et négocie en son nom."],
  ["Banquier", "Argent", "riche", ["argent", "commerce", "ville"], "Garde les dépôts et finance expéditions et guerres."],
  ["Receveur des taxes", "Argent", "aise", ["argent", "politique", "ville"], "Collecte l'impôt et compte chaque pièce deux fois."],
  ["Joaillier", "Artisanat", "riche", ["artisanat", "argent", "noble"], "Taille et monte pierres précieuses pour une clientèle fortunée."],
  ["Aubergiste itinérant", "Voyage", "modeste", ["auberge", "voyage", "route"], "Installe tables et chaudrons là où passent les caravanes."],
  ["Guide de montagne", "Voyage", "modeste", ["montagne", "voyage", "nature"], "Conduit les voyageurs par les cols et les sentiers sûrs.", { combat: "oui" }],
  ["Éclaireur", "Militaire", "modeste", ["militaire", "nature", "voyage"], "Repère les chemins et surveille les mouvements ennemis.", { combat: "oui" }],
  ["Barde", "Art", "modeste", ["art", "voyage", "rumeurs"], "Chante pour son souper et retient les histoires des autres."],
  ["Comédien", "Art", "precaire", ["art", "ville", "voyage"], "Joue sur les tréteaux et change de nom selon les villes."],
  ["Enlumineur", "Art", "aise", ["art", "savoir", "écriture"], "Illustre manuscrits et armoiries."],
  ["Sculpteur", "Art", "aise", ["art", "pierre", "noble"], "Taille statues et bas-reliefs pour temples et demeures."],
  ["Maître de guilde", "Commerce", "puissant", ["commerce", "politique", "ville"], "Dirige une guilde et arbitre les conflits entre ses membres."],
  ["Collecteur de contes", "Savoir", "modeste", ["savoir", "voyage", "rumeurs"], "Écoute les récits des auberges et les recopie fidèlement."],
];

for (const [nom, categorie, niveauSocial, tags, description, extra] of PROFESSIONS) {
  entries.push(
    E(TABLE_IDS.professions, nom, {
      categorie,
      description,
      tags: [categorie.toLowerCase(), ...tags],
      conditions: { niveauxSociaux: [niveauSocial] },
      meta: {
        categorie,
        niveauSocial,
        affinites: tags,
        ...extra,
      },
    })
  );
}

const LIEUX: [string, string[], string][] = [
  ["La place du marché", ["ville", "commerce"], "Au cœur du bourg, entre étals et fontaine."],
  ["Une taverne enfumée", ["ville", "auberge"], "Tables grasses, chansons et oreilles indiscrètes."],
  ["Les docks au petit matin", ["mer", "rivière", "travail"], "Cordages, poisson et marins pressés."],
  ["La grande route", ["route", "voyage"], "Entre deux bornes, au milieu des charrettes."],
  ["Un temple discret", ["religion", "ville"], "L'odeur de l'encens couvre les conversations."],
  ["La bibliothèque", ["savoir", "ville"], "Silence poussiéreux et pages qui craquent."],
  ["Les remparts", ["militaire", "ville"], "Vue sur la campagne et sur les gardes qui s'ennuient."],
  ["Un atelier de forge", ["artisanat", "forge"], "Chaleur, étincelles et coups réguliers du marteau."],
  ["La forêt ancienne", ["nature", "forêt"], "Lumière verte et branches qui semblent écouter."],
  ["Un village de colline", ["campagne", "nature"], "Toits de chaume et chemins de terre."],
  ["La cour du château", ["noble", "politique"], "Pierre froide, livrées et chuchotements."],
  ["Un cimetière", ["mort", "ville"], "Les ifs font de l'ombre aux noms effacés."],
  ["Les égouts", ["ville", "crime", "misère"], "Briques humides et passages que personne n'avoue connaître."],
  ["Une caravane", ["voyage", "route", "commerce"], "Chameaux, chariots et feux du soir."],
  ["Le port", ["mer", "commerce"], "Mâts, mouettes et odeur de sel."],
  ["Une auberge de passage", ["route", "auberge"], "Lits partagés et soupe tiède."],
  ["La maison de guilde", ["commerce", "ville"], "Bois ciré, registres et ambitions."],
  ["Un monastère isolé", ["religion", "montagne"], "Cloches lointaines et neige sur les toits."],
  ["La cour de justice", ["justice", "ville"], "Bancs durs et sentences qui tombent."],
  ["Un champ de bataille ancien", ["guerre", "nature"], "Herbes hautes sur des souvenirs de fer."],
  ["La rivière", ["rivière", "nature"], "Passeurs, roseaux et bruits d'eau."],
  ["Une bibliothèque privée", ["savoir", "noble"], "Rayons interdits et clés bien gardées."],
  ["Le quartier des artisans", ["ville", "artisanat"], "Odeurs de cuir, de pain et de teinture."],
];

entries.push(
  ...LIEUX.map(([valeur, tags, description]) =>
    E(TABLE_IDS.lieux, valeur, { tags, description })
  )
);

entries.push(
  ...NIVEAUX_SOCIAUX.map((niveau, index) =>
    E(TABLE_IDS.niveauxSociaux, niveau, {
      poids: [8, 18, 16, 10, 5][index],
      meta: { rang: index + 1 },
    })
  )
);

entries.push(
  ...IMPORTANCES.map((importance, index) =>
    E(TABLE_IDS.importances, importance, {
      poids: [18, 14, 8, 3][index],
      meta: { rang: index + 1 },
    })
  )
);

export const ENTRIES_SOCIAL = entries;
