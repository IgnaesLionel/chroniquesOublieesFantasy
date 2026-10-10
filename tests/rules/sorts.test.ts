import { describe, expect, it } from "vitest";
import { sortSchema } from "@/src/lib/data/validation";
import { SEED_SORTS, VOIES_SORTS } from "@/src/lib/data/sorts";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { PROFILS_PAR_FAMILLE, apprendreSort, manaMax } from "@/src/lib/rules/personnage";

const PROFILS = new Set(Object.values(PROFILS_PAR_FAMILLE).flat());

describe("grimoire des sorts (DRS)", () => {
  it("seeds valides, types et coûts cohérents", () => {
    expect(SEED_SORTS.length).toBeGreaterThan(0);
    for (const s of SEED_SORTS) {
      expect(() => sortSchema.parse(s)).not.toThrow();
      if (s.cout) expect(s.cout.montant).toBeGreaterThanOrEqual(0);
      // NB : un sort offensif n'a pas forcément de dégâts (ex. Malédiction : dé malus hors catalogue).
    }
  });

  it("familles = profils lanceurs du DRS", () => {
    for (const s of SEED_SORTS) {
      for (const f of s.familles ?? []) {
        expect(PROFILS.has(f), `${s.nom} : famille inconnue "${f}"`).toBe(true);
      }
    }
    const presentes = new Set(SEED_SORTS.flatMap((s) => s.familles ?? []));
    // Profils avec sorts à PM : Prêtre, Sorcier, Barde, Druide, Ensorceleur, Forgesort, Magicien.
    // Guerrier, Rôdeur, Voleur et Moine n'en ont aucun dans le DRS.
    expect([...presentes].sort()).toEqual(
      ["Barde", "Druide", "Ensorceleur", "Forgesort", "Magicien", "Prêtre", "Sorcier"].sort()
    );
  });

  it("voie + rang renseignés, coût = rang (règle COF, 1 exception DRS)", () => {
    const voies = new Set(VOIES_SORTS);
    for (const s of SEED_SORTS) {
      expect(s.voie, `${s.nom} : voie manquante`).toBeTruthy();
      expect(voies.has(s.voie!), `${s.nom} : voie inconnue "${s.voie}"`).toBe(true);
      expect(s.rang, `${s.nom} : rang manquant`).toBeGreaterThanOrEqual(1);
      expect(s.rang, `${s.nom} : rang > 5`).toBeLessThanOrEqual(5);
      // Rune de garde : rang 5 mais 3 PM via concentration (texte DRS).
      const attendu = s.id === "sort-rune-garde" ? 3 : s.rang;
      expect(s.cout?.montant, `${s.nom} : coût inattendu`).toBe(attendu);
    }
  });

  it("apprendreSort : copie avec nouvel id + mana recalculé (VOL + sorts), full mana et full vie", () => {
    const pretre = SEED_CHARACTERS.find((x) => x.id === "pj-pretre-elfe-haut")!;
    expect(pretre.sorts).toHaveLength(2); // Bénédiction + Récupération mineure (seeds)
    const modele = SEED_SORTS.find((s) => s.id === "sort-sanctuaire")!;
    const blesse = { ...pretre, pv: 2, ressources: { ...pretre.ressources, mana: { max: 4, actuel: 1 } } };
    const r = apprendreSort(blesse, modele);
    expect(r.sorts).toHaveLength(3);
    expect(r.sorts[2].nom).toBe("Sanctuaire");
    expect(r.sorts[2].voie).toBe("Voie de la prière");
    expect(r.sorts[2].id).not.toBe(modele.id);
    expect(modele.id).toBe("sort-sanctuaire"); // le modèle n'est pas muté
    expect(r.ressources.mana.max).toBe(manaMax(2, 3)); // VOL 2 + 3 sorts = 5
    expect(r.ressources.mana).toEqual({ max: 5, actuel: 5 }); // +1 sort => +1 mana, à fond
    expect(r.pv).toBe(r.pvMax); // full vie (niveau)
    const r2 = apprendreSort(r, SEED_SORTS.find((s) => s.id === "sort-benediction")!);
    expect(r2.sorts).toHaveLength(4);
    expect(r2.ressources.mana).toEqual({ max: 6, actuel: 6 });
  });
});
