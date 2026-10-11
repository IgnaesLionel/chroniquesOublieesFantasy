import { describe, expect, it } from "vitest";
import type { Character } from "@/src/lib/rules/types";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { ARME_FAMILLES, ARME_FAMILLE_KEYS, DEGAT_LABEL, labelFamilleArme } from "@/src/lib/rules/world/types";
import { characterSchema, itemSchema } from "@/src/lib/data/validation";
import { attaqueFromItem, attaqueFromSort, participantFromCharacter } from "@/src/lib/rules/combat/factory";
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

  it("Mirabel (seed) arrive en combat avec ses sorts d'attaque", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const p = participantFromCharacter(mirabel, SEED_ITEMS);
    const ids = p.attaques.map((a) => a.id);
    expect(ids).toContain("sort:mirabel-malediction");
    expect(ids).toContain("sort:mirabel-saignements");
    // Malédiction (sans DM) : jet d'attaque + effet, 0 DM.
    expect(p.attaques.find((a) => a.id === "sort:mirabel-malediction")?.degats).toBe("1d1-1");
    expect(p.attaques.find((a) => a.id === "sort:mirabel-saignements")?.bonus).toBe(5);
  });

  it("sort à carac : INT substituée dans les dégâts", () => {
    const sort = { id: "p", nom: "Pied dans la tombe", type: "offensif" as const, degats: "1d4°+INT" };
    const a = attaqueFromSort(sort, 3, { INT: 2 });
    expect(a?.degats).toBe("1d4°+2");
    expect(a?.bonus).toBe(3);
    // Donnée grimoire : Un pied dans la tombe = 1d4°+INT.
    const grimoire = SEED_SORTS.find((s) => s.id === "sort-pied-tombe")!;
    expect(grimoire.degats).toBe("1d4°+INT");
  });

  it("sort à dé évolutif : dE substitué selon le niveau", () => {
    const sort = { id: "e", nom: "Attaque évolutive", type: "offensif" as const, degats: "1dE+1" };
    expect(attaqueFromSort(sort, 0, {}, 1)?.degats).toBe("1d4+1");
    expect(attaqueFromSort(sort, 0, {}, 9)?.degats).toBe("1d8+1");
  });

  it("attaque magique capée au niveau 10", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const haut = { ...mirabel, niveau: 12 };
    const p = participantFromCharacter(haut, SEED_ITEMS);
    // 10 (cap) + VOL 4 = 14, pas 12 + 4 = 16.
    expect(p.attaques.find((a) => a.id === "sort:mirabel-saignements")?.bonus).toBe(14);
  });

  it("attaque de sort TOUCHÉE : dégâts appliqués, PV déduits", () => {
    const lanceur: CombatParticipant = {
      ...guerrier(), nom: "Mirabel",
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
});
