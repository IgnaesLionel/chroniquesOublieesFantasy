import { describe, expect, it } from "vitest";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Character } from "@/src/lib/rules/types";
import { fixedRng } from "@/src/lib/rules/dice/roller";
import {
  lancerMajeure,
  lancerMineure,
  nbRang3AutresVoiesPretre,
  nbRang5VoiesPretre,
  patientsMaxRetablissement,
  quotaMineureParJour,
  rangVoieSoins,
} from "@/src/lib/rules/soins";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { createCombat } from "@/src/lib/rules/combat/initiative";
import {
  castSoutien,
  declencherPhenix,
  lancerRetablissement,
  lancerSortHorsCombat,
  utiliserCapacite,
} from "@/src/lib/rules/combat/attack";

function pj(nom = "Prêtre"): CombatParticipant {
  return {
    instanceId: `pj-${nom}-${Math.random()}`, templateId: "pj", nom, camp: "pj",
    pvMax: 40, pv: 40, defense: 12, initMod: 1, initiative: null,
    attaques: [], effets: [], sorts: [], capacites: [],
    niveau: 1, ressources: { mana: { max: 10, actuel: 10 } },
    statut: "actif", bonusMagique: 5,
    caracs: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 2, INT: 0, VOL: 2 },
    usagesSorts: {},
  };
}

function fichePretre(nom = "Prêtre"): Character {
  return {
    id: `pj-${nom}`, kind: "personnage", nom, classe: "Prêtre", niveau: 5,
    pvMax: 30, pv: 30, defense: 12, initMod: 1,
    caracteristiques: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 3, INT: 0, VOL: 2 },
    peuple: "Humain", famille: "Mystique", profil: "Prêtre",
    attaques: [], capacites: [], ressources: { mana: { max: 10, actuel: 10 } },
    effets: [], inventaire: [], sorts: [], exemple: false,
  };
}

describe("voie des soins (LDB)", () => {
  it("mineure : 1d4°+CHA (d4 niv.1, CHA 2 -> 3+2=5)", () => {
    const r = lancerMineure(2, 1, fixedRng([0.5]));
    expect(r.detailsBase).toEqual([3]);
    expect(r.total).toBe(5);
  });

  it("majeure : 3d4°+CHA +1d4° par rang 5 (niv.1, CHA 2, 2 R5 -> 3+3+3+3+3+2=17)", () => {
    const r = lancerMajeure(2, 2, 1, fixedRng([0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(r.detailsBase).toEqual([3, 3, 3]);
    expect(r.detailsBonusRang5).toEqual([3, 3]);
    expect(r.total).toBe(17);
  });

  it("rangs prêtre : soins, rang 3 hors soins, rang 5 cumulés", () => {
    const porteur = {
      capacites: ["Récupération mineure", "Vigueur divine", "Bénédiction", "Sanctuaire", "Destruction du mal"],
      sorts: [
        { nom: "Récupération majeure", voie: "Voie des soins", rang: 3 },
        { nom: "Foudres divines", voie: "Voie de la foi", rang: 5 },
      ],
    };
    expect(rangVoieSoins(porteur)).toBe(3);
    // Rang 3 hors soins : prière (Sanctuaire/Destruction) = 1.
    expect(nbRang3AutresVoiesPretre(porteur)).toBe(1);
    expect(quotaMineureParJour(porteur)).toBe(4);
    // Rang 5 : foi (Foudres) = 1.
    expect(nbRang5VoiesPretre(porteur)).toBe(1);
  });

  it("mineure combat : quota journalier (rang 1 -> 1/jour, 2e refusé)", () => {
    const mineure = SEED_SORTS.find((s) => s.id === "sort-recuperation-mineure")!;
    expect(mineure.soin).toBe("1d4°+CHA");
    const pretre = { ...pj("Prêtre"), capacites: ["Récupération mineure"], sorts: [mineure] };
    const blesse = { ...pj("Blessé"), pv: 10 };
    const s = createCombat([pretre, blesse]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 1d4 : 3 + CHA 2 = 5 (10 -> 15).
    const r1 = castSoutien(s, a, t, mineure, fixedRng([0.5]));
    expect(r1.resolution.soinTotal).toBe(5);
    expect(r1.state.participants[1].pv).toBe(15);
    expect(r1.state.participants[0].usagesJournaliers?.["récupération mineure"]).toBe(1);
    // 2e lancer même combat : quota épuisé (pas la limite 1 soin/combat, le quota).
    const blesse2 = { ...r1.state.participants[1], soinMagiqueRecu: false, pv: 10 };
    const s2 = { ...r1.state, participants: [r1.state.participants[0], blesse2] };
    expect(() => castSoutien(s2, a, t, mineure, fixedRng([0.5]))).toThrow(/quota épuisé/);
  });

  it("mineure : relève un allié à 0 PV (compagnon KO)", () => {
    const mineure = SEED_SORTS.find((s) => s.id === "sort-recuperation-mineure")!;
    const pretre = { ...pj("Prêtre"), capacites: ["Récupération mineure"], sorts: [mineure] };
    const loup = { ...pj("Loup (Nyssa)"), templateId: "compagnon:loup:nyssa", pv: 0, statut: "ko" as const };
    const s = createCombat([pretre, loup]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 1d4 : 3 + CHA 2 = 5 → le compagnon repasse actif.
    const r = castSoutien(s, a, t, mineure, fixedRng([0.5]));
    expect(r.resolution.soinTotal).toBe(5);
    expect(r.state.participants[1].pv).toBe(5);
    expect(r.state.participants[1].statut).toBe("actif");
  });

  it("majeure : +1d4° par rang 5 (2 R5 -> 5 dés)", () => {
    const majeure = SEED_SORTS.find((s) => s.id === "sort-recuperation-majeure")!;
    const pretre = {
      ...pj("Prêtre"),
      capacites: ["Récupération majeure", "Foudres divines", "Mot de pouvoir"],
      sorts: [majeure],
    };
    const blesse = { ...pj("Blessé"), pv: 10 };
    const s = createCombat([pretre, blesse]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Foi R5 (Foudres) + guerre sainte R5 (Mot) = 2 bonus : 3+2 dés à 3 = 15 + CHA 2 = 17.
    const r = castSoutien(s, a, t, majeure, fixedRng([0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(r.resolution.soinDetails).toHaveLength(5);
    expect(r.resolution.soinTotal).toBe(17);
  });

  it("soin magique unique : 2e soin même cible refusé sauf outrepasser MJ", () => {
    const mineure = SEED_SORTS.find((s) => s.id === "sort-recuperation-mineure")!;
    const majeure = SEED_SORTS.find((s) => s.id === "sort-recuperation-majeure")!;
    const pretre = { ...pj("Prêtre"), capacites: ["Récupération mineure", "Récupération majeure"], sorts: [mineure, majeure] };
    const blesse = { ...pj("Blessé"), pv: 10 };
    const s = createCombat([pretre, blesse]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // Premier soin passe mais consomme aussi le quota mineure.
    const r1 = castSoutien(s, a, t, majeure, fixedRng([0.5, 0.5, 0.5]));
    expect(r1.state.participants[1].soinMagiqueRecu).toBe(true);
    // 2e soin (mineure) sur même cible : refusé par la règle 1/combat (quota OK : rang 1).
    expect(() => castSoutien(r1.state, a, t, mineure, fixedRng([0.5]))).toThrow(/déjà reçu un soin magique/);
    // Outrepasser MJ : passe.
    const r2 = castSoutien(r1.state, a, t, mineure, fixedRng([0.5]), { outrepasserSoin: true });
    expect(r2.resolution.soinTotal).toBeGreaterThan(0);
  });

  it("vigueur divine : auto purge poison, test MJ si surnaturel", () => {
    const pretre = { ...pj("Prêtre"), capacites: ["Vigueur divine"] };
    const malade = {
      ...pj("Malade"),
      effets: [
        { id: "e1", nom: "Empoisonné", dureeTours: 3 as number, toursRestants: 3 as number, modificateurs: {} },
        { id: "e2", nom: "Protection", dureeTours: 1 as number, toursRestants: 1 as number, modificateurs: {} },
      ],
    };
    const s = createCombat([pretre, malade]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    const r = utiliserCapacite(s, a, t, "Vigueur divine", { effetCle: null, modeVigueur: "auto" });
    expect(r.state.participants[1].effets.map((e) => e.nom)).toEqual(["Protection"]);
    // Test MJ réussi : purge aussi.
    const s2 = createCombat([pretre, malade]);
    const r2 = utiliserCapacite(s2, s2.participants[0].instanceId, s2.participants[1].instanceId, "Vigueur divine", { effetCle: null, modeVigueur: "test" }, fixedRng([0.9, 0.1]));
    expect(r2.resolution.testMagique?.reussi).toBe(true);
    expect(r2.state.participants[1].effets.map((e) => e.nom)).toEqual(["Protection"]);
  });

  it("phénix : déclencheur auto à 0 PV, jet unique, prêtre au double", () => {
    const pretre = { ...pj("Prêtre"), pv: 0, statut: "ko" as const, capacites: ["Phénix"] };
    const allie = { ...pj("Allié"), pv: 10 };
    const s = createCombat([pretre, allie]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    // 2d4 : 3+3=6 + CHA 2 = 8 alliés, 16 prêtre.
    const r = declencherPhenix(s, a, fixedRng([0.5, 0.5]), [t]);
    expect(r.resolution.montant).toBe(8);
    expect(r.resolution.montantPretre).toBe(16);
    expect(r.state.participants[0].pv).toBe(16);
    expect(r.state.participants[0].statut).toBe("actif");
    expect(r.state.participants[1].pv).toBe(18);
    // 2e déclenchement : 1/jour épuisé.
    expect(() => declencherPhenix(r.state, a, fixedRng([0.5, 0.5]), [t])).toThrow(/0 PV|déjà utilisé/);
  });

  it("rétablissement : refusé en combat, rituel multi-patients hors combat (jet par patient)", () => {
    const retab = SEED_SORTS.find((s) => s.id === "sort-retablissement")!;
    expect(retab.rituelHorsCombat).toBe(true);
    expect(retab.concentrationInterdite).toBe(true);
    const pretre = { ...pj("Prêtre"), capacites: ["Rétablissement"], sorts: [retab] };
    const s = createCombat([pretre, pj("Blessé")]);
    const [a, t] = s.participants.map((p) => p.instanceId);
    expect(() => castSoutien(s, a, t, retab)).toThrow(/rituel hors combat/);
    // Hors combat : 2 patients, CHA 3 -> OK, 1/jour.
    const fiche = { ...fichePretre(), niveau: 7, capacites: ["Rétablissement"], sorts: [retab] };
    const p1 = { ...fichePretre("A"), id: "a", pv: 10 };
    const p2 = { ...fichePretre("B"), id: "b", pv: 12 };
    expect(patientsMaxRetablissement(3)).toBe(3);
    const r = lancerRetablissement(fiche, [p1, p2], retab, fixedRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(r.resolution.patients).toHaveLength(2);
    // 3 base + 1 R5 (Rétablissement lui-même) = 4 dés.
    expect(r.resolution.detailsParPatient[0]).toHaveLength(4);
    expect(r.resolution.nbRang5).toBe(1);
    expect(r.patients[0].pv).toBeGreaterThan(10);
    expect(r.lanceur.usagesJournaliers?.["rétablissement"]).toBe(1);
    // Trop de patients pour CHA 0.
    const faible = { ...fiche, caracteristiques: { ...fiche.caracteristiques, CHA: 0 } };
    const quatre = [p1, p2, { ...p1, id: "c" }, { ...p1, id: "d" }];
    expect(() => lancerRetablissement(faible, quatre, retab)).toThrow(/max 1/);
  });

  it("hors combat : mineure 1d4°+CHA + quota (2e refusée sans repos)", () => {
    const mineure = SEED_SORTS.find((s) => s.id === "sort-recuperation-mineure")!;
    const pretre = { ...fichePretre(), niveau: 3, capacites: ["Récupération mineure"], sorts: [mineure] };
    const blesse = { ...fichePretre("B"), id: "b", pv: 10 };
    // niv.3 -> d4, 1d4 3 + CHA 3 = 6.
    const r1 = lancerSortHorsCombat(pretre, blesse, mineure, fixedRng([0.5]));
    expect(r1.resolution.soinTotal).toBe(6);
    expect(r1.lanceur.usagesJournaliers?.["récupération mineure"]).toBe(1);
    // Quota rang 1 : 2e refusée.
    const blesse2 = { ...blesse, id: "c", pv: 10 };
    expect(() => lancerSortHorsCombat(r1.lanceur, blesse2, mineure, fixedRng([0.5]))).toThrow(/quota épuisé/);
  });
});
