// Catalogue d'effets.
// Les 10 états préjudiciables sont les valeurs OFFICIELLES du livre de base
// (LDB) : Aveuglé, Affaibli, Essoufflé, Étourdi, Immobilisé, Invalide,
// Paralysé, Ralenti, Renversé, Surpris. Le moteur applique ce qu'il peut
// (jets d'attaque, DEF, dé bonus/malus, toucher auto + critique du paralysé,
// malus à distance de l'aveuglé) ; le reste est marqué (MJ) dans la
// description : déplacements, actions par round, initiative (déjà tirée),
// sorts exigeant la vue, tests hors jets d'attaque.
// Les autres entrées (empoisonné, saignement...) sont génériques (assistant),
// ajustables par le MJ.

export interface EffectTemplate {
  key: string;
  nom: string;
  description: string;
  dureeDefaut: number | null;
  modificateurs: Record<string, number>;
}

export const EFFECT_CATALOG: EffectTemplate[] = [
  // États préjudiciables officiels (LDB).
  { key: "aveugle", nom: "Aveuglé", description: "−5 en attaque et en DEF, −10 en attaque à distance. −5 en Init. au prochain jet (MJ, initiative déjà tirée) ; sorts exigeant de voir la cible impossibles (MJ).", dureeDefaut: 2, modificateurs: { attaque: -5, defense: -5, attaqueDistance: -5 } },
  { key: "affaibli", nom: "Affaibli", description: "Dé malus à tous les tests (moteur : jets d'attaque ; autres tests : MJ).", dureeDefaut: 2, modificateurs: { deMalus: 1 } },
  { key: "essouffle", nom: "Essoufflé", description: "Déplacement limité à 5 m par action de mouvement (MJ).", dureeDefaut: 2, modificateurs: { deplacementMax: 5 } },
  { key: "etourdi", nom: "Étourdi", description: "Aucune action possible et −5 en DEF.", dureeDefaut: 1, modificateurs: { empecheAgir: 1, defense: -5 } },
  { key: "immobilise", nom: "Immobilisé", description: "Pas de déplacement (MJ) et dé malus aux tests d'attaque.", dureeDefaut: 2, modificateurs: { deMalus: 1, pasDeDeplacement: 1 } },
  { key: "invalide", nom: "Invalide", description: "Déplacement limité à 5 m par action de mouvement (MJ).", dureeDefaut: 2, modificateurs: { deplacementMax: 5 } },
  { key: "paralyse", nom: "Paralysé", description: "Aucune action possible ; touché automatiquement et subit un critique.", dureeDefaut: 2, modificateurs: { empecheAgir: 1, paralyse: 1 } },
  { key: "ralenti", nom: "Ralenti", description: "Une seule action par round, d'attaque ou de mouvement (MJ).", dureeDefaut: 2, modificateurs: { actionUnique: 1 } },
  { key: "renverse", nom: "Renversé", description: "−5 en attaque et en DEF ; se relever exige une action d'attaque (MJ).", dureeDefaut: 2, modificateurs: { attaque: -5, defense: -5 } },
  { key: "surpris", nom: "Surpris", description: "Pas d'action et −5 en DEF au premier round de combat.", dureeDefaut: 1, modificateurs: { empecheAgir: 1, defense: -5 } },
  // Effets de sorts officiels (LDB) : Enseveli (Ensevelissement).
  { key: "enseveli", nom: "Enseveli", description: "Enterré vivant (Ensevelissement) : aucune action, inciblable ; 2d4°/round. Sortie : action limitée, test FOR/AGI diff 15 (aides +2, max +10). À 0 PV : décès au tour suivant.", dureeDefaut: null, modificateurs: { empecheAgir: 1, inciblable: 1 } },
  // Options tactiques officielles (LDB) : postures déclarées au lieu d'attaquer (MJ : économie d'actions).
  { key: "defense-partielle", nom: "Défense partielle", description: "LDB (A) : +3 en DEF et aux tests opposés pour résister (MJ) pendant 1 round. Générale : contact, distance et magie.", dureeDefaut: 1, modificateurs: { defense: 3 } },
  { key: "defense-totale", nom: "Défense totale", description: "LDB (L) : +5 en DEF et aux tests opposés pour résister (MJ) pendant 1 round. Générale : contact, distance et magie.", dureeDefaut: 1, modificateurs: { defense: 5 } },
  { key: "riposte-posture", nom: "Posture de riposte", description: "LDB (L ou A, au contact) : déclarée en début de round ; si attaqué au contact, riposte immédiate sur son tour (1/round — avant sa propre initiative : attaque seule). Le MJ fait jouer la riposte (sélectionner le riposteur comme attaquant).", dureeDefaut: 1, modificateurs: { ripostePosture: 1 } },
  { key: "soutien-tactique", nom: "Soutien", description: "LDB (L) : sacrifie toutes ses actions — +5 en attaque au contact à un allié contre la créature désignée, jusqu’au tour de l’allié au round suivant. Au contact de la créature, action offensive (MJ).", dureeDefaut: 1, modificateurs: { attaque: 5 } },
  // Effets génériques (assistant, ajustables par le MJ).
  { key: "empoisonne", nom: "Empoisonné", description: "Perd 1 PV au début de son tour et −2 aux jets d'attaque (générique, ajustable par le MJ).", dureeDefaut: 3, modificateurs: { attaque: -2, pvParTour: -1 } },
  { key: "saignement", nom: "Saignement", description: "Perd 2 PV au début de son tour (générique).", dureeDefaut: 3, modificateurs: { pvParTour: -2 } },
  { key: "protection", nom: "Protection", description: "+2 défense (générique).", dureeDefaut: 3, modificateurs: { defense: 2 } },
  { key: "bonus-attaque", nom: "Bonus d'attaque", description: "+2 attaque (générique).", dureeDefaut: 2, modificateurs: { attaque: 2 } },
  { key: "brulure", nom: "Brûlure", description: "Perd 1 PV au début de son tour (Feu, générique).", dureeDefaut: 2, modificateurs: { pvParTour: -1 } },
  { key: "gele", nom: "Gelé", description: "−1 attaque, ralenti (Glace, générique).", dureeDefaut: 1, modificateurs: { attaque: -1 } },
  { key: "concentration", nom: "Concentration", description: "Marqueur, aucun modificateur.", dureeDefaut: null, modificateurs: {} },
  { key: "travail-equipe", nom: "Travail d'équipe", description: "Loup au contact du rôdeur (MJ : adjacence déclarée) : dé bonus en attaque.", dureeDefaut: null, modificateurs: { deBonus: 1 } },
];
