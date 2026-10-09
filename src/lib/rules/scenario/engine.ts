import type { FlagValue, PlayState, Scenario, Scene } from "@/src/lib/rules/scenario/types";
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

export function startPlay(scenario: Scenario): PlayState {
  const dep = getDepart(scenario);
  return { scenarioId: scenario.id, sceneId: dep.id, historique: [dep.id], flags: {} };
}

/** Suit un choix : vérifie la condition (SI/SINON) puis navigue. */
export function followChoice(scenario: Scenario, play: PlayState, choiceId: string): PlayState {
  const current = getScene(scenario, play.sceneId);
  const choice = current.choix.find((c) => c.id === choiceId);
  if (!choice) throw new Error("Choix invalide.");
  if (!evaluateCondition(choice.condition, play.flags)) throw new Error("Condition non remplie pour ce choix.");
  const next = getScene(scenario, choice.versSceneId);
  return { ...play, sceneId: next.id, historique: [...play.historique, next.id] };
}

/** Définit un flag (clé, indice, chef_mort...). */
export function setFlag(play: PlayState, flag: string, valeur: FlagValue): PlayState {
  return { ...play, flags: { ...play.flags, [flag]: valeur } };
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
