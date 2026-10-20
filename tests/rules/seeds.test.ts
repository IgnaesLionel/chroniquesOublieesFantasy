import { describe, expect, it } from "vitest";
import { characterSchema, monsterSchema } from "@/src/lib/data/validation";
import type { Character } from "@/src/lib/rules/types";
import {
  SEED_CHARACTERS,
  SEED_MONSTERS,
  avecEquipementGrainesPersonnages,
  avecNomsGrainesPersonnages,
  avecRevisionsGrainesPersonnages,
  migrerGrainesPersonnages,
} from "@/src/lib/data/seeds";
import { fusionnerSeedsManquants, preparerStock } from "@/src/lib/store/useLocalCollection";

describe("Phase 1 : données personajes/monstres", () => {
  it("4 PJ valides", () => {
    expect(SEED_CHARACTERS).toHaveLength(4);
    for (const c of SEED_CHARACTERS) {
      expect(() => characterSchema.parse(c)).not.toThrow();
    }
  });

  it("monstres valides avec pv cohérents", () => {
    for (const m of SEED_MONSTERS) {
      expect(() => monsterSchema.parse(m)).not.toThrow();
      expect(m.pv).toBeLessThanOrEqual(m.pvMax);
    }
  });

  it("graines manquantes ajoutées sans toucher au stock", () => {
    const stock = [{ id: "a" }, { id: "b", nom: "Modifié" }];
    // Rien de neuf : même référence, pas de réécriture.
    expect(fusionnerSeedsManquants(stock, [{ id: "a" }, { id: "b" }])).toBe(stock);
    // Nouveau contenu : ajouté à la fin, existant intact.
    const next = fusionnerSeedsManquants(stock, [{ id: "b" }, { id: "c" }]);
    expect(next).toEqual([{ id: "a" }, { id: "b", nom: "Modifié" }, { id: "c" }]);
    // Graines vides : stock inchangé.
    expect(fusionnerSeedsManquants(stock, [])).toBe(stock);
  });

  it("renommage des fiches graines : seul l'ancien nom exact suit, le reste est conservé", () => {
    const stock = [
      { ...SEED_CHARACTERS[0], id: "pj-sorcier-humain", nom: "Mirabel", niveau: 4, pv: 3 },
      { ...SEED_CHARACTERS[3], id: "pj-guerrier-nain", nom: "Thornak le Rouge" },
      { ...SEED_CHARACTERS[2], id: "pj-fiche-maison", nom: "Aelion" },
    ];
    const next = avecNomsGrainesPersonnages(stock);
    // Fiche encore au nom d'origine : renommée, tout le reste intact.
    expect(next[0].nom).toBe("Maë");
    expect(next[0]).toMatchObject({ niveau: 4, pv: 3 });
    // Nom choisi par le MJ (ou id hors graines) : jamais touché.
    expect(next[1].nom).toBe("Thornak le Rouge");
    expect(next[2].nom).toBe("Aelion");
    // Idempotente : plus rien à migrer, même référence (pas de réécriture).
    expect(avecNomsGrainesPersonnages(next)).toBe(next);
    expect(avecNomsGrainesPersonnages([])).toEqual([]);
  });

  it("révision de graine (Nyssa) : l'ancien talent cède sa place au nouveau", () => {
    const nyssa = SEED_CHARACTERS.find((x) => x.id === "pj-rodeur-demi-elfe")!;
    const stock = [
      // Fiche enregistrée : place de l'ancien talent conservée, reste intact.
      { ...nyssa, niveau: 3, capacites: ["Archer émérite", "Survie", "Tir chirurgical"] },
      // Échange déjà fait par le MJ : jamais réécrit (idempotence).
      { ...nyssa, capacites: ["Archer émérite", "Le loup"] },
      // Talent retiré par le MJ : pas de réapparition.
      { ...nyssa, capacites: ["Archer émérite"] },
      // Id hors graines : jamais touché.
      { ...SEED_CHARACTERS[0], id: "pj-fiche-maison", capacites: ["Survie"] },
    ];
    const next = avecRevisionsGrainesPersonnages(stock);
    expect(next[0].capacites).toEqual(["Archer émérite", "Le loup", "Tir chirurgical"]);
    expect(next[0]).toMatchObject({ niveau: 3 });
    expect(next[1].capacites).toEqual(["Archer émérite", "Le loup"]);
    expect(next[2].capacites).toEqual(["Archer émérite"]);
    expect(next[3].capacites).toEqual(["Survie"]);
    // Idempotente : plus rien à corriger, même référence (pas de réécriture).
    expect(avecRevisionsGrainesPersonnages(next)).toBe(next);
    // Chaîne de migration (nom puis révisions) : les deux corrections s'appliquent.
    const [migre] = migrerGrainesPersonnages([{ ...nyssa, nom: "Faelyn", capacites: ["Survie"] }]);
    expect(migre).toMatchObject({ nom: "Nyssa", capacites: ["Le loup"] });
  });

  it("révision de graine (Maë) : création d'origine -> Un pied + Saignements + Armure d'os, voie du mage", () => {
    const mae = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    // Ancienne fiche enregistrée : Voie du mage adoptée, Malédiction + Saignements + Maîtrise.
    const ancienne: Character = {
      ...mae,
      voieMage: true,
      traitsPeuple: ["Capacité de peuple + occultisme", "Diversité"],
      capacites: ["Malédiction", "Saignements", "Maîtrise de la magie"],
      defense: 11,
      ressources: { ...mae.ressources, mana: { max: 6, actuel: 4 } },
      sorts: [
        { id: "mae-malediction", nom: "Malédiction", type: "offensif", cout: { ressource: "mana", montant: 1 } },
        { id: "mae-saignements", nom: "Saignements", type: "offensif", cout: { ressource: "mana", montant: 1 } },
      ],
    };
    const [migre] = avecRevisionsGrainesPersonnages([ancienne]);
    expect(migre.capacites).toEqual(["Un pied dans la tombe", "Saignements", "Armure d'os"]);
    expect(migre.traitsPeuple).toEqual(["Diversité", "Capacité de peuple + occultisme"]);
    expect(migre.voieMage).toBe(true);
    // Les sorts des talents retirés partent, celui du nouveau arrive ; Saignements survit.
    expect(migre.sorts.map((s) => s.nom)).toEqual(["Saignements", "Un pied dans la tombe"]);
    expect(migre.sorts[1].id).toBe("pj-sorcier-humain-sort-pied-tombe");
    // Dérivés resynchronisés : Armure d'os +3 (11 -> 14), mana = VOL + 2 sorts.
    // La réserve entamée (4) n'est pas rechargée, l'équipement reste celui du MJ.
    expect(migre.defense).toBe(14);
    expect(migre.ressources.mana).toEqual({ max: 6, actuel: 4 });
    expect(migre.inventaire).toEqual(mae.inventaire);
    // Idempotente, et graine déjà corrigée : jamais réécrite.
    expect(avecRevisionsGrainesPersonnages([migre])[0]).toBe(migre);
    expect(avecRevisionsGrainesPersonnages([mae])[0]).toBe(mae);
    // Chaîne complète (nom, révision, équipement) sur une vieille sauvegarde.
    const [chaine] = migrerGrainesPersonnages([{ ...ancienne, nom: "Mirabel" }]);
    expect(chaine).toMatchObject({
      nom: "Maë",
      capacites: ["Un pied dans la tombe", "Saignements", "Armure d'os"],
      defense: 14,
    });
  });

  it("révision de graine (Maë) : étape intermédiaire sans voie du mage rattrapée", () => {
    const mae = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    // Fiche déjà migrée par la révision précédente : Armure d'os SANS voie du
    // mage (alerte « Armure d'os : niveau 2 requis ») et sans Saignements.
    const intermediaire: Character = {
      ...mae,
      voieMage: undefined,
      traitsPeuple: ["Diversité"],
      capacites: ["Un pied dans la tombe", "Armure d'os"],
      sorts: [mae.sorts[0]],
      ressources: { mana: { max: 5, actuel: 5 }, chance: mae.ressources.chance },
    };
    const [migre] = avecRevisionsGrainesPersonnages([intermediaire]);
    // L'ordre des talents suit l'état d'origine (cosmétique) ; le contenu est
    // celui de la graine.
    expect([...migre.capacites].sort()).toEqual(["Un pied dans la tombe", "Saignements", "Armure d'os"].sort());
    expect(migre.voieMage).toBe(true);
    expect(migre.traitsPeuple).toEqual(["Diversité", "Capacité de peuple + occultisme"]);
    expect([...migre.sorts.map((s) => s.nom)].sort()).toEqual(["Un pied dans la tombe", "Saignements"].sort());
    expect(migre.defense).toBe(14);
    expect(migre.ressources.mana).toEqual({ max: 6, actuel: 5 });
    // Idempotente.
    expect(avecRevisionsGrainesPersonnages([migre])[0]).toBe(migre);
  });

  it("équipement de départ des graines : le petit bouclier manquant est posé équipé", () => {
    const thornak = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    // Graine : bouclier équipé et DEF stockée cohérente (10+AGI 1+bouclier 1).
    const bouclier = thornak.inventaire.find((e) => e.itemId === "item-petit-bouclier");
    expect(bouclier).toMatchObject({ quantite: 1, equipe: true });
    expect(thornak.defense).toBe(12);
    // Fiche enregistrée AVANT l'ajout : l'objet est ajouté équipé, le reste de la
    // fiche (niveau, PV, objets du MJ) est conservé et la DEF stockée suit le bonus.
    const ancienne = {
      ...thornak,
      defense: 11,
      niveau: 4,
      pv: 7,
      inventaire: [{ itemId: "item-hache-1main", quantite: 1, equipe: true }],
    };
    const migre = avecEquipementGrainesPersonnages([ancienne]);
    expect(migre[0].inventaire).toEqual([
      { itemId: "item-hache-1main", quantite: 1, equipe: true },
      { itemId: "item-petit-bouclier", quantite: 1, equipe: true },
    ]);
    expect(migre[0]).toMatchObject({ defense: 12, niveau: 4, pv: 7 });
    // Idempotente : plus rien à poser, même référence (pas de réécriture).
    expect(avecEquipementGrainesPersonnages(migre)).toBe(migre);
    // DEF relevée par le MJ : conservée (jamais rabaissée).
    expect(avecEquipementGrainesPersonnages([{ ...ancienne, defense: 15 }])[0].defense).toBe(15);
    // Main déjà prise (arme à 2 mains, autre bouclier) : la fiche du MJ prime.
    const deuxMains = {
      ...ancienne,
      inventaire: [{ itemId: "item-hache-2mains-2d6", quantite: 1, equipe: true }],
    };
    expect(avecEquipementGrainesPersonnages([deuxMains])[0]).toBe(deuxMains);
    // Id hors graines : jamais touché.
    const maison = { ...ancienne, id: "pj-fiche-maison" };
    expect(avecEquipementGrainesPersonnages([maison])[0]).toBe(maison);
    // Chaîne complète (nom, talents, équipement) sur une vieille sauvegarde.
    const [chaine] = migrerGrainesPersonnages([{ ...ancienne, nom: "Dorain", defense: 11 }]);
    expect(chaine).toMatchObject({ nom: "Thornak", defense: 12 });
  });

  it("preparerStock : graines manquantes puis migration", () => {
    const migrer = (xs: { id: string; nom: string }[]) =>
      xs.map((x) => (x.nom === "Dorain" ? { ...x, nom: "Thornak" } : x));
    const stock = [{ id: "a", nom: "Dorain" }];
    expect(preparerStock(stock, [{ id: "b", nom: "Neuf" }], migrer)).toEqual([
      { id: "a", nom: "Thornak" },
      { id: "b", nom: "Neuf" },
    ]);
    // Sans graine ni migration : stock inchangé (même référence).
    expect(preparerStock(stock, [], undefined)).toBe(stock);
  });
});
