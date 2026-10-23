import { describe, expect, it } from "vitest";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import {
  cacheProfils,
  dprDepuisAttaques,
  editionDepuisMonstre,
  facteurResistance,
  indiceControle,
  indiceSoutien,
  profilDepuisMonstre,
} from "@/src/lib/encounters/roles";

function monstre(nom: string): MonsterTemplate {
  const m = SEED_MONSTERS.find((x) => x.nom === nom);
  if (!m) throw new Error(`Monstre de test introuvable : ${nom}`);
  return m;
}

describe("profils tactiques des créatures", () => {
  it("dérive l'édition sans mélanger COF2, COF1 et hors DRS", () => {
    expect(editionDepuisMonstre(monstre("Bandit de base"))).toBe("cof2");
    expect(editionDepuisMonstre(monstre("Araignée géante"))).toBe("cof1");
    expect(editionDepuisMonstre(monstre("Arbre animé"))).toBe("hors-drs");
  });

  it("normalise les attaques, distances et moyennes de dégâts", () => {
    const p = profilDepuisMonstre(monstre("Bandit de base"));
    expect(p.nc).toBe(0.5);
    expect(p.attaques.length).toBeGreaterThanOrEqual(2);
    expect(p.attaques.some((a) => a.distance)).toBe(true);
    expect(p.dprReference).toBeGreaterThan(0);
    expect(p.attaqueSoutenue).not.toBeNull();
    expect(p.meilleureAttaque).not.toBeNull();
    expect(p.avertissements).toEqual([]);
  });

  it("détecte les résistances sans inventer de valeur", () => {
    const squelette = profilDepuisMonstre(monstre("Squelette"));
    expect(squelette.facteurDegatsSubis).toBeLessThan(1);
    expect(squelette.rd).toBe(0);
    expect(squelette.avertissements).toEqual([]);
    const zombie = profilDepuisMonstre(monstre("Zombie humain"));
    expect(zombie.facteurDegatsSubis).toBeLessThan(1);
  });

  it("repère un boss par sa mécanique, pas seulement ses PV", () => {
    const vampire = profilDepuisMonstre(monstre("Vampire ancien"));
    expect(vampire.candidatBoss).toBe(true);
    expect(vampire.signature.length).toBeGreaterThan(0);
    expect(vampire.roles).toContain("boss");

    const momie = profilDepuisMonstre(monstre("Momie auguste"));
    expect(momie.candidatBoss).toBe(true);
    expect(momie.signature.join(" ")).toMatch(/Injonction/i);
  });

  it("signale une fiche sans attaque au lieu de fabriquer un profil", () => {
    const arbre = profilDepuisMonstre(monstre("Arbre animé"));
    expect(arbre.attaques).toHaveLength(0);
    expect(arbre.dprReference).toBe(0);
    expect(arbre.avertissements.some((a) => /Aucune attaque/i.test(a))).toBe(true);
  });

  it("indices de contrôle et de soutien dérivés des textes", () => {
    expect(indiceControle("Paralysie : CON 10 ou paralysée 1d6 rounds")).toBeGreaterThanOrEqual(0.5);
    expect(indiceControle("Soutien")).toBe(0);
    expect(indiceSoutien("Guérison accélérée : 5 PV par round")).toBeGreaterThan(0);
    expect(facteurResistance("Résistance aux DM : DM divisés par 2 sauf armes tranchantes")).toBeLessThan(1);
  });

  it("le DPR baisse quand la DEF augmente", () => {
    const p = profilDepuisMonstre(monstre("Ogre"));
    const bas = dprDepuisAttaques(p.attaques, 12);
    const haut = dprDepuisAttaques(p.attaques, 22);
    expect(bas).toBeGreaterThan(haut);
  });

  it("cache les profils par identifiant", () => {
    const cache = cacheProfils(SEED_MONSTERS);
    expect(cache.size).toBe(SEED_MONSTERS.length);
    expect(cache.get(monstre("Gobelin de base").id)?.nom).toBe("Gobelin de base");
  });

  it("ne confond pas commandement et soins dans la régénération", () => {
    // Régression : le « soutien » mélange soins, commandement et invocation.
    // Un chef qui commande ne rend PAS de PV ; seule une capacité de soin
    // réelle alimente la régénération.
    const chef = profilDepuisMonstre(monstre("Chef Gobelin"));
    expect(chef.soutien).toBeGreaterThanOrEqual(0.25); // commandement détecté
    expect(chef.regeneration).toBe(0); // mais aucun soin

    const momie = profilDepuisMonstre(monstre("Momie auguste"));
    expect(momie.regeneration).toBeGreaterThan(0);

    // Une créature sans mot-clé de soin ne régénère pas.
    expect(profilDepuisMonstre(monstre("Ogre")).regeneration).toBe(0);
  });

  it("mesure la part des dégâts issue du vol de vie", () => {
    const sorcier = profilDepuisMonstre(monstre("Sorcier"));
    expect(sorcier.partVolDeVie).toBeGreaterThan(0);
    expect(sorcier.partVolDeVie).toBeLessThanOrEqual(1);

    const orc = profilDepuisMonstre(monstre("Orc de base"));
    expect(orc.partVolDeVie).toBe(0);
  });
});
