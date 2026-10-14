import type { FlagValue, PlayDecision, PlayState, Scenario, Scene } from "@/src/lib/rules/scenario/types";
import { evaluateCondition } from "@/src/lib/rules/scenario/conditions";

export function getScene(scenario: Scenario, sceneId: string): Scene {
  const s = scenario.scenes.find((x) => x.id === sceneId);
  if (!s) throw new Error(`Scène introuvable : ${sceneId}`);
  return s;
}

/** Version sûre pour l'UI : null si absente (scénario corrompu) au lieu de lever. */
export function getSceneSafe(scenario: Scenario, sceneId: string): Scene | null {
  return scenario.scenes.find((x) => x.id === sceneId) ?? null;
}

export function getDepart(scenario: Scenario): Scene {
  const dep = scenario.chapitres[0]?.sceneDepartId ?? scenario.scenes[0]?.id;
  if (!dep) throw new Error("Scénario vide.");
  return getScene(scenario, dep);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Complète un état (anciennes sauvegardes -> nouveaux champs). Pur, sans mutation. */
export function ensurePlayDefaults(play: PlayState): PlayState {
  const visitees = Array.from(new Set([...(play.visitees ?? []), ...(play.historique ?? []), play.sceneId]));
  return {
    ...play,
    visitees,
    terminees: play.terminees ?? [],
    indices: play.indices ?? [],
    decisions: play.decisions ?? [],
    notes: play.notes ?? "",
    notesScenes: play.notesScenes ?? {},
  };
}

export function startPlay(scenario: Scenario): PlayState {
  const dep = getDepart(scenario);
  return ensurePlayDefaults({ scenarioId: scenario.id, sceneId: dep.id, historique: [dep.id], flags: {} });
}

function pushDecision(play: PlayState, d: PlayDecision): PlayDecision[] {
  return [...(play.decisions ?? []), d];
}

/** Suit un choix : vérifie la condition (SI/SINON) puis navigue. Enregistre visite + décision. */
export function followChoice(scenario: Scenario, play: PlayState, choiceId: string): PlayState {
  const current = getScene(scenario, play.sceneId);
  const choice = current.choix.find((c) => c.id === choiceId);
  if (!choice) throw new Error("Choix invalide.");
  if (!evaluateCondition(choice.condition, play.flags)) throw new Error("Condition non remplie pour ce choix.");
  const next = getScene(scenario, choice.versSceneId);
  const base = ensurePlayDefaults(play);
  const visitees = Array.from(new Set([...base.visitees!, next.id]));
  return {
    ...base,
    sceneId: next.id,
    historique: [...base.historique, next.id],
    visitees,
    decisions: pushDecision(base, { sceneId: current.id, choiceId: choice.id, label: choice.label, at: nowIso() }),
    updatedAt: nowIso(),
  };
}

/** Navigation libre du MJ (changer de direction, retour arrière, saut). Ne vérifie aucune condition. */
export function gotoScene(scenario: Scenario, play: PlayState, sceneId: string, raison?: string): PlayState {
  const next = getScene(scenario, sceneId);
  const base = ensurePlayDefaults(play);
  const visitees = Array.from(new Set([...base.visitees!, next.id]));
  return {
    ...base,
    sceneId: next.id,
    historique: [...base.historique, next.id],
    visitees,
    decisions: raison
      ? pushDecision(base, { sceneId: base.sceneId, label: raison, at: nowIso() })
      : base.decisions!,
    updatedAt: nowIso(),
  };
}

/** Retour à une scène précédente sans perdre l'historique (correction d'erreur). */
export function backTo(scenario: Scenario, play: PlayState, sceneId: string): PlayState {
  return gotoScene(scenario, play, sceneId, `Retour MJ vers ${getSceneSafe(scenario, sceneId)?.titre ?? sceneId}`);
}

/** Marque / démarque une scène comme terminée (suivi MJ). */
export function toggleTerminee(play: PlayState, sceneId: string): PlayState {
  const base = ensurePlayDefaults(play);
  const has = base.terminees!.includes(sceneId);
  return {
    ...base,
    terminees: has ? base.terminees!.filter((id) => id !== sceneId) : [...base.terminees!, sceneId],
    updatedAt: nowIso(),
  };
}

/** Ajoute / retire un indice découvert. */
export function toggleIndice(play: PlayState, indice: string): PlayState {
  const base = ensurePlayDefaults(play);
  const v = indice.trim();
  if (!v) return base;
  const has = base.indices!.includes(v);
  return { ...base, indices: has ? base.indices!.filter((i) => i !== v) : [...base.indices!, v], updatedAt: nowIso() };
}

/** Note globale de partie. */
export function setNotes(play: PlayState, notes: string): PlayState {
  return { ...ensurePlayDefaults(play), notes, updatedAt: nowIso() };
}

/** Note liée à une scène (ne modifie pas le scénario prévu). */
export function setSceneNote(play: PlayState, sceneId: string, note: string): PlayState {
  const base = ensurePlayDefaults(play);
  return { ...base, notesScenes: { ...base.notesScenes!, [sceneId]: note }, updatedAt: nowIso() };
}

/** Définit un flag (clé, indice, chef_mort...). */
export function setFlag(play: PlayState, flag: string, valeur: FlagValue): PlayState {
  return { ...ensurePlayDefaults(play), flags: { ...play.flags, [flag]: valeur }, updatedAt: nowIso() };
}

/** Scènes liées (sortantes) d'une scène. */
export function linkedScenes(scenario: Scenario, sceneId: string): Scene[] {
  const s = getSceneSafe(scenario, sceneId);
  if (!s) return [];
  return s.choix
    .map((c) => getSceneSafe(scenario, c.versSceneId))
    .filter((x): x is Scene => x !== null);
}

/** Scènes orphelines (jamais ciblées et pas au départ) — aide à repérer les scènes ignorables / oubliées. */
export function orphanScenes(scenario: Scenario): Scene[] {
  const dep = scenario.chapitres[0]?.sceneDepartId ?? scenario.scenes[0]?.id;
  const ciblees = new Set(scenario.scenes.flatMap((s) => s.choix.map((c) => c.versSceneId)));
  return scenario.scenes.filter((s) => s.id !== dep && !ciblees.has(s.id));
}

/** Vérifie les liens : toute destination existe. Retourne la liste d'erreurs. */
export function validateScenario(scenario: Scenario): string[] {
  const ids = new Set(scenario.scenes.map((s) => s.id));
  const errors: string[] = [];
  if (scenario.scenes.length === 0) errors.push("Aucune scène.");
  for (const s of scenario.scenes) {
    for (const c of s.choix) {
      if (!ids.has(c.versSceneId)) errors.push(`"${s.titre}" -> choix "${c.label}" vers scène manquante (${c.versSceneId}).`);
    }
  }
  const dep = scenario.chapitres[0]?.sceneDepartId;
  if (dep && !ids.has(dep)) errors.push("Scène de départ manquante.");
  return errors;
}

/** Profil de branchement d'une scène : fin (0 lien), railroad (1 lien), embranchement (2+). */
export type ProfilBranchement = "fin" | "railroad" | "embranchement";

export function profilScene(scene: Pick<Scene, "choix">): ProfilBranchement {
  if (scene.choix.length === 0) return "fin";
  if (scene.choix.length === 1) return "railroad";
  return "embranchement";
}

export const PROFIL_LABEL: Record<ProfilBranchement, string> = {
  fin: "Fin",
  railroad: "Railroad",
  embranchement: "Embranchement",
};

/** Résumé structurel d'un scénario : passages linéaires, hubs, fins. Pur, sans migration. */
export function resumeScenario(scenario: Pick<Scenario, "scenes">): {
  total: number;
  hubs: number;
  fins: number;
  label: "vide" | "railroad" | "avec embranchements";
} {
  const total = scenario.scenes.length;
  let hubs = 0;
  let fins = 0;
  for (const s of scenario.scenes) {
    const p = profilScene(s);
    if (p === "embranchement") hubs += 1;
    if (p === "fin") fins += 1;
  }
  return { total, hubs, fins, label: total === 0 ? "vide" : hubs === 0 ? "railroad" : "avec embranchements" };
}
