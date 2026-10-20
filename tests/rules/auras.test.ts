import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import { appliquerAurasDebutCombat } from "@/src/lib/rules/combat/auras";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import { recibrerCible } from "@/src/lib/rules/combat/staging";
import { attaqueInterdite } from "@/src/lib/rules/effects/effects";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import { fixedRng } from "@/src/lib/rules/dice/roller";

/** PJ minimal, avec la valeur de PER (= « Sagesse » des vieilles cartes). */
function pj(nom: string, per: number): CombatParticipant {
  return {
    instanceId: `pj-${nom}`, templateId: "pj", nom, camp: "pj",
    pvMax: 30, pv: 30, defense: 15, initMod: 0, initiative: null,
    attaques: [{ id: "epee", nom: "Épée", bonus: 5, degats: "1d8" }],
    effets: [], sorts: [], capacites: [], niveau: 1, ressources: {}, statut: "actif",
    caracs: { AGI: 0, CON: 0, FOR: 0, PER: per, CHA: 0, INT: 0, VOL: 0 },
  };
}

function sigmeus(): CombatParticipant {
  const tpl = SEED_MONSTERS.find((m) => m.id === "notion-sigmeus-le-necromant")!;
  return monsterInstances(tpl, 1)[0];
}

describe("auras de début de combat (Effroi de Sigméus)", () => {
  it("s'applique même si Sigméus n'est pas en tête d'initiative", () => {
    const sig = sigmeus();
    const heros = pj("Héros", 0);
    // Le PJ est listé EN PREMIER : l'aura ne dépend pas de l'ordre d'initiative.
    // d20 = 1 (rng 0), total 1 < 10 -> échec ; durée 1d4 = 4 (rng 0.75).
    const s = appliquerAurasDebutCombat(createCombat([heros, sig]), fixedRng([0, 0.75]));
    const cible = s.participants.find((p) => p.instanceId === heros.instanceId)!;
    const eff = cible.effets.find((e) => e.nom === "Effroi")!;
    expect(eff).toBeDefined();
    expect(eff.toursRestants).toBe(4);
    expect(eff.dureeTours).toBe(4);
    expect(eff.interditCible).toBe(sig.instanceId);
    expect(attaqueInterdite(cible.effets, sig.instanceId)).toBe(true);
    expect(attaqueInterdite(cible.effets, "autre")).toBe(false);
  });

  it("journalise le test de SAG (d20 + PER vs 10)", () => {
    const sig = sigmeus();
    const heros = pj("Héros", 3); // d20 = 1 + PER 3 = 4 -> échec
    const s = appliquerAurasDebutCombat(createCombat([sig, heros]), fixedRng([0, 0]));
    const ligne = s.log.find((l) => l.message.includes("test de SAG"))!;
    expect(ligne).toBeDefined();
    expect(ligne.message).toContain("1+3 = 4 vs 10");
    expect(ligne.message).toContain("échec");
  });

  it("test réussi : aucune entrave", () => {
    const sig = sigmeus();
    const heros = pj("Héros", 20); // d20 = 1 + 20 = 21 >= 10 -> réussi
    const s = appliquerAurasDebutCombat(createCombat([sig, heros]), fixedRng([0]));
    const cible = s.participants.find((p) => p.instanceId === heros.instanceId)!;
    expect(cible.effets).toEqual([]);
    expect(s.log.some((l) => l.message.includes("réussi"))).toBe(true);
  });

  it("n'affecte pas les créatures du même camp", () => {
    const sig = sigmeus();
    const sbire: CombatParticipant = {
      ...pj("Sbire", 0), instanceId: "m-sbire", templateId: "m", camp: "monstre", capacites: [],
    };
    const s = appliquerAurasDebutCombat(createCombat([sig, sbire]), fixedRng([0, 0]));
    expect(s.participants.every((p) => p.effets.length === 0)).toBe(true);
    expect(s.log.some((l) => l.message.includes("test de SAG"))).toBe(false);
  });

  it("recibrerCible écarte la cible interdite (Effroi)", () => {
    const sig = sigmeus();
    const heros = pj("Héros", 0);
    const sbire: CombatParticipant = {
      ...pj("Sbire", 0), instanceId: "m-sbire", templateId: "m", camp: "monstre", capacites: [],
    };
    const s = appliquerAurasDebutCombat(createCombat([sig, heros, sbire]), fixedRng([0, 0.75]));
    // Le héros est sous Effroi : Sigméus disparaît de ses cibles, il reste le sbire…
    expect(recibrerCible(s, heros.instanceId, sig.instanceId)).toBe(sbire.instanceId);
    // …mais Sigméus reste libre de viser le héros.
    expect(recibrerCible(s, sig.instanceId, heros.instanceId)).toBe(heros.instanceId);
  });
});
