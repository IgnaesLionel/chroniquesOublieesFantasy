import { describe, expect, it } from "vitest";
import { CLASSES } from "@/src/lib/data/classes";
import { CAPACITES, actionDeCapacite, actionDeTalent, catalogueCapacites, infererAction, voiesDe } from "@/src/lib/data/capacites";
import { VOIES_PEUPLE, VOIE_MAGE } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { PROFILS_PAR_FAMILLE, REGLES_PROFILS } from "@/src/lib/rules/personnage";

describe("onglet classes (DRS)", () => {
  it("14 profils, familles cohérentes avec les règles", () => {
    expect(CLASSES).toHaveLength(14);
    const attendus = Object.values(PROFILS_PAR_FAMILLE).flat();
    expect(CLASSES.map((c) => c.profil).sort()).toEqual([...attendus].sort());
    for (const c of CLASSES) {
      expect(REGLES_PROFILS[c.profil]?.famille, `${c.profil} : famille incohérente`).toBe(c.famille);
      expect(c.sourceUrl).toMatch(/^https:\/\/drs\.chroniques-oubliees\.fr\/fantasy\/profils\//);
    }
  });

  it("5 voies uniques par classe", () => {
    for (const c of CLASSES) {
      expect(c.voies, `${c.profil}`).toHaveLength(5);
      expect(new Set(c.voies).size, `${c.profil} : doublon`).toBe(5);
    }
    // 70 noms de voies au total, tous distincts.
    const toutes = CLASSES.flatMap((c) => c.voies);
    expect(new Set(toutes).size).toBe(70);
  });

  it("chaque sort du grimoire rattache voie + famille à une classe (ou à une voie du peuple)", () => {
    const voiesPeuple = new Map([...VOIES_PEUPLE, VOIE_MAGE].map((v) => [v.voie, v]));
    for (const s of SEED_SORTS) {
      const porteuses = CLASSES.filter(
        (c) => c.voies.includes(s.voie!) && (s.familles ?? []).includes(c.profil)
      );
      const voiePeuple = voiesPeuple.get(s.voie!);
      if (voiePeuple) {
        // Sort de voie du peuple/mage : la voie existe (familles vérifiées par ailleurs).
        expect(s.familles!.length, `${s.nom} : sans famille`).toBeGreaterThan(0);
      } else {
        expect(porteuses.length, `${s.nom} : voie/famille orpheline`).toBeGreaterThanOrEqual(1);
      }
    }
    expect(voiesPeuple.get("Voie du mage")).toBe(VOIE_MAGE);
  });

  it("infererAction : A/M/L/G depuis le résumé, passifs sans action", () => {
    expect(infererAction("Bouclier requis. Action gratuite : +2 DEF à un allié.")).toBe("gratuite");
    expect(infererAction("Action limitée : deux attaques au contact.")).toBe("limitee");
    expect(infererAction("Action de mouvement : posture défensive.")).toBe("mouvement");
    expect(infererAction("Action d'attaque : sournoise contre surpris.")).toBe("attaque");
    expect(infererAction("Dé malus en attaque au contact pour +2d4 DM.")).toBeUndefined();
    expect(infererAction("FOR +1 et dé bonus aux tests de FOR.")).toBeUndefined();
    // Un passif peut parler de mouvement sans être une action de mouvement.
    expect(infererAction("Passif : +3 Init et +1 mouvement/combat.")).toBeUndefined();
    expect(infererAction("+2 DEF, se relever en mouvement.")).toBeUndefined();
    // Le premier marqueur gagne : (M) de base, (G) seulement au rang 5.
    expect(infererAction("Bouclier requis. (M) : posture. Rang 5 : (G) 1/round.")).toBe("mouvement");
  });

  it("actionDeCapacite / actionDeTalent : sort lié, résumé et passifs", () => {
    const toutes = Object.values(CAPACITES).flatMap((voies) => voies.flatMap((v) => v.capacites));
    const souplesse = toutes.find((c) => c.nom === "Souplesse du félin");
    expect(souplesse).toBeTruthy();
    expect(actionDeCapacite(souplesse!)).toBeUndefined();

    // Rétablissement n'a pas de marqueur dans son résumé : l'action vient du sort lié.
    const retablissement = toutes.find((c) => c.nom === "Rétablissement");
    expect(retablissement).toBeTruthy();
    expect(actionDeCapacite(retablissement!)).toBe("limitee");

    expect(actionDeTalent("Protéger un allié", "Guerrier")).toBe("gratuite");
    expect(actionDeTalent("Parer un coup", "Guerrier")).toBe("mouvement");
    expect(actionDeTalent("Souplesse du félin")).toBeUndefined();
    expect(actionDeTalent("Rétablissement")).toBe("limitee");
  });

  it("catalogueCapacites : tous les talents non-sorts, ids uniques", () => {
    const total = Object.values(CAPACITES).flatMap((voies) => voies.flatMap((v) => v.capacites)).length;
    expect(total).toBe(350);
    const catalogue = catalogueCapacites();
    // Capacités des voies de profils moins celles déjà au grimoire
    // (les sorts de la Voie du mage, hors profils, n'en font pas partie).
    const sortsProfils = Object.values(CAPACITES)
      .flatMap((voies) => voies.flatMap((v) => v.capacites))
      .filter((c) => c.sortId).length;
    expect(catalogue.length).toBe(total - sortsProfils);
    const ids = catalogue.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of catalogue) {
      expect(c.nom.length).toBeGreaterThan(0);
      expect(c.rang).toBeGreaterThanOrEqual(1);
      expect(c.rang).toBeLessThanOrEqual(5);
    }
    // L'exemple demandé : Protéger un allié, action gratuite.
    const proteger = catalogue.find((c) => c.nom === "Protéger un allié");
    expect(proteger).toBeTruthy();
    expect(proteger!.profil).toBe("Guerrier");
    expect(proteger!.voie).toBe("Voie du bouclier");
    expect(proteger!.rang).toBe(1);
    expect(proteger!.action).toBe("gratuite");
  });
  it("capacités : 5 voies × 5 rangs par profil, rangs 1-5", () => {
    expect(Object.keys(CAPACITES).sort()).toEqual(CLASSES.map((c) => c.profil).sort());
    for (const c of CLASSES) {
      const voies = voiesDe(c.profil);
      expect(voies.map((v) => v.voie), c.profil).toEqual([...c.voies]);
      for (const v of voies) {
        expect(v.capacites.map((x) => x.rang), `${c.profil} / ${v.voie}`).toEqual([1, 2, 3, 4, 5]);
        for (const cap of v.capacites) {
          expect(cap.nom.length, `${c.profil} / ${v.voie} R${cap.rang}`).toBeGreaterThan(0);
          expect(cap.resume.length, `${cap.nom} : résumé vide`).toBeGreaterThan(0);
        }
      }
    }
    expect(voiesDe("Inexistant")).toEqual([]);
  });

  it("cohérence grimoire ↔ capacités (sortId bidirectionnel, voies de peuple incluses)", () => {
    const parId = new Map(SEED_SORTS.map((s) => [s.id, s]));
    const toutesVoies: { proprietaire: string; voie: string; capacites: { nom: string; rang: number; sortId?: string }[] }[] = [
      ...Object.entries(CAPACITES).flatMap(([profil, voies]) => voies.map((v) => ({ proprietaire: profil, ...v }))),
      ...VOIES_PEUPLE.map((v) => ({ proprietaire: v.peuple, voie: v.voie, capacites: v.capacites })),
      { proprietaire: "Voie du mage", voie: VOIE_MAGE.voie, capacites: VOIE_MAGE.capacites },
    ];
    let lies = 0;
    for (const { proprietaire, voie, capacites } of toutesVoies) {
      for (const cap of capacites) {
        if (!cap.sortId) continue;
        lies += 1;
        const sort = parId.get(cap.sortId);
        expect(sort, `${proprietaire} / ${cap.nom} : sortId inconnu`).toBeTruthy();
        expect(sort!.voie, `${cap.nom} : voie divergente`).toBe(voie);
        expect(sort!.nom, `${cap.sortId} : nom divergent`).toBe(cap.nom);
        expect(sort!.rang, `${cap.nom} : rang divergent`).toBe(cap.rang);
      }
    }
    // Tout sort du grimoire est référencé par exactement une capacité.
    const references = new Map<string, number>();
    for (const { capacites } of toutesVoies) {
      for (const cap of capacites) {
        if (cap.sortId) references.set(cap.sortId, (references.get(cap.sortId) ?? 0) + 1);
      }
    }
    for (const s of SEED_SORTS) {
      expect(references.get(s.id) ?? 0, `${s.nom} : non référencé par les voies`).toBe(1);
    }
    expect(lies).toBe(SEED_SORTS.length);
  });
});
