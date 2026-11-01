import { describe, expect, it } from "vitest";
import { CAPACITES } from "@/src/lib/data/capacites";
import { CAPACITES_USABLES, estLancable, usageTalent } from "@/src/lib/data/capacites-usables";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { createEffect } from "@/src/lib/rules/effects/effects";

describe("couverture des capacités et des sorts", () => {
  it("chaque capacité de profil reçoit un usage, actif ou passif explicite", () => {
    for (const [profil, voies] of Object.entries(CAPACITES)) {
      for (const voie of voies) {
        for (const c of voie.capacites) {
          const u = usageTalent(c.nom, profil);
          expect(u, `${profil} / ${voie.voie} / ${c.nom}`).toBeDefined();
          if (u?.mode === "actif") {
            expect(estLancable(u), `${profil} / ${c.nom} doit être lançable`).toBe(true);
          }
        }
      }
    }
  });

  it("les talents gérés par le panneau Attaque ne polluent pas le panneau Capacités", () => {
    expect(usageTalent("Attaque puissante")?.mode).toBe("narratif");
    expect(usageTalent("Charge")?.mode).toBe("narratif");
    expect(usageTalent("Attaque bondissante")?.mode).toBe("narratif");
    expect(usageTalent("Maître du poison")?.mode).toBe("narratif");
  });

  it("les réactions et actions narratives restent utilisables avec validation MJ", () => {
    for (const nom of ["Résistance à la magie", "Défier la mort", "Esquive acrobatique", "Démolition"]) {
      const u = usageTalent(nom);
      expect(u?.mode, nom).toBe("actif");
      expect(estLancable(u), nom).toBe(true);
      expect(u?.questionMJ, nom).toBeTruthy();
    }
  });

  it("les passifs explicites ne sont jamais proposés comme actions", () => {
    for (const nom of ["Armure d'os", "Exsangue"]) {
      expect(usageTalent(nom)?.mode, nom).toBe("passif");
      expect(estLancable(usageTalent(nom)), nom).toBe(false);
    }
  });

  it("les talents à dégâts automatiques sont mécanisés", () => {
    for (const nom of ["Fureur du dragon", "Mon armure est une arme"]) {
      const u = usageTalent(nom);
      expect(u?.degats, nom).toBeTruthy();
      expect(estLancable(u), nom).toBe(true);
    }
  });

  it("chaque sort possède un effet, une invocation ou un marqueur lançable", () => {
    for (const s of SEED_SORTS) {
      const mecanise = !!(
        s.effetCle ||
        s.degats ||
        s.effetDegats ||
        s.soin ||
        s.invocation ||
        s.attaqueAccordee ||
        s.zonePersistante ||
        s.rituelHorsCombat ||
        s.nettoie ||
        s.toucheAuto
      );
      expect(mecanise, `${s.id} (${s.nom})`).toBe(true);
    }
  });

  it("un marqueur de sort inconnu conserve son nom et sa description", () => {
    const e = createEffect("marqueur:sort-test", {
      nom: "Sort de test",
      description: "Description du sort.",
      dureeTours: 3,
    });
    expect(e.nom).toBe("Sort de test");
    expect(e.description).toBe("Description du sort.");
    expect(e.dureeTours).toBe(3);
  });

  it("les usages explicites restent uniques après les fusions", () => {
    const noms = CAPACITES_USABLES.map((u) => u.talent.toLowerCase());
    expect(new Set(noms).size).toBe(noms.length);
  });
});
