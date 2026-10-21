import { describe, expect, it } from "vitest";
import { migrerGrainesPersonnages, SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { preparerStock } from "@/src/lib/store/useLocalCollection";
import type { Character } from "@/src/lib/rules/types";

/**
 * Régression du bug « plein vie après Terminer » : la lecture d'une sauvegarde
 * abîmée (PV baissés en combat) par la page Personnages réécrivait des fiches
 * plein vie. La chaîne de chargement (fusion des graines + migration) doit
 * être incapable de REMONTER un PV, quelle que soit la forme de la fiche.
 */
describe("preparerStock : les PV baissés sont toujours conservés", () => {
  const blesses = (pv: number): Character[] =>
    SEED_CHARACTERS.map((c) => ({ ...c, pv }) as Character);

  it("conserve des PV baissés sur les fiches graines", () => {
    const sortie = preparerStock(blesses(1), SEED_CHARACTERS, migrerGrainesPersonnages);
    expect(sortie.map((p) => p.pv)).toEqual(SEED_CHARACTERS.map(() => 1));
  });

  it("conserve les PV baissés même quand la révision de graine se déclenche", () => {
    // État d'origine des fiches joueur : talents-marqueurs encore présents
    // (Nyssa « Survie », Maë « Saignements ») → la migration les corrige.
    const ancienne = SEED_CHARACTERS.map((c) => {
      const n = { ...c } as Character;
      if (n.id === "pj-rodeur-demi-elfe") {
        n.capacites = ["Survie", ...(n.capacites ?? []).filter((t) => t !== "Le loup")];
        n.sorts = (n.sorts ?? []).filter((s) => s.nom !== "Le loup");
      }
      if (n.id === "pj-sorcier-humain") {
        n.capacites = ["Saignements", "Malédiction", "Maîtrise de la magie"];
      }
      n.pv = 3;
      return n;
    });
    const sortie = preparerStock(ancienne, SEED_CHARACTERS, migrerGrainesPersonnages);
    expect(sortie.find((p) => p.id === "pj-rodeur-demi-elfe")?.pv).toBe(3);
    expect(sortie.find((p) => p.id === "pj-sorcier-humain")?.pv).toBe(3);
    // La correction des talents a bien eu lieu (la migration tourne).
    expect(sortie.find((p) => p.id === "pj-rodeur-demi-elfe")?.capacites).toContain("Le loup");
  });

  it("conserve des PV baissés sur des fiches hors graines (ids inconnus)", () => {
    const maison = SEED_CHARACTERS.map((c, i) => ({ ...c, id: `hors-graine-${i}`, pv: 2 }) as Character);
    const sortie = preparerStock(maison, SEED_CHARACTERS, migrerGrainesPersonnages);
    expect(sortie.filter((p) => p.pv === 2)).toHaveLength(maison.length);
    // Les graines manquantes sont ajoutées à côté, jamais à la place.
    expect(sortie.length).toBeGreaterThan(maison.length);
  });

  it("n'écrit jamais pv = pvMax quand le stock est déjà complet", () => {
    const complet = SEED_CHARACTERS.map((c) => ({ ...c, pv: c.pvMax - 1 }) as Character);
    const sortie = preparerStock(complet, SEED_CHARACTERS, migrerGrainesPersonnages);
    for (const p of sortie) expect(p.pv).toBeLessThan(p.pvMax);
  });

  it("cas utilisateur combiné : anciens noms + marqueurs + dégâts — rien ne remonte", () => {
    // Fiches telles qu'un MJ pouvait encore les avoir : noms d'origine de la
    // graine (Mirabel…), talents-marqueurs non migrés, dégâts de combat. Tous
    // les chemins de migration tournent ENSEMBLE — aucun PV ne doit remonter.
    const anciensNoms: Record<string, string> = {
      "pj-sorcier-humain": "Mirabel",
      "pj-rodeur-demi-elfe": "Faelyn",
      "pj-pretre-elfe-haut": "Aelion",
      "pj-guerrier-nain": "Dorain",
    };
    const blesses: Character[] = SEED_CHARACTERS.map((c) => {
      const n = { ...c, pv: Math.max(1, c.pvMax - 4) } as Character;
      const ancien = anciensNoms[n.id];
      if (ancien) n.nom = ancien;
      if (n.id === "pj-rodeur-demi-elfe") {
        n.capacites = ["Survie", ...(n.capacites ?? []).filter((t) => t !== "Le loup")];
        n.sorts = (n.sorts ?? []).filter((s) => s.nom !== "Le loup");
      }
      if (n.id === "pj-sorcier-humain") {
        n.capacites = ["Saignements", "Malédiction", "Maîtrise de la magie"];
      }
      return n;
    });
    const pvEntrees = new Map(blesses.map((c) => [c.id, c.pv]));
    const sortie = preparerStock(blesses, SEED_CHARACTERS, migrerGrainesPersonnages);
    for (const p of sortie) {
      const avant = pvEntrees.get(p.id);
      if (avant !== undefined) expect(p.pv).toBe(avant); // conservés à l'identique
      expect(p.pv).toBeLessThanOrEqual(p.pvMax);
    }
    // Les chemins de migration ont bien tourné (sinon le test ne prouve rien).
    expect(sortie.find((p) => p.id === "pj-sorcier-humain")?.nom).toBe("Maë");
    expect(sortie.find((p) => p.id === "pj-rodeur-demi-elfe")?.capacites).toContain("Le loup");
  });
});
