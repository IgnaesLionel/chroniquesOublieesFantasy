import { describe, expect, it } from "vitest";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import type { ContexteRencontre, SlotRencontre } from "@/src/lib/encounters/types";
import { genererRencontre } from "@/src/lib/encounters/generate";
import { groupeSimplifie } from "@/src/lib/encounters/party";

function contexte(partiel: Partial<ContexteRencontre> = {}): ContexteRencontre {
  return {
    type: "bataille",
    terrain: "plaine",
    surprise: "aucune",
    theme: "toutes",
    inclureV1: false,
    inclureHorsDrs: false,
    ...partiel,
  };
}

function idMonstre(nom: string): string {
  const m = SEED_MONSTERS.find((x) => x.nom === nom);
  if (!m) throw new Error(`Monstre introuvable : ${nom}`);
  return m.id;
}

describe("génération de compositions", () => {
  const groupe = groupeSimplifie(4, 3);

  it("produit plusieurs variantes dans la limite de créatures", () => {
    const res = genererRencontre({
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "normal",
      contexte: contexte(),
      graine: 42,
    });
    expect(res.candidats.length).toBeGreaterThan(0);
    expect(res.candidats.length).toBeLessThanOrEqual(3);
    expect(res.cibleNr).toBe(3);
    for (const c of res.candidats) {
      expect(c.nombreEnnemis).toBeGreaterThan(0);
      expect(c.nombreEnnemis).toBeLessThanOrEqual(12);
      expect(c.pmTotal).toBeGreaterThan(0);
      expect(c.slots.length).toBeGreaterThan(0);
    }
  });

  it("est reproductible avec la même graine", () => {
    const options = {
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "normal" as const,
      contexte: contexte(),
      graine: 1234,
    };
    const a = genererRencontre(options);
    const b = genererRencontre(options);
    expect(a.graine).toBe(1234);
    const cle = (r: typeof a) =>
      r.candidats.map((c) => c.slots.map((s) => `${s.monstreId}:${s.quantite}`).sort().join("|")).join(";");
    expect(cle(a)).toBe(cle(b));
  });

  it("conserve les verrous du MJ", () => {
    const verrous: SlotRencontre[] = [{ monstreId: idMonstre("Gobelin de base"), quantite: 2, verrouille: true }];
    const res = genererRencontre({
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "normal",
      contexte: contexte(),
      verrous,
      graine: 7,
    });
    expect(res.candidats.length).toBeGreaterThan(0);
    expect(res.avertissements.some((a) => /verrouillé/i.test(a))).toBe(true);
    for (const c of res.candidats) {
      const gobelin = c.slots.find((s) => s.monstreId === verrous[0].monstreId);
      expect(gobelin).toBeDefined();
      expect(gobelin?.quantite).toBeGreaterThanOrEqual(2);
    }
  });

  it("en mode boss, cherche une mécanique distinctive", () => {
    const res = genererRencontre({
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "boss",
      contexte: contexte({ type: "boss" }),
      graine: 99,
    });
    expect(res.candidats.length).toBeGreaterThan(0);
    expect(res.candidats.some((c) => c.nombreBoss > 0)).toBe(true);
    expect(res.candidats.some((c) => c.slots.some((s) => s.profil.signature.length > 0))).toBe(true);
  });

  it("respecte le thème demandé", () => {
    const res = genererRencontre({
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "normal",
      contexte: contexte({ theme: "Humains" }),
      graine: 5,
    });
    expect(res.candidats.length).toBeGreaterThan(0);
    for (const c of res.candidats) {
      for (const s of c.slots) {
        const champs = [
          s.profil.template.categorie ?? "",
          s.profil.template.type,
          ...(s.profil.template.sousCategories ?? []),
        ].map((x) => x.toLowerCase());
        expect(champs.some((x) => x.includes("humain"))).toBe(true);
      }
    }
  });

  it("exclut V1 et hors DRS par défaut", () => {
    const res = genererRencontre({
      groupe,
      bestiaire: SEED_MONSTERS,
      difficulte: "normal",
      contexte: contexte(),
      graine: 11,
    });
    for (const c of res.candidats) {
      for (const s of c.slots) expect(s.profil.edition).toBe("cof2");
    }
  });

  it("ne rend jamais une composition vide quand le budget est sous le prix plancher du thème", () => {
    // Régression signalée en usage : avec un thème restreint (« Mort-vivant »,
    // « Démon »), le générateur ne produisait aucune composition et l'interface
    // n'affichait rien. Cause : le budget cible peut être inférieur au prix de
    // la créature la moins chère du filtre (10 Pm pour un mort-vivant, 20 pour
    // un démon). Ici un PJ unique de niveau 1 donne une cible de 2,5 Pm.
    const faible = groupeSimplifie(1, 1);
    for (const theme of ["Mort-vivant", "Démon"]) {
      const res = genererRencontre({
        groupe: faible,
        bestiaire: SEED_MONSTERS,
        difficulte: "normal",
        contexte: contexte({ theme }),
        graine: 42,
      });
      expect(res.candidats.length).toBeGreaterThan(0);
      expect(res.candidats[0].nombreEnnemis).toBeGreaterThan(0);
      expect(res.avertissements.some((a) => /Budget trop serré/i.test(a))).toBe(true);
    }
  });

  it("signale un bestiaire vide au lieu de planter", () => {
    const res = genererRencontre({
      groupe,
      bestiaire: [],
      difficulte: "normal",
      contexte: contexte(),
      graine: 1,
    });
    expect(res.candidats).toHaveLength(0);
    expect(res.avertissements.length).toBeGreaterThan(0);
    expect(res.cibleAtteinte).toBe(false);
  });
});
