import { describe, expect, it } from "vitest";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import type { Item } from "@/src/lib/rules/world/types";
import {
  ACTION_OBJET,
  chargesInitialesObjet,
  chargesRestantesObjet,
  identifierParchemin,
  lireParchemin,
  natureObjetCombat,
  resumeObjetCombat,
  soinPotion,
} from "@/src/lib/rules/combat/objets";

function objet(over: Partial<Item> = {}): Item {
  return {
    id: "objet-test",
    nom: "Objet",
    categorie: "divers",
    quantite: 1,
    exemple: false,
    ...over,
  };
}

describe("objets de combat", () => {
  it("reconnaît les potions par leur catégorie", () => {
    expect(natureObjetCombat(objet({ categorie: "potion", nom: "Potion de soin" }))).toBe("potion");
    expect(ACTION_OBJET.potion).toBe("mouvement");
  });

  it("reconnaît les parchemins, sauf les parchemins vierges", () => {
    expect(
      natureObjetCombat(
        objet({
          categorie: "outil",
          nom: "Parchemin — « Soins légers » (Voie des soins, rang 1)",
        })
      )
    ).toBe("parchemin");
    expect(natureObjetCombat(objet({ categorie: "outil", nom: "Parchemin vierge" }))).toBeNull();
    expect(ACTION_OBJET.parchemin).toBe("limitee");
  });

  it("distingue la baguette magique de la baguette-arme mundane", () => {
    expect(
      natureObjetCombat(
        objet({
          categorie: "outil",
          magique: true,
          nom: "Baguette — « Feu grégeois » (Voie de la magie élémentaire, rang 3)",
        })
      )
    ).toBe("baguette");
    expect(natureObjetCombat(objet({ categorie: "arme", nom: "Baguette (1d4)" }))).toBeNull();
    expect(ACTION_OBJET.baguette).toBe("attaque");
  });

  it("résume le rang et les charges des objets magiques", () => {
    const parchemin = objet({
      nom: "Parchemin — « Feu grégeois » (Voie de la magie élémentaire, rang 3)",
      description: "Sort scellé de rang 3.",
    });
    expect(resumeObjetCombat(parchemin, "parchemin")).toContain("rang 3");

    const baguette = objet({
      nom: "Baguette — « Feu grégeois »",
      effet: "12 charges, niveau de magie 1.",
    });
    expect(resumeObjetCombat(baguette, "baguette")).toContain("12 charges");
  });

  it("calcule le soin d'une potion avec le dé évolutif", () => {
    const potion = objet({ categorie: "potion", nom: "Potion de soin", effet: "Rend des PV (2d4°)." });
    const soin = soinPotion(potion, 1, {}, fixedRng([0, 0.5]));
    expect(soin).toEqual({ expression: "2d4", details: [1, 3], total: 4 });

    const hautNiveau = soinPotion(potion, 7, {}, fixedRng([0.5, 0.99]));
    expect(hautNiveau?.expression).toBe("2d6");
    expect(hautNiveau?.total).toBe(10);
  });

  it("substitue les caractéristiques et renvoie null sans formule", () => {
    const potion = objet({ categorie: "potion", effet: "Rend 2d4°+CHA PV." });
    const soin = soinPotion(potion, 1, { CHA: 2 }, fixedRng([0, 0.5]));
    expect(soin).toEqual({ expression: "2d4+2", details: [1, 3], total: 6 });

    expect(soinPotion(objet({ categorie: "potion", effet: "Invisibilité." }), 1)).toBeNull();
  });

  it("ignore les dés de tirage de la description (pas un soin)", () => {
    const potion = objet({
      categorie: "potion",
      nom: "Potion — Invisibilité (Magicien)",
      effet: "Invisibilité (Magicien)",
      description: "d6 = 5 → commune ; d10 = 9 → Invisibilité (Magicien).",
    });
    expect(soinPotion(potion, 1)).toBeNull();
  });

  it("suit les charges d'une baguette, avec ou sans compteur d'inventaire", () => {
    const baguette = objet({
      nom: "Baguette — « Feu grégeois »",
      effet: "12 charges, niveau de magie 1.",
    });
    expect(chargesInitialesObjet(baguette)).toBe(12);
    expect(chargesRestantesObjet({}, baguette)).toBe(12);
    expect(chargesRestantesObjet({ charges: 5 }, baguette)).toBe(5);
    expect(resumeObjetCombat(baguette, "baguette", 5)).toContain("5 charges");
  });

  it("identifie le sort scellé et sa famille", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération mineure » (Voie des soins, rang 1)",
    });
    const id = identifierParchemin(parchemin);
    expect(id.sort?.id).toBe("sort-recuperation-mineure");
    expect(id.rang).toBe(1);
    expect(id.famille).toBe("Mystique");
  });

  it("lit sans test un sort du profil au rang maîtrisé", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération mineure » (Voie des soins, rang 1)",
    });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Prêtre", famille: "Mystique", sorts: [{ rang: 1 }], niveau: 1, bonusMagique: 2 },
      fixedRng([0])
    );
    expect(resultat.statut).toBe("sans-test");
    expect(resultat.lance).toBe(true);
    expect(resultat.consomme).toBe(true);
    expect(resultat.message).toContain("aucun test");
  });

  it("teste un rang non maîtrisé et conserve le parchemin sur un échec < 10", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération majeure » (Voie des soins, rang 3)",
    });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Prêtre", famille: "Mystique", sorts: [{ rang: 1 }], niveau: 1, bonusMagique: 2 },
      fixedRng([0.45])
    );
    expect(resultat.statut).toBe("test");
    expect(resultat.difficulte).toBe(15);
    expect(resultat.d20).toBe(10);
    expect(resultat.marge).toBe(-3);
    expect(resultat.lance).toBe(false);
    expect(resultat.consomme).toBe(false);
    expect(resultat.message).toContain("conservé");
  });

  it("efface et consomme le parchemin sur un échec d'au moins 10 points", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération majeure » (Voie des soins, rang 3)",
    });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Prêtre", famille: "Mystique", sorts: [{ rang: 1 }], niveau: 1, bonusMagique: 0 },
      fixedRng([0])
    );
    expect(resultat.marge).toBe(-14);
    expect(resultat.consomme).toBe(true);
    expect(resultat.message).toContain("effacé");
  });

  it("ajoute +5 pour un autre profil de la même famille", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération majeure » (Voie des soins, rang 3)",
    });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Druide", famille: "Mystique", sorts: [{ rang: 5 }], niveau: 5, bonusMagique: 2 },
      fixedRng([0.95])
    );
    expect(resultat.statut).toBe("test");
    expect(resultat.difficulte).toBe(20);
    expect(resultat.total).toBe(22);
    expect(resultat.lance).toBe(true);
    expect(resultat.message).toContain("autre profil");
  });

  it("considère un barde sans grimoire comme lanceur de sorts", () => {
    const parchemin = objet({
      nom: "Parchemin — « Chant des héros » (Voie du musicien, rang 1)",
    });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Barde", famille: "Aventurier", sorts: [], niveau: 1, bonusMagique: 4 },
      fixedRng([0])
    );
    expect(resultat.statut).toBe("test");
    expect(resultat.difficulte).toBe(5);
    expect(resultat.total).toBe(5);
    expect(resultat.lance).toBe(true);
  });

  it("refuse un parchemin d'une autre famille ou un non-lanceur", () => {
    const parchemin = objet({
      nom: "Parchemin — « Récupération mineure » (Voie des soins, rang 1)",
    });
    const autreFamille = lireParchemin(
      parchemin,
      { profil: "Magicien", famille: "Mage", sorts: [{ rang: 1 }], niveau: 1, bonusMagique: 2 },
      fixedRng([0.95])
    );
    expect(autreFamille.statut).toBe("impossible");
    expect(autreFamille.consomme).toBe(false);

    const nonLanceur = lireParchemin(
      parchemin,
      { profil: "Guerrier", famille: "Combattant", sorts: [], niveau: 1, bonusMagique: 0 },
      fixedRng([0.95])
    );
    expect(nonLanceur.statut).toBe("impossible");
    expect(nonLanceur.consomme).toBe(false);
  });

  it("laisse au MJ un parchemin dont le sort n'est pas identifié", () => {
    const parchemin = objet({ nom: "Parchemin — sort de rang 3 (MJ)" });
    const resultat = lireParchemin(
      parchemin,
      { profil: "Prêtre", famille: "Mystique", sorts: [{ rang: 3 }], niveau: 3, bonusMagique: 2 },
      fixedRng([0.95])
    );
    expect(resultat.statut).toBe("inconnu");
    expect(resultat.consomme).toBe(false);
    expect(resultat.message).toContain("MJ");
  });
});
