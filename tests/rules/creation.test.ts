import { describe, expect, it } from "vitest";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import type { Character } from "@/src/lib/rules/types";
import { deriverPersonnage, recalculerPersonnage } from "@/src/lib/rules/personnage";
import {
  CREATION_DEFAUT,
  apprendreTalentComplet,
  compterCapacites,
  coutRang,
  creationProfil,
  estEffective,
  etatCreation,
  localiserCapacite,
  niveauMinRang,
  normaliserNomCapacite,
  peutApprendre,
  peutDesapprendre,
  pointsCapaciteTotal,
  sortDuTalent,
  talentsRang1Disponibles,
  talentsRang2Gratuits,
} from "@/src/lib/rules/creation";

describe("création niv. 1 : points de capacité (COF V2)", () => {
  it("config par profil : cas standard + 4 Mages", () => {
    expect(CREATION_DEFAUT).toEqual({ points: 2 });
    for (const p of ["Ensorceleur", "Forgesort", "Magicien", "Sorcier"]) {
      expect(creationProfil(p)).toEqual({ points: 2, rang2Gratuit: true, voieRemplacement: "Voie du mage" });
    }
    for (const p of ["Guerrier", "Prêtre", "Rôdeur", "Barbare", "Inconnu", ""]) {
      expect(creationProfil(p)).toEqual({ points: 2 });
    }
  });

  it("localiserCapacite : profil d'abord, suffixes ignorés", () => {
    expect(localiserCapacite("Bénédiction", "Prêtre", "Elfe haut", false))
      .toMatchObject({ rang: 1, voie: "Voie de la prière", source: "profil" });
    // Collision : Archer émérite existe en Rôdeur R1 et sylvain R3 -> profil gagne.
    expect(localiserCapacite("Archer émérite", "Rôdeur", "Demi-Elfe", false))
      .toMatchObject({ rang: 1, source: "profil" });
    expect(localiserCapacite("Diversité", "Sorcier", "Humain", true))
      .toMatchObject({ rang: 1, source: "peuple" });
    expect(localiserCapacite("Maîtrise de la magie", "Sorcier", "Humain", true))
      .toMatchObject({ rang: 2, source: "mage" });
    // Sans adoption de la voie du mage : sort de mage = inconnu.
    expect(localiserCapacite("Maîtrise de la magie", "Sorcier", "Humain", false)).toBeUndefined();
    expect(localiserCapacite("Flèche sanglante (L)", "Rôdeur", "Demi-Elfe", false))
      .toMatchObject({ rang: 4, source: "peuple" });
    expect(localiserCapacite("Boule de feu", "Guerrier", "Nain", false)).toBeUndefined();
    expect(normaliserNomCapacite("Flèche sanglante (L)")).toBe("flèche sanglante");
  });

  it("seeds conformes : 2 pts dépensés, gratuités OK, zéro alerte", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const e1 = etatCreation(mirabel)!;
    expect(e1.points).toBe(2);
    expect(e1.depense).toBe(2);
    expect(e1.restants).toBe(0);
    expect(e1.peupleOk).toBe(true);
    expect(e1.rang2Nom).toBe("Maîtrise de la magie");
    expect(e1.alertes).toEqual([]);

    for (const id of ["pj-rodeur-demi-elfe", "pj-pretre-elfe-haut", "pj-guerrier-nain"]) {
      const e = etatCreation(SEED_CHARACTERS.find((x) => x.id === id)!)!;
      expect(e.depense).toBe(2);
      expect(e.restants).toBe(0);
      expect(e.peupleOk).toBe(true);
      expect(e.rang2Nom).toBeNull();
      expect(e.alertes).toEqual([]);
    }
  });

  it("coûts, niveaux min, points totaux", () => {
    expect([1, 2, 3, 4, 5].map(coutRang)).toEqual([1, 1, 2, 2, 2]);
    // Table DRS : 1, 2*, 3, 5, 7, 9, 11, 13.
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(niveauMinRang)).toEqual([1, 2, 3, 5, 7, 9, 11, 13]);
    expect(pointsCapaciteTotal(1)).toBe(2);
    expect(pointsCapaciteTotal(3)).toBe(6);
  });

  it("points non dépensés : alerte (pas de mise de côté)", () => {
    const base = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const e = etatCreation({ ...base, capacites: ["Protéger un allié"] })!;
    expect(e.restants).toBe(1);
    expect(e.alertes.some((a) => a.includes("1 pt à dépenser"))).toBe(true);
  });

  it("écarts : dépassement, rang > 1, peuple manquant, hors voies, hors Mage", () => {
    const base = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // 3e rang 1 -> dépassement.
    const trop = etatCreation({ ...base, capacites: [...base.capacites, "Vivacité"] })!;
    expect(trop.depense).toBe(3);
    expect(trop.restants).toBe(-1);
    expect(trop.alertes.some((a) => a.includes("3 pts dépensés pour 2 disponibles"))).toBe(true);
    // Rang 2 sans gratuité -> alerte.
    const r2 = etatCreation({ ...base, capacites: ["Protéger un allié", "Parer un coup"] })!;
    expect(r2.alertes.some((a) => a.includes("Parer un coup"))).toBe(true);
    // Rang 1 de peuple manquant.
    const sansPeuple = etatCreation({ ...base, traitsPeuple: [] })!;
    expect(sansPeuple.peupleOk).toBe(false);
    expect(sansPeuple.alertes.some((a) => a.includes("Habitant des tunnels"))).toBe(true);
    // Capacité d'un autre profil.
    const autre = etatCreation({ ...base, capacites: ["Protéger un allié", "Bénédiction"] })!;
    expect(autre.alertes.some((a) => a.includes("Bénédiction") && a.includes("inconnue"))).toBe(true);
    // Voie du mage hors famille Mage.
    const mage = etatCreation({ ...base, voieMage: true })!;
    expect(mage.alertes.some((a) => a.includes("hors famille Mage"))).toBe(true);
    // Niveau > 1 : règle non applicable.
    expect(etatCreation({ ...base, niveau: 2 })).toBeNull();
  });

  it("peutApprendre : le cas Frakzor (Armure lourde bloquée), prérequis et niveaux", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // Guerrier niv. 1, 0 pt restant : Armure lourde (résistance R3) bloquée.
    const bloque = peutApprendre(dorain, { nom: "Armure lourde", voie: "Voie de la résistance", rang: 3 });
    expect(bloque.ok).toBe(false);
    expect(bloque.raisons.some((r) => r.includes("niveau 3 requis"))).toBe(true);
    expect(bloque.raisons.some((r) => r.includes("requiert") && r.includes("rang 2"))).toBe(true);
    expect(bloque.raisons.some((r) => r.includes("pas assez de points"))).toBe(true);
    // Chaîne valide au niv. 3 : R1+R2 connus, 6 pts au total.
    const niv3 = { ...dorain, niveau: 3, capacites: ["Robustesse", "Résilient"] };
    const ok = peutApprendre(niv3, { nom: "Armure lourde", voie: "Voie de la résistance", rang: 3 });
    expect(ok).toEqual({ ok: true, raisons: [], cout: 2, gratuit: false, connu: false });
    // Saut de rang interdit même avec points et niveau.
    const saut = peutApprendre({ ...niv3, capacites: ["Robustesse"] }, { nom: "Armure lourde", voie: "Voie de la résistance", rang: 3 });
    expect(saut.ok).toBe(false);
    expect(saut.raisons.some((r) => r.includes("requiert Voie de la résistance rang 2"))).toBe(true);
    // R2 non gratuit au niv. 1 : niveau requis même avec des points.
    const faelyn1 = { ...SEED_CHARACTERS.find((x) => x.id === "pj-rodeur-demi-elfe")!, capacites: ["Survie"] };
    const r2 = peutApprendre(faelyn1, { nom: "Tir chirurgical", voie: "Voie de l'archer", rang: 2 });
    expect(r2.ok).toBe(false);
    expect(r2.raisons.some((r) => r.includes("niveau 2 requis"))).toBe(true);
    // Gratuité Mage : contourne le niveau, pas le prérequis.
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const vierge = { ...mirabel, capacites: ["Malédiction", "Saignements"] };
    const free = peutApprendre(vierge, { nom: "Maîtrise de la magie", voie: "Voie du mage", rang: 2 });
    expect(free.ok).toBe(true);
    expect(free.gratuit).toBe(true);
    // Hors voies accessibles.
    const hors = peutApprendre(dorain, { nom: "Bénédiction", voie: "Voie de la prière", rang: 1 });
    expect(hors.ok).toBe(false);
    expect(hors.raisons.some((r) => r.includes("hors voies accessibles"))).toBe(true);
    // Création maison (sans voie) : espace MJ, libre.
    expect(peutApprendre(dorain, { nom: "Truc du MJ" }).ok).toBe(true);
    // Déjà connue.
    expect(peutApprendre(dorain, { nom: "Robustesse", voie: "Voie de la résistance", rang: 1 }).raisons).toContain("déjà connue");
    // R4 exige le niveau 5 (table DRS), même avec points et prérequis.
    const r4 = peutApprendre(
      { ...dorain, niveau: 4, capacites: ["Robustesse", "Résilient", "Armure lourde", "Constitution héroïque"] },
      { nom: "Dur à cuire", voie: "Voie de la résistance", rang: 5 }
    );
    expect(r4.ok).toBe(false);
    expect(r4.raisons.some((r) => r.includes("niveau 7 requis"))).toBe(true);
  });

  it("compterCapacites : sorts comptés, customs ignorés, peuple R1 gratuit", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const avecSort = {
      ...dorain,
      sorts: [{ id: "s1", nom: "Bénédiction", type: "defensif" as const, voie: "Voie de la prière", rang: 1, cout: { ressource: "mana", montant: 1 } }],
    };
    const cpt = compterCapacites(avecSort);
    expect(cpt.depense).toBe(3); // 2 talents + 1 sort compté
    expect(cpt.alertes.some((a) => a.includes("Bénédiction"))).toBe(true);
    // Talent doublon d'un sort connu : compté une seule fois.
    const dup = compterCapacites({ ...avecSort, capacites: [...dorain.capacites, "Bénédiction"] });
    expect(dup.depense).toBe(3);
  });
  it("sélecteurs : rangs 1 apprenables + gratuité R2 Mage", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // 2/2 dépensés : plus de rang 1 à prendre (5 voies = 5 rangs 1, 2 pris).
    expect(talentsRang1Disponibles(dorain)).toHaveLength(3);
    expect(talentsRang2Gratuits(dorain)).toEqual([]);
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    expect(talentsRang2Gratuits(mirabel)).toEqual([]); // gratuité consommée
    const vierge = { ...mirabel, capacites: ["Malédiction", "Saignements"] };
    // Rangs 2 Sorcier (Beauté, Masque, Baiser...) + mage (Maîtrise) proposés.
    const noms = talentsRang2Gratuits(vierge).map((o) => o.nom);
    expect(noms).toContain("Beauté de la succube");
    expect(noms).toContain("Maîtrise de la magie");
  });

  it("peutDesapprendre : du haut vers le bas, jamais de saut", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const avance = { ...dorain, niveau: 3, capacites: ["Robustesse", "Résilient", "Armure lourde"] };
    // R2 bloqué tant que le R3 est connu.
    const bloque = peutDesapprendre(avance, "Résilient", "talents");
    expect(bloque.ok).toBe(false);
    expect(bloque.raisons.some((r) => r.includes("Voie de la résistance rang 3"))).toBe(true);
    // Le R3 se retire librement, puis le R2 se libère.
    expect(peutDesapprendre(avance, "Armure lourde", "talents")).toEqual({ ok: true, raisons: [] });
    expect(peutDesapprendre({ ...avance, capacites: ["Robustesse", "Résilient"] }, "Résilient", "talents").ok).toBe(true);
    // R1 seul : libre.
    expect(peutDesapprendre(dorain, "Robustesse", "talents").ok).toBe(true);
    // Inconnue : retirable (corrige l'écart).
    const inconnue = { ...dorain, capacites: [...dorain.capacites, "Boule de feu"] };
    expect(peutDesapprendre(inconnue, "Boule de feu", "talents").ok).toBe(true);
    // Absente : non.
    expect(peutDesapprendre(dorain, "Vivacité", "talents")).toEqual({ ok: false, raisons: ["non apprise"] });
    // Sort maison (sans voie) : libre.
    const custom = { ...dorain, sorts: [{ id: "x", nom: "Truc", type: "utilitaire" as const }] };
    expect(peutDesapprendre(custom, "Truc", "sorts").ok).toBe(true);
    // Sort à voie bloqué par un rang supérieur connu.
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const sortsMage = {
      ...mirabel,
      sorts: [
        { id: "a", nom: "Maîtrise de la magie", type: "utilitaire" as const, voie: "Voie du mage", rang: 2, cout: { ressource: "mana", montant: 2 } },
        { id: "b", nom: "Tour de magie", type: "utilitaire" as const, voie: "Voie du mage", rang: 3, cout: { ressource: "mana", montant: 3 } },
      ],
    };
    const bloqueSort = peutDesapprendre(sortsMage, "Maîtrise de la magie", "sorts");
    expect(bloqueSort.ok).toBe(false);
    expect(bloqueSort.raisons.some((r) => r.includes("Voie du mage rang 3"))).toBe(true);
    expect(peutDesapprendre(sortsMage, "Tour de magie", "sorts")).toEqual({ ok: true, raisons: [] });
  });

  it("estEffective : inactif sous le niveau requis (baisse de niveau)", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // R1 : toujours effectif.
    expect(estEffective(dorain, "Robustesse")).toEqual({ effectif: true });
    // R3 appris au niv. 3 puis redescente au niv. 1 : inactif, raison affichable.
    const haut = { ...dorain, niveau: 3, capacites: ["Robustesse", "Résilient", "Armure lourde"] };
    expect(estEffective(haut, "Armure lourde")).toEqual({ effectif: true });
    const bas = { ...haut, niveau: 1 };
    expect(estEffective(bas, "Armure lourde")).toEqual({
      effectif: false,
      raison: "niveau 3 requis (niveau 1)",
    });
    expect(estEffective(bas, "Robustesse")).toEqual({ effectif: true });
    // Gratuité Mage : effective malgré le niveau.
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    expect(estEffective(mirabel, "Maîtrise de la magie")).toEqual({ effectif: true });
    // Inconnue : effective par défaut (déjà signalée ailleurs).
    expect(estEffective(dorain, "Boule de feu")).toEqual({ effectif: true });
  });

  it("sortDuTalent + apprendreTalentComplet : un talent-sort devient lançable", () => {
    // Talent-sort connu : retrouve l'entrée grimoire.
    expect(sortDuTalent("Un pied dans la tombe", SEED_SORTS)?.id).toBe("sort-pied-tombe");
    expect(sortDuTalent("Maîtrise de la magie", SEED_SORTS)?.id).toBe("sort-maitrise-magie");
    // Talent pur : rien.
    expect(sortDuTalent("Robustesse", SEED_SORTS)).toBeUndefined();
    expect(sortDuTalent("Boule de feu", SEED_SORTS)).toBeUndefined();
    // Grimoire sans l'entrée : rien.
    expect(sortDuTalent("Un pied dans la tombe", [])).toBeUndefined();
    // Apprendre le talent crée aussi le sort (+ mana), full mana + full vie (niveau).
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const vierge: Character = { ...mirabel, pv: 2, capacites: ["Malédiction"], sorts: [], ressources: { ...mirabel.ressources, mana: { max: 4, actuel: 1 } } };
    expect(mirabel.caracteristiques.VOL).toBe(4);
    const r = apprendreTalentComplet(vierge, "Un pied dans la tombe", SEED_SORTS);
    expect(r.capacites).toContain("Un pied dans la tombe");
    expect(r.sorts.map((s) => s.nom)).toContain("Un pied dans la tombe");
    expect(r.ressources.mana.max).toBe(5); // VOL 4 + 1 sort
    expect(r.ressources.mana).toEqual({ max: 5, actuel: 5 }); // +1 sort => +1 mana, à fond
    expect(r.pv).toBe(r.pvMax); // full vie
    expect(vierge.sorts).toHaveLength(0); // non muté
    // Pas de doublon si le sort existe déjà.
    const r2 = apprendreTalentComplet(r, "Un pied dans la tombe", SEED_SORTS);
    expect(r2.sorts.filter((s) => s.nom === "Un pied dans la tombe")).toHaveLength(1);
    expect(r2.capacites.filter((t) => t === "Un pied dans la tombe")).toHaveLength(1);
    // Talent pur : aucun sort créé.
    const r3 = apprendreTalentComplet(vierge, "Robustesse", SEED_SORTS);
    expect(r3.capacites).toContain("Robustesse");
    expect(r3.sorts).toHaveLength(0);
  });

  it("Armure d'os : +3 DEF permanent à l'apprentissage, retiré au désapprentissage", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    expect(deriverPersonnage(mirabel).defense).toBe(11); // 10 + AGI 1
    const r = apprendreTalentComplet(mirabel, "Armure d'os", SEED_SORTS);
    expect(r.capacites).toContain("Armure d'os");
    expect(r.sorts).toHaveLength(mirabel.sorts.length); // talent pur, aucun sort
    expect(deriverPersonnage(r).defense).toBe(14);
    expect(r.defense).toBe(14); // resynchronisé aussitôt (fiche + combat)
    // Désapprendre (retirer le talent + recalculer) retire le bonus.
    const sans = recalculerPersonnage({ ...r, capacites: r.capacites.filter((t) => t !== "Armure d'os") });
    expect(deriverPersonnage(sans).defense).toBe(11);
    expect(sans.defense).toBe(11);
  });

  it("guerrier : Vivacité +3 INIT, bouclier/dur/rempart +1 DEF, Robustesse manuelle", () => {
    const dorain = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // Fiche : Robustesse connue mais PV/DEF sans bonus (13 = 10+CON, DEF 11) — non appliqué.
    expect(deriverPersonnage(dorain).defense).toBe(11);
    expect(deriverPersonnage(dorain).pvMax).toBe(13);
    expect(deriverPersonnage(dorain).initiative).toBe(11); // 10 + PER 1
    let c = apprendreTalentComplet(dorain, "Vivacité", SEED_SORTS);
    expect(deriverPersonnage(c).initiative).toBe(14);
    expect(c.initMod).toBe(4);
    c = apprendreTalentComplet(c, "Défense au bouclier", SEED_SORTS);
    expect(c.defense).toBe(12);
    c = apprendreTalentComplet(c, "Renvoi de sort", SEED_SORTS);
    expect(c.defense).toBe(13); // +2 au rang 5 de la voie
    c = apprendreTalentComplet(c, "Dur à cuire", SEED_SORTS);
    expect(c.defense).toBe(14);
    c = apprendreTalentComplet(c, "Rempart", SEED_SORTS);
    expect(c.defense).toBe(15);
  });
});
