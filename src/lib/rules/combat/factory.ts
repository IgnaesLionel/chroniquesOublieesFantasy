import type { AttackDef, Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { substituerDeEvolutif, substituerStats } from "@/src/lib/rules/dice/roller";
import { deEvolutif, niveauAttaque } from "@/src/lib/rules/personnage";
import { compterCapacites, niveauMinRang, normaliserNomCapacite } from "@/src/lib/rules/creation";

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
 * magique du lanceur (passée par participantFromCharacter : niv+VOL).
 * Les caracs ("1d4°+INT") et le dé évolutif ("1dE") sont substitués.
 * Action, vol de vie, touche auto, moitié si raté et effet au toucher
 * (dégâts par tour + modificateurs) suivent la fiche du sort. */
export function attaqueFromSort(sort: Sort, bonusMagique = 0, caracs: Record<string, number> = {}, niveauDe = 1): AttackDef | null {
  if (sort.type !== "offensif") return null;
  return {
    id: `sort:${sort.id}`,
    nom: `✦ ${sort.nom}`,
    bonus: sort.bonus ?? bonusMagique,
    degats: sort.degats ? substituerDeEvolutif(substituerStats(sort.degats, caracs), deEvolutif(niveauDe)) : "1d1-1",
    action: sort.action ?? "attaque",
    volDeVie: sort.volDeVie,
    toucheAuto: sort.toucheAuto,
    demiDegatsSiRate: sort.demiDegatsSiRate,
    effetTouche: sort.effetCle ? { cle: sort.effetCle, duree: sort.effetDuree ?? null, degatsParTour: sort.effetDegats, mods: sort.effetMods } : undefined,
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
  const magique = niveauAttaque(c.niveau) + c.caracteristiques.VOL;
  for (const sort of c.sorts ?? []) {
    const a = attaqueFromSort(sort, magique, c.caracteristiques, c.niveau);
    if (a) attaques.push(a);
  }
  // Verrou de niveau par sort (gratuité Mage déduite) pour les panneaux.
  const compte = compterCapacites(c);
  const sorts = (c.sorts ?? []).map((s) => {
    if (s.voie == null || s.rang == null) return { ...s };
    const gratuit =
      compte.rang2Nom != null && normaliserNomCapacite(compte.rang2Nom) === normaliserNomCapacite(s.nom);
    return { ...s, niveauMin: gratuit ? 1 : niveauMinRang(s.rang) };
  });
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
    sorts,
    capacites: [...(c.capacites ?? [])],
    ressources: { ...c.ressources },
    niveau: c.niveau,
    statut: c.pv <= 0 ? "ko" : "actif",
    bonusMagique: magique,
    caracs: { ...c.caracteristiques },
    usagesSorts: {},
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
    capacites: [...(template.capacites ?? [])],
    ressources: {},
    niveau: template.niveau,
    statut: "actif" as const,
    usagesSorts: {},
  }));
}

export function resetUidCounter() {
  counter = 0;
}
