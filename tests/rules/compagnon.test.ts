import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Character } from "@/src/lib/rules/types";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import {
  appliquerResultatsCombat,
  construireLoupCompagnon,
  lancerSortHorsCombat,
  propositionTravailEquipe,
  resolveAttack,
  transfererVieAuLoup,
  utiliserCapacite,
} from "@/src/lib/rules/combat/attack";
import { construirePJCombat } from "@/src/lib/rules/combat/staging";
import { talentsLancables } from "@/src/lib/data/capacites-usables";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  CARACS_LOUP,
  CARACS_LOUP_ALPHA,
  aUnLoup,
  bonusDefTactiques,
  estAlpha,
  facteurLienEmpathique,
  ficheLoup,
  idFicheLoup,
  nbRang5VoiesRodeur,
  pvMaxLoup,
  rangVoieCompagnon,
} from "@/src/lib/rules/compagnon";

function rodeur(nom = "Rodeur"): CombatParticipant {
  return {
    instanceId: `pj-${nom}-${Math.random()}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 13, initMod: 2, initiative: null,
    attaques: [{ id: "arc", nom: "Arc court", bonus: 7, degats: "1d6" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 3,
    ressources: {},
    statut: "actif",
    profil: "Rôdeur",
    caracs: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 },
    usagesSorts: {},
  };
}

function gobelin(nom = "Gobelin", pv = 30): CombatParticipant {
  return {
    instanceId: `m-${nom}-${pv}-${Math.random()}`, templateId: "m", nom, camp: "monstre",
    pvMax: pv, pv, defense: 10, initMod: 2, initiative: null,
    attaques: [{ id: "dague", nom: "Dague", bonus: 4, degats: "1d6+2" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 1,
    ressources: {},
    statut: "actif",
  };
}

describe("voie du compagnon animal (LDB)", () => {
  it("DEF = 12 + rang DANS la voie (R3 compagnon + R5 archer sans Tactiques = 15)", () => {
    const r = {
      ...rodeur(),
      capacites: ["Le loup", "Travail d'équipe", "Lien empathique", "Flèche de mort"],
    };
    expect(rangVoieCompagnon({ capacites: r.capacites, sorts: [] })).toBe(3);
    expect(nbRang5VoiesRodeur({ capacites: r.capacites, sorts: [] })).toBe(1);
    expect(bonusDefTactiques({ capacites: r.capacites, sorts: [] })).toBe(0);
    const loup = construireLoupCompagnon(r);
    expect(loup.defense).toBe(15); // 12 + 3, pas 12 + 5
    expect(loup.pv).toBe(12); // niv 3 × 4
  });

  it("alpha : CON +3 FOR +5, DM 1d4°+5, DEF 12 + rang voie", () => {
    expect(CARACS_LOUP).toMatchObject({ CON: 1, FOR: 2 });
    expect(CARACS_LOUP_ALPHA).toMatchObject({ CON: 3, FOR: 5 });
    const r = { ...rodeur(), capacites: ["Le loup", "Loup alpha"], niveau: 4, bonusMagique: 7 };
    const loup = construireLoupCompagnon(r);
    expect(loup.nom).toBe(`Loup alpha (${r.nom})`);
    expect(loup.caracs).toMatchObject({ CON: 3, FOR: 5 });
    expect(loup.defense).toBe(16); // 12 + rang 4
    expect(loup.attaques[0].degats).toBe("1d4+5"); // niv 4 -> d4
    const simple = construireLoupCompagnon({ ...rodeur(), capacites: ["Le loup"] });
    expect(simple.caracs).toMatchObject({ CON: 1, FOR: 2 });
  });

  it("tactiques : +1d4° auto même cible même manche, rien sinon", () => {
    // R5 Tactiques sans la chaîne R4 : rang 5 ≥ 4 → alpha (1d4+5 au niv. 3).
    const r = { ...rodeur(), capacites: ["Le loup", "Tactiques de meute"] };
    const loupModele = construireLoupCompagnon(r);
    expect(loupModele.nom.startsWith("Loup alpha")).toBe(true);
    const s = createCombat([r, { ...loupModele, compagnonDe: r.instanceId }, gobelin("A"), gobelin("B")]);
    const [rid, lid, ga, gb] = s.participants.map((p) => p.instanceId);
    // Rôdeur touche A : 19+7, 1d6 -> 4.
    const r1 = resolveAttack(s, rid, ga, "arc", fixedRng([0.9, 0.5]));
    expect(r1.resolution.touche).toBe(true);
    // Loup même cible : base 1d4+5 (3+5=8) + meute 1d4° (3) = 11.
    const r2 = resolveAttack(r1.state, lid, ga, "loup-morsure", fixedRng([0.9, 0.5, 0.5]));
    expect(r2.resolution.touche).toBe(true);
    expect(r2.resolution.degatsTotal).toBe(11);
    expect(r2.state.log.some((l) => l.message.includes("Tactiques de meute"))).toBe(true);
    // Autre cible : pas de bonus (8 seuls).
    const r3 = resolveAttack(r1.state, lid, gb, "loup-morsure", fixedRng([0.9, 0.5]));
    expect(r3.resolution.degatsTotal).toBe(8);
    expect(r3.state.log.some((l) => l.message.includes("Tactiques de meute"))).toBe(false);
  });

  it("tactiques : sans attaque préalable du maître, pas de bonus", () => {
    const r = { ...rodeur(), capacites: ["Le loup", "Tactiques de meute"] };
    const loupModele = construireLoupCompagnon(r);
    const s = createCombat([r, { ...loupModele, compagnonDe: r.instanceId }, gobelin("A")]);
    const [, lid, ga] = s.participants.map((p) => p.instanceId);
    const res = resolveAttack(s, lid, ga, "loup-morsure", fixedRng([0.9, 0.5]));
    expect(res.resolution.degatsTotal).toBe(8);
  });

  it("lien empathique : 1 PV = 1 PV (×2 tactiques), sans limite, L", () => {
    const r = { ...rodeur(), capacites: ["Le loup", "Lien empathique"], pv: 30 };
    const loup = { ...construireLoupCompagnon(r), pv: 5, compagnonDe: r.instanceId };
    const s = createCombat([r, loup, gobelin("G")]);
    const [rid, lid] = s.participants.map((p) => p.instanceId);
    const t = transfererVieAuLoup(s, rid, lid, 4);
    expect(t.resolution).toMatchObject({ pvDepenses: 4, pvRendus: 4, facteur: 1 });
    expect(t.state.participants[0].pv).toBe(26);
    expect(t.state.participants[1].pv).toBe(9);
    // Avec Tactiques : doublé, plafonné au max.
    const r2 = { ...rodeur("R2"), capacites: ["Le loup", "Lien empathique", "Tactiques de meute"], pv: 30 };
    const loup2 = { ...construireLoupCompagnon(r2), pv: 5, compagnonDe: r2.instanceId };
    expect(facteurLienEmpathique({ capacites: r2.capacites, sorts: [] })).toBe(2);
    const s2 = createCombat([r2, loup2, gobelin("G2")]);
    const [a2, l2] = s2.participants.map((p) => p.instanceId);
    const t2 = transfererVieAuLoup(s2, a2, l2, 4);
    expect(t2.resolution.facteur).toBe(2);
    expect(t2.state.participants[1].pv).toBe(12); // 5 + 8 plafonné à 12
    // Erreurs : sans Lien, montant excessif.
    const sansLien = createCombat([{ ...rodeur(), capacites: ["Le loup"] }, loup]);
    expect(() => transfererVieAuLoup(sansLien, sansLien.participants[0].instanceId, sansLien.participants[1].instanceId, 2)).toThrow(/Lien empathique/);
    expect(() => transfererVieAuLoup(s, rid, lid, 99)).toThrow(/insuffisants/);
  });

  it("travail d'équipe : dé bonus au loup via Capacités (adjacence MJ)", () => {
    expect(talentsLancables(["Travail d'équipe", "Lien empathique"])).toEqual(["Travail d'équipe", "Lien empathique"]);
    const r = { ...rodeur(), capacites: ["Le loup", "Travail d'équipe"] };
    const loup = { ...construireLoupCompagnon(r), compagnonDe: r.instanceId };
    const s = createCombat([{ ...r, capacites: [...r.capacites, "Travail d'équipe"] }, loup, gobelin("G")]);
    const [rid, lid, ga] = s.participants.map((p) => p.instanceId);
    const pose = utiliserCapacite(s, rid, lid, "Travail d'équipe", { effetCle: "travail-equipe", dureeTours: null, mods: { deBonus: 1 } });
    expect(pose.state.participants[1].effets[0].modificateurs).toMatchObject({ deBonus: 1 });
    // 3 puis 19 gardé (dé bonus).
    const atk = resolveAttack(pose.state, lid, ga, "loup-morsure", fixedRng([0.1, 0.9, 0.5]));
    expect(atk.resolution.desAvantage).toBe("bonus");
    expect(atk.resolution.jetNaturel).toBe(19);
  });

  it("alpha dès le rang 4 dans la voie (repli rang, ex. libellé édité)", () => {
    expect(estAlpha({ capacites: ["Le loup", "Loup alpha"] })).toBe(true);
    // R5 Tactiques sans la chaîne "Loup alpha" (fiche éditée à la main) : rang 5 ≥ 4 → alpha.
    expect(estAlpha({ capacites: ["Le loup", "Tactiques de meute"] })).toBe(true);
    expect(estAlpha({ capacites: ["Le loup"] })).toBe(false);
    const r = { ...rodeur(), capacites: ["Le loup", "Tactiques de meute"], niveau: 7 };
    const loup = construireLoupCompagnon(r);
    expect(loup.nom).toBe(`Loup alpha (${r.nom})`);
    expect(loup.caracs).toMatchObject({ CON: 3, FOR: 5 });
  });

  it("chaine fiche -> staging : Loup alpha nommé, DEF voie, caracs alpha", () => {
    const maitre: Character = {
      id: "pj-r", kind: "personnage", nom: "Faelyn", classe: "Rôdeur", niveau: 5,
      pvMax: 20, pv: 20, defense: 13, initMod: 2,
      caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 },
      peuple: "Demi-Elfe", famille: "Aventurier", profil: "Rôdeur",
      attaques: [], capacites: ["Le loup", "Travail d'équipe", "Lien empathique", "Loup alpha"],
      ressources: {}, effets: [], inventaire: [], sorts: [], exemple: false,
    };
    const [pj, loup] = construirePJCombat(maitre, []);
    expect(pj.nom).toBe("Faelyn");
    expect(loup.nom).toBe("Loup alpha (Faelyn)");
    expect(loup.defense).toBe(16); // 12 + rang 4
    expect(loup.caracs).toMatchObject({ CON: 3, FOR: 5 });
    expect(loup.pv).toBe(20); // niv 5 × 4, pleins
    expect(loup.compagnonDe).toBe(pj.instanceId);
  });

  it("staging : PV persistés de la fiche, 0 conservé = KO", () => {
    const maitre = {
      id: "pj-r", kind: "personnage" as const, nom: "R", classe: "Rôdeur", niveau: 3,
      pvMax: 20, pv: 20, defense: 13, initMod: 2,
      caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 },
      peuple: "Humain", famille: "Aventurier" as const, profil: "Rôdeur",
      attaques: [], capacites: ["Le loup"], ressources: {}, effets: [],
      inventaire: [], sorts: [], exemple: false,
      compagnon: { pv: 5 },
    };
    const [pj, loup] = construirePJCombat(maitre, []);
    expect(pj.nom).toBe("R");
    expect(loup.pv).toBe(5);
    expect(loup.pvMax).toBe(12);
    expect(loup.statut).toBe("actif");
    const ko = construirePJCombat({ ...maitre, compagnon: { pv: 0 } }, [])[1];
    expect(ko.pv).toBe(0);
    expect(ko.statut).toBe("ko");
    const neuf = construirePJCombat({ ...maitre, compagnon: undefined }, [])[1];
    expect(neuf.pv).toBe(12);
  });

  it("fin de combat : PV du loup persistés sur la fiche maître", () => {
    const fiche: Character = {
      id: "pj-r", kind: "personnage", nom: "R", classe: "Rôdeur", niveau: 3,
      pvMax: 20, pv: 20, defense: 13, initMod: 2,
      caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 },
      peuple: "Humain", famille: "Aventurier", profil: "Rôdeur",
      attaques: [], capacites: ["Le loup"], ressources: {}, effets: [],
      inventaire: [], sorts: [], exemple: false,
    };
    const r = { ...rodeur("R"), templateId: "pj-r", capacites: ["Le loup"] };
    const loup = { ...construireLoupCompagnon(r), templateId: "compagnon:loup:pj-r", compagnonDe: r.instanceId, pv: 7 };
    const s = createCombat([r, loup, gobelin("G")]);
    const [maj] = appliquerResultatsCombat([fiche], s.participants);
    expect(maj.compagnon).toEqual({ pv: 7 });
    expect(maj.pv).toBe(20);
  });

  it("proposition travail d'équipe : cas couverts pour le panneau Attaque", () => {
    const r = { ...rodeur(), capacites: ["Le loup", "Travail d'équipe"] };
    const loup = { ...construireLoupCompagnon(r), compagnonDe: r.instanceId };
    const s = createCombat([r, loup, gobelin("G")]);
    const [rid, lid] = s.participants.map((p) => p.instanceId);
    // Cas nominal : loup + maître avec talent → proposition au nom du maître.
    expect(propositionTravailEquipe(s.participants, lid)).toEqual({ maitreNom: "Rodeur" });
    expect(propositionTravailEquipe(s.participants, rid)).toBeNull(); // pas un loup
    expect(propositionTravailEquipe(s.participants, "inexistant")).toBeNull();
    expect(propositionTravailEquipe(s.participants, null)).toBeNull();
    // Maître sans le talent → null (le panneau affiche l'astuce R2).
    const r2 = { ...rodeur("R2"), capacites: ["Le loup"] };
    const loup2 = { ...construireLoupCompagnon(r2), compagnonDe: r2.instanceId };
    const s2 = createCombat([r2, loup2, gobelin("G2")]);
    expect(propositionTravailEquipe(s2.participants, s2.participants[1].instanceId)).toBeNull();
    // Dé bonus déjà actif (effet Capacités) → null (pas de double proposition).
    const pose = utiliserCapacite(s, rid, lid, "Travail d'équipe", { effetCle: "travail-equipe", dureeTours: null, mods: { deBonus: 1 } });
    expect(propositionTravailEquipe(pose.state.participants, lid)).toBeNull();
    // Repli nom (sans compagnonDe ni template) → maître retrouvé.
    const loupNu = { ...loup, compagnonDe: undefined, templateId: "x", nom: "Loup (Rodeur)" };
    const s3 = createCombat([r, loupNu, gobelin("G3")]);
    expect(propositionTravailEquipe(s3.participants, s3.participants[1].instanceId)).toEqual({ maitreNom: "Rodeur" });
  });

  it("fiche loup : personnage à part entière, soignable hors combat", () => {
    const maitre: Character = {
      id: "pj-r", kind: "personnage", nom: "R", classe: "Rôdeur", niveau: 3,
      pvMax: 20, pv: 20, defense: 13, initMod: 2,
      caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: 0 },
      peuple: "Humain", famille: "Aventurier", profil: "Rôdeur",
      attaques: [], capacites: ["Le loup"], ressources: {}, effets: [],
      inventaire: [], sorts: [], exemple: false,
      compagnon: { pv: 5 },
    };
    expect(aUnLoup(maitre)).toBe(true);
    expect(aUnLoup({ capacites: [] })).toBe(false);
    const loup = ficheLoup(maitre)!;
    expect(loup.id).toBe(idFicheLoup("pj-r"));
    expect(loup.nom).toBe("Loup (R)");
    expect(loup.pv).toBe(5);
    expect(loup.pvMax).toBe(pvMaxLoup(3));
    expect(ficheLoup({ ...maitre, capacites: [] })).toBeNull();
    // Soin hors combat sur la fiche loup (sort de soin générique, 1d4 : 3).
    const soigneur: Character = {
      ...maitre, id: "pj-s", nom: "S",
      ressources: { mana: { max: 5, actuel: 5 } },
      sorts: [],
    };
    const soin = { id: "t", nom: "Soin test", type: "defensif" as const, soin: "1d4", cout: { ressource: "mana", montant: 1 } };
    const { cible: soigne } = lancerSortHorsCombat(soigneur, loup, soin, fixedRng([0.5]));
    expect(soigne.pv).toBe(8);
  });
});
