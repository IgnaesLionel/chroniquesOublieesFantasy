// Helpers purs de préparation de rencontre (staging).
// Extraits de app/combat/page.tsx : testables sans React.
import type { Character } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import { participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { construireLoupCompagnon, talentConnu } from "@/src/lib/rules/combat/attack";
import { normaliserPersonnage } from "@/src/lib/rules/personnage";

/** PJ (+ loup éventuel) reconstruits depuis la fiche : attaques/sorts/talents à jour. */
export function construirePJCombat(c: Character, catalogue: Item[] = []): CombatParticipant[] {
  const frais = participantFromCharacter(
    normaliserPersonnage(c as unknown as Record<string, unknown>),
    catalogue
  );
  if (!talentConnu(frais, "Le loup")) return [frais];
  return [
    frais,
    construireLoupCompagnon(frais, {
      instanceId: `compagnon-${frais.instanceId}`,
      templateId: `compagnon:loup:${c.id}`,
      initMod: frais.initMod,
      initiative: null,
    }),
  ];
}

/** Reconstruit les PJ depuis leurs fiches (staging et démarrage). */
export function rafraichirStaging(
  liste: CombatParticipant[],
  characters: Character[],
  catalogue: Item[] = []
): CombatParticipant[] {
  return liste.flatMap((p) => {
    if (p.templateId.startsWith("compagnon:loup")) return [];
    const fiche = characters.find((c) => c.id === p.templateId);
    return fiche && p.camp === "pj" ? construirePJCombat(fiche, catalogue) : [p];
  });
}

/** Re-cible si l'ancienne cible est invalide : priorité aux ennemis. */
export function recibrerCible(
  c: CombatState,
  attacker: string | null,
  prev: string | null
): string | null {
  const opts = c.participants.filter((p) => p.statut === "actif" && p.instanceId !== attacker);
  if (prev && opts.some((p) => p.instanceId === prev)) return prev;
  const atk = c.participants.find((p) => p.instanceId === attacker);
  const foes = opts.filter((p) => p.camp !== atk?.camp);
  return (foes[0] ?? opts[0])?.instanceId ?? null;
}
