// Types du moteur de combat pur. Sans React.
// Les règles COF V2 non confirmées sont isolées dans CombatOptions.

import type { ActiveEffect, AttackDef, DeRecupType, Sort } from "@/src/lib/rules/types";
import type { ArmeFamille } from "@/src/lib/rules/world/types";
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
  /** Niveau du personnage (verrous de niveau des sorts : niveauMin). */
  niveau: number;
  /** Talents connus (noms) : utilisables tels quels via le panneau Capacités. */
  capacites: string[];
  /** Copie des ressources du personnage (ex: mana) pour les coûts de sorts. */
  ressources: Record<string, { max: number; actuel: number }>;
  /** Dé de récupération de la fiche (d6/d8/d10) : brûlure de mana (1 DR par PM). Absent = pas de brûlure (monstres, invocations). */
  deRecuperation?: DeRecupType;
  statut: Statut;
  /** Bonus d'attaque magique (niv+VOL) : invocations, jets MJ. */
  bonusMagique?: number;
  /** Caractéristiques (substitution "1d4°+INT" des attaques accordées). */
  caracs?: Record<string, number>;
  /** Profil (voies suivies : loup, tactiques...). */
  profil?: string;
  /**
   * Espèces/catégories normalisées (type + catégorie + sous-catégories du
   * template : "creature", "monstres/creatures", "mort-vivant"...).
   * Renseigné pour les monstres ; vide/absent pour les PJ. Tester avec
   * estDeCategorie (src/lib/rules/categories.ts).
   */
  categories?: string[];
  /** Sous-catégories brutes du template (libellés d'affichage : "Mort-vivant"). */
  sousCategories?: string[];
  /** Usages de sorts limités : sortId -> { tentatives, cibles touchées }. */
  usagesSorts?: Record<string, { n: number; cibles: string[] }>;
  /** Sort absorbé (Absorber) en attente de renvoi. */
  sortAbsorbe?: SortAbsorbe;
  /**
   * Modificateur de DEF du bouclier manié (null = pas de bouclier).
   * Voie du bouclier : requis pour Protéger/Parer/Absorber/Renvoi et le
   * bonus passif. Figé à l'entrée en combat (resync depuis la fiche).
   */
  bouclierBonus?: number | null;
  /** Taille (bestiaire : Minuscule... Énorme) : Ensevelissement (moyenne ou moins). Absente = compatible (MJ). */
  taille?: string;
  /** Serviteur invoqué : qui l'a appelé + espèce (comptage, poussière des zombies). */
  invoque?: { par: string; espece: string };
  /**
   * Compagnon animal : instanceId du maître (rôdeur) en combat.
   * Posé à la construction (staging ou appel) : sert à Tactiques de meute
   * (même cible même manche) et au Lien empathique. Repli historique :
   * templateId `compagnon:loup:<templateId du maître>` ou nom `Loup (Nom)`.
   */
  compagnonDe?: string;
  /** Dernier coup porté (Double peine : 2e touche même cible même round). */
  dernierCoup?: { cibleId: string; manche: number; enchaine: boolean };
  /**
   * Compteurs journaliers recopiés de la fiche (quotas 1/jour, mineure...) :
   * incrémentés en combat, réécrits vers la fiche à "Appliquer aux fiches".
   */
  usagesJournaliers?: Record<string, number>;
  /**
   * Soin magique déjà reçu ce combat (règle de table LDB : un seul soin
   * magique par cible et par combat, potions incluses côté MJ).
   * Posé après tout soin de sort/capacité ; MJ peut outrepasser.
   */
  soinMagiqueRecu?: boolean;
  /**
   * Voie du maître d'armes : famille d'armes de prédilection (copie de la
   * fiche). +1 attaque, Science du critique 19-20 et Spécialisation (+N DM)
   * auto quand l'attaque est de cette famille (resolveAttack). Absent = aucun.
   */
  famillePredilection?: ArmeFamille;
  /** Spécialisation : bonus DM fixe (0-6) avec l'arme de prédilection. */
  bonusSpecialisation?: number;
}

/** Sort absorbé par un bouclier, renvoyable (Renvoi de sort ; zones rejouées en mono-cible, MJ au cas par cas). */
export interface SortAbsorbe {
  nom: string;
  bonus: number;
  degats: string;
  effetCle?: string;
  effetDuree?: number | null;
  effetDegats?: string;
  effetMods?: Record<string, number>;
  zone?: boolean;
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
  /** 20 naturel = touche auto + critique (confirmé COF V2, physique et magique). */
  nat20ToucheAuto: boolean;
  /** 1 naturel = échec auto (confirmé COF V2 ; la chance +10 peut le rattraper). */
  nat1EchecAuto: boolean;
  /** Multiplicateur de dégâts en critique (bonus inclus, confirmé COF V2). */
  multiplicateur: number;
}

export interface CombatOptions {
  critique: CritOptions;
  /** Faut-il sauter les KO/morts lors du nextTurn ? */
  sauterKO: boolean;
}

export const DEFAULT_COMBAT_OPTIONS: CombatOptions = {
  // Confirmé COF V2 : nat 20 = touche auto + critique ×2 (bonus inclus, physique et magique).
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
  /** Second d20 (dé bonus/malus) : null si jet simple. */
  jetSecondaire?: number | null;
  /** "bonus" = garder le meilleur, "malus" = garder le pire, null = jet simple. */
  desAvantage?: "bonus" | "malus" | null;
  /** Vrai si touche automatique sans jet (Rituel de sang). */
  toucheAuto?: boolean;
  jetTotal: number;
  defenseCible: number;
  touche: boolean;
  critique: boolean;
  degatsDetails: number[];
  degatsTotal: number;
  pvAvant: number;
  pvApres: number;
  cibleTombe: boolean;
  /** Riposte Sang mordant (null si non déclenchée). */
  sangMordant?: { degats: number; pvAttaquantApres: number } | null;
}
