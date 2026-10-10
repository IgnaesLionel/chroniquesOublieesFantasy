// Types du moteur de combat pur. Sans React.
// Les règles COF V2 non confirmées sont isolées dans CombatOptions.

import type { ActiveEffect, AttackDef, Sort } from "@/src/lib/rules/types";
import type { Rng } from "@/src/lib/rules/dice/roller";

export type Camp = "pj" | "monstre";
export type Statut = "actif" | "ko" | "mort";

export interface CombatParticipant {
  instanceId: string;
  templateId: string;
  nom: string;
  camp: Camp;
  pvMax: number;
  pv: number;
  defense: number;
  initMod: number;
  initiative: number | null;
  attaques: AttackDef[];
  effets: ActiveEffect[];
  /** Sorts connus (offensifs fusionnés dans attaques, défensifs lançables en soutien). */
  sorts: Sort[];
  /** Talents connus (noms) : utilisables tels quels via le panneau Capacités. */
  capacites: string[];
  /** Copie des ressources du personnage (ex: mana) pour les coûts de sorts. */
  ressources: Record<string, { max: number; actuel: number }>;
  statut: Statut;
}

export interface CombatLogEntry {
  id: string;
  at: string;
  manche: number;
  message: string;
}

export interface CombatState {
  id: string;
  participants: CombatParticipant[];
  /** Index dans participants (triés par initiative après rollInitiatives). */
  tourIndex: number;
  manche: number;
  log: CombatLogEntry[];
  termine: boolean;
  gagnant: Camp | "egalite" | null;
}

export interface CritOptions {
  /** 20 naturel = touche auto. À confirmer COF V2. */
  nat20ToucheAuto: boolean;
  /** 1 naturel = échec auto. À confirmer COF V2. */
  nat1EchecAuto: boolean;
  /** Multiplicateur de dégâts en critique (ex: 2 = doublés). Configurable. */
  multiplicateur: number;
}

export interface CombatOptions {
  critique: CritOptions;
  /** Faut-il sauter les KO/morts lors du nextTurn ? */
  sauterKO: boolean;
}

export const DEFAULT_COMBAT_OPTIONS: CombatOptions = {
  // TODO_RULE COF V2 : valider critique / échec auto avec vos livres.
  critique: { nat20ToucheAuto: true, nat1EchecAuto: true, multiplicateur: 2 },
  sauterKO: true,
};

export type RngProvider = Rng;

export interface AttackResolution {
  attaquantId: string;
  attaquantNom: string;
  cibleId: string;
  cibleNom: string;
  attaqueNom: string;
  jetNaturel: number;
  jetTotal: number;
  defenseCible: number;
  touche: boolean;
  critique: boolean;
  degatsDetails: number[];
  degatsTotal: number;
  pvAvant: number;
  pvApres: number;
  cibleTombe: boolean;
}
