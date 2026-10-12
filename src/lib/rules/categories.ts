// Catégories et sous-catégories de créatures (bestiaire).
// Une créature garde son type (Humanoïde, Animal, Créature...) et sa catégorie
// Notion (Monstres/Créatures, Animaux, Humains...), et peut en plus porter des
// sous-catégories libres : "Mort-vivant", "Démon"... Utile en combat car
// certains sorts/capacités frappent plus fort certaines espèces
// (ex : Arme de lumière, Destruction du mal contre démons et morts-vivants).

/** Suggestions de sous-catégories (saisie libre possible dans l'éditeur). */
export const SOUS_CATEGORIES_SUGGEREES = [
  "Mort-vivant",
  "Démon",
  "Céleste",
  "Esprit",
  "Construit",
  "Végétal",
] as const;

/** Pluriels et variantes -> forme canonique (clés déjà normalisées). */
const ALIAS_CATEGORIES: Record<string, string> = {
  "morts-vivants": "mort-vivant",
  "demons": "demon",
  "celestes": "celeste",
  "esprits": "esprit",
  "construits": "construit",
  "vegetaux": "vegetal",
  "humanoides": "humanoide",
  "animaux": "animal",
  "creatures": "creature",
};

const DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Normalise un libellé pour comparaison : minuscules, sans accents,
 * espaces/underscores -> tirets. "Mort-Vivant", "mort vivant", "MORT-VIVANT"
 * donnent tous "mort-vivant" ; "Démon" et "demon" donnent "demon".
 */
export function normaliserCategorie(libelle: string): string {
  const base = libelle
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(/[_\s]+/g, "-");
  return ALIAS_CATEGORIES[base] ?? base;
}

/** Libellés bruts d'un template -> liste normalisée dédupliquée (type + catégorie + sous-catégories). */
export function categoriesMonstre(template: {
  type?: string;
  categorie?: string;
  sousCategories?: string[];
}): string[] {
  const brutes = [template.type, template.categorie, ...(template.sousCategories ?? [])].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  return [...new Set(brutes.map(normaliserCategorie))];
}

/** Le participant appartient-il à cette espèce/catégorie ("mort-vivant", "démon", "humanoïde"... ) ? */
export function estDeCategorie(
  participant: { categories?: string[] } | null | undefined,
  categorie: string
): boolean {
  const cible = normaliserCategorie(categorie);
  return (participant?.categories ?? []).some((c) => normaliserCategorie(c) === cible);
}

/**
 * Le sort frappe-t-il cette cible ? Sans restriction d'espèce (champ absent
 * ou vide) : toujours. Sinon la cible doit appartenir à l'une des espèces
 * listées (ex: Destruction du mal -> ["Mort-vivant"]).
 */
export function cibleEspeceAcceptee(
  sort: { cibleEspeces?: string[] } | null | undefined,
  cible: { categories?: string[] } | null | undefined
): boolean {
  const especes = sort?.cibleEspeces ?? [];
  if (especes.length === 0) return true;
  return especes.some((e) => estDeCategorie(cible, e));
}
