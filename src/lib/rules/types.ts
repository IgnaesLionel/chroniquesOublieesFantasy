// Types du moteur de règles. Pur TypeScript, sans dépendance React.
// Toute règle COF V2 incertaine doit rester configurable, jamais devinée.

import type { Caracteristiques as CaracteristiquesCOF, DeRecupType, FamilleCOF } from "@/src/lib/rules/personnage";
import type { ArmeFamille } from "@/src/lib/rules/world/types";
import type { Bourse } from "@/src/lib/rules/bourse";

export type { CaracteristiquesCOF, DeRecupType, FamilleCOF };

export interface Caracteristiques {
  AGI: number;
  CON: number;
  FOR: number;
  PER: number;
  CHA: number;
  INT: number;
  VOL: number;
  /** Indexation par nom (substitution "1d4°+INT", calculs génériques). */
  [stat: string]: number;
}

/** Ancien bloc de stats (D&D-like) conservé pour migration des sauvegardes v2. */
export interface Stats {
  FOR: number;
  DEX: number;
  CON: number;
  INT: number;
  SAG: number;
  CHA: number;
}

export interface ArmureCOF {
  nom?: string;
  /** Bonus DEF apporté par l'armure (composante "Équipement" de 10+AGI+Équip+Mod). */
  def?: number;
  agiMax?: number | null;
}

export interface DesRecuperationCOF {
  type: DeRecupType;
  max: number;
  actuel: number;
}

export interface AttackDef {
  id: string;
  nom: string;
  /** Bonus au jet d'attaque (ex: +6) */
  bonus: number;
  /** Expression de dégâts normalisée moteur (ex: "1d8+3"). */
  degats: string;
  /** Affichage d'origine si normalisée (ex: "1d8+8+1d8", "DM 1"). */
  degatsAffiche?: string;
  /** Type d'action COF (A/M/L/G). Défaut : "attaque". Indicatif (géré en réel). */
  action?: ActionDRS;
  /** Touche automatique (pas de jet, ex. Rituel de sang) : dégâts + effet si applicable. */
  toucheAuto?: boolean;
  /** Moitié des dégâts en cas de jet raté (ex. Briser les cœurs). */
  demiDegatsSiRate?: boolean;
  /** Le lanceur récupère autant de PV que de DM infligés (ex. Baiser du vampire). */
  volDeVie?: boolean;
  /** Effet appliqué à la cible si TOUCHÉ (ex: poison d'une arme). */
  effetTouche?: {
    cle: string;
    duree: number | null;
    /** Dégâts par tour lancés au toucher (ex: "1d4", Saignements) -> pvParTour. */
    degatsParTour?: string;
    /** Modificateurs supplémentaires fusionnés (ex: { deMalus: 1 }). */
    mods?: Record<string, number>;
    /** Jet de sauvegarde (ex: CON 10 du Pied) : réussi = pas d'effet. */
    sauvegarde?: { carac: string; difficulte: number };
  };
  /** Familles d'arme (ex: ["arcs"]) : talents liés (Archer émérite). */
  familles?: ArmeFamille[];
}

/** Une entrée d'inventaire : référence un objet global + quantité + arme équipée ou non. */
export interface InventaireEntree {
  itemId: string;
  quantite: number;
  equipe: boolean;
}

export type SortType = "offensif" | "defensif" | "utilitaire";

/** Type d'action DRS : attaque (A), mouvement (M), limitée (L), gratuite (G). */
export type ActionDRS = "attaque" | "mouvement" | "limitee" | "gratuite";

export interface Sort {
  id: string;
  nom: string;
  type: SortType;
  /** École / élément : Feu, Glace, Arcanes, Sacré... (libre) */
  ecole?: string;
  description?: string;
  /**
   * Voie (arbre de talents) dont est issu le sort : ex. "Voie de la foi".
   * Les voies contiennent des capacités ; seuls les sorts (coût PM) vont au grimoire.
   */
  voie?: string;
  /** Rang dans la voie (1 à 5). Règle COF : le coût PM d'un sort = son rang. */
  rang?: number;
  /** Niveau minimum calculé (combat) : rang requis, gratuité Mage déduite. */
  niveauMin?: number;
  /** Type d'action DRS pour l'utiliser (A/M/L/G). */
  action?: ActionDRS;
  /**
   * Familles (profils) pouvant apprendre le sort : ex. ["Sorcier", "Magicien"].
   * Vide ou absent = accessible à toutes les classes.
   */
  familles?: string[];
  /** Sort offensif : bonus au jet. */
  bonus?: number;
  /** Sort offensif : dégâts (ex: "2d6"). */
  degats?: string;
  /** Sort défensif : soin (ex: "1d8+2"). */
  soin?: string;
  /** Effet appliqué (cible si offensif et TOUCHÉ, allié si défensif). Clé du catalogue. */
  effetCle?: string;
  effetDuree?: number | null;
  /** Dégâts par tour de l'effet, lancés au toucher (ex: "1d4", Saignements) -> pvParTour. */
  effetDegats?: string;
  /** Modificateurs supplémentaires de l'effet (ex: { deMalus: 1 }, Strangulation). */
  effetMods?: Record<string, number>;
  /** Jet de sauvegarde de l'effet (ex: CON 10 du Pied) : réussi = pas d'effet. */
  effetSauvegarde?: { carac: string; difficulte: number };
  /** Coût en ressource (ex: { ressource: "mana", montant: 2 }). */
  cout?: { ressource: string; montant: number };
  /** Sacrifice de PV du lanceur au lancer, en dés (ex: "1d4", Pacte démoniaque). Min 0 (KO possible). */
  coutPV?: string;
  /** Le lanceur récupère autant de PV que de DM infligés (ex. Baiser du vampire). */
  volDeVie?: boolean;
  /** Touche automatique, sans jet (ex. Rituel de sang : la cible saigne sans test). */
  toucheAuto?: boolean;
  /** Moitié des dégâts en cas de jet raté (ex. Briser les cœurs). */
  demiDegatsSiRate?: boolean;
  /** Limite d'utilisations par combat (ex: 1, Ensevelissement ; 1/jour ≈ 1 combat, Armée). */
  limiteCombat?: number;
  /** Limite par cible sur un combat, décomptée au TOUCHÉ (ex: Malédiction, Briser). */
  limiteParCible?: boolean;
  /** Attaque temporaire accordée au lanceur (ex: griffes de l'Aspect, contact de la Succube). */
  attaqueAccordee?: { nom: string; degats: string; bonus?: number; volDeVie?: boolean };
  /** Serviteur invoqué ajouté au combat (ex: démon, zombie). PV = base + parNiveau × niveau. */
  invocation?: {
    nom: string;
    pvBase: number;
    pvParNiveau: number;
    defense: number;
    /** "magique" = bonus magique du lanceur, sinon bonus fixe. */
    bonusAttaque: number | "magique";
    degats: string;
    initiative?: number;
  };
  /** Frappe de zone : dégâts + effet à tous les ennemis actifs (ex: Armée des morts). */
  zone?: boolean;
  /**
   * Restriction d'espèce : le sort ne blesse que ces espèces (libellés
   * comparés via normaliserCategorie, ex: Destruction du mal -> ["Mort-vivant"]).
   * Sur une autre espèce : 0 DM, effet non appliqué, log explicite.
   */
  cibleEspeces?: string[];
}

export interface ActiveEffect {
  id: string;
  nom: string;
  description?: string;
  /** null = permanent jusqu'à suppression manuelle */
  dureeTours: number | null;
  toursRestants: number | null;
  modificateurs: Record<string, number>;
  source?: string;
  /**
   * Tour (manche + index) où l'effet a été posé en combat.
   * Sert à ne pas consommer l'effet à la fin du tour pendant lequel il a
   * été appliqué : un "Ralenti (1 tour)" posé sur un ennemi doit couvrir
   * tout son prochain tour et n'expirer qu'à la fin de celui-ci — y compris
   * quand il est posé par quelqu'un d'autre ou par le porteur lui-même.
   */
  pose?: { manche: number; tourIndex: number };
}

interface CreatureBase {
  id: string;
  nom: string;
  pvMax: number;
  pv: number;
  defense: number;
  initMod: number;
  attaques: AttackDef[];
  effets: ActiveEffect[];
  notes?: string;
  /** true = donnée d'exemple, à remplacer par vos vraies stats COF V2 */
  exemple: boolean;
}

export interface Character extends CreatureBase {
  kind: "personnage";
  /** Profil (ex: "Guerrier", "Sorcier", "Rôdeur", "Prêtre"). Conservé pour compat ; voir `profil`. */
  classe: string;
  niveau: number;
  /** Caractéristiques COF Fantasy : AGI, CON, FOR, PER, CHA, INT, VOL. */
  caracteristiques: Caracteristiques;
  /** Ancien bloc de stats (sauvegardes v2) : migré vers `caracteristiques` au chargement. */
  stats?: Stats;
  /** Peuple : Humain, Demi-Elfe, Elfe haut, Nain (libre pour extensions). */
  peuple: string;
  /** Famille : Combattant, Aventurier, Mystique, Mage. */
  famille: FamilleCOF;
  /** Profil (14 profils du tableau). Si vide, repli sur `classe`. */
  profil: string;
  /** Idéal héroïque : narratif uniquement, aucun bonus. */
  idealHeroique?: string;
  /** Travers : narratif uniquement, aucun bonus. */
  travers?: string;
  /** Traits du peuple cochés / connus (textes informatifs). */
  traitsPeuple?: string[];
  /** Migration sorts effectuée (talents-sorts -> entrées lançables). */
  migreSorts?: boolean;
  /** Voie du mage adoptée (famille Mage) : remplace la voie du peuple en gardant son rang 1. */
  voieMage?: boolean;
  /** Armure portée (bonus DEF + AGI max éventuelle). */
  armure?: ArmureCOF;
  /** Composante "Équipement" de DEF = 10+AGI+Équip+Mod (prioritaire sur armure.def si renseigné). */
  defenseEquipement?: number;
  /** Composante "Mod" de DEF (bonus/malus temporaires intégrés au champ stocké). */
  defenseMod?: number;
  /** Dés de récupération : type (d6/d8/d10) + réserve. */
  desRecuperation?: DesRecuperationCOF;
  capacites: string[];
  ressources: Record<string, { max: number; actuel: number }>;
  /** Objets possédés ; les armes équipées servent en combat. */
  inventaire: InventaireEntree[];
  /** Bourse (pp / po / pa). */
  bourse?: Bourse;
  /** Sorts connus (offensifs utilisables comme attaques, défensifs comme soutien). */
  sorts: Sort[];
}

export interface MonsterTemplate extends Omit<CreatureBase, "pv" | "effets"> {
  kind: "monstre";
  type: string;
  /** Niveau de créature (NC Notion, peut être 0 ou fractionnaire). */
  niveau: number;
  pv: number;
  capacites: string[];
  /** Clés du catalogue partagé (capacites-partagees.ts). */
  capacitesPartagees?: string[];
  /** Textes complets des capacités (transcriptions Notion). */
  capacitesDetails?: { nom: string; description: string }[];
  description?: string;
  comportement?: string;
  /** Champs fiche Notion : taille, catégorie, RD, déplacement, initiative affichée, source. */
  taille?: string;
  categorie?: string;
  /**
   * Sous-catégories libres (libellés bruts, ex: ["Mort-vivant"]) : une
   * créature "Monstres/Créatures" peut aussi être un mort-vivant, un
   * "Humanoïde" peut être un démon... Comparer via normaliserCategorie /
   * estDeCategorie (insensible casse/accents/pluriels usuels).
   */
  sousCategories?: string[];
  rd?: number;
  deplacement?: number | null;
  initiativeFiche?: number;
  sourceUrl?: string;
}

/** Capacité partagée par plusieurs créatures (ex: Vol rapide). Texte informatif. */
export interface CapacitePartagee {
  cle: string;
  nom: string;
  resume: string;
  texte: string;
  /** Précision d'application manuelle éventuelle. */
  mecanique?: string;
}
