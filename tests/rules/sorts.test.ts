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

  it("sorcier (livre) : 20 sorts, actions et coûts fonctionnels", () => {
    const VOIES_SORCIER = ["Voie du démon", "Voie de la mort", "Voie de l'outre-tombe", "Voie du sang", "Voie de la sombre magie"];
    const sorts = SEED_SORTS.filter((s) => (s.familles ?? []).includes("Sorcier") && VOIES_SORCIER.includes(s.voie ?? ""));
    const parNom = Object.fromEntries(sorts.map((s) => [s.nom, s]));
    // 4 sorts × 5 voies (les 5 talents sans PM restent hors grimoire).
    expect(sorts).toHaveLength(20);
    for (const s of sorts) {
      expect(s.action, `${s.nom} : action manquante`).toBeTruthy();
      expect(s.cout?.montant, `${s.nom} : coût = rang`).toBe(s.rang);
    }
    // Cas du livre.
    expect(parNom["Malédiction"].action).toBe("mouvement");
    expect(parNom["Malédiction"].limiteParCible).toBe(true);
    expect(parNom["Malédiction"].effetMods).toMatchObject({ deMalus: 1 });
    expect(parNom["Beauté de la succube"].type).toBe("utilitaire");
    expect(parNom["Beauté de la succube"].attaqueAccordee?.volDeVie).toBe(true);
    expect(parNom["Aspect du démon"].type).toBe("utilitaire");
    expect(parNom["Aspect du démon"].effetMods).toMatchObject({ defense: 5 });
    expect(parNom["Invocation d'un démon"].invocation?.nom).toBe("Démon");
    expect(parNom["Invocation d'un démon"].coutPV).toBe("1d4°");
    expect(parNom["Baiser du vampire"].volDeVie).toBe(true);
    expect(parNom["Briser les cœurs"].demiDegatsSiRate).toBe(true);
    expect(parNom["Briser les cœurs"].limiteParCible).toBe(true);
    expect(parNom["Ensevelissement"].limiteCombat).toBe(1);
    expect(parNom["Ensevelissement"].effetDegats).toBe("2d4°");
    expect(parNom["Ensevelissement"].degats).toBeUndefined();
    expect(parNom["Saignements"].effetDegats).toBe("1d4°");
    expect(parNom["Saignements"].degats).toBeUndefined();
    expect(parNom["Strangulation"].effetDegats).toBe("1d4°+INT");
    expect(parNom["Rituel de sang"]).toBeTruthy();
    expect(parNom["Rituel de sang"].toucheAuto).toBe(true);
    expect(parNom["Rituel de sang"].coutPV).toBe("1d4°");
    expect(parNom["Armée des morts"].zone).toBe(true);
    expect(parNom["Armée des morts"].limiteCombat).toBe(1);
    expect(parNom["Animation des morts"].invocation?.nom).toBe("Zombie");
    expect(parNom["Un pied dans la tombe"].effetSauvegarde).toEqual({ carac: "CON", difficulte: 10 });
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
