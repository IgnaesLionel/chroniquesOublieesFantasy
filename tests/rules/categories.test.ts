import { describe, expect, it } from "vitest";
import {
  SOUS_CATEGORIES_SUGGEREES,
  categoriesMonstre,
  cibleEspeceAcceptee,
  estDeCategorie,
  estVivant,
  normaliserCategorie,
} from "@/src/lib/rules/categories";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import { monsterSchema, sortSchema } from "@/src/lib/data/validation";
import { SEED_MONSTERS, avecSousCategoriesGraines } from "@/src/lib/data/seeds";

describe("sous-catégories de créatures", () => {
  it("normalisation insensible casse/accents/séparateurs + pluriels usuels", () => {
    expect(normaliserCategorie("Mort-vivant")).toBe("mort-vivant");
    expect(normaliserCategorie("MORT-VIVANT")).toBe("mort-vivant");
    expect(normaliserCategorie("mort vivant")).toBe("mort-vivant");
    expect(normaliserCategorie("Morts-Vivants")).toBe("mort-vivant");
    expect(normaliserCategorie("Démon")).toBe("demon");
    expect(normaliserCategorie("demon")).toBe("demon");
    expect(normaliserCategorie("Démons")).toBe("demon");
    expect(normaliserCategorie("Humanoïde")).toBe("humanoide");
  });

  it("suggestions : Mort-vivant et Démon proposés", () => {
    expect(SOUS_CATEGORIES_SUGGEREES).toContain("Mort-vivant");
    expect(SOUS_CATEGORIES_SUGGEREES).toContain("Démon");
  });

  it("categoriesMonstre fusionne type + catégorie + sous-catégories, dédupliquées", () => {
    expect(categoriesMonstre({ type: "Créature", categorie: "Monstres/Créatures", sousCategories: ["Mort-vivant"] })).toEqual(
      ["creature", "monstres/creatures", "mort-vivant"]
    );
    // Doublon via type ("Humanoïde") et sous-catégorie : une seule entrée.
    expect(categoriesMonstre({ type: "Humanoïde", sousCategories: ["humanoide"] })).toEqual(["humanoide"]);
    expect(categoriesMonstre({})).toEqual([]);
  });

  it("estDeCategorie matche malgré casse/accents, faux sinon", () => {
    const squelette = { categories: ["creature", "monstres/creatures", "mort-vivant"] };
    expect(estDeCategorie(squelette, "mort-vivant")).toBe(true);
    expect(estDeCategorie(squelette, "Mort-Vivant")).toBe(true);
    expect(estDeCategorie(squelette, "Morts-Vivants")).toBe(true);
    expect(estDeCategorie(squelette, "démon")).toBe(false);
    expect(estDeCategorie(undefined, "mort-vivant")).toBe(false);
    expect(estDeCategorie({}, "mort-vivant")).toBe(false);
  });

  it("factory : les instances de monstres portent catégories + libellés bruts", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom === "Squelette")!;
    const [inst] = monsterInstances(tpl, 1);
    expect(inst.sousCategories).toEqual(["Mort-vivant"]);
    expect(estDeCategorie(inst, "mort-vivant")).toBe(true);
    expect(estDeCategorie(inst, "démon")).toBe(false);
  });

  it("graines : les 6 morts-vivants cités + zombies/goule/vampires/ombre tagués, golem construit", () => {
    const parNom = new Map(SEED_MONSTERS.map((m) => [m.nom, m]));
    for (const nom of ["Momie auguste", "Squelette géant", "Momie", "Zombies coriaces", "Sigméus, le nécromant", "Squelette"]) {
      expect(parNom.get(nom)?.sousCategories, nom).toEqual(["Mort-vivant"]);
    }
    for (const nom of ["Zombie humain", "Zombie choursette", "Zombie ourhible", "Goule", "Vampire", "Vampire ancien", "Ombre"]) {
      expect(parNom.get(nom)?.sousCategories, nom).toEqual(["Mort-vivant"]);
    }
    expect(parNom.get("Golem de chair")?.sousCategories).toEqual(["Construit"]);
    // Démonet : humanoïde ET démon (sous-catégorie orthogonale au type).
    expect(parNom.get("Démonet")?.type).toBe("Humanoïde");
    expect(parNom.get("Démonet")?.sousCategories).toEqual(["Démon"]);
    // Mais la catégorie principale est conservée (filtre existant intact).
    expect(parNom.get("Squelette")?.categorie).toBe("Monstres/Créatures");
  });

  it("migration : sauvegarde locale ancienne (sans champ) enrichie depuis les graines, choix MJ préservés", () => {
    const squeletteGraine = SEED_MONSTERS.find((m) => m.nom === "Squelette")!;
    const gobelinGraine = SEED_MONSTERS.find((m) => m.nom === "Gobelin de base")!;
    // Ancienne sauvegarde : champ absent -> tags de la graine reportés.
    const strip = (m: typeof squeletteGraine) => {
      const copie = { ...m };
      delete copie.sousCategories;
      return copie;
    };
    const vieux = [strip(squeletteGraine), strip(gobelinGraine)];
    expect(vieux[0].sousCategories).toBeUndefined();
    const migres = avecSousCategoriesGraines(vieux);
    expect(migres.find((m) => m.nom === "Squelette")?.sousCategories).toEqual(["Mort-vivant"]);
    // Non tagué dans les graines : inchangé (même référence).
    expect(migres.find((m) => m.nom === "Gobelin de base")).toBe(vieux[1]);
    // Choix du MJ (champ défini, même vide) : jamais écrasé.
    expect(avecSousCategoriesGraines([{ ...squeletteGraine, sousCategories: [] }])[0].sousCategories).toEqual([]);
    // Monstre créé par l'utilisateur (id inconnu des graines) : inchangé.
    const cree = { ...strip(squeletteGraine), id: "m-xyz" };
    expect(avecSousCategoriesGraines([cree])[0]).toBe(cree);
  });

  it("validation : sousCategories accepté, monstre tagué valide", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom === "Squelette")!;
    expect(monsterSchema.safeParse(tpl).success).toBe(true);
    expect(monsterSchema.safeParse({ ...tpl, sousCategories: ["Mort-vivant", "Custom"] }).success).toBe(true);
  });

  it("estVivant : PJ oui, morts-vivants et construits non", () => {
    expect(estVivant({ camp: "pj" })).toBe(true);
    const squelette = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Squelette")!, 1)[0];
    expect(estVivant(squelette)).toBe(false);
    const golem = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Golem de chair")!, 1)[0];
    expect(estVivant(golem)).toBe(false);
    const gobelin = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Gobelin de base")!, 1)[0];
    expect(estVivant(gobelin)).toBe(true);
  });

  it("cibleEspeceAcceptee : sans restriction toujours, sinon espèce requise", () => {
    const mortVivant = { categories: ["creature", "mort-vivant"] };
    const gobelin = { categories: ["humanoide"] };
    expect(cibleEspeceAcceptee(undefined, gobelin)).toBe(true);
    expect(cibleEspeceAcceptee({}, gobelin)).toBe(true);
    expect(cibleEspeceAcceptee({ cibleEspeces: [] }, gobelin)).toBe(true);
    expect(cibleEspeceAcceptee({ cibleEspeces: ["Mort-vivant"] }, mortVivant)).toBe(true);
    expect(cibleEspeceAcceptee({ cibleEspeces: ["mort-vivant"] }, mortVivant)).toBe(true);
    expect(cibleEspeceAcceptee({ cibleEspeces: ["Mort-vivant"] }, gobelin)).toBe(false);
    expect(cibleEspeceAcceptee({ cibleEspeces: ["Mort-vivant", "Démon"] }, { categories: ["demon"] })).toBe(true);
  });

  it("validation : sort à restriction d'espèce accepté (Destruction du mal)", () => {
    expect(sortSchema.safeParse({ id: "x", nom: "X", type: "offensif", cibleEspeces: ["Mort-vivant"] }).success).toBe(true);
  });
});
