import { describe, expect, it } from "vitest";
import {
  basculerVerrou,
  estimerCombat,
  genererPnj,
  regenererChamp,
  validerPnj,
} from "@/src/lib/npcgen/engine";
import { SEED_ENTRIES, SEED_FACTIONS, SEED_PROFILES, SEED_TABLES } from "@/src/lib/npcgen/seeds";
import { TABLE_IDS, type NpcGenerationOptions } from "@/src/lib/npcgen/types";

const data = {
  tables: SEED_TABLES,
  entries: SEED_ENTRIES,
  factions: SEED_FACTIONS,
  profiles: SEED_PROFILES,
};

function generer(options: NpcGenerationOptions = {}) {
  return genererPnj({ seed: "graine-test", detail: "detaille", ...options }, data);
}

describe("graines du générateur de PNJ", () => {
  it("couvre chaque table et n'a aucun identifiant dupliqué", () => {
    const ids = new Set<string>();
    SEED_ENTRIES.forEach((e) => {
      expect(ids.has(e.id), `identifiant dupliqué : ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(SEED_TABLES.some((t) => t.id === e.tableId), `table inconnue : ${e.tableId}`).toBe(true);
    });
    expect(new Set(SEED_TABLES.map((t) => t.id)).size).toBe(SEED_TABLES.length);
    expect(new Set(SEED_FACTIONS.map((f) => f.id)).size).toBe(SEED_FACTIONS.length);
    expect(new Set(SEED_PROFILES.map((p) => p.id)).size).toBe(SEED_PROFILES.length);
    Object.values(TABLE_IDS).forEach((id) => {
      expect(SEED_TABLES.some((t) => t.id === id), `table manquante : ${id}`).toBe(true);
    });
    Object.values(TABLE_IDS)
      .filter((id) => id !== TABLE_IDS.reglesCompatibilite)
      .forEach((id) => {
        expect(SEED_ENTRIES.some((e) => e.tableId === id), `table vide : ${id}`).toBe(true);
      });
  });

  it("livre des factions et profils utilisables", () => {
    expect(SEED_FACTIONS.length).toBeGreaterThanOrEqual(8);
    expect(SEED_PROFILES.length).toBeGreaterThanOrEqual(8);
    expect(SEED_PROFILES.every((p) => p.actif)).toBe(true);
  });
});

describe("moteur de génération", () => {
  it("génère une fiche narrative complète et déterministe", () => {
    const a = generer({ seed: "deterministe" });
    const b = generer({ seed: "deterministe" });
    expect(a.npc.nom).not.toBe("");
    expect(a.npc.profession).not.toBe("");
    expect(a.npc.description.length).toBeGreaterThan(20);
    expect(a.npc.personnalite.traitsPositifs.length).toBeGreaterThan(0);
    expect(a.npc.motivations.secret).not.toBe("");
    expect(a.npc.roleplay.accroche).not.toBe("");
    expect(a.npc.equipement.length).toBeGreaterThan(0);
    expect(a.npc.nom).toBe(b.npc.nom);
    expect(a.npc.profession).toBe(b.npc.profession);
    expect(a.npc.motivations.secret).toBe(b.npc.motivations.secret);
    expect(a.npc.personnalite).toEqual(b.npc.personnalite);
    expect(a.statBlock).toBeUndefined();
  });

  it("respecte les critères explicites", () => {
    const resultat = generer({
      seed: "criteres",
      sexe: "feminin",
      culture: "Nordique",
      profession: "Garde",
      importance: "important",
      lieu: "Les docks au petit matin",
    });
    expect(resultat.npc.sexe).toBe("feminin");
    expect(resultat.npc.culture).toBe("Nordique");
    expect(resultat.npc.profession).toBe("Garde");
    expect(resultat.npc.importance).toBe("important");
    expect(resultat.npc.lieu).toBe("Les docks au petit matin");
    expect(resultat.npc.prenom).not.toBe("");
  });

  it("applique les règles d'exclusion (mendiant sans objets de valeur)", () => {
    for (let i = 0; i < 25; i += 1) {
      const resultat = generer({ seed: `mendiant-${i}`, profession: "Mendiant", detail: "detaille" });
      expect(resultat.npc.profession).toBe("Mendiant");
      expect(resultat.npc.objetsValeurs).toEqual([]);
      expect(resultat.npc.objetsMagiques).toEqual([]);
    }
  });

  it("conserve les champs verrouillés lors d'une régénération globale", () => {
    const base = generer({ seed: "verrou-base" }).npc;
    const verrouille = basculerVerrou(base, "prenom");
    const resultat = genererPnj(
      {
        seed: "verrou-nouveau",
        base: verrouille,
        verrous: ["prenom", "profession"],
      },
      data
    );
    expect(resultat.npc.prenom).toBe(base.prenom);
    expect(resultat.npc.profession).toBe(base.profession);
  });

  it("régénère un seul champ sans toucher au reste", () => {
    const base = generer({ seed: "champ-base" }).npc;
    const resultat = regenererChamp(base, "voix", data, { seed: "champ-nouveau" });
    expect(resultat.npc.prenom).toBe(base.prenom);
    expect(resultat.npc.profession).toBe(base.profession);
    expect(resultat.npc.motivations.secret).toBe(base.motivations.secret);
    expect(resultat.npc.roleplay.accroche).toBe(base.roleplay.accroche);
    expect(resultat.npc.updatedAt).not.toBe("");
  });

  it("permet de régénérer un métier issu d'un profil", () => {
    const profil = SEED_PROFILES.find((p) => p.nom === "Garde en patrouille")!;
    const base = generer({ seed: "profil-regen", profileId: profil.id }).npc;
    const professions = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      professions.add(regenererChamp(base, "profession", data, { seed: `profil-regen-${i}` }).npc.profession);
    }
    expect(professions.size).toBeGreaterThan(1);
  });

  it("régénère le champ ciblé même s'il est verrouillé", () => {
    const base = generer({ seed: "verrou-champ-base" }).npc;
    const verrouille = basculerVerrou(base, "profession");
    const professions = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      professions.add(
        regenererChamp(verrouille, "profession", data, { seed: `verrou-champ-${i}` }).npc.profession
      );
    }
    expect(professions.size).toBeGreaterThan(1);
  });

  it("régénère un champ même si les critères du formulaire l'imposent encore", () => {
    const profil = SEED_PROFILES.find((p) => p.nom === "Garde en patrouille")!;
    const base = generer({ seed: "critere-regen", profileId: profil.id }).npc;
    const professions = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const resultat = regenererChamp(base, "profession", data, {
        ...profil.options,
        tags: [...profil.tags, ...(profil.options.tags ?? [])],
        seed: `critere-regen-${i}`,
        profession: "Garde",
      });
      professions.add(resultat.npc.profession);
    }
    expect(professions.size).toBeGreaterThan(1);
  });

  it("ignore un critère forcé dont l'entrée est inactive", () => {
    const entriesInactives = SEED_ENTRIES.map((e) =>
      e.tableId === TABLE_IDS.professions && e.valeur === "Garde" ? { ...e, actif: false } : e
    );
    const resultat = genererPnj(
      { seed: "critere-inactif", profession: "Garde" },
      { ...data, entries: entriesInactives }
    );
    expect(resultat.warnings.some((w) => w.includes("Garde") && w.includes("inactive"))).toBe(true);
    expect(resultat.npc.profession).not.toBe("Garde");
  });

  it("trace un lieu forcé comme choix manuel", () => {
    const resultat = generer({ seed: "lieu-force", lieu: "Les docks au petit matin" });
    expect(resultat.npc.lieu).toBe("Les docks au petit matin");
    expect(resultat.npc.champs.lieu?.mode).toBe("manuel");
    expect(resultat.npc.champs.lieu?.sourceTableId).toBe(TABLE_IDS.lieux);
  });

  it("gère une table absente ou vide sans planter", () => {
    const sansTables = genererPnj({ seed: "vide" }, { tables: [], entries: [] });
    expect(sansTables.npc.nom).toBe("PNJ sans nom");
    expect(sansTables.warnings.length).toBeGreaterThan(3);

    const tablesInactives = SEED_TABLES.map((t) =>
      t.id === TABLE_IDS.especes ? { ...t, actif: false } : t
    );
    const resultat = genererPnj(
      { seed: "inactive", espece: "Humain" },
      { tables: tablesInactives, entries: SEED_ENTRIES, factions: [] }
    );
    expect(resultat.npc.espece).toBe("");
    expect(resultat.warnings.some((w) => w.includes("Espèces"))).toBe(true);
  });

  it("produit un bloc de combat explicitement estimé, jamais officiel", () => {
    const resultat = generer({
      seed: "combat",
      genererCombat: true,
      palierPuissance: "elite",
      importance: "majeur",
    });
    expect(resultat.statBlock).toBeDefined();
    expect(resultat.statBlock?.source).toBe("estimation");
    expect(resultat.statBlock?.palier).toBe("elite");
    expect(resultat.statBlock?.pv).toBe(55);
    expect(resultat.statBlock?.notes).toContain("pas une règle officielle COF2");
    expect(resultat.npc.statBlockId).toBe(resultat.statBlock?.id);
  });

  it("peut estimer un combat a posteriori sans changer la fiche", () => {
    const base = generer({ seed: "combat-apres" }).npc;
    const bloc = estimerCombat(base, "moyen", data);
    expect(bloc.npcId).toBe(base.id);
    expect(bloc.source).toBe("estimation");
    expect(base.statBlockId).toBeUndefined();
  });

  it("signale les incohérences sans bloquer l'édition", () => {
    const npc = generer({ seed: "validation" }).npc;
    const modifie = { ...npc, nom: "", age: -4, profession: "" };
    const problemes = validerPnj(modifie, SEED_TABLES, SEED_ENTRIES);
    expect(problemes.some((p) => p.includes("nom"))).toBe(true);
    expect(problemes.some((p) => p.includes("profession"))).toBe(true);
    expect(problemes.some((p) => p.includes("âge"))).toBe(true);
  });

  it("utilise les profils comme point de départ", () => {
    const profil = SEED_PROFILES.find((p) => p.nom === "Garde en patrouille")!;
    const resultat = generer({ seed: "profil", profileId: profil.id });
    expect(resultat.npc.profession).toBe("Garde");
    expect(resultat.npc.importance).toBe("secondaire");
    expect(resultat.npc.tags).toContain("ville");
    expect(resultat.statBlock).toBeDefined();
  });

  it("ignore un profil désactivé sans casser la génération", () => {
    const profil = SEED_PROFILES.find((p) => p.nom === "Garde en patrouille")!;
    const resultat = genererPnj(
      { seed: "profil-inactif", profileId: profil.id },
      { ...data, profiles: [{ ...profil, actif: false }] }
    );
    expect(resultat.warnings.some((w) => w.includes("inactif"))).toBe(true);
    expect(resultat.npc.nom).not.toBe("");
  });
});
