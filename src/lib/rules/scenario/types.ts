// Modèle scénario modulaire. Scènes non linéaires + suivi de partie.
// Rétro-compatible : texteMJ/notesMJ restent lus comme narration/secrets.

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

export type SceneType = "narration" | "exploration" | "interaction" | "combat" | "transition";

export const SCENE_TYPES: SceneType[] = ["narration", "exploration", "interaction", "combat", "transition"];

export const SCENE_TYPE_LABEL: Record<SceneType, string> = {
  narration: "Narration",
  exploration: "Exploration",
  interaction: "Interaction",
  combat: "Combat",
  transition: "Transition",
};

/** Icônes sobres (texte, pas d'emoji) pour badges et graphe. */
export const SCENE_TYPE_ICON: Record<SceneType, string> = {
  narration: "◉",
  exploration: "◎",
  interaction: "◈",
  combat: "⚔",
  transition: "➤",
};

export type SceneStatus = "non_visitee" | "en_cours" | "terminee";

export interface Scene {
  id: string;
  titre: string;
  /** Type de scène (défaut : narration pour les anciennes données). */
  type?: SceneType;
  /** Ancien champ : conservé, lu comme narration si `narration` absent. */
  texteMJ: string;
  /** Nouveau canon : texte à lire aux joueurs. */
  narration?: string;
  /** Idées d'actions / interactions / découvertes (une entrée = une idée). */
  actionsPossibles?: string[];
  /** Ancien champ : conservé, lu comme secret si `infosSecretes` absent. */
  notesMJ?: string;
  /** Éléments réservés au MJ. */
  infosSecretes?: string;
  /** Résultats possibles des actions et décisions (texte libre). */
  consequences?: string;
  /** Indices disponibles dans la scène (le suivi des découvertes vit dans PlayState). */
  indices?: string[];
  description?: string;
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

export interface PlayDecision {
  sceneId: string;
  choiceId?: string;
  label: string;
  at: string;
}

export interface PlayState {
  scenarioId: string;
  sceneId: string;
  historique: string[];
  flags: Record<string, FlagValue>;
  /** Scènes visitées au moins une fois (dont scène en cours). */
  visitees?: string[];
  /** Scènes marquées terminées par le MJ. */
  terminees?: string[];
  /** Indices découverts pendant la partie. */
  indices?: string[];
  /** Décisions des joueurs (choix suivis + changements libres). */
  decisions?: PlayDecision[];
  /** Note globale de partie. */
  notes?: string;
  /** Notes par scène (id scène -> texte). */
  notesScenes?: Record<string, string>;
  updatedAt?: string;
}

/** Normalise le type (anciennes données sans type -> narration). */
export function sceneTypeOf(s: Pick<Scene, "type">): SceneType {
  return s.type && (SCENE_TYPES as string[]).includes(s.type) ? s.type : "narration";
}

/** Narration à lire : `narration` puis repli `texteMJ`. */
export function narrationOf(s: Pick<Scene, "narration" | "texteMJ">): string {
  return (s.narration ?? s.texteMJ ?? "").trim();
}

/** Secrets MJ : `infosSecretes` puis repli `notesMJ`. */
export function secretsOf(s: Pick<Scene, "infosSecretes" | "notesMJ">): string {
  return (s.infosSecretes ?? s.notesMJ ?? "").trim();
}

/** Actions possibles (toujours un tableau). */
export function actionsOf(s: Pick<Scene, "actionsPossibles">): string[] {
  return (s.actionsPossibles ?? []).filter((a) => a.trim().length > 0);
}

/** Statut d'une scène pour une partie donnée. */
export function statusOf(sceneId: string, play: Pick<PlayState, "sceneId" | "terminees" | "visitees" | "historique">): SceneStatus {
  if ((play.terminees ?? []).includes(sceneId)) return "terminee";
  if (play.sceneId === sceneId) return "en_cours";
  const seen = [...(play.visitees ?? []), ...(play.historique ?? [])];
  return seen.includes(sceneId) ? "terminee" : "non_visitee";
}
