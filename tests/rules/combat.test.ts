import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives } from "@/src/lib/rules/combat/initiative";
import { applyDamage, checkEnd, resolveAttack } from "@/src/lib/rules/combat/attack";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";

function pj(nom = "Guerrier", defense = 18): CombatParticipant {
  return {
    instanceId: `pj-${nom}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense, initMod: 1, initiative: null,
    attaques: [{ id: "epee", nom: "Épée", bonus: 6, degats: "1d8+3" }],
    effets: [],
    sorts: [],
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
});
