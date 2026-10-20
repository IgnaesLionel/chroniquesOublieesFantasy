import { describe, expect, it } from "vitest";
import type { Character } from "@/src/lib/rules/types";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { ARME_FAMILLES, ARME_FAMILLE_KEYS, DEGAT_LABEL, labelFamilleArme, mainsDe, type Item } from "@/src/lib/rules/world/types";
import { characterSchema, itemSchema } from "@/src/lib/data/validation";
import { attaqueFromItem, attaqueFromSort, participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { bonusDefenseInventaire, bonusDefenseMagique, bonusDefenseMundane, deriverPersonnage, recalculerPersonnage } from "@/src/lib/rules/personnage";
import { peutEquiper, validerEquipement } from "@/src/lib/rules/equipement";
import { applySpellCost, castSoutien, resolveAttack } from "@/src/lib/rules/combat/attack";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { fixedRng } from "@/src/lib/rules/dice/roller";

function guerrier(): CombatParticipant {
  return {
    instanceId: "pj", templateId: "pj", nom: "Brom", camp: "pj",
    pvMax: 40, pv: 40, defense: 18, initMod: 1, initiative: 10,
    attaques: [{ id: "epee", nom: "Épée", bonus: 6, degats: "1d8+3" }],
    effets: [], sorts: [], capacites: [], niveau: 1, ressources: {}, statut: "actif",
  };
}

function gobelin(pv = 8): CombatParticipant {
  return {
    instanceId: "m", templateId: "m", nom: "Gobelin", camp: "monstre",
    pvMax: pv, pv, defense: 15, initMod: 2, initiative: 5,
    attaques: [{ id: "dague", nom: "Dague", bonus: 4, degats: "1d6+2" }],
    effets: [], sorts: [], capacites: [], niveau: 1, ressources: {}, statut: "actif",
  };
}

/**
 * Thornak privé de son petit bouclier de graine : base « nue » des tests
 * d'armure (la graine porte désormais le bouclier équipé, +1 DEF).
 */
function thornakSansBouclier(): Character {
  const t = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
  return { ...t, inventaire: (t.inventaire ?? []).filter((e) => e.itemId !== "item-petit-bouclier") };
}

describe("inventaire, armes et sorts", () => {
  it("seeds personnages/objets valides avec inventaire COF", () => {
    for (const c of SEED_CHARACTERS) expect(() => characterSchema.parse(c)).not.toThrow();
    for (const o of SEED_ITEMS) expect(() => itemSchema.parse(o)).not.toThrow();
    const sorcier = SEED_CHARACTERS.find((c) => c.id === "pj-sorcier-humain")!;
    expect(sorcier.inventaire.map((e) => e.itemId)).toContain("item-dague");
    const rodeur = SEED_CHARACTERS.find((c) => c.id === "pj-rodeur-demi-elfe")!;
    expect(rodeur.inventaire.map((e) => e.itemId)).toContain("item-arc-court");
  });

  it("arme d'inventaire équipée -> attaque, non équipée ignorée", () => {
    const c: Character = {
      ...SEED_CHARACTERS.find((x) => x.id === "pj-rodeur-demi-elfe")!,
      inventaire: [
        { itemId: "item-arc-court", quantite: 1, equipe: true },
        { itemId: "item-dague-poison", quantite: 1, equipe: false },
      ],
      pv: 9,
    };
    const p = participantFromCharacter(c, SEED_ITEMS);
    expect(p.attaques.map((a) => a.id)).toContain("item:item-arc-court");
    expect(p.attaques.map((a) => a.id)).not.toContain("item:item-dague-poison");
  });

  it("sort offensif -> attaque ✦, dague empoisonnée porte son effet", () => {
    const base = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const mage: Character = {
      ...base,
      sorts: [
        { id: "sort-projectile", nom: "Projectile magique", type: "offensif", degats: "1d6+2", cout: { ressource: "mana", montant: 2 } },
        { id: "sort-feu", nom: "Flèche de feu", type: "offensif", degats: "2d6", cout: { ressource: "mana", montant: 3 } },
      ],
    };
    const p = participantFromCharacter(mage, SEED_ITEMS);
    expect(p.attaques.map((a) => a.id)).toContain("sort:sort-projectile");
    expect(p.attaques.map((a) => a.id)).toContain("sort:sort-feu");
    // Bonus d'attaque magique par défaut = niv + VOL (1+4 = 5 ici).
    expect(p.attaques.find((a) => a.id === "sort:sort-feu")?.bonus).toBe(5);
    const dague = attaqueFromItem(SEED_ITEMS.find((o) => o.id === "item-dague-poison")!);
    expect(dague?.effetTouche?.cle).toBe("empoisonne");
    expect(attaqueFromSort({ id: "x", nom: "Soin", type: "defensif" })).toBeNull();
  });

  it("sort offensif sans dégâts -> attaque à effet (0 DM, convention 1d1-1)", () => {
    const malediction = attaqueFromSort({ id: "m", nom: "Malédiction", type: "offensif" }, 3);
    expect(malediction).not.toBeNull();
    expect(malediction?.degats).toBe("1d1-1");
    expect(malediction?.bonus).toBe(3);
    // Bonus explicite prioritaire sur l'attaque magique.
    const fixe = attaqueFromSort({ id: "f", nom: "Feu", type: "offensif", degats: "2d6", bonus: 7 }, 3);
    expect(fixe?.bonus).toBe(7);
    expect(fixe?.degats).toBe("2d6");
  });

  it("Maë (seed) arrive en combat avec son sort d'attaque et son armure d'os", () => {
    const mae = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const p = participantFromCharacter(mae, SEED_ITEMS);
    const ids = p.attaques.map((a) => a.id);
    expect(ids).toContain("sort:mae-pied-tombe");
    // Un pied dans la tombe : 1d4°+INT (INT 2) au niv. 1, attaque magique niv+VOL = 5.
    const pied = p.attaques.find((a) => a.id === "sort:mae-pied-tombe");
    expect(pied?.degats).toBe("1d4+2");
    expect(pied?.bonus).toBe(5);
    expect(pied?.effetTouche?.cle).toBe("ralenti");
    // Armure d'os (talent passif) : DEF 10 + AGI 1 + 3 = 14.
    expect(p.defense).toBe(14);
  });

  it("sort à carac : INT substituée dans les dégâts", () => {
    const sort = { id: "p", nom: "Pied dans la tombe", type: "offensif" as const, degats: "1d4°+INT" };
    const a = attaqueFromSort(sort, 3, { INT: 2 });
    expect(a?.degats).toBe("1d4+2"); // niv. 1 -> d4
    expect(a?.bonus).toBe(3);
    // Donnée grimoire : Un pied dans la tombe = 1d4°+INT.
    const grimoire = SEED_SORTS.find((s) => s.id === "sort-pied-tombe")!;
    expect(grimoire.degats).toBe("1d4°+INT");
  });

  it("sort du grimoire au niv. 7 : 2d4°+INT -> 2d6+2 (Baiser du vampire)", () => {
    const grimoire = SEED_SORTS.find((s) => s.id === "sort-baiser-vampire")!;
    expect(grimoire.degats).toBe("2d4°+INT");
    expect(attaqueFromSort(grimoire, 0, { INT: 2 }, 7)?.degats).toBe("2d6+2");
    expect(attaqueFromSort(grimoire, 0, { INT: 2 }, 3)?.degats).toBe("2d4+2");
  });

  it("sort à dé évolutif legacy : dE substitué selon le niveau", () => {
    const sort = { id: "e", nom: "Attaque évolutive", type: "offensif" as const, degats: "1dE+1" };
    expect(attaqueFromSort(sort, 0, {}, 1)?.degats).toBe("1d4+1");
    expect(attaqueFromSort(sort, 0, {}, 9)?.degats).toBe("1d8+1");
  });

  it("attaque magique capée au niveau 10", () => {
    const mae = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const haut = { ...mae, niveau: 12 };
    const p = participantFromCharacter(haut, SEED_ITEMS);
    // 10 (cap) + VOL 4 = 14, pas 12 + 4 = 16.
    expect(p.attaques.find((a) => a.id === "sort:mae-pied-tombe")?.bonus).toBe(14);
  });

  it("attaque de sort TOUCHÉE : dégâts appliqués, PV déduits", () => {
    const lanceur: CombatParticipant = {
      ...guerrier(), nom: "Maë",
      sorts: [{ id: "s", nom: "Saignements", type: "offensif", degats: "1d4", cout: { ressource: "mana", montant: 1 } }],
      attaques: [{ id: "sort:s", nom: "✦ Saignements", bonus: 5, degats: "1d4" }],
      ressources: { mana: { max: 6, actuel: 6 } },
    };
    const s = createCombat([lanceur, gobelin()]);
    // Jet 15 + 5 = 20 vs déf 15 : touché. 1d4 avec rng 0 -> 1 DM.
    const { state, resolution } = resolveAttack(s, "pj", "m", "sort:s", fixedRng([0.72, 0]));
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(1);
    expect(state.participants[1].pv).toBe(7);
  });

  it("TOUCHÉ avec arme à effet -> effet appliqué à la cible", () => {
    const atk: CombatParticipant = {
      ...guerrier(),
      attaques: [{ id: "d", nom: "Dague empoisonnée", bonus: 10, degats: "1d6", effetTouche: { cle: "empoisonne", duree: 3 } }],
    };
    const s = createCombat([atk, gobelin()]);
    const { state, resolution } = resolveAttack(s, "pj", "m", "d", fixedRng([0.5, 0]));
    expect(resolution.touche).toBe(true);
    expect(state.participants[1].effets.map((e) => e.nom)).toContain("Empoisonné");
    expect(state.log.some((l) => l.message.includes('Effet "Empoisonné"'))).toBe(true);
  });

  it("MANQUÉ -> pas d'effet appliqué", () => {
    const atk: CombatParticipant = {
      ...guerrier(),
      attaques: [{ id: "d", nom: "Dague", bonus: 0, degats: "1d6", effetTouche: { cle: "empoisonne", duree: 3 } }],
    };
    const s = createCombat([atk, gobelin()]);
    const { state } = resolveAttack(s, "pj", "m", "d", fixedRng([0])); // nat 1
    expect(state.participants[1].effets).toHaveLength(0);
  });

  it("coût de sort déduit, insuffisant = erreur", () => {
    const mage: CombatParticipant = {
      ...guerrier(), nom: "Elyndra",
      sorts: [{ id: "s", nom: "Projectile", type: "offensif", degats: "1d6", cout: { ressource: "mana", montant: 2 } }],
      ressources: { mana: { max: 10, actuel: 3 } },
    };
    const s = createCombat([mage, gobelin()]);
    const s2 = applySpellCost(s, "pj", mage.sorts[0]);
    expect(s2.participants[0].ressources.mana.actuel).toBe(1);
    expect(() => applySpellCost(s2, "pj", { id: "g", nom: "Gros", type: "offensif", cout: { ressource: "mana", montant: 5 } })).toThrow(/insuffisant/);
  });

  it("sort défensif : soin + protection sur allié", () => {
    const pretre: CombatParticipant = {
      ...guerrier(), nom: "Cédric", sorts: [], ressources: { mana: { max: 8, actuel: 8 } },
    };
    const blesse: CombatParticipant = { ...guerrier(), instanceId: "ami", nom: "Ami", pv: 20 };
    const s = createCombat([pretre, blesse, gobelin()]);
    const { state, resolution } = castSoutien(
      s, "pj", "ami",
      { id: "soin", nom: "Soins", type: "defensif", soin: "1d8+2", effetCle: "protection", effetDuree: 2, cout: { ressource: "mana", montant: 2 } },
      fixedRng([0.5]) // d8 -> 5, +2 = 7
    );
    expect(resolution.soinTotal).toBe(7);
    expect(resolution.pvApres).toBe(27);
    expect(resolution.effetNom).toBe("Protection");
    expect(state.participants[0].ressources.mana.actuel).toBe(6);
  });

  it("sort offensif via castSoutien = erreur", () => {
    const s = createCombat([guerrier(), gobelin()]);
    expect(() => castSoutien(s, "pj", "m", { id: "f", nom: "Feu", type: "offensif", degats: "2d6" })).toThrow(/offensif/);
  });
});

describe("familles d'armes", () => {
  it("taxonomie coherente : cles uniques, libelles et degats renseignes", () => {
    const keys = ARME_FAMILLES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...ARME_FAMILLE_KEYS].sort());
    for (const f of ARME_FAMILLES) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(Object.keys(DEGAT_LABEL)).toContain(f.degat);
      expect(f.verbes.length).toBeGreaterThan(0);
      expect(f.exemples.length).toBeGreaterThan(0);
    }
    expect(labelFamilleArme("haches")).toBe("Haches");
  });

  it("seeds d'armes taguees avec des familles connues", () => {
    const connues = new Set<string>(ARME_FAMILLE_KEYS);
    for (const o of SEED_ITEMS) {
      for (const f of o.familles ?? []) expect(connues.has(f)).toBe(true);
    }
    const fam = (id: string) => SEED_ITEMS.find((o) => o.id === id)?.familles ?? [];
    expect(fam("item-epee")).toEqual(["epees"]);
    expect(fam("item-hache-1main")).toEqual(["haches"]);
    expect(fam("item-dague")).toEqual(["dagues"]);
    expect(fam("item-arc-court")).toEqual(["arcs"]);
    expect(fam("item-baton-ferre")).toEqual(["batons"]);
    expect(fam("item-masse")).toEqual(["masses"]);
    expect(fam("item-grimoire")).toEqual(["gourdins"]); // contondant (improvise)
    for (const o of SEED_ITEMS.filter((x) => x.estArme)) {
      expect((o.familles ?? []).length).toBeGreaterThan(0);
    }
  });

  it("itemSchema accepte familles, refuse une famille inconnue", () => {
    const base = { id: "x", nom: "Hachette de lancer", categorie: "arme", quantite: 1, exemple: false };
    expect(() => itemSchema.parse({ ...base, familles: ["haches", "jet"] })).not.toThrow();
    expect(() => itemSchema.parse({ ...base })).not.toThrow();
    expect(() => itemSchema.parse({ ...base, familles: ["nimporte"] })).toThrow();
  });
  it("arme equipee apres coup : snapshot fige, reconstruction depuis la fiche l'ajoute", () => {
    const base = SEED_CHARACTERS.find((x) => x.id === "pj-rodeur-demi-elfe")!;
    const avant = participantFromCharacter(base, SEED_ITEMS);
    expect(avant.attaques.map((a) => a.id)).not.toContain("item:item-hache-1main");
    const modifiee = { ...base, inventaire: [...(base.inventaire ?? []), { itemId: "item-hache-1main", quantite: 1, equipe: true }] };
    const apres = participantFromCharacter(modifiee, SEED_ITEMS);
    expect(apres.attaques.map((a) => a.id)).toContain("item:item-hache-1main");
  });

  it("armures equipees : bonus DEF (bouclier +2, mailles +4)", () => {
    const base = thornakSansBouclier();
    expect(deriverPersonnage(base, SEED_ITEMS).defense).toBe(11);
    const equipe = {
      ...base,
      inventaire: [
        ...(base.inventaire ?? []),
        { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
        { itemId: "item-chemise-mailles", quantite: 1, equipe: true },
      ],
    };
    expect(bonusDefenseInventaire(equipe, SEED_ITEMS)).toBe(6);
    expect(deriverPersonnage(equipe, SEED_ITEMS).defense).toBe(17);
    expect(recalculerPersonnage(equipe, SEED_ITEMS).defense).toBe(17);
    // Non équipé = pas de bonus.
    const range = {
      ...base,
      inventaire: [...(base.inventaire ?? []), { itemId: "item-grand-bouclier", quantite: 1, equipe: false }],
    };
    expect(deriverPersonnage(range, SEED_ITEMS).defense).toBe(11);
    // Combat : fiche non recalculée part quand même avec le bonus.
    expect(participantFromCharacter({ ...equipe, defense: 11 }, SEED_ITEMS).defense).toBe(17);
  });

  it("bouclier équipé sur la fiche -> participant avec bouclierBonus (Voie du bouclier)", () => {
    const base = thornakSansBouclier();
    // Petit bouclier du stock, équipé : bonus +1 détecté en combat.
    const equipe = recalculerPersonnage({
      ...base,
      inventaire: [...(base.inventaire ?? []), { itemId: "item-petit-bouclier", quantite: 1, equipe: true }],
    }, SEED_ITEMS);
    expect(equipe.inventaire.find((e) => e.itemId === "item-petit-bouclier")?.equipe).toBe(true);
    expect(participantFromCharacter(equipe, SEED_ITEMS).bouclierBonus).toBe(1);
    // Rangé (non équipé) : pas de bouclier en combat.
    const range = recalculerPersonnage({
      ...base,
      inventaire: [...(base.inventaire ?? []), { itemId: "item-petit-bouclier", quantite: 1, equipe: false }],
    }, SEED_ITEMS);
    expect(participantFromCharacter(range, SEED_ITEMS).bouclierBonus).toBeNull();
  });

  it("magiques non cumulés (max), mundanes cumulés, talents en plus", () => {
    const anneau: Item = {
      id: "x-anneau", nom: "Anneau +3", categorie: "armure", quantite: 1, exemple: false,
      bonusDefense: 3, mains: 0, emplacement: "torse", magique: true,
    };
    const armureMagique: Item = {
      id: "x-armure", nom: "Cotte +2", categorie: "armure", quantite: 1, exemple: false,
      bonusDefense: 2, mains: 0, emplacement: "torse", magique: true,
    };
    const catalogue = [...SEED_ITEMS, anneau, armureMagique];
    const base = thornakSansBouclier();
    const equipe = {
      ...base,
      inventaire: [
        ...(base.inventaire ?? []),
        { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
        { itemId: "item-chemise-mailles", quantite: 1, equipe: true },
        { itemId: "x-anneau", quantite: 1, equipe: true },
        { itemId: "x-armure", quantite: 1, equipe: true },
      ],
    };
    expect(bonusDefenseMundane(equipe, catalogue)).toBe(6);
    expect(bonusDefenseMagique(equipe, catalogue)).toBe(3);
    expect(bonusDefenseInventaire(equipe, catalogue)).toBe(9);
    // Thornak : 10 + AGI 1 + 9 = 20.
    expect(deriverPersonnage(equipe, catalogue).defense).toBe(20);
    expect(recalculerPersonnage(equipe, catalogue).defense).toBe(20);
    // Non équipé : ignoré des deux côtés.
    const range = { ...equipe, inventaire: equipe.inventaire.map((e) => ({ ...e, equipe: e.itemId === "x-anneau" })) };
    expect(bonusDefenseMagique(range, catalogue)).toBe(3);
    expect(bonusDefenseMundane(range, catalogue)).toBe(0);
  });
});

describe("règles d'équipement (mains, torse, bouclier)", () => {
  it("deux armes à 1 main OK, deux armes à 2 mains KO", () => {
    const deux1main = [
      { itemId: "item-epee-longue-1d8", quantite: 1, equipe: true },
      { itemId: "item-hache-1main", quantite: 1, equipe: true },
    ];
    expect(validerEquipement(deux1main, SEED_ITEMS).ok).toBe(true);
    const epee2mains: Item = {
      id: "x-epee-2m", nom: "Épée 2m", categorie: "arme", quantite: 1, exemple: false,
      estArme: true, bonusAttaque: 0, degats: "2d6", mains: 2,
    };
    const hache2mains: Item = {
      id: "x-hache-2m", nom: "Hache 2m", categorie: "arme", quantite: 1, exemple: false,
      estArme: true, bonusAttaque: 0, degats: "2d6", mains: 2,
    };
    const cat = [...SEED_ITEMS, epee2mains, hache2mains];
    expect(validerEquipement([
      { itemId: "x-epee-2m", quantite: 1, equipe: true },
      { itemId: "x-hache-2m", quantite: 1, equipe: true },
    ], cat).ok).toBe(false);
  });

  it("arc (2 mains) + épée (1 main) impossible", () => {
    const inv = [
      { itemId: "item-arc-court", quantite: 1, equipe: true },
      { itemId: "item-epee-longue-1d8", quantite: 1, equipe: false },
    ];
    const test = peutEquiper(inv, SEED_ITEMS, "item-epee-longue-1d8");
    expect(test.ok).toBe(false);
    expect(test.raisons.join(" ")).toMatch(/Mains/);
  });

  it("épée + bouclier OK, arme à 2 mains + bouclier KO", () => {
    expect(validerEquipement([
      { itemId: "item-epee-longue-1d8", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(true);
    expect(validerEquipement([
      { itemId: "item-epee-2mains-2d6", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(false);
    expect(validerEquipement([
      { itemId: "item-hache-2mains-2d6", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(false);
  });

  it("un seul torse à la fois", () => {
    const cuir: Item = {
      id: "x-cuir", nom: "Cuir (+2 DEF)", categorie: "armure", quantite: 1, exemple: false,
      bonusDefense: 2, mains: 0, emplacement: "torse",
    };
    const cat = [...SEED_ITEMS, cuir];
    const inv = [
      { itemId: "item-chemise-mailles", quantite: 1, equipe: true },
      { itemId: "x-cuir", quantite: 1, equipe: false },
    ];
    expect(peutEquiper(inv, cat, "x-cuir").ok).toBe(false);
    // Torse + bouclier : cumul autorisé.
    expect(validerEquipement([
      { itemId: "item-chemise-mailles", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(true);
  });

  it("bâtons à 2 mains, baguette à 1 main", () => {
    const mains = (id: string) => mainsDe(SEED_ITEMS.find((o) => o.id === id)!);
    expect(mains("item-baton")).toBe(2);
    expect(mains("item-baton-ferre")).toBe(2);
    expect(mains("item-baguette")).toBe(1);
    // Baguette + bouclier OK (1+1), bâton + bouclier KO (2+1).
    expect(validerEquipement([
      { itemId: "item-baguette", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(true);
    expect(validerEquipement([
      { itemId: "item-baton-ferre", quantite: 1, equipe: true },
      { itemId: "item-grand-bouclier", quantite: 1, equipe: true },
    ], SEED_ITEMS).ok).toBe(false);
  });

  it("itemSchema accepte mains et emplacement", () => {
    const base = { id: "x", nom: "X", categorie: "armure", quantite: 1, exemple: false };
    expect(() => itemSchema.parse({ ...base, bonusDefense: 2, mains: 0, emplacement: "torse" })).not.toThrow();
    expect(() => itemSchema.parse({ ...base, mains: 3 })).toThrow();
    expect(() => itemSchema.parse({ ...base, emplacement: "casque" })).toThrow();
  });
});
