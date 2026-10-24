import { describe, expect, it } from "vitest";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import { profilDepuisMonstre } from "@/src/lib/encounters/roles";
import type { SlotResolu } from "@/src/lib/encounters/types";
import { participantsDepuisRencontre, stagingDepuisRencontre } from "@/src/lib/rules/combat/depuis-rencontre";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import type { MonsterTemplate } from "@/src/lib/rules/types";

function monstre(nom: string): MonsterTemplate {
  const m = SEED_MONSTERS.find((x) => x.nom === nom);
  if (!m) throw new Error(`Monstre introuvable : ${nom}`);
  return m;
}

function slot(nom: string, quantite: number): SlotResolu {
  const template = monstre(nom);
  return { monstreId: template.id, quantite, profil: profilDepuisMonstre(template) };
}

describe("conversion rencontre -> combat", () => {
  it("instancie une créature par unité, avec des PV indépendants", () => {
    const participants = participantsDepuisRencontre([slot("Gobelin de base", 3)]);

    expect(participants).toHaveLength(3);
    expect(new Set(participants.map((p) => p.instanceId)).size).toBe(3);
    for (const p of participants) {
      expect(p.camp).toBe("monstre");
      expect(p.templateId).toBe(monstre("Gobelin de base").id);
      expect(p.pv).toBe(monstre("Gobelin de base").pv);
      expect(p.pvMax).toBe(monstre("Gobelin de base").pvMax);
    }
    expect(participants.map((p) => p.nom)).toEqual(["Gobelin de base #1", "Gobelin de base #2", "Gobelin de base #3"]);
  });

  it("renumérote les doublons de toute la composition", () => {
    const participants = participantsDepuisRencontre([slot("Gobelin de base", 2), slot("Gobelin de base", 1)]);

    expect(participants).toHaveLength(3);
    expect(participants.map((p) => p.nom)).toEqual(["Gobelin de base #1", "Gobelin de base #2", "Gobelin de base #3"]);
  });

  it("conserve une créature unique sans suffixe", () => {
    const participants = participantsDepuisRencontre([slot("Goule", 1)]);
    expect(participants).toHaveLength(1);
    expect(participants[0].nom).toBe("Goule");
  });

  it("remplace le camp ennemi et conserve les PJ posés", () => {
    const template = monstre("Orc de base");
    const pj = monsterInstances(template, 2); // sert de figurant : seul le camp compte ici
    for (const p of pj) p.camp = "pj";
    const orc = monsterInstances(template, 1)[0];

    const staging = stagingDepuisRencontre([orc, ...pj], [slot("Goule", 2)]);

    expect(staging).toHaveLength(4);
    expect(staging.filter((p) => p.camp === "pj")).toHaveLength(2);
    expect(staging.filter((p) => p.camp === "monstre").map((p) => p.templateId)).toEqual([
      monstre("Goule").id,
      monstre("Goule").id,
    ]);
  });

  it("ne cumule pas deux conversions successives", () => {
    const template = monstre("Orc de base");
    const pj = monsterInstances(template, 1)[0];
    pj.camp = "pj";

    const premiere = stagingDepuisRencontre([pj], [slot("Gobelin de base", 2)]);
    const seconde = stagingDepuisRencontre(premiere, [slot("Goule", 1)]);

    expect(seconde).toHaveLength(2);
    expect(seconde.filter((p) => p.camp === "monstre")).toHaveLength(1);
    expect(seconde.filter((p) => p.camp === "monstre")[0].nom).toBe("Goule");
  });

  it("gère une quantité nulle ou négative comme une créature", () => {
    const participants = participantsDepuisRencontre([slot("Goule", 0)]);
    expect(participants).toHaveLength(1);
  });
});
