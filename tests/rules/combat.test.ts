import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { AttackDef } from "@/src/lib/rules/types";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives } from "@/src/lib/rules/combat/initiative";
import { applyDamage, applyCoutPV, castSoutien, checkEnd, construireLoupCompagnon, depenserChanceApresCoup, etatLimite, frapperZone, invoquerCompagnon, renvoyerSort, resolveAttack, sortUtilisable, utiliserCapacite } from "@/src/lib/rules/combat/attack";
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

  it("touche auto (Rituel du sang) : sans jet, sacrifice + effet", () => {
    const sort = { id: "r", nom: "Rituel du sang", type: "offensif" as const, cout: { ressource: "mana", montant: 4 }, coutPV: "1d4" };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:r", nom: "✦ Rituel du sang", bonus: 0, degats: "1d1-1", toucheAuto: true, effetTouche: { cle: "Saignement rituel", duree: null } }],
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

function guerrier(nom = "Guerrier"): CombatParticipant {
  return {
    instanceId: `pj-${nom}-${Math.random()}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 14, initMod: 1, initiative: null,
    attaques: [{ id: "epee", nom: "Épée", bonus: 6, degats: "1d8+3" }],
    effets: [],
    sorts: [],
    capacites: [],
    niveau: 3,
    ressources: {},
    statut: "actif",
    caracs: { AGI: 1, CON: 2, FOR: 3, PER: 1, CHA: 0, INT: 0, VOL: 0 },
    usagesSorts: {},
  };
}

describe("guerrier (voies du livre)", () => {
  it("parer un coup : test opposé bloque, stance consommée ; raté = dégâts", () => {
    const def = {
      ...guerrier(),
      effets: [createEffect("Parade", { modificateurs: { parade: 1 }, dureeTours: 1 })],
    };
    const s = createCombat([pj("A"), def]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19+6 = 25 ≥ 14 touché ; parade 20+(3+3) = 26 ≥ 25 bloqué.
    const r1 = resolveAttack(s, a, t, "epee", fixedRng([0.9, 0.95]));
    expect(r1.state.participants[1].pv).toBe(40);
    expect(r1.state.participants[1].effets).toHaveLength(0);
    expect(r1.state.log.some((l) => l.message.includes("pare l'attaque"))).toBe(true);

    const s2 = createCombat([pj("A"), {
      ...guerrier(),
      effets: [createEffect("Parade", { modificateurs: { parade: 1 }, dureeTours: 1 })],
    }]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    // Touché ; parade 3+6 = 9 < 25 ratée ; 1d8+3 : 8 DM.
    const r2 = resolveAttack(s2, a2, t2, "epee", fixedRng([0.9, 0.1, 0.5]));
    expect(r2.state.participants[1].pv).toBe(32);
    expect(r2.state.participants[1].effets).toHaveLength(1);
    expect(r2.state.log.some((l) => l.message.includes("rate sa parade"))).toBe(true);
  });

  it("absorber + renvoyer : sort stocké puis retourné, zones refusées", () => {
    const baiser = { id: "x", nom: "Baiser du vampire", type: "offensif" as const, cout: { ressource: "mana", montant: 3 } };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:x", nom: "✦ Baiser", bonus: 4, degats: "1d6" }],
      sorts: [baiser],
    };
    const def = {
      ...guerrier(),
      effets: [createEffect("Absorption", { modificateurs: { absorption: 1 }, dureeTours: 1 })],
    };
    const s = createCombat([atk, def]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19+4 = 23 ≥ 14 touché ; absorption 20+6 = 26 ≥ 23.
    const r1 = resolveAttack(s, a, t, "sort:x", fixedRng([0.9, 0.95]));
    expect(r1.state.participants[1].pv).toBe(40);
    expect(r1.state.participants[1].effets).toHaveLength(0);
    expect(r1.state.participants[1].sortAbsorbe?.nom).toBe("Baiser du vampire");
    expect(r1.state.log.some((l) => l.message.includes("absorbe"))).toBe(true);
    // Renvoi : 19+4 = 23 ≥ 12, 1d6 : 4 DM au lanceur d'origine.
    const r2 = renvoyerSort(r1.state, t, a, fixedRng([0.9, 0.5]));
    expect(r2.resolution.touche).toBe(true);
    expect(r2.resolution.degatsTotal).toBe(4);
    expect(r2.state.participants[0].pv).toBe(36);
    expect(r2.state.participants[1].sortAbsorbe).toBeUndefined();
    expect(r2.state.participants[1].attaques).toHaveLength(1);
    // Sans sort absorbé, ni zone : erreurs.
    expect(() => renvoyerSort(r2.state, t, a)).toThrow(/aucun sort absorbé/);
    const zone = { ...r2.state.participants[1], sortAbsorbe: { nom: "Z", bonus: 1, degats: "1d6", zone: true } };
    const sz = { ...r2.state, participants: r2.state.participants.map((p) => (p.instanceId === t ? zone : p)) };
    expect(() => renvoyerSort(sz, t, a)).toThrow(/zone/);
  });

  it("science du critique : seuil 19 avec prédilection (MJ)", () => {
    const atk = {
      ...pj("A"),
      effets: [createEffect("Critique 19-20", { modificateurs: { seuilCrit: 19 } })],
    };
    const s = createCombat([atk, pj("Mur", 30)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19 >= 19 : critique (8×2 = 16).
    const r1 = resolveAttack(s, a, t, "epee", fixedRng([0.9, 0.5]));
    expect(r1.resolution.critique).toBe(true);
    expect(r1.resolution.degatsTotal).toBe(16);
    // 18 < 19 et 24 < 30 : manqué (pas de critique élargi abusif).
    const r2 = resolveAttack(s, a, t, "epee", fixedRng([0.85, 0.5]));
    expect(r2.resolution.touche).toBe(false);
    expect(r2.resolution.critique).toBe(false);
  });

  it("riposte : un raté au contact est signalé (MJ : attaque manuelle)", () => {
    const cible = { ...pj("Tank", 30), capacites: ["Riposte"] };
    const s = createCombat([pj("A"), cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 3+6 = 9 < 30 raté.
    const { state } = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.5]));
    expect(state.log.some((l) => l.message.includes("Riposte (G)"))).toBe(true);
    const s2 = createCombat([pj("A"), pj("Tank", 30)]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    const r2 = resolveAttack(s2, a2, t2, "epee", fixedRng([0.1, 0.5]));
    expect(r2.state.log.some((l) => l.message.includes("Riposte"))).toBe(false);
  });

  it("coups spéciaux : modificateur, +DM, dés bonus, avantage/désavantage", () => {
    const s = createCombat([pj("A"), pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 3 +6 +2 = 11 ≥ 10 touché ; 1d8+3 : 8, +1d6 : 4, +3 => 15.
    const r = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, { modAttaque: 2, bonusDM: 3, degatsBonus: ["1d6"] });
    expect(r.resolution.touche).toBe(true);
    expect(r.resolution.degatsTotal).toBe(15);
    expect(r.state.log.some((l) => l.message.includes("coup spécial"))).toBe(true);
    // Sans le +2, le même jet rate (3+6 = 9 < 10).
    const r2 = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.5]));
    expect(r2.resolution.touche).toBe(false);
    // Avantage / désavantage ponctuels (Parfaite / Puissante).
    const r3 = resolveAttack(s, a, t, "epee", fixedRng([0.1, 0.9, 0.5]), DEFAULT_COMBAT_OPTIONS, { deBonus: true });
    expect(r3.resolution.desAvantage).toBe("bonus");
    expect(r3.resolution.jetNaturel).toBe(19);
    const r4 = resolveAttack(s, a, t, "epee", fixedRng([0.9, 0.1, 0.5]), DEFAULT_COMBAT_OPTIONS, { deMalus: true });
    expect(r4.resolution.desAvantage).toBe("malus");
    expect(r4.resolution.jetNaturel).toBe(3);
  });

  it("usages : Parer/Absorber/Renvoi/Science existent avec modificateurs", () => {
    const parer = CAPACITES_USABLES.find((u) => u.talent === "Parer un coup");
    expect(parer).toMatchObject({ effetCle: "Parade", dureeTours: 1, mods: { parade: 1 } });
    const absorber = CAPACITES_USABLES.find((u) => u.talent === "Absorber un sort");
    expect(absorber).toMatchObject({ effetCle: "Absorption", mods: { absorption: 1 } });
    const renvoi = CAPACITES_USABLES.find((u) => u.talent === "Renvoi de sort");
    expect(renvoi?.actionSpeciale).toBe("renvoi");
    const science = CAPACITES_USABLES.find((u) => u.talent === "Science du critique");
    expect(science).toMatchObject({ effetCle: "Critique 19-20", mods: { seuilCrit: 19 } });
  });

  it("sauvegarde CON 10 (Pied) : ratée = Ralenti 1 round, réussie = dégâts seuls", () => {
    const atk = {
      ...sorcier(),
      attaques: [{ id: "pb", nom: "✦ Pied", bonus: 10, degats: "1d6", effetTouche: { cle: "Ralenti", duree: 1, sauvegarde: { carac: "CON", difficulte: 10 } } }],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touché (19+10), 4 DM, sauvegarde 3 < 10 ratée -> Ralenti 1 round.
    const r1 = resolveAttack(s, a, t, "pb", fixedRng([0.9, 0.5, 0.1]));
    expect(r1.resolution.touche).toBe(true);
    expect(r1.state.participants[1].pv).toBe(36);
    expect(r1.state.participants[1].effets.find((e) => e.nom === "Ralenti")?.toursRestants).toBe(1);
    expect(r1.state.log.some((l) => l.message.includes("test de CON") && l.message.includes("Ralenti"))).toBe(true);
    // Touché, 4 DM, sauvegarde 19 ≥ 10 réussie -> dégâts seuls, pas d'effet.
    const r2 = resolveAttack(s, a, t, "pb", fixedRng([0.9, 0.5, 0.9]));
    expect(r2.resolution.touche).toBe(true);
    expect(r2.state.participants[1].pv).toBe(36);
    expect(r2.state.participants[1].effets).toHaveLength(0);
    expect(r2.state.log.some((l) => l.message.includes("pas de Ralenti"))).toBe(true);
  });

  it("sauvegarde utilise la carac de la cible (CON +3)", () => {
    const atk = {
      ...sorcier(),
      attaques: [{ id: "pb", nom: "✦ Pied", bonus: 10, degats: "1d1-1", effetTouche: { cle: "Ralenti", duree: 1, sauvegarde: { carac: "CON", difficulte: 10 } } }],
    };
    const tank = { ...pj("Tank", 10), caracs: { AGI: 0, CON: 3, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 } };
    const s = createCombat([atk, tank]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touché, sauvegarde 5+3 = 8 < 10 tout juste ratée -> Ralenti.
    const r = resolveAttack(s, a, t, "pb", fixedRng([0.9, 0.1, 0.2]));
    expect(r.state.participants[1].effets.map((e) => e.nom)).toContain("Ralenti");
    expect(r.state.log.some((l) => l.message.includes("(+3)"))).toBe(true);
  });
});

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

describe("rodeur (voies du livre)", () => {
  it("flèche de mort : dé bonus + 1d4° ou état au choix (aveuglé)", () => {
    const atk = { ...rodeur(), capacites: ["Flèche de mort"] };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 3 puis 19 gardé (dé bonus), 19+7 touché ; 1d6 : 4, 1d4° : 3 => 7.
    const r1 = resolveAttack(s, a, t, "arc", fixedRng([0.1, 0.9, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      deBonus: true, degatsBonus: ["1d4°"],
    });
    expect(r1.resolution.desAvantage).toBe("bonus");
    expect(r1.resolution.degatsTotal).toBe(7);
    // Variante état : aveuglé 1 round, sans dégâts bonus.
    const r2 = resolveAttack(s, a, t, "arc", fixedRng([0.9, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      deBonus: true, effetSupp: { cle: "aveugle", duree: 1 },
    });
    const aveugle = r2.state.participants[1].effets.find((e) => e.nom === "Aveuglé");
    expect(aveugle?.toursRestants).toBe(1);
    expect(aveugle?.modificateurs).toMatchObject({ attaque: -3 });
    expect(r2.state.log.some((l) => l.message.includes("Aveuglé"))).toBe(true);
  });

  it("attaque éclair : bonus et DM à l'AGI (pas FOR)", () => {
    const atk = { ...rodeur(), capacites: ["Attaque éclair"] };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // niv 3 + AGI 3 = +6 (au lieu de +7) ; 1d6+3 : 4+3 = 7.
    const r = resolveAttack(s, a, t, "arc", fixedRng([0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      bonusOverride: 6, degatsOverride: "1d6+3",
    });
    expect(r.resolution.jetTotal).toBe(17);
    expect(r.resolution.degatsTotal).toBe(7);
    expect(r.state.log.some((l) => l.message.includes("Dégâts : 1d6+3"))).toBe(true);
  });

  it("double peine : +1d4° à la 2e touche même cible même round, une fois", () => {
    const atk = { ...rodeur(), capacites: ["Double peine"] };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touche 1 : 4 DM, mémoire posée (enchaine false).
    const r1 = resolveAttack(s, a, t, "arc", fixedRng([0.9, 0.5]));
    expect(r1.state.participants[1].pv).toBe(36);
    expect(r1.state.participants[0].dernierCoup).toMatchObject({ enchaine: false });
    // Touche 2 : 4 + 1d4°(3) = 7, mémoire verrouillée.
    const r2 = resolveAttack(r1.state, a, t, "arc", fixedRng([0.9, 0.5, 0.5]));
    expect(r2.resolution.degatsTotal).toBe(7);
    expect(r2.state.participants[1].pv).toBe(29);
    expect(r2.state.log.some((l) => l.message.includes("Double peine"))).toBe(true);
    expect(r2.state.participants[0].dernierCoup).toMatchObject({ enchaine: true });
    // Touche 3 : 4 DM seuls (une fois par round).
    const r3 = resolveAttack(r2.state, a, t, "arc", fixedRng([0.9, 0.5]));
    expect(r3.resolution.degatsTotal).toBe(4);
    expect(r3.state.participants[1].pv).toBe(25);
  });

  it("attaque à suivre signalée au raté (sauf Droite-gauche ou sort)", () => {
    const atk = { ...rodeur(), capacites: ["Attaque à suivre"] };
    const s = createCombat([atk, pj("Mur", 30)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 3+7 = 10 < 30 raté.
    const r1 = resolveAttack(s, a, t, "arc", fixedRng([0.1, 0.5]));
    expect(r1.state.log.some((l) => l.message.includes("Attaque à suivre (G)"))).toBe(true);
    // Droite-gauche remplace : plus de signal.
    const sub = { ...rodeur(), capacites: ["Attaque à suivre", "Droite-gauche"] };
    const s2 = createCombat([sub, pj("Mur", 30)]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    const r2 = resolveAttack(s2, a2, t2, "arc", fixedRng([0.1, 0.5]));
    expect(r2.state.log.some((l) => l.message.includes("Attaque à suivre"))).toBe(false);
    // Sort raté : pas de signal (main principale = arme).
    const mage = {
      ...rodeur(), capacites: ["Attaque à suivre"],
      attaques: [{ id: "sort:s", nom: "✦ S", bonus: 0, degats: "1d1-1" }],
      sorts: [{ id: "s", nom: "S", type: "offensif" as const }],
    };
    const s3 = createCombat([mage, pj("Mur", 30)]);
    const [a3, t3] = s3.participants.map((p) => p.instanceId);
    const r3 = resolveAttack(s3, a3, t3, "sort:s", fixedRng([0.1, 0.1]));
    expect(r3.state.log.some((l) => l.message.includes("Attaque à suivre"))).toBe(false);
  });

  it("riposte : pas de signal sur sort raté (contact uniquement)", () => {
    const cible = { ...pj("Tank", 30), capacites: ["Riposte"] };
    const mage = {
      ...rodeur(),
      attaques: [{ id: "sort:s", nom: "✦ S", bonus: 0, degats: "1d1-1" }],
      sorts: [{ id: "s", nom: "S", type: "offensif" as const }],
    };
    const s = createCombat([mage, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const r = resolveAttack(s, a, t, "sort:s", fixedRng([0.1, 0.1]));
    expect(r.resolution.touche).toBe(false);
    expect(r.state.log.some((l) => l.message.includes("Riposte"))).toBe(false);
  });

  it("compagnon : loup (DEF 13, PV niv×4), alpha auto, sans talent = erreur", () => {
    const s = createCombat([rodeur(), gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    expect(() => invoquerCompagnon(s, a)).toThrow(/pas de compagnon/);
    const avec = { ...rodeur(), capacites: ["Le loup"] };
    const s2 = createCombat([{ ...avec, niveau: 3, bonusMagique: 6 }, gobelin("G")]);
    const [a2] = s2.participants.map((p) => p.instanceId);
    const r = invoquerCompagnon(s2, a2);
    expect(r.resolution.invoqueNom).toBe("Loup (Rodeur)");
    const loup = r.state.participants[2];
    expect(loup.camp).toBe("pj");
    expect(loup.pv).toBe(12);
    expect(loup.defense).toBe(13); // 12 + rang 1
    expect(loup.attaques[0]).toMatchObject({ bonus: 6, degats: "1d4+2" });
    // Alpha DRS : DEF 12+rang (12+4=16), PV niv×4 (4×4=16), 1d4°+5.
    const alpha = { ...rodeur(), capacites: ["Le loup", "Loup alpha"], niveau: 4, bonusMagique: 7 };
    const s3 = createCombat([alpha, gobelin("G")]);
    const [a3] = s3.participants.map((p) => p.instanceId);
    const ra = invoquerCompagnon(s3, a3);
    expect(ra.resolution.invoqueNom).toBe("Loup alpha (Rodeur)");
    expect(ra.state.participants[2].pv).toBe(16);
    expect(ra.state.participants[2].defense).toBe(16);
    expect(ra.state.participants[2].attaques[0].degats).toBe("1d4°+5");
    // Tactiques + Flèche (R5) : +1 archer +1 compagnon (celle-ci incluse) = +2.
    const tact = { ...rodeur(), capacites: ["Le loup", "Tactiques de meute", "Flèche de mort"] };
    const s4 = createCombat([tact, gobelin("G")]);
    const [a4] = s4.participants.map((p) => p.instanceId);
    expect(invoquerCompagnon(s4, a4).state.participants[2].defense).toBe(19); // 12 + rang 5 + 2
  });
  it("archer émérite : +PER auto aux DM à l’arc, sans activation", () => {
    const atk = { ...rodeur(), capacites: ["Archer émérite"], attaques: [{ id: "arc", nom: "Arc court", bonus: 7, degats: "1d6", familles: ["arcs"] } as AttackDef] };
    // rodeur() : PER 2. Touché : 15+7 = 22 vs déf 10 ; 1d6 : 4 + PER 2 = 6.
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, b] = s.participants.map((x) => x.instanceId);
    const r = resolveAttack(s, a, b, "arc", fixedRng([0.7, 0.5]));
    expect(r.resolution.touche).toBe(true);
    expect(r.resolution.degatsTotal).toBe(6);
    expect(r.state.log.some((l) => l.message.includes("Archer émérite"))).toBe(true);
    // Dague (perforant, pas un arc) : pas de bonus.
    const dag = { ...rodeur(), capacites: ["Archer émérite"], attaques: [{ id: "dague", nom: "Dague", bonus: 7, degats: "1d6", familles: ["dagues"] } as AttackDef] };
    const s2 = createCombat([dag, pj("Tank", 10)]);
    const [a2, b2] = s2.participants.map((x) => x.instanceId);
    expect(resolveAttack(s2, a2, b2, "dague", fixedRng([0.7, 0.5])).resolution.degatsTotal).toBe(4);
    // Sans le talent : pas de bonus même à l’arc.
    const s3 = createCombat([{ ...rodeur(), attaques: [{ id: "arc", nom: "Arc court", bonus: 7, degats: "1d6", familles: ["arcs"] } as AttackDef] }, pj("Tank", 10)]);
    const [a3, b3] = s3.participants.map((x) => x.instanceId);
    expect(resolveAttack(s3, a3, b3, "arc", fixedRng([0.7, 0.5])).resolution.degatsTotal).toBe(4);
  });

  it("increvable : soin 4d4°+CON, +5 DEF, purge, réveille un KO", () => {
    const lanceur = { ...rodeur(), capacites: ["Increvable"] };
    const cible = {
      ...rodeur("Cible"), pv: 0, statut: "ko" as const,
      effets: [
        createEffect("saignement", { dureeTours: 3 }),
        createEffect("protection", { dureeTours: null }),
      ],
    };
    const s = createCombat([lanceur, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 4d4° : 3+3+3+3 = 12 + CON 1 = 13 PV.
    const { state, resolution } = utiliserCapacite(s, a, t, "Increvable", {
      effetCle: "Increvable", dureeTours: 1, mods: { defense: 5 }, soin: "4d4°+CON", nettoie: true,
    }, fixedRng([0.5, 0.5, 0.5, 0.5]));
    expect(resolution.soinTotal).toBe(13);
    const apres = state.participants[1];
    expect(apres.pv).toBe(13);
    expect(apres.statut).toBe("actif");
    expect(apres.effets.map((e) => e.nom).sort()).toEqual(["Increvable", "Protection"]);
    expect(apres.effets.find((e) => e.nom === "Increvable")?.modificateurs).toMatchObject({ defense: 5 });
    expect(state.log.some((l) => l.message.includes("purgés"))).toBe(true);
  });

  it("loup : compagnon permanent, plus une capacite lancable en combat", () => {
    expect(CAPACITES_USABLES.some((u) => u.talent === "Le loup")).toBe(false);
    const avec = { ...rodeur(), capacites: ["Le loup"], niveau: 3, bonusMagique: 6 };
    const loup = construireLoupCompagnon(avec, {
      instanceId: "compagnon-test",
      templateId: "compagnon:loup:test",
      initMod: avec.initMod,
      initiative: null,
    });
    expect(loup.nom).toBe("Loup (Rodeur)");
    expect(loup.camp).toBe("pj");
    expect(loup.pv).toBe(12);
    expect(loup.defense).toBe(13); // 12 + rang 1
    expect(loup.initiative).toBeNull();
    expect(loup.attaques[0]).toMatchObject({ bonus: 6, degats: "1d4+2" });
    expect(() => construireLoupCompagnon(rodeur(), { instanceId: "x" })).toThrow(/pas de compagnon/);
    const inc = CAPACITES_USABLES.find((u) => u.talent === "Increvable");
    expect(inc).toMatchObject({ effetCle: "Increvable", dureeTours: 1, mods: { defense: 5 }, soin: "4d4°+CON", nettoie: true });
  });
});
