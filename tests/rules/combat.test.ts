import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { AttackDef } from "@/src/lib/rules/types";
import type { ArmeFamille } from "@/src/lib/rules/world/types";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives } from "@/src/lib/rules/combat/initiative";
import { applyDamage, applyCoutPV, appliquerResultatsCombat, castSoutien, checkEnd, construireLoupCompagnon, coutEffectifSort, depenserChanceApresCoup, estAttaqueContact, etatLimite, bonusOppositionContact, frapperCibles, frapperZone, invoquer, invoquerCompagnon, payerCoutSort, protegerAllie, renvoyerSort, reporterRessource, resolveAttack, resynchroniserDepuisFiche, sortUtilisable, tailleAcceptee, tenterSortieEnseveli, utiliserCapacite } from "@/src/lib/rules/combat/attack";
import { monsterInstances, nomBaseInstance, participantFromCharacter, renommerDoublonsMonstres } from "@/src/lib/rules/combat/factory";
import { fixedRng, parseDiceExpression, substituerDesEvolutifs, substituerStats } from "@/src/lib/rules/dice/roller";
import { SEED_MONSTERS, SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { CAPACITES } from "@/src/lib/data/capacites";
import { CAPACITES_USABLES, talentsLancables } from "@/src/lib/data/capacites-usables";
import { createEffect, pvParTourTotal } from "@/src/lib/rules/effects/effects";
import { maxZombiesControles, normaliserNomCapacite } from "@/src/lib/rules/personnage";

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

  it("doublons inter-lots renumérotés : 2 rats puis 1 rat -> #1..#3", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom.toLowerCase().includes("rat")) ?? SEED_MONSTERS[0];
    const lot1 = monsterInstances(tpl, 2);
    const lot2 = monsterInstances(tpl, 1);
    // Sans renommage : deux "#1" + un homonyme nu.
    expect([lot1[0].nom, lot1[1].nom, lot2[0].nom]).toEqual([`${tpl.nom} #1`, `${tpl.nom} #2`, tpl.nom]);
    const groupe = renommerDoublonsMonstres([...lot1, ...lot2]);
    expect(groupe.map((g) => g.nom)).toEqual([1, 2, 3].map((i) => `${tpl.nom} #${i}`));
  });

  it("renommage : 1 seul garde le nom nu, les PJ sont intacts", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom.toLowerCase().includes("rat")) ?? SEED_MONSTERS[0];
    const [seul] = monsterInstances(tpl, 1);
    expect(renommerDoublonsMonstres([pj("Aria"), seul]).map((p) => p.nom)).toEqual(["Aria", tpl.nom]);
    expect(nomBaseInstance(`${tpl.nom} #2`)).toBe(tpl.nom);
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

  it("dé évolutif en attaque : 1d4° -> d6 au niv. 7, sans relance", () => {
    const lanceur = { ...pj("Mage"), niveau: 7, attaques: [{ id: "sort", nom: "✦ Pied dans la tombe", bonus: 5, degats: "1d4°+2" }] };
    const s = createCombat([lanceur, gobelin("Gob")]);
    // Jet 15+5=20 vs déf 15 : touché ; 1d6 (niv. 7) : 4 -> 4+2 = 6.
    const { state, resolution } = resolveAttack(
      s, s.participants[0].instanceId, s.participants[1].instanceId, "sort",
      fixedRng([0.72, 0.5])
    );
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsDetails).toEqual([4]);
    expect(resolution.degatsTotal).toBe(6);
    expect(resolution.pvApres).toBe(2);
    expect(resolution.cibleTombe).toBe(false);
    expect(state.log.some((l) => l.message.includes("1d6+2"))).toBe(true);
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

  it("usages par défaut : Protéger un allié -> action spéciale (mod. bouclier)", () => {
    const entree = CAPACITES_USABLES.find((u) => u.talent === "Protéger un allié");
    expect(entree).toMatchObject({ effetCle: "protection", dureeTours: 1, cibles: "allies", actionSpeciale: "proteger" });
  });

  it("protegerAllie : mod. DEF du bouclier contre la prochaine attaque, consommée (1/round)", () => {
    const dorainSeed = SEED_CHARACTERS.find((x) => x.id === "pj-guerrier-nain")!;
    const dorain = { ...participantFromCharacter(dorainSeed, []), bouclierBonus: 2 };
    const s = createCombat([dorain, pj("Allié"), gobelin("G")]);
    const [lanceur, allie, monstre] = s.participants.map((p) => p.instanceId);
    // Sans bouclier manié : refusé.
    const nu = createCombat([{ ...dorain, bouclierBonus: null }, pj("Allié2"), gobelin("G2")]);
    const [nuL, nuA] = nu.participants.map((p) => p.instanceId);
    expect(() => protegerAllie(nu, nuL, nuA)).toThrow(/bouclier requis/);
    // Protection +2 (bouclier), pas +2 fixe : effet ciblé 1 round.
    const p1 = protegerAllie(s, lanceur, allie);
    const garde = p1.state.participants[1];
    expect(garde.effets).toHaveLength(1);
    expect(garde.effets[0].nom).toBe("Protection");
    expect(garde.effets[0].toursRestants).toBe(1);
    expect(garde.effets[0].source).toBe(dorain.nom);
    expect(garde.effets[0].modificateurs).toMatchObject({ defense: 2, protection: 1 });
    expect(p1.resolution.talentNom).toBe("Protéger un allié");
    expect(p1.state.log.some((l) => l.message.includes("protège"))).toBe(true);
    // Déjà protégé : refusé (1/round).
    expect(() => protegerAllie(p1.state, lanceur, allie)).toThrow(/déjà protégé/);
    // 1re attaque (14+4 = 18 < 18+2) : manquée, protection consommée.
    const r1 = resolveAttack(p1.state, monstre, allie, "dague", fixedRng([0.66]));
    expect(r1.resolution.touche).toBe(false);
    expect(r1.state.participants[1].effets).toHaveLength(0);
    expect(r1.state.log.some((l) => l.message.includes("protection consommée"))).toBe(true);
    // 2e attaque : sans bonus (14+4 = 18 vs 18 -> touché ; 1d6+2 : 4+2 = 6).
    const r2 = resolveAttack(r1.state, monstre, allie, "dague", fixedRng([0.66, 0.5]));
    expect(r2.resolution.touche).toBe(true);
    expect(r2.resolution.degatsTotal).toBe(6);
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

  it("lancement : incantation, brûlure (1 DR/PM) et concentration (A→L, −2 PM)", () => {
    const foudre = { id: "f", nom: "Foudre", type: "offensif" as const, action: "attaque" as const, cout: { ressource: "mana", montant: 4 } };
    // Coût effectif : classique inchangé, concentré −2 PM, sorts L/M exclus.
    expect(coutEffectifSort(foudre, {})).toEqual({ pm: 4, base: 4, concentre: false });
    expect(coutEffectifSort(foudre, { concentration: true })).toEqual({ pm: 2, base: 4, concentre: true });
    expect(coutEffectifSort({ ...foudre, cout: { ressource: "mana", montant: 1 } }, { concentration: true }).pm).toBe(0);
    expect(() => coutEffectifSort({ ...foudre, action: "limitee" as const }, { concentration: true })).toThrow(/attaque/);
    expect(() => coutEffectifSort({ ...foudre, action: "mouvement" as const }, { concentration: true })).toThrow(/attaque/);

    const mage: CombatParticipant = { ...sorcier("Mage"), deRecuperation: "d6", pv: 20, pvMax: 20, ressources: { mana: { max: 6, actuel: 0 } } };
    const s = createCombat([mage, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    // Brûlure : 4 PM au d6, rng 0.5 -> 4 par dé = 16 PV (20 -> 4), mana intact.
    const { state: s2, paiement } = payerCoutSort(s, a, foudre, { mode: "brulure" }, fixedRng([0.5]));
    expect(paiement).toMatchObject({ mode: "brulure", pm: 4, pvBrules: 16, concentre: false });
    expect(paiement.detailsBrulure).toEqual([4, 4, 4, 4]);
    expect(s2.participants[0].pv).toBe(4);
    expect(s2.participants[0].ressources.mana.actuel).toBe(0);
    expect(s2.log.some((l) => l.message.includes("brûle sa mana"))).toBe(true);

    // Interdits : mana restant, sorts de soins, pas de DR.
    const plein: CombatParticipant = { ...sorcier("Plein"), deRecuperation: "d6" };
    const sp = createCombat([plein, gobelin("G")]);
    expect(() => payerCoutSort(sp, plein.instanceId, foudre, { mode: "brulure" })).toThrow(/0 mana/);
    expect(() => payerCoutSort(s, a, { ...foudre, soin: "1d4" }, { mode: "brulure" })).toThrow(/soins/);
    const sansDR = { ...pj("Guerrier"), ressources: { mana: { max: 0, actuel: 0 } } };
    const ss = createCombat([sansDR, gobelin("G")]);
    expect(() => payerCoutSort(ss, sansDR.instanceId, foudre, { mode: "brulure" })).toThrow(/récupération/);

    // Brûlure concentrée : 3 PM (A) -> 1 PM = 1 DR ; KO possible et termine.
    const sort3 = { ...foudre, cout: { ressource: "mana", montant: 3 } };
    const mourant: CombatParticipant = { ...sorcier("Mourant"), deRecuperation: "d6", pv: 3, pvMax: 20, ressources: { mana: { max: 6, actuel: 0 } } };
    const sm = createCombat([mourant, gobelin("G")]);
    const { state: s3, paiement: p3 } = payerCoutSort(sm, mourant.instanceId, sort3, { mode: "brulure", concentration: true }, fixedRng([0.5]));
    expect(p3).toMatchObject({ mode: "brulure", pm: 1, pvBrules: 4, concentre: true });
    expect(s3.participants[0].pv).toBe(0);
    expect(s3.participants[0].statut).toBe("ko");
    expect(s3.termine).toBe(true);
    expect(s3.gagnant).toBe("monstre");
    expect(s3.log.some((l) => l.message.includes("se concentre"))).toBe(true);
  });

  it("resolveAttack en brûlure : sort lancé à 0 mana, PV sacrifiés", () => {
    const foudre = { id: "f", nom: "Foudre", type: "offensif" as const, action: "attaque" as const, degats: "1d6", cout: { ressource: "mana", montant: 2 } };
    const atk: CombatParticipant = {
      ...sorcier("Mage"),
      deRecuperation: "d6",
      pv: 20, pvMax: 20,
      ressources: { mana: { max: 6, actuel: 0 } },
      attaques: [{ id: "sort:f", nom: "✦ Foudre", bonus: 10, degats: "1d6" }],
      sorts: [foudre],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Brûlure 2d6 : 4+4 = 8 PV (20 -> 12), puis jet 19+10 touché, 1d6 : 4 DM.
    const { state } = resolveAttack(s, a, t, "sort:f", fixedRng([0.5, 0.5, 0.9, 0.5]), DEFAULT_COMBAT_OPTIONS, {}, { mode: "brulure" });
    expect(state.participants[0].pv).toBe(12);
    expect(state.participants[0].ressources.mana.actuel).toBe(0);
    expect(state.participants[1].pv).toBe(36);
    expect(state.log.some((l) => l.message.includes("brûle sa mana"))).toBe(true);
  });

  it("resolveAttack concentrée : sort (A) à −2 PM en mana classique", () => {
    const foudre = { id: "f", nom: "Foudre", type: "offensif" as const, action: "attaque" as const, degats: "1d6", cout: { ressource: "mana", montant: 4 } };
    const atk: CombatParticipant = {
      ...sorcier("Mage"),
      attaques: [{ id: "sort:f", nom: "✦ Foudre", bonus: 10, degats: "1d6" }],
      sorts: [foudre],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 4 PM -> 2 PM (mana 10 -> 8), jet 19+10 touché, 1d6 : 4 DM.
    const { state } = resolveAttack(s, a, t, "sort:f", fixedRng([0.9, 0.5]), DEFAULT_COMBAT_OPTIONS, {}, { concentration: true });
    expect(state.participants[0].ressources.mana.actuel).toBe(8);
    expect(state.participants[1].pv).toBe(36);
    expect(state.log.some((l) => l.message.includes("se concentre"))).toBe(true);
  });

  it("factory : le participant porte le DR de la fiche (brûlure)", () => {
    const mirabel = SEED_CHARACTERS.find((x) => x.id === "pj-sorcier-humain")!;
    expect(participantFromCharacter(mirabel, []).deRecuperation).toBe("d6");
  });

  it("sacrifice PV évolutif (1d4° -> d6 au niv. 7)", () => {
    const sort = { id: "sv", nom: "S", type: "offensif" as const, cout: { ressource: "mana", montant: 2 }, coutPV: "1d4°" };
    const atk = {
      ...sorcier(),
      niveau: 7,
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

  it("dégâts par tour évolutifs (1d4° -> d6 au niv. 7)", () => {
    const atk = {
      ...sorcier(),
      niveau: 7,
      attaques: [{ id: "sa", nom: "Saignements", bonus: 10, degats: "1d1-1", effetTouche: { cle: "Saignement", duree: null, degatsParTour: "1d4°" } }],
    };
    const s = createCombat([atk, pj("Tank", 10)]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touché (19+10), 0 DM direct, DoT 1d6 : 4.
    const { state } = resolveAttack(s, a, t, "sa", fixedRng([0.9, 0.1, 0.5]));
    const effet = state.participants[1].effets.find((e) => e.nom === "Saignement");
    expect(effet).toBeTruthy();
    expect(effet!.modificateurs).toMatchObject({ pvParTour: -4 });
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
    expect(accordee!.degats).toBe("1d4+2"); // niv. 5 -> d4
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

  it("zone évolutive (2d4° -> 2d6 au niv. 7)", () => {
    const armee = {
      id: "am", nom: "Armée des morts", type: "utilitaire" as const, rang: 5,
      action: "limitee" as const, degats: "2d4°",
      effetCle: "Armée des morts", effetDuree: null, effetDegats: "2d4°",
      limiteCombat: 1, zone: true, cout: { ressource: "mana", montant: 5 },
    };
    const caster = { ...sorcier(), niveau: 7, sorts: [armee] };
    const s = createCombat([caster, gobelin("A", 20), gobelin("B", 20)]);
    const [a] = s.participants.map((p) => p.instanceId);
    // 2d6 : 4+4 = 8 immédiats, DoT 2d6 : -8/round.
    const { state } = frapperZone(s, a, armee, fixedRng([0.5, 0.5, 0.5, 0.5]));
    expect(state.participants[1].pv).toBe(12);
    expect(state.participants[2].pv).toBe(12);
    expect(state.participants[2].effets[0].modificateurs).toMatchObject({ pvParTour: -8 });
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

  it("appliquerResultatsCombat : PV + mana/chance vers les fiches, monstres ignorés", () => {
    const sylva = SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut") ?? SEED_CHARACTERS[0];
    const blesse: CombatParticipant = {
      ...pj("Sylva"),
      templateId: sylva.id,
      camp: "pj",
      pv: sylva.pvMax - 3,
      ressources: { mana: { max: 6, actuel: 4 }, chance: { max: 3, actuel: 2 } },
    };
    const intact: CombatParticipant = { ...pj("Intact"), templateId: "inexistant", camp: "pj", pv: 1, ressources: {} };
    const monstre: CombatParticipant = { ...gobelin("Gob"), pv: 0 };
    const fiches = [
      { ...sylva, pv: sylva.pvMax, ressources: { ...sylva.ressources, mana: { max: 6, actuel: 6 } } },
    ];
    const resultat = appliquerResultatsCombat(fiches, [blesse, intact, monstre]);
    // Sylva : PV -3 persistés, mana/chance dépensés persistés.
    expect(resultat[0].pv).toBe(sylva.pvMax - 3);
    expect(resultat[0].ressources.mana).toEqual({ max: 6, actuel: 4 });
    // Plafond fiche respecté (participant au-delà du max).
    const gonfle = appliquerResultatsCombat(
      fiches,
      [{ ...blesse, pv: 99, ressources: { mana: { max: 6, actuel: 99 } } }]
    );
    expect(gonfle[0].pv).toBe(sylva.pvMax);
    expect(gonfle[0].ressources.mana).toEqual({ max: 6, actuel: 6 });
  });

  it("resynchroniserDepuisFiche : structure suit la fiche, volatile intact, idempotent", () => {
    const cible: CombatParticipant = {
      ...pj("Elyndra"),
      niveau: 1,
      pv: 5,
      pvMax: 20,
      ressources: { mana: { max: 1, actuel: 0 } },
      effets: [createEffect("protection")],
      sorts: [],
      capacites: [],
      attaques: [{ id: "epee", nom: "Épée", bonus: 6, degats: "1d8+3" }],
      usagesSorts: { vieux: { n: 1, cibles: [] } },
    };
    const frais: CombatParticipant = {
      ...pj("Elyndra"),
      niveau: 2,
      bonusMagique: 5,
      ressources: { mana: { max: 6, actuel: 6 }, chance: { max: 3, actuel: 3 } },
      sorts: [{ id: "s", nom: "Soins", type: "defensif" }],
      capacites: ["Talent"],
      attaques: [{ id: "epee", nom: "Épée", bonus: 7, degats: "1d8+3" }],
    };
    const r = resynchroniserDepuisFiche(cible, frais);
    expect(r.modifie).toBe(true);
    expect(r.nouvelles).toEqual([]);
    expect(r.manaInfo).toBe(", mana 1 → 6");
    // Structure : suivie.
    expect(r.participant.niveau).toBe(2);
    expect(r.participant.bonusMagique).toBe(5);
    expect(r.participant.sorts.map((s) => s.nom)).toContain("Soins");
    expect(r.participant.attaques[0].bonus).toBe(7);
    expect(r.participant.ressources.mana).toEqual({ max: 6, actuel: 5 }); // 1 dépensé conservé
    expect(r.participant.ressources.chance).toEqual({ max: 3, actuel: 3 });
    // Volatile : intact.
    expect(r.participant.pv).toBe(5);
    expect(r.participant.pvMax).toBe(20);
    expect(r.participant.effets.map((e) => e.nom)).toContain("Protection");
    expect(r.participant.usagesSorts).toEqual({ vieux: { n: 1, cibles: [] } });
    // Idempotent : deuxième passage sans modification.
    const r2 = resynchroniserDepuisFiche(r.participant, frais);
    expect(r2.modifie).toBe(false);
    expect(r2.manaInfo).toBe("");
  });

  it("reporterRessource : max suivi depuis la fiche, dépensé conservé", () => {
    // Elyndra : 1/1 intact en combat + fiche à 6 → 6/6.
    expect(reporterRessource({ max: 1, actuel: 1 }, { max: 6, actuel: 6 })).toEqual({ max: 6, actuel: 6 });
    // 1 dépensé (0/1) + fiche à 6 → 5/6.
    expect(reporterRessource({ max: 1, actuel: 0 }, { max: 6, actuel: 6 })).toEqual({ max: 6, actuel: 5 });
    // Sans ancienne valeur : fiche telle quelle ; sans fiche : inchangé.
    expect(reporterRessource(undefined, { max: 6, actuel: 6 })).toEqual({ max: 6, actuel: 6 });
    expect(reporterRessource({ max: 3, actuel: 2 }, undefined)).toEqual({ max: 3, actuel: 2 });
    // Max réduit : dépensé conservé, plancher 0.
    expect(reporterRessource({ max: 6, actuel: 4 }, { max: 4, actuel: 4 })).toEqual({ max: 4, actuel: 2 });
    expect(reporterRessource({ max: 6, actuel: 0 }, { max: 2, actuel: 2 })).toEqual({ max: 2, actuel: 0 });
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

  it("etatLimite + applyCoutPV unitaires", () => {    const sort = { id: "e", nom: "Ensevelissement", type: "offensif" as const, limiteCombat: 1 };
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

  it("bouclier requis : Parer/Absorber/Protéger/Renvoi refusés sans bouclier", () => {
    const nu = { ...guerrier(), bouclierBonus: null, capacites: ["Parer un coup", "Absorber un sort", "Protéger un allié"] };
    const s = createCombat([nu, pj("Allié")]);
    const [l, c] = s.participants.map((p) => p.instanceId);
    expect(() => utiliserCapacite(s, l, l, "Parer un coup", { effetCle: "Parade", dureeTours: 1, mods: { parade: 1 } })).toThrow(/bouclier requis/);
    expect(() => utiliserCapacite(s, l, l, "Absorber un sort", { effetCle: "Absorption", dureeTours: 1, mods: { absorption: 1 } })).toThrow(/bouclier requis/);
    expect(() => protegerAllie(s, l, c)).toThrow(/bouclier requis/);
    // Avec bouclier : Parer passe.
    const ok = createCombat([{ ...nu, bouclierBonus: 1 }, pj("Allié2")]);
    const [l2, c2] = ok.participants.map((p) => p.instanceId);
    const r = utiliserCapacite(ok, l2, l2, "Parer un coup", { effetCle: "Parade", dureeTours: 1, mods: { parade: 1 } });
    expect(r.state.participants[0].effets).toHaveLength(1);
    expect(r.resolution.effetNom).toBe("Parade");
    expect(() => utiliserCapacite(ok, l2, l2, "Absorber un sort", { effetCle: "Absorption", dureeTours: 1, mods: { absorption: 1 } })).toThrow(/parade préparée/);
  });

  it("bonusOppositionContact : niv + FOR/AGI + arme + mods (distance incluse)", () => {
    // guerrier() : épée +6 (bonus complet), niv 3, FOR 3.
    expect(bonusOppositionContact(guerrier())).toMatchObject({ bonus: 6, avantage: null });
    // Arme d'inventaire (bonus partiel) : 3 + 3 + 1.
    const fantassin = { ...guerrier(), attaques: [{ id: "item:epee", nom: "🗡 Épée", bonus: 1, degats: "1d8" }] };
    expect(bonusOppositionContact(fantassin)).toMatchObject({ bonus: 7, avantage: null });
    // Malus d'effet inclus (aveuglé −5 attaque).
    const aveugle = { ...fantassin, effets: [createEffect("aveugle")] };
    expect(bonusOppositionContact(aveugle)).toMatchObject({ bonus: 2, avantage: null });
    // Dé malus (affaibli) : reporté sur le test opposé.
    const affaibli = { ...fantassin, effets: [createEffect("affaibli")] };
    expect(bonusOppositionContact(affaibli)).toMatchObject({ bonus: 7, avantage: "malus" });
  });

  it("absorber + renvoyer : parade requise, sort stocké puis retourné (zones rejouées)", () => {
    const baiser = { id: "x", nom: "Baiser du vampire", type: "offensif" as const, cout: { ressource: "mana", montant: 3 } };
    const atk = {
      ...sorcier(),
      attaques: [{ id: "sort:x", nom: "✦ Baiser", bonus: 4, degats: "1d6" }],
      sorts: [baiser],
    };
    const def = {
      ...guerrier(),
      bouclierBonus: 2,
      effets: [
        createEffect("Parade", { modificateurs: { parade: 1 }, dureeTours: 1 }),
        createEffect("Absorption", { modificateurs: { absorption: 1 }, dureeTours: 1 }),
      ],
    };
    // Absorption sans parade préparée : le sort passe (19+4 = 23 ≥ 14 ; 1d6 : 6 DM).
    const seul = createCombat([atk, { ...guerrier(), effets: [createEffect("Absorption", { modificateurs: { absorption: 1 }, dureeTours: 1 })] }]);
    const [sa, st] = seul.participants.map((p) => p.instanceId);
    const r0 = resolveAttack(seul, sa, st, "sort:x", fixedRng([0.9, 0.95]));
    expect(r0.resolution.touche).toBe(true);
    expect(r0.state.participants[1].pv).toBe(34);
    expect(r0.state.participants[1].sortAbsorbe).toBeUndefined();
    const s = createCombat([atk, def]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19+4 = 23 ≥ 14 touché ; absorption (parade requise) 20+6 = 26 ≥ 23.
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
    // Sans sort absorbé : erreur.
    expect(() => renvoyerSort(r2.state, t, a)).toThrow(/aucun sort absorbé/);
    // Zone : désormais renvoyée en mono-cible contre le lanceur (19+1 = 20 ≥ 12 ; 1d6 : 4).
    const zone = { ...r2.state.participants[1], sortAbsorbe: { nom: "Z", bonus: 1, degats: "1d6", zone: true } };
    const sz = { ...r2.state, participants: r2.state.participants.map((p) => (p.instanceId === t ? zone : p)) };
    const rz = renvoyerSort(sz, t, a, fixedRng([0.9, 0.5]));
    expect(rz.resolution.touche).toBe(true);
    expect(rz.resolution.degatsTotal).toBe(4);
    // Renvoi sans bouclier : refusé.
    const sn = { ...r1.state, participants: r1.state.participants.map((p) => (p.instanceId === t ? { ...p, bouclierBonus: null } : p)) };
    expect(() => renvoyerSort(sn, t, a)).toThrow(/bouclier requis/);
  });

  it("zone : Défense au bouclier −rang (sauf surpris), absorption du guerrier seul", () => {
    const boom = { id: "z", nom: "Explosion", type: "offensif" as const, zone: true, degats: "2d6", cout: { ressource: "mana", montant: 3 } };
    const lanceur = { ...sorcier(), sorts: [boom], attaques: [] };
    const garde = {
      ...guerrier(),
      bouclierBonus: 2,
      capacites: ["Défense au bouclier", "Parer un coup", "Absorber un sort"],
      effets: [
        createEffect("Parade", { modificateurs: { parade: 1 }, dureeTours: 1 }),
        createEffect("Absorption", { modificateurs: { absorption: 1 }, dureeTours: 1 }),
      ],
    };
    const s = createCombat([lanceur, garde, gobelin("G")]);
    const ids = s.participants.map((p) => p.instanceId);
    // 2d6 : 4+4 = 8 ; garde : −3 (rang 3) puis absorption 19+6 = 26 ≥ 3+8 = 11.
    const r = frapperZone(s, ids[0], boom, fixedRng([0.5, 0.5, 0.1, 0.9]), {}, [ids[1], ids[2]]);
    const apres = r.state.participants;
    expect(apres[1].pv).toBe(40);
    expect(apres[1].effets).toHaveLength(0);
    expect(apres[1].sortAbsorbe?.nom).toBe("Explosion");
    expect(apres[2].pv).toBe(0);
    expect(r.state.log.some((l) => l.message.includes("Défense au bouclier"))).toBe(true);
    expect(r.state.log.some((l) => l.message.includes("absorbe Explosion"))).toBe(true);
    // Surpris : ni réduction ni parade — 8 DM.
    const garde2 = {
      ...guerrier(),
      bouclierBonus: 2,
      capacites: ["Défense au bouclier"],
      effets: [createEffect("surpris")],
    };
    const s2 = createCombat([lanceur, garde2, gobelin("G2")]);
    const ids2 = s2.participants.map((p) => p.instanceId);
    const r2 = frapperZone(s2, ids2[0], boom, fixedRng([0.5, 0.5]), {}, [ids2[1], ids2[2]]);
    expect(r2.state.participants[1].pv).toBe(32);
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
    expect(aveugle?.modificateurs).toMatchObject({ attaque: -5, defense: -5, attaqueDistance: -5 });
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
    expect(ra.state.participants[2].attaques[0].degats).toBe("1d4+5"); // niv. 4 -> d4
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

  it("increvable au niv. 7 : 4d6+CON (dé évolutif)", () => {
    const lanceur = { ...rodeur(), niveau: 7, capacites: ["Increvable"] };
    const cible = { ...rodeur("Cible"), pv: 10 };
    const s = createCombat([lanceur, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 4d6 : 4+4+4+4 = 16 + CON 1 = 17 PV (10 -> 27).
    const { state, resolution } = utiliserCapacite(s, a, t, "Increvable", {
      effetCle: "Increvable", dureeTours: 1, mods: { defense: 5 }, soin: "4d4°+CON", nettoie: true,
    }, fixedRng([0.5, 0.5, 0.5, 0.5]));
    expect(resolution.soinTotal).toBe(17);
    expect(state.participants[1].pv).toBe(27);
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

function pretreDestruction(): CombatParticipant {
  const destruction = {
    id: "sort-destruction-mal", nom: "Destruction du mal", type: "offensif" as const,
    degats: "2d4", toucheAuto: true, cibleEspeces: ["Mort-vivant", "Démon"],
    cout: { ressource: "mana", montant: 3 },
  };
  return {
    ...pj("Prêtre"),
    attaques: [{ id: "sort:sort-destruction-mal", nom: "✦ Destruction du mal", bonus: 8, degats: "2d4", toucheAuto: true }],
    sorts: [destruction],
    ressources: { mana: { max: 6, actuel: 6 } },
  };
}

function squelette(): CombatParticipant {
  const tpl = SEED_MONSTERS.find((m) => m.nom === "Squelette")!;
  return monsterInstances(tpl, 1)[0];
}

describe("restriction d'espèce (Destruction du mal -> morts-vivants et démons)", () => {
  it("automatique : 2d4 DM sur mort-vivant, mana payé", () => {
    const s = createCombat([pretreDestruction(), squelette()]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Touche auto (pas de jet), 2d4 : 3+3 = 6 DM (9 -> 3 PV).
    const { state, resolution } = resolveAttack(s, a, t, "sort:sort-destruction-mal", fixedRng([0.5, 0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.toucheAuto).toBe(true);
    expect(resolution.degatsTotal).toBe(6);
    expect(state.participants[1].pv).toBe(3);
    expect(state.participants[0].ressources.mana.actuel).toBe(3);
  });

  it("automatique : dégâts aussi sur démon (Démonet, humanoïde démoniaque)", () => {
    const tpl = SEED_MONSTERS.find((m) => m.nom === "Démonet")!;
    const demonet = monsterInstances(tpl, 1)[0];
    const pvAvant = demonet.pv;
    const s = createCombat([pretreDestruction(), demonet]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 2d4 : 3+3 = 6 DM.
    const { state, resolution } = resolveAttack(s, a, t, "sort:sort-destruction-mal", fixedRng([0.5, 0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(6);
    expect(state.participants[1].pv).toBe(pvAvant - 6);
  });

  it("sans effet sur les autres espèces : 0 DM, PV intacts, journal explicite", () => {
    const s = createCombat([pretreDestruction(), gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const { state, resolution } = resolveAttack(s, a, t, "sort:sort-destruction-mal", fixedRng([0.5, 0.5]));
    expect(resolution.touche).toBe(true); // touché mais immunisé
    expect(resolution.degatsTotal).toBe(0);
    expect(resolution.pvApres).toBe(resolution.pvAvant);
    expect(state.participants[1].pv).toBe(8);
    expect(state.participants[1].effets).toHaveLength(0);
    expect(state.log.some((l) => l.message.includes("Sans effet") && l.message.includes("Mort-vivant"))).toBe(true);
  });

  it("fiche ancienne (sort appris avant la restriction) : complété depuis le grimoire, 0 DM sur Chef Kobold", () => {
    const aelion = SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut")!;
    // Snapshot tel qu'enregistré avant l'ajout de toucheAuto/cibleEspeces.
    const stale = {
      id: "sort-ancien-123", nom: "Destruction du mal", type: "offensif" as const,
      voie: "Voie de la prière", rang: 3, action: "attaque" as const,
      description: "ancien texte", familles: ["Prêtre"],
      degats: "2d4", cout: { ressource: "mana", montant: 3 },
    };
    const fiche = { ...aelion, sorts: [...aelion.sorts, stale] };
    const pretre = participantFromCharacter(fiche, []);
    // Le participant porte le sort complété, sans muter la fiche.
    expect(pretre.sorts.find((s) => s.nom === "Destruction du mal")?.cibleEspeces).toEqual(["Mort-vivant", "Démon"]);
    expect(pretre.sorts.find((s) => s.nom === "Destruction du mal")?.toucheAuto).toBe(true);
    expect(fiche.sorts.find((s) => s.nom === "Destruction du mal")).not.toHaveProperty("cibleEspeces");
    const atkId = pretre.attaques.find((a) => a.nom.includes("Destruction"))!.id;
    // Chef Kobold (ni démon ni mort-vivant) : 0 DM + log.
    const koboldTpl = SEED_MONSTERS.find((m) => m.nom === "Chef Kobold")!;
    const s = createCombat([pretre, monsterInstances(koboldTpl, 1)[0]]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const { state, resolution } = resolveAttack(s, a, t, atkId, fixedRng([0.5, 0.5]));
    expect(resolution.degatsTotal).toBe(0);
    expect(state.participants[1].pv).toBe(koboldTpl.pv);
    expect(state.log.some((l) => l.message.includes("Sans effet"))).toBe(true);
    // ...mais dégâts du grimoire au rang de voie (2d4°+CHA, CHA 4) sur squelette.
    const s2 = createCombat([pretre, squelette()]);
    const r2 = resolveAttack(s2, s2.participants[0].instanceId, s2.participants[1].instanceId, atkId, fixedRng([0.5, 0.5]));
    expect(r2.resolution.degatsTotal).toBe(10);
    expect(r2.state.participants[1].pv).toBe(0);
  });

  it("sort à jet restreint : touché sur mort-vivant = dégâts, sur vivant = 0", () => {
    const fleau = {
      id: "fleau", nom: "Fléau", type: "offensif" as const,
      degats: "1d6", cibleEspeces: ["mort-vivant"],
      cout: { ressource: "mana", montant: 1 },
    };
    const lanceur = {
      ...pj("Prêtre"),
      attaques: [{ id: "sort:fleau", nom: "✦ Fléau", bonus: 10, degats: "1d6" }],
      sorts: [fleau],
      ressources: { mana: { max: 6, actuel: 6 } },
    };
    // Touché (19+10) sur squelette : 1d6 = 4 DM.
    const s1 = createCombat([lanceur, squelette()]);
    const r1 = resolveAttack(s1, s1.participants[0].instanceId, s1.participants[1].instanceId, "sort:fleau", fixedRng([0.9, 0.5]));
    expect(r1.resolution.touche).toBe(true);
    expect(r1.resolution.degatsTotal).toBe(4);
    // Touché (19+10) sur gobelin : 0 DM + log.
    const s2 = createCombat([{ ...lanceur }, gobelin("G")]);
    const r2 = resolveAttack(s2, s2.participants[0].instanceId, s2.participants[1].instanceId, "sort:fleau", fixedRng([0.9, 0.5]));
    expect(r2.resolution.touche).toBe(true);
    expect(r2.resolution.degatsTotal).toBe(0);
    expect(r2.state.log.some((l) => l.message.includes("Sans effet"))).toBe(true);
  });

  it("la chance ne contourne pas l'immunité d'espèce : touché mais 0 DM", () => {
    const lanceur = {
      ...pj("Prêtre"),
      ressources: { chance: { max: 2, actuel: 2 }, mana: { max: 6, actuel: 6 } },
      attaques: [{ id: "sort:fleau2", nom: "✦ Fléau", bonus: 6, degats: "1d6" }],
      sorts: [{ id: "fleau2", nom: "Fléau", type: "offensif" as const, degats: "1d6", cibleEspeces: ["mort-vivant"], cout: { ressource: "mana", montant: 1 } }],
    };
    const s = createCombat([lanceur, gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const manque = resolveAttack(s, a, t, "sort:fleau2", fixedRng([0.1, 0.5])).resolution; // 3+6=9 < 15
    expect(manque.touche).toBe(false);
    // 9+10 = 19 ≥ 15 : touché, mais gobelin immunisé -> 0 DM + log.
    const { state, resolution } = depenserChanceApresCoup(s, a, t, "sort:fleau2", manque, fixedRng([0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.degatsTotal).toBe(0);
    expect(state.participants[1].pv).toBe(8);
    expect(state.log.some((l) => l.message.includes("Sans effet"))).toBe(true);
  });
});

describe("voie du sang en combat : Siphon (montant MJ) et Sang mordant (riposte)", () => {
  it("utiliserCapacite soinFixe : +NC PV sans jet, journalisé", () => {
    const lanceur = { ...pj("Sorcier"), capacites: ["Siphon des âmes"] };
    const cible = { ...pj("Cible"), pv: 10 };
    const s = createCombat([lanceur, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const { state, resolution } = utiliserCapacite(s, a, t, "Siphon des âmes", { effetCle: null, soinFixe: 7 });
    expect(resolution.soinTotal).toBe(7);
    expect(state.participants[1].pv).toBe(17);
    expect(state.log.some((l) => l.message.includes("Soin (MJ)"))).toBe(true);
  });

  it("Sang mordant : 1d4° d'acide à l'attaquant au contact", () => {
    const attaquant = pj("Attaquant");
    const cible = { ...gobelin("Sorcier", 30), effets: [createEffect("Sang mordant")] };
    const s = createCombat([attaquant, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // d20 15+6=21 touche (DEF 15) ; 1d8+3 -> 5+3=8 ; riposte 1d4 -> 3.
    const { state, resolution } = resolveAttack(s, a, t, "epee", fixedRng([0.7, 0.5, 0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.sangMordant).toEqual({ degats: 3, pvAttaquantApres: 37 });
    expect(state.participants[0].pv).toBe(37);
    expect(state.log.some((l) => l.message.includes("Sang mordant"))).toBe(true);
  });

  it("Sang mordant : ni à distance, ni sans l'effet", () => {
    const archer = {
      ...pj("Archer"),
      attaques: [{ id: "arc", nom: "Arc", bonus: 6, degats: "1d6", familles: ["arcs" as ArmeFamille] }],
    };
    const cible = { ...gobelin("Sorcier", 30), effets: [createEffect("Sang mordant")] };
    const s = createCombat([archer, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const dist = resolveAttack(s, a, t, "arc", fixedRng([0.7, 0.5, 0.5])).resolution;
    expect(dist.touche).toBe(true);
    expect(dist.sangMordant).toBeNull();
    const s2 = createCombat([pj("Attaquant"), gobelin("G")]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    const nu = resolveAttack(s2, a2, t2, "epee", fixedRng([0.7, 0.5, 0.5])).resolution;
    expect(nu.sangMordant).toBeNull();
  });

  it("estAttaqueContact : sorts exclus, distance exclue, naturelles incluses", () => {
    expect(estAttaqueContact({ id: "epee" }, false)).toBe(true);
    expect(estAttaqueContact({ id: "arc", familles: ["arcs"] }, false)).toBe(false);
    expect(estAttaqueContact({ id: "epee", familles: ["epees"] }, false)).toBe(true);
    expect(estAttaqueContact({ id: "sort:feu" }, true)).toBe(false);
    expect(estAttaqueContact({ id: "sort:feu" }, false)).toBe(false);
  });
});

describe("sorts fonctionnels : moitié des DM au save réussi", () => {
  const boom = (difficulte: number) => ({
    ...pj("Magicien"),
    attaques: [{
      id: "boom", nom: "Boom", bonus: 6, degats: "1d8+3",
      effetTouche: { cle: "Feu", duree: null as null, sauvegarde: { carac: "CON", difficulte, moitieDM: true } },
    }],
  });

  it("save réussie : DM divisés par 2 + journal", () => {
    const s = createCombat([boom(5), gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // d20 15+6 touche ; 1d8+3 -> 5+3=8 ; save 19 >= 5 -> moitié = 4.
    const { state, resolution } = resolveAttack(s, a, t, "boom", fixedRng([0.7, 0.5, 0.9]));
    expect(resolution.degatsTotal).toBe(4);
    expect(state.participants[1].pv).toBe(4);
    expect(state.log.some((l) => l.message.includes("Moitié"))).toBe(true);
  });

  it("save ratée : DM complets", () => {
    const s = createCombat([boom(20), gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // save 2 < 20 -> 8 DM complets.
    const { state, resolution } = resolveAttack(s, a, t, "boom", fixedRng([0.7, 0.5, 0.05]));
    expect(resolution.degatsTotal).toBe(8);
    expect(state.participants[1].pv).toBe(0);
  });

  it("intégration : Arc de feu du grimoire au participant (dégâts + save résolue)", () => {
    const sorcier = SEED_CHARACTERS.find((c) => c.id === "pj-sorcier-humain")!;
    const arc = SEED_SORTS.find((s) => s.id === "sort-arc-feu")!;
    const int = sorcier.caracteristiques.INT;
    const p = participantFromCharacter({ ...sorcier, sorts: [arc] }, []);
    const atk = p.attaques.find((x) => x.id === "sort:sort-arc-feu")!;
    expect(atk.degats).toBe(`1d4+${int}`);
    expect(atk.effetTouche?.sauvegarde).toMatchObject({ carac: "AGI", difficulte: 10 + int, moitieDM: true });
  });
});

describe("ciblage multiple et zone ajustable", () => {
  const arc = () => ({
    id: "sort-arc-feu", nom: "Arc de feu", type: "offensif" as const,
    degats: "1d4", ciblesMax: 3, cout: { ressource: "mana", montant: 1 },
  });

  it("frapperCibles : un jet par cible, mana payé une fois", () => {
    const sortArc = arc();
    const lanceur = {
      ...pj("Magicien"),
      sorts: [sortArc],
      attaques: [{ id: "sort:sort-arc-feu", nom: "✦ Arc de feu", bonus: 4, degats: "1d4" }],
      ressources: { mana: { max: 6, actuel: 6 } },
    };
    const s = createCombat([lanceur, gobelin("A", 30), gobelin("B", 30)]);
    const [a, t1, t2] = s.participants.map((p) => p.instanceId);
    // Cible 1 : d20 15+4 touche (DEF 15), 1d4 -> 3 DM ; cible 2 : d20 5+4=9 raté.
    const { state, resolutions } = frapperCibles(s, a, arc(), "sort:sort-arc-feu", [t1, t2], fixedRng([0.7, 0.5, 0.2]));
    expect(resolutions).toHaveLength(2);
    expect(resolutions[0].touche).toBe(true);
    expect(resolutions[0].degatsTotal).toBe(3);
    expect(resolutions[1].touche).toBe(false);
    expect(state.participants[1].pv).toBe(27);
    expect(state.participants[2].pv).toBe(30);
    expect(state.participants[0].ressources.mana.actuel).toBe(5);
  });

  it("frapperCibles : vide, surnombre et limite par cible rejetés avant paiement", () => {
    const malediction = {
      id: "m", nom: "Malédiction", type: "offensif" as const,
      limiteParCible: true, cout: { ressource: "mana", montant: 1 },
    };
    const lanceur = { ...pj("Magicien"), sorts: [malediction], ressources: { mana: { max: 6, actuel: 6 } } };
    const s = createCombat([lanceur, gobelin("A", 30), gobelin("B", 30)]);
    const [a, t1, t2] = s.participants.map((p) => p.instanceId);
    expect(() => frapperCibles(s, a, arc(), "x", [], fixedRng([0.5]))).toThrow(/Aucune cible/);
    expect(() => frapperCibles(s, a, arc(), "x", [t1, t2, t1, t1], fixedRng([0.5]))).toThrow(/au maximum/);
    // Malédiction déjà utilisée sur A : rejet avant tout paiement.
    const marque = s.participants.map((p) =>
      p.instanceId === a ? { ...p, sorts: [malediction], usagesSorts: { m: { n: 1, cibles: [t1] } } } : p
    );
    const s2 = { ...s, participants: marque };
    expect(() => frapperCibles(s2, a, malediction, "x", [t1, t2], fixedRng([0.5]))).toThrow(/déjà affectée/);
    expect(s2.participants[0].ressources.mana.actuel).toBe(6);
  });

  it("frapperZone : cibles explicites incluant un allié (Explosion de feu)", () => {
    const boom = {
      id: "bz", nom: "Boom", type: "offensif" as const, degats: "2d4",
      zone: true, cout: { ressource: "mana", montant: 2 },
    };
    const lanceur = { ...pj("Magicien"), sorts: [boom], ressources: { mana: { max: 6, actuel: 6 } } };
    const s = createCombat([lanceur, pj("Allié"), gobelin("G", 30)]);
    const [a, al, g] = s.participants.map((p) => p.instanceId);
    // 2d4 : 3+3 = 6 DM sur l'allié coché et le gobelin.
    const { state } = frapperZone(s, a, boom, fixedRng([0.5, 0.5]), undefined, [al, g]);
    expect(state.participants[1].pv).toBe(34);
    expect(state.participants[2].pv).toBe(24);
    expect(state.participants[0].ressources.mana.actuel).toBe(4);
  });

  it("Mot de pouvoir : zone + 1/jour dans les seeds", () => {
    const mot = SEED_SORTS.find((s) => s.id === "sort-mot-pouvoir")!;
    expect(mot.zone).toBe(true);
    expect(mot.limiteCombat).toBe(1);
  });
});

describe("fusion capacités : usages valides et exécutables", () => {
  it("chaque usage pointe un talent de nos voies, champs valides", () => {
    const connus = new Set<string>();
    for (const voies of Object.values(CAPACITES)) {
      for (const v of voies) for (const t of v.capacites) connus.add(normaliserNomCapacite(t.nom));
    }
    for (const u of CAPACITES_USABLES) {
      expect(connus.has(normaliserNomCapacite(u.talent)), `talent inconnu : ${u.talent}`).toBe(true);
      expect(["allies", "ennemis", "tous", "soi"]).toContain(u.cibles);
      if (u.coutPV) {
        expect(() => parseDiceExpression(substituerDesEvolutifs(u.coutPV!, 1)), `${u.talent} : coutPV invalide`).not.toThrow();
      }
      if (u.soin) {
        const expr = substituerStats(substituerDesEvolutifs(u.soin, 1), { CON: 2, CHA: 2 });
        expect(() => parseDiceExpression(expr), `${u.talent} : soin invalide`).not.toThrow();
      }
    }
  });

  it("passifs exclus du panneau Capacités : seules les lançables", () => {
    const lances = talentsLancables([
      "Protéger un allié", "Pacte démoniaque", "Siphon des âmes", "Increvable",
      "Parer un coup", "Renvoi de sort", "Armure d'os", "Exsangue",
      "Archer émérite", "Survie", "Attaque puissante", "Charge", "Feinte",
      "Sort inventé",
    ]);
    expect(lances).toEqual([
      "Protéger un allié", "Pacte démoniaque", "Siphon des âmes", "Increvable",
      "Parer un coup", "Renvoi de sort",
    ]);
  });

  it("Prouesse et Tour de force : coût PV auto au clic", () => {
    const lanceur = { ...pj("Guerrier"), capacites: ["Prouesse"] };
    const s = createCombat([lanceur, gobelin("G")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 1d4 : 3 PV sacrifiés (40 -> 37).
    const r = utiliserCapacite(s, a, t, "Prouesse", { effetCle: null, coutPV: "1d4°" }, fixedRng([0.5]));
    expect(r.state.participants[0].pv).toBe(37);
    expect(r.state.log.some((l) => l.message.includes("Prouesse"))).toBe(true);
  });

  it("Phénix et Feindre la mort : soin auto", () => {
    const lanceur = { ...pj("Prêtre"), capacites: ["Phénix"] };
    const blesse = { ...pj("Allié"), pv: 10 };
    const s = createCombat([lanceur, blesse]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 2d4°+CHA (CHA 0) : 3+3 = 6 -> 16 PV.
    const r = utiliserCapacite(s, a, t, "Phénix", { effetCle: null, soin: "2d4°+CHA" }, fixedRng([0.5, 0.5]));
    expect(r.resolution.soinTotal).toBe(6);
    expect(r.state.participants[1].pv).toBe(16);
  });
});

describe("options tactiques (LDB)", () => {
  it("assurée : +5 en attaque (armes), DM divisés par 2", () => {
    const s = createCombat([pj("Att"), gobelin()]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 11 naturel : 11+6+5 = 22 vs 15 -> touche ; 1d8+3 : 5+3 = 8 -> 4.
    const r = resolveAttack(s, a, t, "epee", fixedRng([0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      modAttaque: 5, diviseDM: 2, tactique: "assuree",
    });
    expect(r.resolution.jetTotal).toBe(22);
    expect(r.resolution.degatsTotal).toBe(4);
    expect(r.state.log.some((l) => l.message.includes("Assurée"))).toBe(true);
    expect(r.state.log.some((l) => l.message.includes("divisés par 2"))).toBe(true);
  });

  it("précise : −3 en attaque, +1d4° DM", () => {
    const s = createCombat([pj("Att"), gobelin()]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19 naturel : 19+6-3 = 22 vs 15 -> touche ; 1d8+3 : 8, +1d4° : 3 -> 11.
    const r = resolveAttack(s, a, t, "epee", fixedRng([0.9, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      modAttaque: -3, degatsBonus: ["1d4°"], tactique: "precise",
    });
    expect(r.resolution.jetTotal).toBe(22);
    expect(r.resolution.degatsTotal).toBe(11);
    expect(r.state.log.some((l) => l.message.includes("Précise"))).toBe(true);
  });

  it("violente : −7 en attaque, +2d4° DM", () => {
    const s = createCombat([pj("Att"), gobelin()]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 19 naturel : 19+6-7 = 18 vs 15 -> touche ; 1d8+3 : 8, +2d4° : 3+3 -> 14.
    const r = resolveAttack(s, a, t, "epee", fixedRng([0.9, 0.5, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS, {
      modAttaque: -7, degatsBonus: ["2d4°"], tactique: "violente",
    });
    expect(r.resolution.jetTotal).toBe(18);
    expect(r.resolution.degatsTotal).toBe(14);
    expect(r.state.log.some((l) => l.message.includes("Violente"))).toBe(true);
  });

  it("Saignements de Mirabel (seed) : DoT 1d4° pendant INT (2) rounds, sans dégâts immédiats", () => {
    const mirabel = SEED_CHARACTERS.find((c) => c.id === "pj-sorcier-humain")!;
    const lanceur = participantFromCharacter(mirabel, SEED_ITEMS);
    const s = createCombat([lanceur, gobelin()]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Difficulté fixe 10+CON (gobelin de test sans caracs : CON 0 = 10, DEF 15 ignorée) :
    // 11 naturel : 11+5 = 16 >= 10 -> touche ; pas de dégâts immédiats.
    // DoT 1d4° (niv. 1 -> d4) : 3 PV/round.
    const r = resolveAttack(s, a, t, "sort:mirabel-saignements", fixedRng([0.5, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS);
    expect(r.resolution.defenseCible).toBe(10);
    expect(r.resolution.touche).toBe(true);
    expect(r.resolution.degatsTotal).toBe(0);
    const effet = r.state.participants[1].effets.find((e) => e.nom === "Saignement");
    expect(effet).toBeTruthy();
    expect(effet?.toursRestants).toBe(2);
    expect(pvParTourTotal(r.state.participants[1].effets)).toBe(-3);
    expect(r.state.log.some((l) => l.message.includes("Difficulté 10+CON"))).toBe(true);
    expect(r.state.log.some((l) => l.message.includes("Saignement"))).toBe(true);
  });

  it("difficulté fixe : la DEF est ignorée (cible blindée mais frêle touchée)", () => {
    const mirabel = SEED_CHARACTERS.find((c) => c.id === "pj-sorcier-humain")!;
    const lanceur = participantFromCharacter(mirabel, SEED_ITEMS);
    // DEF 20 mais CON 0 -> seuil 10 ; 5 naturel : 5+5 = 10 -> touche (raté vs DEF).
    const cible = { ...gobelin(), defense: 20, caracs: { AGI: 0, CON: 0, FOR: 0, PER: 0, CHA: 0, INT: 0, VOL: 0 } };
    const s = createCombat([lanceur, cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const r = resolveAttack(s, a, t, "sort:mirabel-saignements", fixedRng([0.2, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS);
    expect(r.resolution.defenseCible).toBe(10);
    expect(r.resolution.touche).toBe(true);
  });
});

describe("outre-tombe (corrections LDB)", () => {
  const pied = () => ({
    id: "pied", nom: "Un pied dans la tombe", type: "offensif" as const,
    testOppose: "magique" as const, exigeVivant: true,
    degats: "1d6", effetCle: "ralenti", effetDuree: 1,
    effetSauvegarde: { carac: "CON", difficulte: 10 },
    cout: { ressource: "mana", montant: 1 },
  });
  const lanceurPied = () => ({
    ...sorcier(),
    attaques: [{ id: "sort:pied", nom: "✦ Pied", bonus: 10, degats: "1d6", effetTouche: { cle: "ralenti", duree: 1, sauvegarde: { carac: "CON", difficulte: 10 } } }],
    sorts: [pied()],
    ressources: { mana: { max: 10, actuel: 10 } },
  });

  it("test opposé magique : d20 + magie vs d20 + magie (DEF ignorée)", () => {
    const cible = { ...gobelin(), defense: 30, bonusMagique: 3, caracs: { CON: 1 } };
    const s = createCombat([lanceurPied(), cible]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Attaquant 19+10 = 29 vs défenseur 17+3 = 20 -> touché (raté vs DEF 30).
    const r = resolveAttack(s, a, t, "sort:pied", fixedRng([0.9, 0.8, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS);
    expect(r.resolution.defenseCible).toBe(20);
    expect(r.resolution.touche).toBe(true);
    expect(r.state.log.some((l) => l.message.includes("Test opposé magique"))).toBe(true);
    // Défenseur supérieur : 3+10 = 13 vs 19+3 = 22 -> manqué.
    const r2 = resolveAttack(s, a, t, "sort:pied", fixedRng([0.1, 0.9, 0.5]), DEFAULT_COMBAT_OPTIONS);
    expect(r2.resolution.touche).toBe(false);
  });

  it("Pied : cible non vivante refusée (squelette, golem)", () => {
    const squelette = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Squelette")!, 1)[0];
    const s = createCombat([lanceurPied(), squelette]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    expect(() => resolveAttack(s, a, t, "sort:pied", fixedRng([0.9]))).toThrow(/non vivante/);
    // PJ vivant : pas de refus.
    const s2 = createCombat([lanceurPied(), gobelin()]);
    const [a2, t2] = s2.participants.map((p) => p.instanceId);
    expect(() => resolveAttack(s2, a2, t2, "sort:pied", fixedRng([0.9, 0.1, 0.5, 0.5]))).not.toThrow();
  });

  it("CON inconnue : estimation explicite au MJ (pas de 0 silencieux)", () => {
    const sansCaracs = { ...gobelin(), caracs: undefined };
    const s = createCombat([lanceurPied(), sansCaracs]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const r = resolveAttack(s, a, t, "sort:pied", fixedRng([0.9, 0.5, 0.5]), DEFAULT_COMBAT_OPTIONS);
    expect(r.state.log.some((l) => l.message.includes("inconnue"))).toBe(true);
  });

  it("taille : Ensevelissement refuse au-delà de Moyenne", () => {
    expect(tailleAcceptee("Moyenne", "Moyenne")).toBe(true);
    expect(tailleAcceptee("Petite", "Moyenne")).toBe(true);
    expect(tailleAcceptee("Grande", "Moyenne")).toBe(false);
    expect(tailleAcceptee(undefined, "Moyenne")).toBe(true);
    const sort = { ...pied(), nom: "Ensevelissement", tailleMax: "Moyenne" };
    const lanceur = { ...lanceurPied(), sorts: [sort] };
    const grand = { ...gobelin(), taille: "Grande" };
    const s = createCombat([lanceur, grand]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    expect(() => resolveAttack(s, a, t, "sort:pied", fixedRng([0.9]))).toThrow(/trop grand/);
  });

  it("enseveli : inciblable (attaque, multi, zone), sortie FOR/AGI + aides", () => {
    const victime = {
      ...gobelin("Victime"),
      effets: [createEffect("enseveli", { dureeTours: null })],
    };
    const s = createCombat([pj("A"), victime, gobelin("G")]);
    const [a, v, g] = s.participants.map((p) => p.instanceId);
    expect(() => resolveAttack(s, a, v, "epee", fixedRng([0.9]))).toThrow(/inciblable/);
    const sortFeu = { id: "feu", nom: "Feu", type: "offensif" as const, degats: "1d6" };
    const lanceurFeu = { ...pj("A"), attaques: [{ id: "sort:feu", nom: "✦ Feu", bonus: 5, degats: "1d6" }], sorts: [sortFeu] };
    const sf = createCombat([lanceurFeu, victime]);
    const [af, vf] = sf.participants.map((p) => p.instanceId);
    expect(() => frapperCibles(sf, af, sortFeu, "sort:feu", [vf], fixedRng([0.9]), DEFAULT_COMBAT_OPTIONS, {}, {})).toThrow(/inciblable/);
    // Sortie réussie : 19+1 (FOR) = 20 ≥ 15 -> libre.
    const cibleForte = { ...victime, caracs: { FOR: 1 } };
    const s2 = createCombat([pj("A"), cibleForte]);
    const [, v2] = s2.participants.map((p) => p.instanceId);
    const r = tenterSortieEnseveli(s2, v2, "FOR", 0, fixedRng([0.9]));
    expect(r.resolution.reussie).toBe(true);
    expect(r.state.participants[1].effets).toHaveLength(0);
    // Échec : 3+1 = 4 < 15 -> reste.
    const r2 = tenterSortieEnseveli(s2, v2, "FOR", 0, fixedRng([0.1]));
    expect(r2.resolution.reussie).toBe(false);
    expect(r2.state.participants[1].effets).toHaveLength(1);
    // Aides plafonnées : 99 aides -> +10 ; 1 naturel + 0 + 10 = 11 < 15.
    const s3 = createCombat([pj("B"), victime]);
    const [, v3] = s3.participants.map((p) => p.instanceId);
    const r3 = tenterSortieEnseveli(s3, v3, "FOR", 99, fixedRng([0.0]));
    expect(r3.resolution.aides).toBe(10);
    expect(r3.resolution.reussie).toBe(false);
    // Non enseveli / KO : erreurs.
    expect(() => tenterSortieEnseveli(s2, a, "FOR", 0)).toThrow(/pas enseveli/);
  });

  it("moribond : enseveli à 0 PV meurt au tour suivant (soin purge)", () => {
    const enseveli = (pv: number) => ({
      ...gobelin("Enterré"),
      pv,
      effets: [createEffect("enseveli", { dureeTours: null })],
    });
    let s = createCombat([pj("A"), enseveli(0)]);
    s = nextTurn(s, false); // tour de l'enseveli
    s = nextTurn(s, false); // fin de son tour : marqué moribond
    expect(s.log.some((l) => l.message.includes("mourant enterré"))).toBe(true);
    s = nextTurn(s, false); // tour de A
    s = nextTurn(s, false); // fin de son tour : décès
    expect(s.participants[1].statut).toBe("mort");
    expect(s.log.some((l) => l.message.includes("meurt enterré"))).toBe(true);
  });

  it("poussière : zombie invoqué à 0 PV retiré (pas de KO)", () => {
    const zombie = {
      ...gobelin("Zomb"),
      pv: 0, statut: "ko" as const,
      invoque: { par: "x", espece: "Zombie" },
    };
    const sorcierP = { ...pj("Sorcier"), instanceId: "x" };
    let s = createCombat([sorcierP, zombie, gobelin("G")]);
    s = nextTurn(s, false);
    expect(s.participants.some((p) => p.nom === "Zomb")).toBe(false);
    expect(s.log.some((l) => l.message.includes("poussière"))).toBe(true);
  });

  it("animation : profil bestiaire, max zombies, cadavre au MJ", () => {
    const sort = SEED_SORTS.find((x) => x.id === "sort-animation-morts")!;
    expect(sort.invocation?.modeleNom).toBe("Zombie humain");
    const zombieTpl = SEED_MONSTERS.find((m) => m.nom === "Zombie humain")!;
    const lanceur = { ...lanceurPied(), sorts: [{ ...sort, cout: { ressource: "mana", montant: 0 } }], ressources: { mana: { max: 10, actuel: 10 } } };
    const s = createCombat([lanceur, gobelin("G")]);
    const [a] = s.participants.map((p) => p.instanceId);
    const r = invoquer(s, a, { ...sort, cout: { ressource: "mana", montant: 0 } }, Math.random, {}, { modele: zombieTpl, max: 1 });
    const z = r.state.participants[r.state.participants.length - 1];
    expect(z.nom).toContain("Zombie");
    expect(z.pvMax).toBe(zombieTpl.pvMax);
    expect(z.attaques[0].nom).toBe(zombieTpl.attaques[0].nom);
    expect(z.invoque).toMatchObject({ par: a, espece: "Zombie" });
    // 2e zombie : refusé (max 1).
    expect(() => invoquer(r.state, a, sort, Math.random, {}, { modele: zombieTpl, max: 1 })).toThrow(/max 1/);
    // Sans profil ni stats : erreur MJ explicite.
    expect(() => invoquer(s, a, { ...sort, invocation: { nom: "Zombie" } }, Math.random, {})).toThrow(/MJ/);
    // Contrôle max : 1 + rangs 5 sorcier.
    expect(maxZombiesControles(["Animation des morts"])).toBe(1);
    expect(maxZombiesControles(["Animation des morts", "Lien de sang"])).toBe(2);
  });

  it("armée : sans immédiat, durée NIVEAU rounds", () => {
    const sort = SEED_SORTS.find((x) => x.id === "sort-armee-morts")!;
    expect(sort.degats).toBeUndefined();
    expect(sort.effetDuree).toBe("NIVEAU");
    const lanceur = { ...sorcier(), sorts: [sort], attaques: [] };
    const s = createCombat([lanceur, gobelin("G")]);
    const [a, g] = s.participants.map((p) => p.instanceId);
    const r = frapperZone(s, a, sort, fixedRng([0.5, 0.5, 0.5]), {}, [g]);
    // Pas de hit initial : PV intacts, effet NIVEAU (5) rounds appliqué.
    expect(r.resolution.degatsTotal).toBe(0);
    expect(s.participants[1].pv).toBe(r.state.participants[1].pv);
    const effet = r.state.participants[1].effets.find((e) => e.nom === "Armée des morts");
    expect(effet?.toursRestants).toBe(5);
  });
});
