// Catalogue d'effets génériques. Valeurs EXEMPLES, non officielles COF V2.
// Le MJ peut ajuster durée / modificateurs à tout moment.

export interface EffectTemplate {
  key: string;
  nom: string;
  description: string;
  dureeDefaut: number | null;
  modificateurs: Record<string, number>;
}

export const EFFECT_CATALOG: EffectTemplate[] = [
  { key: "empoisonne", nom: "Empoisonné", description: "−2 aux jets d'attaque (exemple).", dureeDefaut: 3, modificateurs: { attaque: -2 } },
  { key: "etourdi", nom: "Étourdi", description: "Ne peut pas agir (exemple).", dureeDefaut: 1, modificateurs: { empecheAgir: 1 } },
  { key: "aveugle", nom: "Aveuglé", description: "−3 attaque (exemple).", dureeDefaut: 2, modificateurs: { attaque: -3 } },
  { key: "immobilise", nom: "Immobilisé", description: "Ne peut pas agir (exemple).", dureeDefaut: 2, modificateurs: { empecheAgir: 1 } },
  { key: "saignement", nom: "Saignement", description: "Perd 2 PV au début de son tour (exemple).", dureeDefaut: 3, modificateurs: { pvParTour: -2 } },
  { key: "protection", nom: "Protection", description: "+2 défense (exemple).", dureeDefaut: 3, modificateurs: { defense: 2 } },
  { key: "bonus-attaque", nom: "Bonus d'attaque", description: "+2 attaque (exemple).", dureeDefaut: 2, modificateurs: { attaque: 2 } },
  { key: "brulure", nom: "Brûlure", description: "Perd 1 PV au début de son tour (Feu, exemple).", dureeDefaut: 2, modificateurs: { pvParTour: -1 } },
  { key: "gele", nom: "Gelé", description: "−1 attaque, ralenti (Glace, exemple).", dureeDefaut: 1, modificateurs: { attaque: -1 } },
  { key: "concentration", nom: "Concentration", description: "Marqueur, aucun modificateur.", dureeDefaut: null, modificateurs: {} },
];
