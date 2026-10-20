import { describe, expect, it } from "vitest";
import { monsterSchema } from "@/src/lib/data/validation";
import { parseDiceExpression } from "@/src/lib/rules/dice/roller";
import { SEED_MONSTERS } from "@/src/lib/data/seeds";
import { monsterInstances } from "@/src/lib/rules/combat/factory";
import { CAPACITES_PARTAGEES } from "@/src/lib/data/capacites-partagees";
import { AURAS_DEBUT_COMBAT } from "@/src/lib/data/auras-combat";

const CATALOG = new Set(CAPACITES_PARTAGEES.map((c) => c.cle));

describe("bestiaire Notion importé", () => {
  it("95 créatures valides au schéma", () => {
    expect(SEED_MONSTERS.length).toBeGreaterThanOrEqual(90);
    for (const m of SEED_MONSTERS) {
      expect(() => monsterSchema.parse(m), m.id).not.toThrow();
    }
  });

  it("IDs uniques, PV/défense cohérents", () => {
    const ids = SEED_MONSTERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of SEED_MONSTERS) {
      expect(m.pv, m.id).toBeLessThanOrEqual(m.pvMax);
      expect(m.pvMax, m.id).toBeGreaterThan(0);
    }
  });

  it("tous les dégâts passent le parser du moteur (combat sans crash)", () => {
    const sansAttaque = SEED_MONSTERS.filter((m) => m.attaques.length === 0).map((m) => m.id);
    expect(sansAttaque).toEqual(["notion-druid-arbre-anime"]);
    for (const m of SEED_MONSTERS) {
      for (const a of m.attaques) {
        expect(() => parseDiceExpression(a.degats), `${m.id}/${a.nom}: ${a.degats}`).not.toThrow();
      }
    }
  });

  it("références partagées résolues dans le catalogue", () => {
    for (const m of SEED_MONSTERS) {
      for (const ref of m.capacitesPartagees ?? []) {
        expect(CATALOG.has(ref), `${m.id} -> ${ref}`).toBe(true);
      }
    }
  });

  it("catalogue partagé : clés uniques (doublon = clé React dupliquée)", () => {
    const cles = CAPACITES_PARTAGEES.map((c) => c.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("vérification DRS : Chimère/Gorille PV, Ours brun NC, RD renseignées", () => {
    const chimere = SEED_MONSTERS.find((m) => m.id === "notion-nc-7-chimere")!;
    expect(chimere.pvMax).toBe(100); // DRS (la capture VTT affichait 0)
    const gorille = SEED_MONSTERS.find((m) => m.id === "notion-nc-3-gorille")!;
    expect(gorille.pvMax).toBe(30); // DRS (la capture VTT affichait 0)
    const ours = SEED_MONSTERS.find((m) => m.id === "notion-nc-2-ours-brun")!;
    expect(ours.niveau).toBe(4); // VTT + DRS (titre Notion : NC 2)
    // RD du DRS (l'import Notion les laissait à 0 : format « — RD X »).
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-2-demonet")!.rd).toBe(5);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-9-geant-de-feu")!.rd).toBe(6);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-5-troll")!.rd).toBe(3);
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-4-vampirien")!.rd).toBe(5);
  });

  it("vérification DRS : Chasseur ailé et Zombie ourhible (créatures DRS ajoutées)", () => {
    const chasseur = SEED_MONSTERS.find((m) => m.id === "notion-chasseur-aile")!;
    expect(chasseur.niveau).toBe(5);
    expect(chasseur.defense).toBe(18);
    expect(chasseur.pvMax).toBe(50);
    expect(chasseur.attaques[0]).toMatchObject({ nom: "Serres", bonus: 10, degats: "2d6+6" });
    expect(chasseur.capacitesPartagees).toContain("enlevement");
    const zomb = SEED_MONSTERS.find((m) => m.id === "notion-zombie-ourhible")!;
    expect(zomb.niveau).toBe(4);
    expect(zomb.defense).toBe(13);
    expect(zomb.pvMax).toBe(85);
    expect(zomb.attaques[0]).toMatchObject({ nom: "Bec et griffes", bonus: 12, degats: "2d8+10" });
    expect(zomb.capacitesPartagees).toEqual(
      expect.arrayContaining(["sans-esprit", "lenteur", "insensible-douleur", "resistance-zombie"]));
  });
  it("spot checks : Aigle et Gobelin de base", () => {    const aigle = SEED_MONSTERS.find((m) => m.id === "notion-nc-0-5-aigle")!;
    expect(aigle.pv).toBe(3);
    expect(aigle.defense).toBe(13);
    expect(aigle.attaques[0]).toMatchObject({ nom: "Serres", bonus: 3, degats: "1d4" });
    expect(aigle.capacitesPartagees).toContain("vol-rapide");
    const gob = SEED_MONSTERS.find((m) => m.id === "notion-nc-0-gobelin-de-base")!;
    expect(gob.niveau).toBe(0);
    expect(gob.capacitesPartagees).toContain("attaque-en-meute");
  });

  it("Sigméus : Baiser du vampire = attaque à vol de vie, Effroi = aura de début de combat", () => {
    const sigmeus = SEED_MONSTERS.find((m) => m.id === "notion-sigmeus-le-necromant")!;
    // Sort (L) modélisé comme attaque : le moteur soigne le lanceur des DM infligés.
    expect(sigmeus.attaques.find((a) => a.nom === "Baiser du vampire (L)"))
      .toMatchObject({ bonus: 10, degats: "2d6", action: "limitee", volDeVie: true, seuilPv: 0.5 });
    // Effroi : automatique au début du combat (test de SAG diff. 10), ce n'est
    // pas un talent lancable depuis le panneau Capacités.
    expect(sigmeus.capacites).toContain("Effroi");
    expect(AURAS_DEBUT_COMBAT.some((a) => a.capacite === "Effroi" && a.carac === "PER" && a.difficulte === 10)).toBe(true);
  });

  it("Shaman Gobelin : pouvoir magique nommé « Morsure des Ancêtres » (2d6, 30 m, cible unique)", () => {
    const shaman = SEED_MONSTERS.find((m) => m.id === "notion-nc-1-shaman-gobelin")!;
    const pouvoir = shaman.attaques.find((a) => a.nom === "Morsure des Ancêtres")!;
    expect(pouvoir).toBeDefined();
    // Pouvoir de créature : jet d'attaque, 2d6, portée 30 m — ni mana ni rang de voie.
    expect(pouvoir).toMatchObject({ bonus: 4, degats: "2d6", degatsAffiche: "2d6 (30 m)" });
    expect(pouvoir.action).toBeUndefined();
    // Le nom générique partagé par d'autres créatures a disparu de cette fiche.
    expect(shaman.attaques.some((a) => a.nom === "Attaque magique")).toBe(false);
    // Le nom est aussi visible sur la fiche (capacités détaillées).
    expect(shaman.capacitesDetails?.some((c) => c.nom === "Morsure des Ancêtres")).toBe(true);
  });

  it("Sorcier NC 5 : Vampirisation (L) en attaque à vol de vie, « Animer un cadavre » lançable", () => {
    const sorcier = SEED_MONSTERS.find((m) => m.id === "notion-nc-5-sorcier")!;
    const vampirisation = sorcier.attaques.find((a) => a.nom === "Vampirisation (L)")!;
    expect(vampirisation).toMatchObject({
      bonus: 10, degats: "2d8", degatsAffiche: "2d8 (30 m)",
      action: "limitee", volDeVie: true, exigeVivant: true,
    });
    // Capacités listées sans le suffixe « (Capacité) » (transcriptions gardées
    // dans les capacités détaillées) : « Animer un cadavre » est reconnaissable
    // par le panneau Capacités (CAPACITES_USABLES, action « animer »).
    expect(sorcier.capacites).toEqual(
      expect.arrayContaining(["Soutenir", "Vampirisation", "Animer un cadavre", "Pas de l'ombre"]));
    expect(sorcier.capacites?.some((c) => c.includes("(Capacité)"))).toBe(false);
    expect(sorcier.capacitesDetails?.some((c) => c.nom === "Animer un cadavre (Capacité)")).toBe(true);
  });

  it("Shaman orc NC 3 : mêmes pouvoirs (Vampirisation +6 à vol de vie, Animer un cadavre)", () => {
    const shaman = SEED_MONSTERS.find((m) => m.id === "notion-nc-3-shaman-orc")!;
    expect(shaman.attaques.find((a) => a.nom === "Vampirisation (L)"))
      .toMatchObject({ bonus: 6, degats: "2d8", action: "limitee", volDeVie: true, exigeVivant: true });
    expect(shaman.capacites).toEqual(expect.arrayContaining(["Soutenir", "Vampirisation", "Animer un cadavre"]));
    expect(shaman.capacites?.some((c) => c.includes("(Capacité)"))).toBe(false);
  });

  it("caracs : les 99 fiches renseignées (aucune sans source)", () => {
    // Toutes les créatures ont leurs stats (DRS Fantasy ou source MJ).
    // Toute nouvelle fiche sans stats fera échouer ce test : la compléter,
    // jamais de valeurs inventées.
    const SANS_SOURCE: string[] = [];
    const sans = SEED_MONSTERS.filter((m) => !m.caracteristiques);
    expect(sans.map((m) => m.nom).sort()).toEqual([...SANS_SOURCE].sort());
    const CLES = ["AGI", "CON", "FOR", "PER", "CHA", "INT", "VOL"];
    for (const m of SEED_MONSTERS) {
      if (!m.caracteristiques) continue;
      for (const c of CLES) expect(typeof m.caracteristiques[c], `${m.id}.${c}`).toBe("number");
    }
    // Cas du rapport : l'Araignée géante a CON 3 (Saignements diff 13).
    for (const a of SEED_MONSTERS.filter((m) => m.nom === "Araignée géante")) {
      expect(a.caracteristiques?.CON).toBe(3);
    }
    // Les instances portent les caracs (repli 0 si fiche incomplète).
    const [araignee] = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Araignée géante")!, 1);
    expect(araignee.caracs).toMatchObject({ CON: 3 });
    const [strige] = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Strige")!, 1);
    expect(strige.caracs).toMatchObject({ CON: -3, VOL: 2 });
    const [minotaure] = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Minotaure")!, 1);
    expect(minotaure.caracs).toMatchObject({ CON: 6, VOL: 2 });
    const [geant] = monsterInstances(SEED_MONSTERS.find((m) => m.nom === "Géant des collines")!, 1);
    expect(geant.caracs).toMatchObject({ CON: 7, VOL: 0 });
  });

  it("badge V2 : 76 fiches DRS liées, customs et V1 exclus", () => {
    const badged = SEED_MONSTERS.filter((m) => m.drsSlug);
    expect(badged).toHaveLength(76);
    for (const m of badged) {
      expect(m.drsSlug, m.id).toMatch(/^[a-z0-9-]+$/);
    }
    expect(SEED_MONSTERS.find((m) => m.nom === "Goule")?.drsSlug).toBe("goule");
    expect(SEED_MONSTERS.find((m) => m.nom === "Loup (Mâle alpha)")?.drsSlug).toBe("loup-male-alpha");
    // Customs, variantes, ancienne édition et V1 (pas en V2) : pas de badge.
    for (const nom of ["Loup (compagnon du rôdeur)", "Loup alpha (compagnon du rôdeur)", "Sigméus, le nécromant", "Dragon rouge (blocs ancienne édition, tels qu'affichés)", "Worg", "Araignée géante", "Strige"]) {
      expect(SEED_MONSTERS.find((m) => m.nom === nom)?.drsSlug, nom).toBeUndefined();
    }
  });

  it("V1 ajoutées : Chauve-souris géante, Élémentaire de feu, Gobelours", () => {
    for (const nom of ["Chauve-souris géante", "Élémentaire de feu", "Gobelours"]) {
      const m = SEED_MONSTERS.find((x) => x.nom === nom)!;
      expect(m, nom).toBeTruthy();
      expect(m.v1).toBe(true);
      expect(m.drsSlug).toBeUndefined();
      expect(() => monsterSchema.parse(m), m.id).not.toThrow();
    }
    const cs = SEED_MONSTERS.find((m) => m.nom === "Chauve-souris géante")!;
    expect(cs.caracteristiques).toMatchObject({ AGI: 4, CON: -1, FOR: -1, PER: 4, CHA: -4, INT: -4, VOL: 4 });
    expect(cs.attaques[0]).toMatchObject({ nom: "Morsure", bonus: 7, degats: "1d6+1" });
    expect(cs.attaques[0].effetTouche).toMatchObject({
      cle: "Poison anesthésiant", sauvegarde: { carac: "CON", difficulte: 12 },
    });
    const feu = SEED_MONSTERS.find((m) => m.nom === "Élémentaire de feu")!;
    expect(feu.caracteristiques).toMatchObject({ AGI: 1, VOL: 0 });
    expect(feu.attaques[0]).toMatchObject({ nom: "Poings enflammés", bonus: 4, degats: "1d6+3" });
    const gob = SEED_MONSTERS.find((m) => m.nom === "Gobelours")!;
    expect(gob.caracteristiques).toMatchObject({ FOR: 4, CON: 4 });
    expect(gob.attaques[0]).toMatchObject({ nom: "Masse cloutée", bonus: 8, degats: "1d8+5" });
  });

  it("V1 ajoutées (2e vague) : Puma, Ours enragé, Orc robuste", () => {
    for (const nom of ["Puma", "Ours enragé", "Orc robuste"]) {
      const m = SEED_MONSTERS.find((x) => x.nom === nom)!;
      expect(m, nom).toBeTruthy();
      expect(m.v1).toBe(true);
      expect(m.drsSlug).toBeUndefined();
      expect(() => monsterSchema.parse(m), m.id).not.toThrow();
    }
    const puma = SEED_MONSTERS.find((m) => m.nom === "Puma")!;
    expect(puma.caracteristiques).toMatchObject({ AGI: 4, CON: 2, FOR: 2, PER: 2, CHA: -2, INT: -4, VOL: 2 });
    expect(puma.attaques[0]).toMatchObject({ nom: "Morsure et Griffes", bonus: 5, degats: "1d6+2" });
    const ours = SEED_MONSTERS.find((m) => m.nom === "Ours enragé")!;
    expect(ours.caracteristiques).toMatchObject({ AGI: 2, CON: 3, FOR: 3, VOL: 2 });
    expect(ours.attaques[0]).toMatchObject({ nom: "Morsure et griffes", bonus: 6, degats: "1d6+5" });
    const orc = SEED_MONSTERS.find((m) => m.nom === "Orc robuste")!;
    expect(orc.caracteristiques).toMatchObject({ AGI: 1, CON: 1, FOR: 1, PER: 0, CHA: -2, INT: -2, VOL: 0 });
    expect(orc.attaques[0]).toMatchObject({ nom: "Épée", bonus: 2, degats: "1d8+1" });
  });

  it("badge V1 : 19 fiches marquées (V1 seule, pas en V2)", () => {
    const v1 = SEED_MONSTERS.filter((m) => m.v1);
    expect(v1).toHaveLength(19);
    for (const nom of ["Strige", "Worg", "Troll", "Rat géant", "Ombre", "Minotaure", "Homme-lézard", "Elfe noir", "Géant des collines", "Crocodile", "Chef bandit"]) {
      expect(SEED_MONSTERS.find((m) => m.nom === nom)?.v1, nom).toBe(true);
    }
    expect(SEED_MONSTERS.filter((m) => m.nom === "Araignée géante" && m.v1)).toHaveLength(2);
    // V1 seule : aucun badge V2.
    expect(SEED_MONSTERS.find((m) => m.nom === "Worg")).toMatchObject({ v1: true });
    expect(SEED_MONSTERS.find((m) => m.nom === "Worg")?.drsSlug).toBeUndefined();
    // Renommages : Elfe noir (ex-NC 2), Orc de base (ex-Orc).
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-2-elfe-noir")?.nom).toBe("Elfe noir");
    expect(SEED_MONSTERS.find((m) => m.id === "notion-nc-0-orc")?.nom).toBe("Orc de base");
  });
});
