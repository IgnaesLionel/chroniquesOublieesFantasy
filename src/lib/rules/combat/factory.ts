import type { AttackDef, Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Convertit une arme d'inventaire en attaque. */
export function attaqueFromItem(item: Item): AttackDef | null {
  if (!item.estArme) return null;
  return {
    id: `item:${item.id}`,
    nom: `🗡 ${item.nom}`,
    bonus: item.bonusAttaque ?? 0,
    degats: item.degats ?? "1d6",
    effetTouche: item.effetCle ? { cle: item.effetCle, duree: item.effetDuree ?? null } : undefined,
  };
}

/** Convertit un sort offensif en attaque.
 * Sans dégâts (Malédiction, Peur...) : jet d'attaque + effet éventuel, 0 DM
 * (convention du moteur : 0 = "1d1-1"). Sans bonus explicite : attaque
 * magique du lanceur (passée par participantFromCharacter : niv+VOL). */
export function attaqueFromSort(sort: Sort, bonusMagique = 0): AttackDef | null {
  if (sort.type !== "offensif") return null;
  return {
    id: `sort:${sort.id}`,
    nom: `✦ ${sort.nom}`,
    bonus: sort.bonus ?? bonusMagique,
    degats: sort.degats ?? "1d1-1",
    effetTouche: sort.effetCle ? { cle: sort.effetCle, duree: sort.effetDuree ?? null } : undefined,
  };
}

/**
 * PJ -> participant (initiative à lancer ensuite).
 * Les armes ÉQUIPÉES de l'inventaire et les sorts offensifs deviennent des attaques
 * (bonus d'attaque magique = niv+VOL, sauf bonus explicite du sort).
 */
export function participantFromCharacter(c: Character, catalogue: Item[] = []): CombatParticipant {
  const attaques: AttackDef[] = [...c.attaques];
  for (const entree of c.inventaire ?? []) {
    if (!entree.equipe) continue;
    const item = catalogue.find((i) => i.id === entree.itemId);
    if (!item) continue;
    const a = attaqueFromItem(item);
    if (a) attaques.push(a);
  }
  const magique = c.niveau + c.caracteristiques.VOL;
  for (const sort of c.sorts ?? []) {
    const a = attaqueFromSort(sort, magique);
    if (a) attaques.push(a);
  }
  return {
    instanceId: uid("p"),
    templateId: c.id,
    nom: c.nom,
    camp: "pj",
    pvMax: c.pvMax,
    pv: c.pv,
    defense: c.defense,
    initMod: c.initMod,
    initiative: null,
    attaques,
    effets: [],
    sorts: c.sorts ?? [],
    ressources: { ...c.ressources },
    statut: c.pv <= 0 ? "ko" : "actif",
  };
}

/** Template monstre x N -> instances "Gobelin #1..N" aux PV indépendants. */
export function monsterInstances(template: MonsterTemplate, count: number): CombatParticipant[] {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => ({
    instanceId: uid("m"),
    templateId: template.id,
    nom: n === 1 ? template.nom : `${template.nom} #${i + 1}`,
    camp: "monstre" as const,
    pvMax: template.pvMax,
    pv: template.pv,
    defense: template.defense,
    initMod: template.initMod,
    initiative: null,
    attaques: template.attaques,
    effets: [],
    sorts: [],
    ressources: {},
    statut: "actif" as const,
  }));
}

export function resetUidCounter() {
  counter = 0;
}
