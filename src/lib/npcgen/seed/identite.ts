import { SEXES, TABLE_IDS } from "@/src/lib/npcgen/types";
import { fabrique } from "@/src/lib/npcgen/seed/helpers";

const { E, many, entries } = fabrique();

const ESPECES: [string, number, string[]][] = [
  ["Humain", 22, ["cité", "route", "noble"]],
  ["Nain", 7, ["montagne", "forge", "clan"]],
  ["Elfe haut", 5, ["savoir", "forêt", "ancien"]],
  ["Demi-Elfe", 5, ["frontière", "forêt", "ville"]],
  ["Halfelin", 5, ["campagne", "rivière", "communauté"]],
  ["Gnome", 3, ["atelier", "savoir", "curiosité"]],
  ["Orc", 3, ["tribu", "frontière", "guerre"]],
  ["Sang-mêlé", 2, ["frontière", "ville", "exil"]],
];

const PREMONS: Record<string, { masculins: string[]; feminins: string[] }> = {
  Citadine: {
    masculins: ["Aldric", "Bastien", "Cédric", "Dorien", "Éloi", "Gaspard", "Hugo", "Jules", "Lucien", "Marcel", "Nicolas", "Renaud", "Simon", "Théo", "Valentin"],
    feminins: ["Adèle", "Blanche", "Camille", "Delphine", "Élise", "Fleur", "Gaëlle", "Hélène", "Iris", "Jeanne", "Lucie", "Margot", "Nina", "Rose", "Sabine"],
  },
  Rurale: {
    masculins: ["Anselme", "Bertrand", "Colin", "Denis", "Étienne", "Firmin", "Gilles", "Henri", "Jacques", "Martin", "Noël", "Odon", "Pascal", "Raoul", "Tristan"],
    feminins: ["Agnès", "Berthe", "Claudine", "Denise", "Ermeline", "Francine", "Gisèle", "Hortense", "Irène", "Jacqueline", "Léonore", "Mathilde", "Nicole", "Perrine", "Yvette"],
  },
  Nordique: {
    masculins: ["Ari", "Bjorn", "Dag", "Eirik", "Falk", "Gunnar", "Hakon", "Ivar", "Jorunn", "Kjetil", "Leif", "Magnus", "Nils", "Rolf", "Sven"],
    feminins: ["Astrid", "Bera", "Dagny", "Eira", "Freya", "Gudrun", "Hilda", "Ingrid", "Karin", "Liv", "Maja", "Runa", "Sigrid", "Solveig", "Thyra"],
  },
  Savante: {
    masculins: ["Anselme", "Benedict", "Cassien", "Damien", "Érasme", "Faustin", "Grégoire", "Isidore", "Jérôme", "Lazare", "Marius", "Odon", "Quentin", "Séverin", "Ulysse"],
    feminins: ["Adélaïde", "Béatrice", "Clémence", "Diane", "Eudoxie", "Faustine", "Grâce", "Honorine", "Isabeau", "Julienne", "Léonie", "Maud", "Olympe", "Priscille", "Viviane"],
  },
  Nomade: {
    masculins: ["Amar", "Barak", "Dorian", "Eskil", "Farid", "Gideon", "Hakan", "Ilyas", "Jamal", "Karim", "Malik", "Nadir", "Rashid", "Samir", "Tarek"],
    feminins: ["Aïcha", "Badia", "Dalia", "Esma", "Farida", "Ghaliya", "Hafsa", "Ines", "Jamila", "Kenza", "Layla", "Mina", "Nadia", "Salma", "Yasmina"],
  },
  Maritime: {
    masculins: ["Aaron", "Bran", "Corin", "Dorian", "Ewan", "Fen", "Galen", "Hollis", "Isidore", "Jory", "Kael", "Lars", "Milo", "Orin", "Perrin"],
    feminins: ["Alma", "Brine", "Cora", "Darya", "Eline", "Fenna", "Gale", "Hilde", "Isla", "Jora", "Kira", "Lina", "Maren", "Nora", "Sela"],
  },
};

const NOMS: Record<string, string[]> = {
  Citadine: ["Aubépine", "Beaulieu", "Corvin", "Dufresne", "Épervier", "Fontaine", "Grimaud", "Hachette", "Lorrain", "Marchand", "Noiret", "Perrin", "Roux", "Sable", "Valmont"],
  Rurale: ["Berger", "Champfort", "Deschamps", "Faucheux", "Grandpré", "Lemoine", "Meunier", "Pommier", "Rivière", "Sabot", "Terrier", "Verger", "Vigneron"],
  Nordique: ["Barbe-de-Fer", "Brumeval", "Corne-de-Brume", "Fjord", "Havard", "Loup-Gris", "Marche-Neige", "Rochelac", "Stern", "Ventfroid", "Vif-Écume"],
  Savante: ["Alambert", "Beauvoir", "Cendrelune", "Duval", "Étoile", "Livre-Ouvert", "Montaigne", "Noirclair", "Parchemine", "Sancte", "Verrier"],
  Nomade: ["al-Rahim", "Ben-Hassan", "des Dunes", "el-Farid", "Kadri", "Mansour", "Nasser", "Orient", "Sultan", "Zahir"],
  Maritime: ["Briselame", "Cordage", "Écume", "Flamme-Saline", "Gouffre", "Marin", "Mouette", "Quille", "Récif", "Sel", "Vague"],
};

ESPECES.forEach(([valeur, poids, tags]) => {
  entries.push(
    E(TABLE_IDS.especes, valeur, {
      poids,
      tags,
      description:
        valeur === "Humain"
          ? "Le peuple le plus répandu, présent dans presque toutes les cultures."
          : undefined,
    })
  );
});

for (const sexe of SEXES) {
  entries.push(
    E(TABLE_IDS.sexes, sexe, {
      poids: 10,
      meta: { code: sexe },
    })
  );
}

Object.keys(PREMONS).forEach((culture) => {
  entries.push(
    E(TABLE_IDS.cultures, culture, {
      tags: [culture.toLowerCase()],
      meta: { culture },
      description: `Culture ${culture.toLowerCase()}.`,
    })
  );
  PREMONS[culture].masculins.forEach((prenom) =>
    entries.push(
      E(TABLE_IDS.prenomsMasculins, prenom, {
        tags: [culture.toLowerCase()],
        conditions: { sexes: ["masculin"] },
        meta: { culture, sexe: "masculin" },
      })
    )
  );
  PREMONS[culture].feminins.forEach((prenom) =>
    entries.push(
      E(TABLE_IDS.prenomsFeminins, prenom, {
        tags: [culture.toLowerCase()],
        conditions: { sexes: ["feminin"] },
        meta: { culture, sexe: "feminin" },
      })
    )
  );
  NOMS[culture].forEach((nom) =>
    entries.push(E(TABLE_IDS.nomsFamille, nom, { tags: [culture.toLowerCase()], meta: { culture } }))
  );
});

entries.push(
  E(TABLE_IDS.tranchesAge, "Enfant", { poids: 2, meta: { min: 8, max: 15 } }),
  E(TABLE_IDS.tranchesAge, "Jeune adulte", { poids: 12, meta: { min: 16, max: 25 } }),
  E(TABLE_IDS.tranchesAge, "Adulte", { poids: 20, meta: { min: 26, max: 45 } }),
  E(TABLE_IDS.tranchesAge, "Adulte confirmé", { poids: 13, meta: { min: 46, max: 60 } }),
  E(TABLE_IDS.tranchesAge, "Vieillard", { poids: 7, meta: { min: 61, max: 78 } }),
  E(TABLE_IDS.tranchesAge, "Très vieux", { poids: 2, meta: { min: 79, max: 110 } })
);

entries.push(
  E(TABLE_IDS.tailles, "Petite", { poids: 5, meta: { min: 148, max: 160 } }),
  E(TABLE_IDS.tailles, "Moyenne", { poids: 22, meta: { min: 161, max: 175 } }),
  E(TABLE_IDS.tailles, "Grande", { poids: 15, meta: { min: 176, max: 190 } }),
  E(TABLE_IDS.tailles, "Très grande", { poids: 3, meta: { min: 191, max: 205 } }),
  E(TABLE_IDS.corpulences, "Menu", { poids: 8, meta: { facteur: 0.9 } }),
  E(TABLE_IDS.corpulences, "Svelte", { poids: 12, meta: { facteur: 0.96 } }),
  E(TABLE_IDS.corpulences, "Moyenne", { poids: 20, meta: { facteur: 1 } }),
  E(TABLE_IDS.corpulences, "Robuste", { poids: 12, meta: { facteur: 1.1 } }),
  E(TABLE_IDS.corpulences, "Fort", { poids: 6, meta: { facteur: 1.2 } }),
  E(TABLE_IDS.corpulences, "Très corpulent", { poids: 2, meta: { facteur: 1.35 } })
);

export const ENTRIES_IDENTITE = entries;
