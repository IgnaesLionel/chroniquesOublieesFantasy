import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives } from "@/src/lib/rules/combat/initiative";
import { applyDamage, applyCoutPV, castSoutien, checkEnd, depenserChanceApresCoup, etatLimite, frapperZone, resolveAttack, sortUtilisable, utiliserCapacite } from "@/src/lib/rules/combat/attack";
import { monsterInstances, participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import { SEED_MONSTERS, SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { CAPACITES_USABLES } from "@/src/lib/data/capacites-usables";
import { createEffect } from "@/src/lib/rules/effects/effects";

function pj(nom = "Guerrier", defense = 18): CombatParticipant {
  return {
    instanceId: `pj-${nom}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense, initMod: 1, initiative: null,
    attaques: [{ id: "epee", nom: "Épée", bonus: 6, degats: "1d8+3" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 1,
    ressources: {},
    statut: "actif",
  };
}

function gobelin(nom = "Gobelin", pv = 8): CombatParticipant {
  return {
    instanceId: `m-${nom}-${pv}-${Math.random()}`, templateId: "m", nom, camp: "monstre",
    pvMax: pv, pv, defense: 15, initMod: 2, initiative: null,
    attaques: [{ id: "dague", nom: "Dague", bonus: 4, degats: "1d6+2" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 1,
    ressources: {},
    statut: "actif",
  };
}

describe("moteur de combat", () => {
  it("template x4 -> instances indépendantes (noms #1..#4, PV propres)", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom.toLowerCase().includes("gobelin")) ?? SEED_MONSTERS[0];
    const got = monsterInstances(tpl, 4);
    expect(got).toHaveLength(4);
    expect(got.map((g) => g.nom)).toEqual([1, 2, 3, 4].map((i) => `${tpl.nom} #${i}`));
    const pvRef = tpl.pv;
    got[0].pv = 0;
    expect(got[1].pv).toBe(pvRef);
  });

  it("initiatives triées décroissant", () => {
    const s = createCombat([pj("Lent"), gobelin("Vite")]);
    // rng: Lent -> 5+1=6 ; Vite -> 15+2=17
    let i = 0;
    const seq = [0.22, 0.72];
    const rolled = rollInitiatives(s, () => seq[i++ % seq.length]);
    expect(rolled.participants[0].nom).toBe("Vite");
    expect(getActive(rolled)?.nom).toBe("Vite");
  });

  it("nextTurn boucle et manche++ ; prevTurn revient", () => {
    const s = rollInitiatives(createCombat([pj("A"), pj("B")]), fixedRng([0.5, 0.4]));
    expect(s.manche).toBe(1);
    const s2 = nextTurn(s, false);
    expect(s2.tourIndex).toBe(1);
    const s3 = nextTurn(s2, false);
    expect(s3.tourIndex).toBe(0);
    expect(s3.manche).toBe(2);
    const back = prevTurn(s3);
    expect(back.tourIndex).toBe(1);
  });

  it("attaque TOUCHÉ : 15+4=19 vs déf 18, dégâts appliqués", () => {
    const s = createCombat([gobelin("Gob"), pj("Guerrier", 18)]);
    // jet attaque : veut naturel 15 -> rng 0.72 ; dégâts 1d6+2 : veut 4 -> rng 0.55
    let i = 0;
    const rng = () => [0.72, 0.55][i++ % 2];
    const { state: s2, resolution } = resolveAttack(s, s.participants[0].instanceId, s.participants[1].instanceId, "dague", rng);
    expect(resolution.jetNaturel).toBe(15);
    expect(resolution.jetTotal).toBe(19);
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(6); // 4+2
    expect(resolution.pvAvant).toBe(40);
    expect(resolution.pvApres).toBe(34);
    expect(s2.participants[1].pv).toBe(34);
  });

  it("attaque MANQUÉ : pas de dégâts", () => {
    const s = createCombat([pj("Guerrier"), gobelin("Gob")]);
    const { resolution } = resolveAttack(
      s, s.participants[0].instanceId, s.participants[1].instanceId, "epee",
      fixedRng([0.1]) // naturel 3 + 6 = 9 < déf 15
    );
    expect(resolution.touche).toBe(false);
    expect(resolution.degatsTotal).toBe(0);
    expect(resolution.pvApres).toBe(8);
  });

  it("dégâts explosifs en attaque : 4 relancé + modificateur", () => {
    const lanceur = { ...pj("Mage"), attaques: [{ id: "sort", nom: "✦ Pied dans la tombe", bonus: 5, degats: "1d4°+2" }] };
    const s = createCombat([lanceur, gobelin("Gob")]);
    // Jet 15+5=20 vs déf 15 : touché ; d4 : 4 (relance 3) -> 4+3+2 = 9.
    const { resolution } = resolveAttack(
      s, s.participants[0].instanceId, s.participants[1].instanceId, "sort",
      fixedRng([0.72, 0.99, 0.5])
    );
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsDetails).toEqual([4, 3]);
    expect(resolution.degatsTotal).toBe(9);
    expect(resolution.pvApres).toBe(0);
    expect(resolution.cibleTombe).toBe(true);
  });

  it("0 PV -> KO + journal hors combat, victoire PJ", () => {
    let s = createCombat([pj("Héros"), gobelin("G1", 5), gobelin("G2", 5)]);
    s = applyDamage(s, s.participants[1].instanceId, 5);
    expect(s.participants[1].statut).toBe("ko");
    expect(s.termine).toBe(false);
    s = applyDamage(s, s.participants[2].instanceId, 99);
    expect(s.participants[2].pv).toBe(0);
    expect(s.termine).toBe(true);
    expect(s.gagnant).toBe("pj");
    expect(s.log.some((l) => l.message.includes("hors combat") || l.message.includes("terminé"))).toBe(true);
  });

  it("nat 1 = échec auto même avec gros bonus", () => {
    const s = createCombat([pj("Fort"), gobelin("G")]);
    const { resolution } = resolveAttack(
      s, s.participants[0].instanceId, s.participants[1].instanceId, "epee", fixedRng([0])
    );
    expect(resolution.jetNaturel).toBe(1);
    expect(resolution.touche).toBe(false);
  });

  it("checkEnd détecte défaite PJ", () => {
    const ko = { ...pj("H"), pv: 0, statut: "ko" as const };
    const s = checkEnd(createCombat([ko, gobelin("G")]));
    expect(s.termine).toBe(true);
    expect(s.gagnant).toBe("monstre");
  });

  it("chance +10 après un manqué : rattrapé, PC dépensé, dégâts relancés", () => {
    const atk = { ...pj("Guerrier"), ressources: { chance: { max: 3, actuel: 2 } } };
    const s = createCombat([atk, pj("Tank", 18)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 9 + 6 = 15 < 18 : manqué.
    const manque = resolveAttack(s, a, t, "epee", fixedRng([0.4])).resolution;
    expect(manque.touche).toBe(false);
    // +10 : 25 ≥ 18, touché. 1d8+3 avec rng 0.5 -> 4+1... 5+3 = 8.
    const { state, resolution } = depenserChanceApresCoup(s, a, t, "epee", manque, fixedRng([0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.critique).toBe(false);
    expect(resolution.jetTotal).toBe(25);
    expect(resolution.degatsTotal).toBe(8);
    expect(state.participants[0].ressources.chance.actuel).toBe(1);
    expect(state.participants[1].pv).toBe(32);
    expect(state.log.some((l) => l.message.includes("1 PC"))).toBe(true);
  });

  it("chance +10 : le PC est dépensé même si ça rate encore", () => {
    const atk = { ...pj("Guerrier"), ressources: { chance: { max: 2, actuel: 1 } } };
    const s = createCombat([atk, pj("Mur", 30)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const manque = resolveAttack(s, a, t, "epee", fixedRng([0.1])).resolution; // 3+6=9
    const { state, resolution } = depenserChanceApresCoup(s, a, t, "epee", manque, fixedRng([0.9]));
    expect(resolution.touche).toBe(false);
    expect(resolution.degatsTotal).toBe(0);
    expect(state.participants[0].ressources.chance.actuel).toBe(0);
    expect(state.participants[1].pv).toBe(40);
  });

  it("chance +10 : rattrape même un 1 naturel", () => {
    const atk = { ...gobelin("G"), ressources: { chance: { max: 2, actuel: 2 } } };
    const s = createCombat([atk, pj("Cible", 12)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const manque = resolveAttack(s, a, t, "dague", fixedRng([0])).resolution; // nat 1
    expect(manque.jetNaturel).toBe(1);
    expect(manque.touche).toBe(false);
    // 5 + 10 = 15 ≥ 12 : touché malgré le 1. 1d6+2 rng 0 -> 1+2 = 3 (cible à 40 PV).
    const { state, resolution } = depenserChanceApresCoup(s, a, t, "dague", manque, fixedRng([0]));
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(3);
    expect(state.participants[1].pv).toBe(37);
  });

  it("chance +10 : erreur sans PC ou sans attaque", () => {
    const atk = { ...pj("Guerrier"), ressources: { chance: { max: 2, actuel: 0 } } };
    const s = createCombat([atk, gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const manque = resolveAttack(s, a, t, "epee", fixedRng([0.1])).resolution;
    expect(() => depenserChanceApresCoup(s, a, t, "epee", manque)).toThrow(/point de chance/);
    expect(() => depenserChanceApresCoup(s, a, t, "inexistante", manque)).toThrow(/Attaque introuvable/);
  });

  it("sortUtilisable : verrou de niveau, gratuité déduite", () => {
    expect(sortUtilisable(1, { nom: "X", rang: 1 })).toEqual({ ok: true });
    expect(sortUtilisable(1, { nom: "X", rang: 2 })).toEqual({ ok: false, raison: "niveau 2 requis" });
    expect(sortUtilisable(1, { nom: "X", rang: 2, niveauMin: 1 })).toEqual({ ok: true });
    expect(sortUtilisable(4, { nom: "X", rang: 4, niveauMin: 5 }).raison).toBe("niveau 5 requis");
    expect(sortUtilisable(3, { nom: "X" })).toEqual({ ok: true });
  });

  it("factory : niveau transmis, niveauMin calculé (gratuité Mage déduite)", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    const p = participantFromCharacter(mirabel, []);
    expect(p.niveau).toBe(1);
    const sorts = Object.fromEntries(p.sorts.map((s) => [s.nom, s.niveauMin]));
    // Malédiction / Saignements (R1) : niveau 1.
    expect(sorts["Malédiction"]).toBe(1);
    expect(sorts["Saignements"]).toBe(1);
    // Maîtrise apprise en talent (gratuité R2 consommée) : sort à créer exigible au niveau 2.
    const sortsMage = {
      ...mirabel,
      sorts: [
        { id: "a", nom: "Maîtrise de la magie", type: "utilitaire" as const, voie: "Voie du mage", rang: 2, cout: { ressource: "mana", montant: 2 } },
      ],
    };
    const p2 = participantFromCharacter(sortsMage, []);
    expect(p2.sorts[0].niveauMin).toBe(1); // gratuité Mage : lançable au niv. 1
    // Monstres : niveau du template, sorts vides.
    const tpl = SEED_MONSTERS[0];
    const [m] = monsterInstances(tpl, 1);
    expect(m.niveau).toBe(tpl.niveau);
    expect(m.sorts).toEqual([]);
  });

  it("usages par défaut : Protéger un allié -> Protection sur allié", () => {
    const entree = CAPACITES_USABLES.find((u) => u.talent === "Protéger un allié");
    expect(entree).toMatchObject({ effetCle: "protection", dureeTours: 1, cibles: "allies" });
  });

  it("utiliserCapacite : buff appliqué + visible + journalisé (Dorain protège un allié)", () => {
    const dorainSeed = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const dorain = participantFromCharacter(dorainSeed, []);
    expect(dorain.capacites).toContain("Protéger un allié");
    const s = createCombat([dorain, pj("Allié"), gobelin("G")]);
    const [lanceur, allie] = s.participants.map((p) => p.instanceId);
    const { state, resolution } = utiliserCapacite(s, lanceur, allie, "Protéger un allié", { effetCle: "protection", dureeTours: 1 });
    const cible = state.participants[1];
    expect(cible.effets).toHaveLength(1);
    expect(cible.effets[0].nom).toBe("Protection");
    expect(cible.effets[0].toursRestants).toBe(1);
    expect(cible.effets[0].source).toBe(dorain.nom);
    expect(cible.effets[0].modificateurs).toMatchObject({ defense: 2 });
    expect(resolution.effetNom).toBe("Protection");
    expect(state.log.some((l) => l.message.includes("Protéger un allié"))).toBe(true);
    expect(state.log.some((l) => l.message.includes("Protection"))).toBe(true);
  });

  it("utiliserCapacite : talent inconnu / étourdi -> erreur ; sans effet -> narratif seul", () => {
    const s = createCombat([pj("A"), pj("B")]);
    const [a, b] = s.participants.map((p) => p.instanceId);
    expect(() => utiliserCapacite(s, a, b, "Inexistant", {})).toThrow(/ne connaît pas/);
    const sonne = {
      ...s,
      participants: s.participants.map((p) =>
        p.instanceId === a
          ? { ...p, capacites: ["Cri de guerre"], effets: [createEffect("etourdi")] }
          : p
      ),
    };
    expect(() => utiliserCapacite(sonne, a, b, "Cri de guerre", {})).toThrow(/ne peut pas agir/);
    const avecTalent = {
      ...s,
      participants: s.participants.map((p) =>
        p.instanceId === a ? { ...p, capacites: ["Cri de guerre"] } : p
      ),
    };
    const { state, resolution } = utiliserCapacite(avecTalent, a, b, "Cri de guerre", {});
    expect(resolution.effetNom).toBeNull();
    expect(state.participants[1].effets).toHaveLength(0);
    expect(state.log.some((l) => l.message.includes("Cri de guerre"))).toBe(true);
  });
});

function sorcier(nom = "Sorcier"): CombatParticipant {
  return {
    instanceId: `pj-${nom}-${Math.random()}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 12, initMod: 1, initiative: null,
    attaques: [],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 5,
    ressources: { mana: { max: 10, actuel: 10 } },
    statut: "actif",
    bonusMagique: 8,
    caracs: { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 2, VOL: 3 },
    usagesSorts: {},
  };
}

describe("sorcier (voies du livre)", () => {
  it("dé bonus : 2d20 garder le meilleur ; dé malus : le pire ; annulation mutuelle", () => {
    const bonus = { ...pj("A"), effets: [createEffect("Dé bonus", { modificateurs: { deBonus: 1 } })] };
    const s = createCombat([bonus, pj("Tank", 18)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // d20 : 3 puis 19 -> gardé 19, +6 = 25 ≥ 18 touché. Dégâts 1d8+3 : 5+3 = 8.
    const r = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.9, 0.5])).resolution;
    expect(r.jetNaturel).toBe(19);
    expect(r.jetSecondaire).toBe(3);
    expect(r.desAvantage).toBe("bonus");
    expect(r.touche).toBe(true);
    expect(r.degatsTotal).toBe(8);

    const malus = { ...pj("B"), effets: [createEffect("Dé malus", { modificateurs: { deMalus: 1 } })] };
    const s2 = createCombat([malus, pj("Tank", 18)]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    // 19 puis 3 -> gardé 3, +6 = 9 < 18 manqué.
    const r2 = resolveAttack(s2, a2, t2, "epee", fixedRng([0.9, 0.1, 0.5])).resolution;
    expect(r2.jetNaturel).toBe(3);
    expect(r2.desAvantage).toBe("malus");
    expect(r2.touche).toBe(false);

    const neutre = { ...pj("C"), effets: [createEffect("X", { modificateurs: { deBonus: 1, deMalus: 1 } })] };
    const s3 = createCombat([neutre, pj("Tank", 18)]);
    const [a3, t3] = s3.participants.map((p) => p.instanceId);
    const r3 = resolveAttack(s3, a3, t3, "epee", fixedRng([0.9, 0.5])).resolution;
    expect(r3.jetNaturel).toBe(19);
    expect(r3.jetSecondaire).toBeNull();
    expect(r3.desAvantage).toBeNull();
  });

  it("vol de vie (Baiser) : le lanceur récupère les DM, mana payé", () => {
    const baiser = { id: "x", nom: "Baiser du vampire", type: "offensif" as const, cout: { ressource: "mana", montant: 3 } };
    const atk = {
      ...sorcier(), pv: 30,
      attaques: [{ id: "sort:x", nom: "✦ Baiser du vampire", bonus: 10, degats: "1d6", volDeVie: true }],
      sorts: [baiser],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19+10 touché, 1d6 : 4 DM.
    const { state, resolution } = resolveAttack(s, a, t, "sort:x", fixedRng([0.9, 0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(4);
    expect(state.participants[0].pv).toBe(34);
    expect(state.participants[0].ressources.mana.actuel).toBe(7);
    expect(state.participants[1].pv).toBe(36);
    expect(state.log.some((l) => l.message.includes("vol de vie"))).toBe(true);
  });

  it("sacrifice PV (Rituel/Invocation) payé avant le jet", () => {
    const sort = { id: "sv", nom: "S", type: "offensif" as const, cout: { ressource: "mana", montant: 2 }, coutPV: "1d6" };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:sv", nom: "✦ S", bonus: 10, degats: "1d6" }],
      sorts: [sort],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Sacrifice 1d6 : 4 PV puis jet 19+10 touché puis 4 DM.
    const { state } = resolveAttack(s, a, t, "sort:sv", fixedRng([0.5, 0.9, 0.5]));
    expect(state.participants[0].pv).toBe(36);
    expect(state.participants[1].pv).toBe(36);
    expect(state.log.some((l) => l.message.includes("sacrifie 4 PV"))).toBe(true);
  });

  it("touche auto (Rituel de sang) : sans jet, sacrifice + effet", () => {
    const sort = { id: "r", nom: "Rituel de sang", type: "offensif" as const, cout: { ressource: "mana", montant: 4 }, coutPV: "1d4" };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:r", nom: "✦ Rituel de sang", bonus: 0, degats: "1d1-1", toucheAuto: true, effetTouche: { cle: "Saignement rituel", duree: null } }],
      sorts: [sort],
    };
    const s = createCombat([atk, pj("Tank", 30)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Sacrifice 1d4 : 3 PV. Dégâts 1d1-1 = 0.
    const { state, resolution } = resolveAttack(s, a, t, "sort:r", fixedRng([0.5, 0.1, 0.9]));
    expect(resolution.touche).toBe(true);
    expect(resolution.toucheAuto).toBe(true);
    expect(state.participants[0].pv).toBe(37);
    expect(state.participants[0].ressources.mana.actuel).toBe(6);
    expect(state.participants[1].effets.map((e) => e.nom)).toContain("Saignement rituel");
  });

  it("moitié si raté (Briser les cœurs)", () => {
    const sort = { id: "br", nom: "Briser les cœurs", type: "offensif" as const, cout: { ressource: "mana", montant: 5 } };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:br", nom: "✦ Briser", bonus: 6, degats: "2d4", demiDegatsSiRate: true }],
      sorts: [sort],
    };
    const s = createCombat([atk, pj("Mur", 30)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 3+6 = 9 < 30 raté, 2d4 : 3+3 = 6 -> moitié 3.
    const { state, resolution } = resolveAttack(s, a, t, "sort:br", fixedRng([0.1, 0.5, 0.5]));
    expect(resolution.touche).toBe(false);
    expect(resolution.degatsTotal).toBe(3);
    expect(state.participants[1].pv).toBe(37);
    expect(state.log.some((l) => l.message.includes("moitié"))).toBe(true);
  });

  it("dégâts par tour lancés au toucher (Saignements)", () => {
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sa", nom: "Saignements", bonus: 10, degats: "1d1-1", effetTouche: { cle: "Saignement", duree: null, degatsParTour: "1d4" } }],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touché, 0 DM direct, DoT 1d4 : 3.
    const { state } = resolveAttack(s, a, t, "sa", fixedRng([0.9, 0.1, 0.5]));
    const effet = state.participants[1].effets.find((e) => e.nom === "Saignement");
    expect(effet).toBeTruthy();
    expect(effet!.modificateurs).toMatchObject({ pvParTour: -3 });
  });

  it("limite 1/combat (Ensevelissement) : 2e lancer refusé", () => {
    const sort = { id: "e", nom: "Ensevelissement", type: "offensif" as const, limiteCombat: 1, cout: { ressource: "mana", montant: 4 } };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:e", nom: "✦ Ensevelissement", bonus: 10, degats: "1d1-1" }],
      sorts: [sort],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const r1 = resolveAttack(s, a, t, "sort:e", fixedRng([0.9, 0.1]));
    expect(r1.state.participants[0].usagesSorts?.["e"]?.n).toBe(1);
    expect(() => resolveAttack(r1.state, a, t, "sort:e", fixedRng([0.9, 0.1]))).toThrow(/limite 1\/combat/);
  });

  it("limite par cible (Malédiction) : même cible refusée, autre acceptée", () => {
    const sort = { id: "m", nom: "Malédiction", type: "offensif" as const, limiteParCible: true, cout: { ressource: "mana", montant: 1 } };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:m", nom: "✦ Malédiction", bonus: 10, degats: "1d1-1", effetTouche: { cle: "Dé malus", duree: 1, mods: { deMalus: 1 } } }],
      sorts: [sort],
    };
    const s = createCombat([atk, gobelin("A"), gobelin("B")]);
    const [a, ga, gb] = s.participants.map((p) => p.instanceId);
    const r1 = resolveAttack(s, a, ga, "sort:m", fixedRng([0.9, 0.1]));
    expect(r1.resolution.touche).toBe(true);
    expect(r1.state.participants[1].effets[0].modificateurs).toMatchObject({ deMalus: 1 });
    expect(() => resolveAttack(r1.state, a, ga, "sort:m", fixedRng([0.9, 0.1]))).toThrow(/déjà affectée/);
    const r2 = resolveAttack(r1.state, a, gb, "sort:m", fixedRng([0.9, 0.1]));
    expect(r2.resolution.touche).toBe(true);
  });

  it("soutien : attaque accordée (Beauté) + effet, INT substitué", () => {
    const beaute = {
      id: "b", nom: "Beauté de la succube", type: "utilitaire" as const, rang: 2,
      action: "limitee" as const, cout: { ressource: "mana", montant: 2 },
      effetCle: "Beauté de la succube", effetDuree: null,
      attaqueAccordee: { nom: "Contact de la succube", degats: "1d4°+INT", volDeVie: true },
    };
    const caster = { ...sorcier(), sorts: [beaute] };
    const s = createCombat([caster, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    const { state } = castSoutien(s, a, a, beaute, fixedRng([0.9]));
    const moi = state.participants[0];
    const accordee = moi.attaques.find((x) => x.nom === "✦ Contact de la succube");
    expect(accordee).toBeTruthy();
    expect(accordee!.degats).toBe("1d4°+2");
    expect(accordee!.volDeVie).toBe(true);
    expect(moi.effets.map((e) => e.nom)).toContain("Beauté de la succube");
    expect(moi.ressources.mana.actuel).toBe(8);
  });

  it("soutien : invocation (démon) au camp du lanceur, PV niveau×5", () => {
    const invoc = {
      id: "i", nom: "Invocation d'un démon", type: "utilitaire" as const, rang: 5,
      action: "limitee" as const, cout: { ressource: "mana", montant: 5 }, coutPV: "1d4",
      invocation: { nom: "Démon", pvBase: 0, pvParNiveau: 5, defense: 18, bonusAttaque: "magique" as const, degats: "2d4°+5" },
    };
    const caster = { ...sorcier(), sorts: [invoc] };
    const s = createCombat([caster, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    // Sacrifice 1d4 : 3 PV.
    const { state, resolution } = castSoutien(s, a, a, invoc, fixedRng([0.5]));
    expect(state.participants).toHaveLength(3);
    const demon = state.participants[2];
    expect(demon.nom).toBe("Démon (Sorcier)");
    expect(demon.camp).toBe("pj");
    expect(demon.pv).toBe(25);
    expect(demon.defense).toBe(18);
    expect(demon.attaques[0].bonus).toBe(8);
    expect(resolution.invoque).toBe("Démon (Sorcier)");
    expect(state.participants[0].pv).toBe(37);
    expect(state.participants[0].ressources.mana.actuel).toBe(5);
  });

  it("zone (Armée des morts) : tous les ennemis, alliés épargnés, 1/combat", () => {
    const armee = {
      id: "am", nom: "Armée des morts", type: "utilitaire" as const, rang: 5,
      action: "limitee" as const, degats: "2d4",
      effetCle: "Armée des morts", effetDuree: null, effetDegats: "2d4",
      limiteCombat: 1, zone: true, cout: { ressource: "mana", montant: 5 },
    };
    const caster = { ...sorcier(), sorts: [armee] };
    const s = createCombat([caster, pj("Allié"), gobelin("A", 8), gobelin("B", 8)]);
    const [a] = s.participants.map((p) => p.instanceId);
    // 2d4 : 3+3 = 6 immédiats, DoT 2d4 : -6/round.
    const { state } = frapperZone(s, a, armee, fixedRng([0.5, 0.5, 0.5, 0.5]));
    expect(state.participants[1].pv).toBe(40);
    expect(state.participants[2].pv).toBe(2);
    expect(state.participants[3].pv).toBe(2);
    expect(state.participants[2].effets[0].modificateurs).toMatchObject({ pvParTour: -6 });
    expect(state.participants[0].usagesSorts?.["am"]?.n).toBe(1);
    expect(() => frapperZone(state, a, armee, fixedRng([0.5]))).toThrow(/limite 1\/combat/);
  });

  it("capacités : Pacte démoniaque sacrifie des PV, sans effet", () => {
    const caster = { ...sorcier(), capacites: ["Pacte démoniaque"] };
    const s = createCombat([caster, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    // Sacrifice 1d4 : 3 PV.
    const { state, resolution } = utiliserCapacite(s, a, a, "Pacte démoniaque", { effetCle: null, coutPV: "1d4" }, fixedRng([0.5]));
    expect(state.participants[0].pv).toBe(37);
    expect(resolution.effetNom).toBeNull();
    expect(state.log.some((l) => l.message.includes("sacrifie 3 PV"))).toBe(true);
  });

  it("soutien : effetMods fusionnés (Aspect +5 DEF)", () => {
    const aspect = {
      id: "as", nom: "Aspect du démon", type: "utilitaire" as const, rang: 4,
      action: "attaque" as const, cout: { ressource: "mana", montant: 4 },
      effetCle: "Aspect du démon", effetDuree: null, effetMods: { defense: 5 },
      attaqueAccordee: { nom: "Griffes du démon", degats: "1d4°+INT" },
    };
    const caster = { ...sorcier(), sorts: [aspect] };
    const s = createCombat([caster, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    const { state } = castSoutien(s, a, a, aspect, fixedRng([0.9]));
    expect(state.participants[0].effets[0].modificateurs).toMatchObject({ defense: 5 });
    expect(state.participants[0].attaques.some((x) => x.nom === "✦ Griffes du démon")).toBe(true);
  });

  it("etatLimite + applyCoutPV unitaires", () => {
    const sort = { id: "e", nom: "Ensevelissement", type: "offensif" as const, limiteCombat: 1 };
    expect(etatLimite(sorcier(), sort).ok).toBe(true);
    const usage = { ...sorcier(), usagesSorts: { e: { n: 1, cibles: [] } } };
    expect(etatLimite(usage, sort).ok).toBe(false);
    const s = createCombat([sorcier(), gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    const r = applyCoutPV(s, a, "1d4", fixedRng([0.5]));
    expect(r.pvPerdus).toBe(3);
    expect(r.state.participants[0].pv).toBe(37);
  });
});
