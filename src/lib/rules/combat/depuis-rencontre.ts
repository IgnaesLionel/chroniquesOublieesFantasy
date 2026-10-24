// Pont entre le générateur de rencontres et le moteur de combat.
// Le générateur produit une composition (modèle de bestiaire + quantité) ; le
// combat attend des participants instanciés (PV indépendants, initiative,
// effets). Aucune statistique n'est recalculée ici : on réutilise le même
// `MonsterTemplate` que le bestiaire, via `monsterInstances`.

import type { SlotResolu } from "@/src/lib/encounters/types";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { monsterInstances, renommerDoublonsMonstres } from "@/src/lib/rules/combat/factory";

/** Composition de rencontre -> participants de combat (un par créature). */
export function participantsDepuisRencontre(slots: SlotResolu[]): CombatParticipant[] {
  return renommerDoublonsMonstres(
    slots.flatMap((s) => monsterInstances(s.profil.template, Math.max(1, Math.floor(s.quantite))))
  );
}

/**
 * Convertit une rencontre en préparation de combat : le camp ennemi est
 * remplacé par la composition générée, les PJ déjà posés (et leurs états
 * initiaux) sont conservés. Remplacer plutôt qu'ajouter évite d'empiler deux
 * rencontres quand le MJ régénère puis convertit à nouveau.
 */
export function stagingDepuisRencontre(
  staging: CombatParticipant[],
  slots: SlotResolu[]
): CombatParticipant[] {
  const pj = staging.filter((p) => p.camp === "pj");
  return renommerDoublonsMonstres([...pj, ...participantsDepuisRencontre(slots)]);
}
