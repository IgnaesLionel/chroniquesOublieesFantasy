import type { Character, MonsterTemplate } from "@/src/lib/rules/types";
import { deriverPersonnage, normaliserNomCapacite, recalculerPersonnage, sortDuTalent } from "@/src/lib/rules/personnage";
import { peutEquiper } from "@/src/lib/rules/equipement";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import monstresNotion from "@/src/lib/data/monstres-notion.json";

// Personnages COF Fantasy transcrits des 4 fiches (niv. 1).
// Formules appliquées :
//   INIT = 10+PER · DEF = 10+AGI+Équip+Mod · PV = base famille+CON
//   (Combattant 10 / Aventurier 8 / Mystique 8 / Mage 6)
//   Chance = 2+CHA (+1 si Aventurier), réserve complète à la création.
//   DR : d10 Combattant, d8 Aventurier, d8+1 Mystique, d6 Mage,
//   nombre max = 2+CON (+1 si Mystique, soit 3+CON à la création),
//   mais réserve initiale = base sans CON : 2 dés (3 si Mystique).
//   Ex : Guerrier CON+3 -> 2/5, Prêtre CON+1 -> 3/4.
//   Contact = niv+FOR · Distance = niv+AGI · Magique = niv+VOL
//   Mana = VOL + nb sorts connus (min 0), réserve complète à la création.
//   Idéal héroïque / travers : narratifs, aucun bonus.
//   Création niv. 1 (voir src/lib/rules/creation.ts) : 2 pts -> 2 capacités
//   de rang 1 du profil + rang 1 de peuple gratuit (+ rang 2 gratuit : les 4 Mages).
//   Les cases non cochées des fiches (capacités futures des voies) ne sont pas apprises.

export const SEED_CHARACTERS: Character[] = [
  {
    id: "pj-sorcier-humain", kind: "personnage", nom: "Maë", classe: "Sorcier", niveau: 1,
    peuple: "Humain", famille: "Mage", profil: "Sorcier",
    caracteristiques: { AGI: 1, CON: 1, FOR: -1, PER: 0, CHA: -1, INT: 2, VOL: 4 },
    idealHeroique: "Sens du sacrifice", travers: "Hautain",
    // Voie du mage non adoptée : voie du peuple conservée (rang 1 seul).
    traitsPeuple: ["Diversité"],
    pvMax: 7, pv: 7, defense: 14, initMod: 0,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Un pied dans la tombe (Voie de l'outre-tombe R1)
    // + Armure d'os (Voie de l'outre-tombe R2, +3 DEF passif).
    // Voie du mage abandonnée : pas de rang 2 gratuit (donc pas de Maîtrise de
    // la magie) — écart assumé : Armure d'os (rang 2) au niveau 1, la table
    // DRS n'ouvrant le rang 2 qu'au niveau 2 hors gratuité Mage.
    capacites: ["Un pied dans la tombe", "Armure d'os"],
    ressources: {
      mana: { max: 5, actuel: 5 },
      chance: { max: 1, actuel: 1 },
    },
    desRecuperation: { type: "d6", max: 3, actuel: 2 },
    effets: [], notes: "Armure d'os : +3 DEF passif (11 -> 14). Voie du mage non adoptée (Diversité seule) : écart assumé « Armure d'os : niveau 2 requis ».", exemple: false,
    inventaire: [
      { itemId: "item-dague", quantite: 1, equipe: true },
      { itemId: "item-grimoire", quantite: 1, equipe: true },
    ],
    // Sorts lançables en combat (attaque magique = niv+VOL = 5) et en soutien.
    // Mana = VOL (4) + sorts connus (1).
    sorts: [
      {
        id: "mae-pied-tombe", nom: "Un pied dans la tombe", type: "offensif",
        voie: "Voie de l'outre-tombe", rang: 1,
        description: "Test opposé d'attaque magique (10 m, vivant) : 1d4°+INT DM, et ralenti 1 round (test CON 10).",
        familles: ["Sorcier"],
        cout: { ressource: "mana", montant: 1 },
      },
    ],
  },
  {
    id: "pj-rodeur-demi-elfe", kind: "personnage", nom: "Nyssa", classe: "Rôdeur", niveau: 1,
    peuple: "Demi-Elfe", famille: "Aventurier", profil: "Rôdeur",
    caracteristiques: { AGI: 3, CON: 1, FOR: 1, PER: 2, CHA: 0, INT: 0, VOL: -1 },
    idealHeroique: "Liberté", travers: "Distrait",
    traitsPeuple: ["Lumière des étoiles"],
    pvMax: 9, pv: 9, defense: 13, initMod: 2,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Archer émérite (Voie de l'archer) + Le loup
    // (Voie du compagnon animal) : le loup rejoint la rencontre en préparation.
    capacites: ["Archer émérite", "Le loup"],
    ressources: {
      mana: { max: 0, actuel: 0 },
      chance: { max: 3, actuel: 3 },
    },
    desRecuperation: { type: "d8", max: 3, actuel: 2 },
    effets: [], notes: "Magique fiche = 1 (formule niv+VOL = 0 ; écart conservé de la fiche). Init fiche +2 (10+PER+1 archer = 13).", exemple: false,
    inventaire: [{ itemId: "item-arc-court", quantite: 1, equipe: true }],
    sorts: [],
  },
  {
    id: "pj-pretre-elfe-haut", kind: "personnage", nom: "Isildeen", classe: "Prêtre", niveau: 1,
    peuple: "Elfe haut", famille: "Mystique", profil: "Prêtre",
    caracteristiques: { AGI: 0, CON: 1, FOR: 0, PER: 0, CHA: 4, INT: 0, VOL: 2 },
    idealHeroique: "Pacifisme", travers: "Phobie du feu",
    traitsPeuple: ["Lumière intérieure"],
    pvMax: 9, pv: 9, defense: 10, initMod: 0,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Bénédiction + Récupération mineure (rang 1 Prêtre).
    capacites: ["Bénédiction", "Récupération mineure"],
    ressources: {
      mana: { max: 4, actuel: 4 },
      chance: { max: 6, actuel: 6 },
    },
    desRecuperation: { type: "d8", max: 4, actuel: 3 },
    effets: [], notes: "", exemple: false,
    inventaire: [{ itemId: "item-baton-ferre", quantite: 1, equipe: true }],
    // Sorts de soutien (mana = VOL (2) + sorts connus (2)).
    sorts: [
      {
        id: "isildeen-benediction", nom: "Bénédiction", type: "defensif",
        voie: "Voie de la prière", rang: 1,
        description: "Chant : alliés en vue +1 aux tests et attaques pendant CHA minutes.",
        familles: ["Prêtre"],
        effetCle: "bonus-attaque", effetDuree: null,
        cout: { ressource: "mana", montant: 1 },
      },
      {
        id: "isildeen-recuperation", nom: "Récupération mineure", type: "defensif",
        voie: "Voie des soins", rang: 1,
        description: "Mains au contact (ou soi) : 1d4°+CHA PV.",
        familles: ["Prêtre"],
        soin: "1d4°+CHA",
        cout: { ressource: "mana", montant: 1 },
      },
    ],
  },
  {
    id: "pj-guerrier-nain", kind: "personnage", nom: "Thornak", classe: "Guerrier", niveau: 1,
    peuple: "Nain", famille: "Combattant", profil: "Guerrier",
    caracteristiques: { AGI: 1, CON: 3, FOR: 2, PER: 1, CHA: 0, INT: 0, VOL: -1 },
    idealHeroique: "Honneur", travers: "Impatient",
    // Fiche : "Habitants des tunnels" (pluriel) ; nom DRS canonique au singulier
    // pour matcher la voie (cases du modal, règle de création).
    traitsPeuple: ["Habitant des tunnels"],
    // DRS Robustesse (Voie résistance R1) : PV max +rang+2 = +3 auto (10+CON 3+3 = 16).
    // Défense 11 + 1 (Petit bouclier équipé) = 12.
    pvMax: 16, pv: 16, defense: 12, initMod: 1,
    defenseEquipement: 0, defenseMod: 0,
    attaques: [],
    // Création : 2 pts -> Protéger un allié + Robustesse (rang 1 Guerrier).
    // Protéger un allié (Voie du bouclier R1) exige un bouclier manié : le petit
    // bouclier le rend utilisable (+1 DEF, 1 main, hache 1 main = 2 mains).
    capacites: ["Protéger un allié", "Robustesse"],
    ressources: {
      mana: { max: 0, actuel: 0 },
      chance: { max: 2, actuel: 2 },
    },
    desRecuperation: { type: "d10", max: 5, actuel: 2 },
    effets: [], notes: "Fiche d'origine : 14 PV affichés (DRS : 10+CON+Robustesse = 16) ; petit bouclier équipé (DEF 11 -> 12).", exemple: false,
    inventaire: [
      { itemId: "item-hache-1main", quantite: 1, equipe: true },
      { itemId: "item-petit-bouclier", quantite: 1, equipe: true },
    ],
    sorts: [],
  },
];

/** Bestiaire Notion de l'utilisateur (95 créatures, exemple:false). Régénéré via bestiaire/import_notion.py. */
export const SEED_MONSTERS: MonsterTemplate[] = monstresNotion as MonsterTemplate[];

/**
 * Renommages des fiches graines. L'id (identité de sauvegarde) ne change pas :
 * les sauvegardes locales sont migrées à la lecture, seules les fiches connues
 * portant ENCORE l'ancien nom suivent le nouveau (niveau, PV, talents, sorts et
 * équipement conservés) ; un nom choisi par le MJ est respecté.
 */
const RENOMMAGES_GRAINES: Record<string, { avant: string; apres: string }> = {
  "pj-sorcier-humain": { avant: "Mirabel", apres: "Maë" },
  "pj-rodeur-demi-elfe": { avant: "Faelyn", apres: "Nyssa" },
  "pj-pretre-elfe-haut": { avant: "Aelion", apres: "Isildeen" },
  "pj-guerrier-nain": { avant: "Dorain", apres: "Thornak" },
};

/** Applique les renommages de graines aux fiches enregistrées (pure, idempotente). */
export function avecNomsGrainesPersonnages(personnages: Character[]): Character[] {
  let touche = false;
  const liste = personnages.map((p) => {
    const r = RENOMMAGES_GRAINES[p.id];
    if (!r || p.nom !== r.avant) return p;
    touche = true;
    return { ...p, nom: r.apres };
  });
  return touche ? liste : personnages;
}

/**
 * Révisions de création des fiches graines : talents abandonnés au profit des
 * nouveaux, à la même place (ex. Nyssa : Survie -> Le loup, Voie du compagnon
 * animal), et corrections plus larges d'une création entière (ex. Maë : Voie du
 * mage abandonnée -> Malédiction/Saignements/Maîtrise de la magie sortent, Un
 * pied dans la tombe + Armure d'os entrent).
 * Même règle que les renommages : la fiche est reconnue par son id et n'est
 * corrigée que si elle possède ENCORE le talent-marqueur de l'ancienne création
 * sans avoir déjà tous les nouveaux (un travail déjà fait à la main, ou un
 * talent retiré par le MJ, n'est jamais réécrit). Les sorts des talents retirés
 * partent avec eux, les nouveaux amènent leur sort du grimoire s'il existe, et
 * les dérivés suivent (DEF, mana) sans jamais rabaisser la DEF du MJ. PV,
 * niveau, équipement et sorts gagnés en jeu sont conservés.
 */
const REVISIONS_GRAINES: Record<
  string,
  { marqueur: string; retirer: string[]; ajouter: string[]; traitsPeuple?: string[]; retirerVoieMage?: boolean }
> = {
  "pj-rodeur-demi-elfe": { marqueur: "Survie", retirer: ["Survie"], ajouter: ["Le loup"] },
  "pj-sorcier-humain": {
    marqueur: "Saignements",
    retirer: ["Malédiction", "Saignements", "Maîtrise de la magie"],
    ajouter: ["Un pied dans la tombe", "Armure d'os"],
    traitsPeuple: ["Diversité"],
    retirerVoieMage: true,
  },
};

/** Applique les révisions de création des graines (pure, idempotente). */
export function avecRevisionsGrainesPersonnages(personnages: Character[]): Character[] {
  const cle = (t: string) => normaliserNomCapacite(t);
  let touche = false;
  const liste = personnages.map((p) => {
    const rev = REVISIONS_GRAINES[p.id];
    if (!rev) return p;
    const capacites = p.capacites ?? [];
    if (!capacites.some((t) => cle(t) === cle(rev.marqueur))) return p;
    const ajouts = rev.ajouter.filter((t) => !capacites.some((x) => cle(x) === cle(t)));
    if (ajouts.length === 0) return p;
    touche = true;
    // Les nouveaux talents prennent la place des retirés, dans l'ordre.
    const retirees = new Set(rev.retirer.map(cle));
    const suivantes: string[] = [];
    let i = 0;
    for (const t of capacites) {
      if (retirees.has(cle(t))) {
        if (i < ajouts.length) {
          suivantes.push(ajouts[i]);
          i += 1;
        }
        continue;
      }
      suivantes.push(t);
    }
    for (; i < ajouts.length; i += 1) suivantes.push(ajouts[i]);
    // Sorts : ceux des talents retirés partent, ceux des nouveaux arrivent.
    const sorts = (p.sorts ?? []).filter((s) => !retirees.has(cle(s.nom)));
    for (const t of rev.ajouter) {
      const modele = sortDuTalent(t, SEED_SORTS);
      if (modele && !sorts.some((s) => cle(s.nom) === cle(modele.nom))) {
        sorts.push({ ...modele, id: `${p.id}-${modele.id}` });
      }
    }
    const corrige: Character = {
      ...p,
      capacites: suivantes,
      sorts,
      ...(rev.traitsPeuple ? { traitsPeuple: [...rev.traitsPeuple] } : {}),
      ...(rev.retirerVoieMage ? { voieMage: undefined } : {}),
    };
    const resynchronise = recalculerPersonnage(corrige, SEED_ITEMS);
    return {
      ...resynchronise,
      defense: Math.max(typeof p.defense === "number" ? p.defense : 0, resynchronise.defense),
    };
  });
  return touche ? liste : personnages;
}

/**
 * Équipements de départ des fiches graines : l'objet manquant est ajouté ÉQUIPÉ,
 * le reste de la fiche n'est jamais touché (niveau, PV, talents, sorts, objets et
 * réglages du MJ conservés ; jamais de doublon). Ajout refusé si l'équipé du MJ ne
 * le permet plus (mains/ bouclier déjà pris) : sa configuration prime. La défense
 * stockée suit le bonus gagné (jamais en dessous de la valeur dérivée), pour qu'une
 * fiche non recalculée affiche déjà la bonne DEF.
 */
const EQUIPEMENTS_GRAINES: Record<string, { itemId: string; quantite: number }> = {
  "pj-guerrier-nain": { itemId: "item-petit-bouclier", quantite: 1 },
};

/** Applique les équipements de départ des graines (pure, idempotente). */
export function avecEquipementGrainesPersonnages(personnages: Character[]): Character[] {
  let touche = false;
  const liste = personnages.map((p) => {
    const ajout = EQUIPEMENTS_GRAINES[p.id];
    if (!ajout) return p;
    const inventaire = p.inventaire ?? [];
    if (inventaire.some((e) => e.itemId === ajout.itemId)) return p;
    if (!peutEquiper(inventaire, SEED_ITEMS, ajout.itemId).ok) return p;
    touche = true;
    const avecObjet: Character = { ...p, inventaire: [...inventaire, { ...ajout, equipe: true }] };
    const derivee = deriverPersonnage(avecObjet, SEED_ITEMS).defense;
    return { ...avecObjet, defense: Math.max(typeof p.defense === "number" ? p.defense : 0, derivee) };
  });
  return touche ? liste : personnages;
}

/** Migrations des fiches graines enregistrées (nom, révisions de création puis équipement). Idempotente. */
export function migrerGrainesPersonnages(personnages: Character[]): Character[] {
  return avecEquipementGrainesPersonnages(
    avecRevisionsGrainesPersonnages(avecNomsGrainesPersonnages(personnages))
  );
}

const SEED_SOUS_CATEGORIES = new Map<string, string[]>(
  SEED_MONSTERS.filter((m) => (m.sousCategories ?? []).length > 0).map((m) => [m.id, [...m.sousCategories!]])
);

/**
 * Migration douce des sauvegardes locales : le localStorage peut contenir des
 * monstres enregistrés AVANT l'ajout des sous-catégories (champ absent).
 * Pour ceux-là uniquement (champ undefined + id connu des graines), on
 * reporte les tags de la graine sans toucher au reste (ni aux monstres
 * créés/édités par l'utilisateur : champ défini, même vide, = choix du MJ).
 */
export function avecSousCategoriesGraines(monstres: MonsterTemplate[]): MonsterTemplate[] {
  let touche = false;
  const liste = monstres.map((m) => {
    if (m.sousCategories !== undefined) return m;
    const tags = SEED_SOUS_CATEGORIES.get(m.id);
    if (!tags) return m;
    touche = true;
    return { ...m, sousCategories: [...tags] };
  });
  return touche ? liste : monstres;
}
