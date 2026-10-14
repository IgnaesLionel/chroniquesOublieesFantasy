import type { Session } from "@/src/lib/rules/session/types";
import { ensureSessionDefaults } from "@/src/lib/rules/session/types";

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Nouvelle table vide. */
export function newSession(nom: string): Session {
  const clean = nom.trim() || "Nouvelle session";
  return ensureSessionDefaults({ id: uid("ses"), nom: clean, characterIds: [], scenarioIds: [] });
}

/** Ajoute / retire un personnage de la table. */
export function toggleMembre(session: Session, characterId: string): Session {
  const base = ensureSessionDefaults(session);
  const has = base.characterIds.includes(characterId);
  return {
    ...base,
    characterIds: has
      ? base.characterIds.filter((id) => id !== characterId)
      : [...base.characterIds, characterId],
    updatedAt: nowIso(),
  };
}

/** Remplace la playlist (ordre de campagne). Nettoie courant + terminés hors playlist. */
export function setPlaylist(session: Session, scenarioIds: string[]): Session {
  const base = ensureSessionDefaults(session);
  const dedup = Array.from(new Set(scenarioIds));
  return {
    ...base,
    scenarioIds: dedup,
    currentScenarioId: dedup.includes(base.currentScenarioId ?? "") ? base.currentScenarioId : dedup[0],
    terminees: (base.terminees ?? []).filter((id) => dedup.includes(id)),
    updatedAt: nowIso(),
  };
}

/** Monte / descend un scénario dans la playlist. */
export function moveScenario(session: Session, scenarioId: string, dir: -1 | 1): Session {
  const base = ensureSessionDefaults(session);
  const i = base.scenarioIds.indexOf(scenarioId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= base.scenarioIds.length) return base;
  const next = [...base.scenarioIds];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...base, scenarioIds: next, updatedAt: nowIso() };
}

/** Définit le scénario courant (null = aucun). */
export function setCurrent(session: Session, scenarioId: string | null): Session {
  const base = ensureSessionDefaults(session);
  if (scenarioId !== null && !base.scenarioIds.includes(scenarioId)) return base;
  return { ...base, currentScenarioId: scenarioId ?? undefined, updatedAt: nowIso() };
}

/** Marque / démarque un scénario comme terminé. */
export function toggleTermine(session: Session, scenarioId: string): Session {
  const base = ensureSessionDefaults(session);
  if (!base.scenarioIds.includes(scenarioId)) return base;
  const has = (base.terminees ?? []).includes(scenarioId);
  return {
    ...base,
    terminees: has
      ? base.terminees!.filter((id) => id !== scenarioId)
      : [...base.terminees!, scenarioId],
    updatedAt: nowIso(),
  };
}

/** Scénario suivant / précédent dans la playlist (null aux extrémités). */
export function nextScenario(session: Session): string | null {
  const base = ensureSessionDefaults(session);
  const i = base.scenarioIds.indexOf(base.currentScenarioId ?? "");
  if (i < 0) return base.scenarioIds[0] ?? null;
  return base.scenarioIds[i + 1] ?? null;
}

export function prevScenario(session: Session): string | null {
  const base = ensureSessionDefaults(session);
  const i = base.scenarioIds.indexOf(base.currentScenarioId ?? "");
  if (i <= 0) return null;
  return base.scenarioIds[i - 1] ?? null;
}

/** Avertissements non bloquants (références manquantes, table vide...). */
export function validateSession(
  session: Session,
  refs?: { characters: string[]; scenarios: string[] }
): string[] {
  const base = ensureSessionDefaults(session);
  const avert: string[] = [];
  if (!base.nom.trim()) avert.push("Nom de session vide.");
  if (base.characterIds.length === 0) avert.push("Aucun personnage dans la table.");
  if (base.scenarioIds.length === 0) avert.push("Aucun scénario dans la playlist.");
  if (base.currentScenarioId && !base.scenarioIds.includes(base.currentScenarioId)) {
    avert.push("Scénario courant hors playlist.");
  }
  if (refs) {
    for (const id of base.characterIds) {
      if (!refs.characters.includes(id)) avert.push(`Personnage introuvable (${id}) — fiche supprimée ?`);
    }
    for (const id of base.scenarioIds) {
      if (!refs.scenarios.includes(id)) avert.push(`Scénario introuvable (${id}) — scénario supprimé ?`);
    }
  }
  return avert;
}
