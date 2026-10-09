// Modèle scénario modulaire. Phase 7 : conditions génériques évaluées.
// Exemples : SI flag "cle" -> porte secrète SINON autre chemin.

export type FlagValue = boolean | string | number;

export type Condition =
  | { type: "flag"; flag: string; op: "estVrai" | "estFaux" | "egal" | "different"; valeur?: FlagValue }
  | { type: "et"; conditions: Condition[] }
  | { type: "ou"; conditions: Condition[] }
  | { type: "non"; condition: Condition };

export interface Choice {
  id: string;
  label: string;
  versSceneId: string;
  /** Absente = toujours disponible. Sinon évaluée contre les flags. */
  condition?: Condition;
}

export interface Scene {
  id: string;
  titre: string;
  texteMJ: string;
  description?: string;
  notesMJ?: string;
  rencontreId?: string;
  /** IDs de la base PNJ (cof.npcs). Affichés en mode jeu. */
  pnjIds?: string[];
  /** IDs de la base objets (cof.items). Objets à remettre / trouvables. */
  itemIds?: string[];
  choix: Choice[];
}

export interface Chapter {
  id: string;
  titre: string;
  sceneDepartId: string;
}

export interface Scenario {
  id: string;
  titre: string;
  description?: string;
  chapitres: Chapter[];
  scenes: Scene[];
  exemple: boolean;
}

export interface PlayState {
  scenarioId: string;
  sceneId: string;
  historique: string[];
  flags: Record<string, FlagValue>;
}
