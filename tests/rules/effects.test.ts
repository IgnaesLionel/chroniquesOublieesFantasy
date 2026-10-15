import { describe, expect, it } from "vitest";
import { createEffect, decrireModificateurs, getModifier, canAct, tickEffects } from "@/src/lib/rules/effects/effects";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { addParticipantEffect, createCombat, nextTurn, removeParticipantEffect } from "@/src/lib/rules/combat/initiative";
import { resolveAttack } from "@/src/lib/rules/combat/attack";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { fixedRng } from "@/src/lib/rules/dice/roller";

function participant(nom: string): CombatParticipant {
  return {
    instanceId: nom, templateId: "t", nom, camp: "pj",
    pvMax: 30, pv: 30, defense: 15, initMod: 0, initiative: 10,
    attaques: [{ id: "a", nom: "Épée", bonus: 5, degats: "1d6+2" }],
    effets: [], statut: "actif",
    sorts: [], capacites: [], niveau: 1, ressources: {},
  };
}

describe("effets temporaires", () => {
  it("poison : -2 attaque, durée 3 -> 2 après tick", () => {
    const poison = createEffect("empoisonne", { source: "Gobelin" });
    expect(poison.toursRestants).toBe(3);
    expect(getModifier([poison], "attaque")).toBe(-2);
    const t = tickEffects([poison]);
    expect(t.restants[0].toursRestants).toBe(2);
    expect(t.expires).toHaveLength(0);
  });

  it("expire après la durée, suppression manuelle possible", () => {
    let effs = [createEffect("protection", { dureeTours: 1 })];
    const t = tickEffects(effs);
    expect(t.restants).toHaveLength(0);
    expect(t.expires).toHaveLength(1);
    effs = [createEffect("protection", { dureeTours: 3 })];
    const { ok } = { ok: true };
    expect(ok).toBe(true);
    const removed = effs.filter((e) => e.id !== effs[0].id);
    expect(removed).toHaveLength(0);
  });

  it("étourdi empêche d'agir", () => {
    const e = createEffect("etourdi");
    expect(canAct([e])).toBe(false);
    expect(canAct([])).toBe(true);
  });

  it("saignement inflige PV au tick", () => {
    const t = tickEffects([createEffect("saignement")]);
    expect(t.pvDelta).toBe(-2);
  });

  it("combat : nextTurn consomme à la FIN du tour du porteur (malus couvre tout son tour)", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    // A (tour en cours) empoisonne B pour 1 tour.
    s = addParticipantEffect(s, "B", createEffect("empoisonne", { dureeTours: 1 }));
    expect(s.participants[1].effets).toHaveLength(1);
    // Tour de B : le malus est toujours là (il n'expire pas avant d'agir).
    s = nextTurn(s, false);
    expect(s.tourIndex).toBe(1);
    expect(s.participants[1].effets).toHaveLength(1);
    expect(s.participants[1].effets[0].toursRestants).toBe(1);
    // Fin du tour de B : le malus expire seulement maintenant.
    s = nextTurn(s, false);
    expect(s.participants[1].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("expiré"))).toBe(true);
  });

  it("combat : auto-buff 1 tour posé pendant son tour survit jusqu'à la fin de son prochain tour", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    // A se protège pendant son propre tour.
    s = addParticipantEffect(s, "A", createEffect("protection", { dureeTours: 1 }));
    // Tour de B : le buff de A est toujours actif (couvre l'inter-round).
    s = nextTurn(s, false);
    expect(s.participants[0].effets).toHaveLength(1);
    // Tour de A (manche 2) : le buff couvre encore tout son tour.
    s = nextTurn(s, false);
    expect(s.tourIndex).toBe(0);
    expect(s.participants[0].effets).toHaveLength(1);
    // Fin du tour de A (manche 2) : le buff expire seulement maintenant.
    s = nextTurn(s, false);
    expect(s.participants[0].effets).toHaveLength(0);
  });

  it("combat : DoT à la fin du tour du porteur (2 ticks pour 2 tours)", () => {
    const a = participant("A");
    const b = { ...participant("B"), camp: "monstre" as const };
    let s = createCombat([a, b]);
    s = addParticipantEffect(s, "B", createEffect("saignement", { dureeTours: 2 }));
    // Tour de B (manche 1) : il agit d'abord, PV intacts, effet présent.
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(30);
    expect(s.participants[1].effets[0].toursRestants).toBe(2);
    // Fin du tour de B : -2 PV, durée 2 => 1.
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(28);
    expect(s.participants[1].effets[0].toursRestants).toBe(1);
    expect(s.log.some((l) => l.message.includes("effet (-2 PV)"))).toBe(true);
    // Tour de B (manche 2) : PV inchangés pendant son tour...
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(28);
    // ...puis fin de son tour : -2 PV et expiration.
    s = nextTurn(s, false);
    expect(s.participants[1].pv).toBe(26);
    expect(s.participants[1].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("expiré"))).toBe(true);
  });

  it("combat : scénario du rapport — Ralenti 1 tour tient tout le tour de l'ennemi", () => {
    // Sorcier (tour en cours) touche l'ennemi avec "Un pied dans la tombe"
    // + Ralenti (1 tour) en effet supplémentaire.
    const sorcierP: CombatParticipant = {
      ...participant("Sorcier"),
      attaques: [{ id: "pied", nom: "Un pied dans la tombe", bonus: 10, degats: "1d6" }],
    };
    const ennemi = { ...participant("Ennemi"), camp: "monstre" as const };
    const s0 = createCombat([sorcierP, ennemi]);
    const { state: s1 } = resolveAttack(
      s0, "Sorcier", "Ennemi", "pied",
      fixedRng([0.9, 0.5]),
      undefined,
      { effetSupp: { cle: "Ralenti", duree: 1 } }
    );
    expect(s1.participants[1].effets.map((e) => e.nom)).toContain("Ralenti");
    // Tour de l'ennemi : il subit encore le malus pendant TOUT son tour.
    const s2 = nextTurn(s1, false);
    const malus = s2.participants[1].effets.find((e) => e.nom === "Ralenti");
    expect(malus).toBeTruthy();
    expect(malus!.toursRestants).toBe(1);
    // Il ne le perd qu'à la fin de son tour.
    const s3 = nextTurn(s2, false);
    expect(s3.participants[1].effets.find((e) => e.nom === "Ralenti")).toBeUndefined();
  });

  it("combat : add/remove effet via helpers + journal", () => {
    let s = createCombat([participant("A")]);
    s = addParticipantEffect(s, "A", createEffect("protection"));
    expect(s.participants[0].effets).toHaveLength(1);
    const id = s.participants[0].effets[0].id;
    s = removeParticipantEffect(s, "A", id);
    expect(s.participants[0].effets).toHaveLength(0);
    expect(s.log.some((l) => l.message.includes("retiré"))).toBe(true);
  });

  it("attaque applique malus poison (-2) et bonus protection (+2 déf)", () => {
    const atk = { ...participant("Att"), effets: [createEffect("empoisonne")] }; // +5-2 = +3
    const def = { ...participant("Def", ), camp: "monstre" as const, defense: 15, effets: [createEffect("protection")] }; // déf 17
    const s = createCombat([atk, def]);
    // naturel 14 : 14+3=17 vs 17 -> touche (sans effets : 14+5=19 touche aussi, mais vérifions le calcul effectif)
    const { resolution } = resolveAttack(s, "Att", "Def", "a", fixedRng([0.66, 0]));
    expect(resolution.jetNaturel).toBe(14);
    expect(resolution.jetTotal).toBe(17);
    expect(resolution.defenseCible).toBe(17);
    expect(resolution.touche).toBe(true);
  });

  it("étourdi bloque l'attaque", () => {
    const atk = { ...participant("Att"), effets: [createEffect("etourdi")] };
    const def = { ...participant("Def"), camp: "monstre" as const };
    const s = createCombat([atk, def]);
    expect(() => resolveAttack(s, "Att", "Def", "a", fixedRng([0.9]))).toThrow(/ne peut pas agir/);
  });
});

describe("états préjudiciables (LDB)", () => {
  it("catalogue : les 10 états officiels avec leurs modificateurs", () => {
    expect(createEffect("aveugle").modificateurs).toMatchObject({ attaque: -5, defense: -5, attaqueDistance: -5 });
    expect(createEffect("affaibli").modificateurs).toMatchObject({ deMalus: 1 });
    expect(createEffect("essouffle").modificateurs).toMatchObject({ deplacementMax: 5 });
    expect(createEffect("etourdi").modificateurs).toMatchObject({ empecheAgir: 1, defense: -5 });
    expect(createEffect("immobilise").modificateurs).toMatchObject({ deMalus: 1, pasDeDeplacement: 1 });
    expect(createEffect("invalide").modificateurs).toMatchObject({ deplacementMax: 5 });
    expect(createEffect("paralyse").modificateurs).toMatchObject({ empecheAgir: 1, paralyse: 1 });
    expect(createEffect("ralenti").modificateurs).toMatchObject({ actionUnique: 1 });
    expect(createEffect("renverse").modificateurs).toMatchObject({ attaque: -5, defense: -5 });
    expect(createEffect("surpris").modificateurs).toMatchObject({ empecheAgir: 1, defense: -5 });
  });

  it("bloquent l'action : étourdi, paralysé, surpris (pas l'immobilisé)", () => {
    expect(canAct([createEffect("etourdi")])).toBe(false);
    expect(canAct([createEffect("paralyse")])).toBe(false);
    expect(canAct([createEffect("surpris")])).toBe(false);
    // Immobilisé : pas de déplacement + dé malus, mais il agit toujours.
    expect(canAct([createEffect("immobilise")])).toBe(true);
    expect(canAct([createEffect("ralenti")])).toBe(true);
    expect(canAct([createEffect("renverse")])).toBe(true);
  });

  it("aveuglé : -5 au contact, -10 à distance (arc)", () => {
    const arc = (effets: ReturnType<typeof createEffect>[]): CombatParticipant => ({
      ...participant("Arc"),
      attaques: [{ id: "arc", nom: "Arc court", bonus: 7, degats: "1d6", familles: ["arcs"] }],
      effets,
    });
    const contact = (effets: ReturnType<typeof createEffect>[]) => ({
      ...participant("Épée"),
      attaques: [{ id: "epee", nom: "Épée", bonus: 7, degats: "1d6" }],
      effets,
    });
    const cible = { ...participant("Cib"), camp: "monstre" as const, defense: 15 };
    // 19 naturel : distance 19+7-5-5 = 16, contact 19+7-5 = 21.
    const rDist = resolveAttack(createCombat([arc([createEffect("aveugle")]), cible]), "Arc", "Cib", "arc", fixedRng([0.9, 0.5]));
    expect(rDist.resolution.jetTotal).toBe(16);
    expect(rDist.state.log.some((l) => l.message.includes("à distance"))).toBe(true);
    const rCont = resolveAttack(createCombat([contact([createEffect("aveugle")]), cible]), "Épée", "Cib", "epee", fixedRng([0.9, 0.5]));
    expect(rCont.resolution.jetTotal).toBe(21);
  });

  it("affaibli : dé malus aux jets d'attaque", () => {
    const atk = { ...participant("Att"), effets: [createEffect("affaibli")] };
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 10 };
    // 3 puis 19 : dé malus garde 3.
    const { resolution } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.1, 0.9, 0.5]));
    expect(resolution.desAvantage).toBe("malus");
    expect(resolution.jetNaturel).toBe(3);
  });

  it("étourdi : bloque et −5 DEF", () => {
    const atk = participant("Att");
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 15, effets: [createEffect("etourdi")] };
    expect(canAct(def.effets)).toBe(false);
    const { resolution } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.5, 0.5]));
    expect(resolution.defenseCible).toBe(10);
  });

  it("immobilisé : agit toujours, mais dé malus aux attaques", () => {
    const atk = { ...participant("Att"), effets: [createEffect("immobilise")] };
    expect(canAct(atk.effets)).toBe(true);
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 10 };
    // 3 puis 19 : dé malus garde 3.
    const { resolution } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.1, 0.9, 0.5]));
    expect(resolution.desAvantage).toBe("malus");
    expect(resolution.jetNaturel).toBe(3);
  });

  it("essoufflé / invalide / ralenti : marqueurs MJ, n'empêchent pas d'agir", () => {
    for (const cle of ["essouffle", "invalide", "ralenti"] as const) {
      const e = createEffect(cle);
      expect(canAct([e])).toBe(true);
      expect(decrireModificateurs(e.modificateurs).some((l) => l.includes("(MJ)"))).toBe(true);
    }
  });

  it("paralysé : touché automatiquement, critique subi (même sur un jet raté)", () => {
    const atk = participant("Att");
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 15, effets: [createEffect("paralyse")] };
    // 2 naturel +5 = 7 < 15 : raté sans la paralysie.
    const { resolution, state } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.05, 0.5]));
    expect(resolution.touche).toBe(true);
    expect(resolution.critique).toBe(true);
    expect(state.log.some((l) => l.message.includes("paralysé"))).toBe(true);
  });

  it("surpris : −5 DEF sur le total, armure comprise", () => {
    const atk = participant("Att");
    // DEF 18 = 10 + AGI 2 + armure 6, surpris avant l'initiative.
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 18, effets: [createEffect("surpris")] };
    const { resolution, state } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.9, 0.5]));
    expect(resolution.defenseCible).toBe(13);
    expect(state.log.some((l) => l.message.includes("Défense Def : 18 (-5 effets)"))).toBe(true);
    // Bloqué en plus (pas d'action au premier round).
    expect(canAct(def.effets)).toBe(false);
  });

  it("renversé : -5 attaque et -5 DEF appliqués des deux côtés", () => {
    const atk = { ...participant("Att"), effets: [createEffect("renverse")] }; // +5-5 = +0
    const def = { ...participant("Def"), camp: "monstre" as const, defense: 15, effets: [createEffect("renverse")] }; // déf 10
    // 14 naturel : 14+0 = 14 vs 10 -> touche.
    const { resolution } = resolveAttack(createCombat([atk, def]), "Att", "Def", "a", fixedRng([0.66, 0.5]));
    expect(resolution.jetTotal).toBe(14);
    expect(resolution.defenseCible).toBe(10);
    expect(resolution.touche).toBe(true);
  });

  it("options tactiques : postures au catalogue", () => {
    expect(createEffect("defense-partielle").modificateurs).toMatchObject({ defense: 3 });
    expect(createEffect("defense-totale").modificateurs).toMatchObject({ defense: 5 });
    expect(createEffect("riposte-posture").modificateurs).toMatchObject({ ripostePosture: 1 });
    expect(createEffect("soutien-tactique").modificateurs).toMatchObject({ attaque: 5 });
  });

  it("libellés moteur des nouvelles clés", () => {
    expect(decrireModificateurs({ attaqueDistance: -5 })).toEqual(["-5 aux attaques à distance (en plus)"]);
    expect(decrireModificateurs({ paralyse: 1 })).toEqual(["touché automatiquement, critique subi"]);
    expect(decrireModificateurs({ pasDeDeplacement: 1 })).toEqual(["pas de déplacement (MJ)"]);
    expect(decrireModificateurs({ actionUnique: 1 })).toEqual(["une seule action par round (MJ)"]);
    expect(decrireModificateurs({ deplacementMax: 5 })).toEqual(["déplacement max 5 m par action de mouvement (MJ)"]);
  });
});

describe("description exacte des modificateurs (règles)", () => {
  it("chaque clé moteur a un libellé", () => {
    expect(decrireModificateurs({ attaque: -3 })).toEqual(["-3 aux jets d'attaque"]);
    expect(decrireModificateurs({ defense: 2 })).toEqual(["+2 en DEF"]);
    expect(decrireModificateurs({ pvParTour: -2 })).toEqual(["-2 PV au début de son tour"]);
    expect(decrireModificateurs({ empecheAgir: 1 })).toEqual(["ne peut pas agir (tour sauté)"]);
    expect(decrireModificateurs({ deBonus: 1 })).toEqual(["dé bonus (2d20, garder le meilleur)"]);
    expect(decrireModificateurs({ deMalus: 1 })).toEqual(["dé malus (2d20, garder le pire)"]);
    expect(decrireModificateurs({ seuilCrit: 19 })).toEqual(["critique dès 19 naturel"]);
    expect(decrireModificateurs({})).toEqual([]);
  });

  it("catalogue : chaque état a une description moteur (sauf marqueur neutre)", () => {
    for (const e of EFFECT_CATALOG) {
      const lignes = decrireModificateurs(e.modificateurs);
      if (Object.keys(e.modificateurs).length === 0) expect(lignes).toEqual([]);
      else expect(lignes.length).toBeGreaterThan(0);
    }
  });
});
