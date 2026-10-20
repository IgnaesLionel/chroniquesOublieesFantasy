// Helpers purs de préparation de rencontre (staging).
// Extraits de app/combat/page.tsx : testables sans React.
import type { Character } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import { participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { construireLoupCompagnon, talentConnu } from "@/src/lib/rules/combat/attack";
import { attaqueInterdite } from "@/src/lib/rules/effects/effects";
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
      // PV persistés sur la fiche maître (fin de combat précédent, soins hors
      // combat) ; sinon pleins. 0 conservé = KO (fuite MJ, à soigner).
      pvConserve: c.compagnon?.pv,
    }),
  ];
}

/** Reconstruit les PJ depuis leurs fiches (staging et démarrage). Les états pré-combat (effets posés avant l'initiative : surpris, aveuglé...) sont conservés. */
export function rafraichirStaging(
  liste: CombatParticipant[],
  characters: Character[],
  catalogue: Item[] = []
): CombatParticipant[] {
  const effetsParInstance = new Map(liste.map((p) => [p.instanceId, p.effets]));
  return liste.flatMap((p) => {
    if (p.templateId.startsWith("compagnon:loup")) return [];
    const fiche = characters.find((c) => c.id === p.templateId);
    const reconstruits = fiche && p.camp === "pj" ? construirePJCombat(fiche, catalogue) : [p];
    return reconstruits.map((r) => {
      // InstanceId d'abord (stable en pratique) ; repli templateId pour les PJ
      // (anciennes sauvegardes, ids reconstruits).
      const gardes =
        effetsParInstance.get(r.instanceId) ??
        (r.camp === "pj" ? liste.find((q) => q.camp === "pj" && q.templateId === r.templateId)?.effets : undefined) ??
        [];
      return { ...r, effets: gardes };
    });
  });
}

/** Re-cible si l'ancienne cible est invalide : priorité aux ennemis (hors cibles interdites par un effet, ex. Effroi). */
export function recibrerCible(
  c: CombatState,
  attacker: string | null,
  prev: string | null
): string | null {
  const atk = c.participants.find((p) => p.instanceId === attacker);
  const opts = c.participants.filter(
    (p) =>
      p.statut === "actif" &&
      p.instanceId !== attacker &&
      !attaqueInterdite(atk?.effets ?? [], p.instanceId)
  );
  if (prev && opts.some((p) => p.instanceId === prev)) return prev;
  const foes = opts.filter((p) => p.camp !== atk?.camp);
  return (foes[0] ?? opts[0])?.instanceId ?? null;
}
