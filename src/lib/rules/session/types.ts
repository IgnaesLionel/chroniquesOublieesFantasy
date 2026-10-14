// Session = une table de jeu : personnages prédéfinis + playlist de scénarios.
// Références par id (pas de copie) : les fiches restent la source de vérité.
// V1 : les PV restent partagés (même comportement que la vue Partie actuelle).

export interface Session {
  id: string;
  nom: string;
  description?: string;
  /** Personnages de la table (ids de cof.characters). */
  characterIds: string[];
  /** Scénarios enchaînés, dans l'ordre de campagne (ids de cof.scenarios). */
  scenarioIds: string[];
  /** Scénario en cours de campagne (doit appartenir à la playlist). */
  currentScenarioId?: string;
  /** Scénarios marqués terminés par le MJ. */
  terminees?: string[];
  /** Notes de campagne. */
  notes?: string;
  updatedAt?: string;
}

/** Complète une session (anciennes sauvegardes -> nouveaux champs). Pur, sans mutation. */
export function ensureSessionDefaults(s: Session): Session {
  return {
    ...s,
    characterIds: s.characterIds ?? [],
    scenarioIds: s.scenarioIds ?? [],
    terminees: s.terminees ?? [],
    notes: s.notes ?? "",
  };
}

/** Progression de campagne : X/Y scénarios terminés + position du courant. */
export function progressOf(s: Pick<Session, "scenarioIds" | "terminees" | "currentScenarioId">): {
  total: number;
  termines: number;
  indexCourant: number;
} {
  const total = s.scenarioIds.length;
  const termines = (s.terminees ?? []).filter((id) => s.scenarioIds.includes(id)).length;
  const indexCourant = s.currentScenarioId ? s.scenarioIds.indexOf(s.currentScenarioId) : -1;
  return { total, termines, indexCourant };
}
