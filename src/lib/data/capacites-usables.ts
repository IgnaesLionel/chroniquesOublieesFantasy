// Usages par défaut des talents en combat : quel effet appliquer quand on
// utilise tel talent, et sur qui par défaut. Le MJ peut toujours choisir un
// autre effet (ou aucun : usage noté au journal) dans le panneau Capacités.
// Seuls les cas mécaniquement directs y figurent ; le reste se gère au cas
// par cas (durées variables, dés bonus non modélisés, etc.).
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";

export type CibleCapacite = "allies" | "ennemis" | "tous" | "soi";

export interface CapaciteUsable {
  /** Nom exact du talent (comparaison insensible à la casse, suffixes (L)/(A)... ignorés). */
  talent: string;
  /** Clé du catalogue d'effets appliquée par défaut (null = aucun, narratif seul). */
  effetCle?: string | null;
  /** Durée par défaut (null = jusqu'à suppression manuelle). */
  dureeTours: number | null;
  /** Cibles suggérées par défaut. */
  cibles: CibleCapacite;
  /** Modificateurs supplémentaires de l'effet (ex: { deMalus: 1 }). */
  mods?: Record<string, number>;
  /** Sacrifice de PV du lanceur en dés (ex: "1d4°", Pacte démoniaque). */
  coutPV?: string;
  /** Soin en dés du lanceur (ex: "4d4°+CON", Increvable). */
  soin?: string;
  /** Montant saisi par le MJ au lieu d'un jet (ex: Siphon = NC PV) : "soin". */
  montantMJ?: "soin" | "lien";
  /** Purge les états non permanents de la cible (ex: Increvable). */
  nettoie?: boolean;
  /** Action moteur spéciale (ex: "renvoi" du Renvoi de sort, "proteger" de Protéger un allié). */
  actionSpeciale?: "renvoi" | "proteger" | "vigueur" | "lien-empathique";
  /** Écart éventuel avec le texte DRS (approximation moteur). */
  note?: string;
}

export const CAPACITES_USABLES: CapaciteUsable[] = [ {
    talent: "Protéger un allié",
    effetCle: "protection",
    dureeTours: 1,
    cibles: "allies",
    actionSpeciale: "proteger",
    note: "Guerrier (G, bouclier requis) : mod. DEF du bouclier à un allié au contact (MJ) contre la prochaine attaque (1/round, annoncée avant le résultat) ; le guerrier garde son bonus ; pas si surpris.",
  },
  {
    talent: "Pacte démoniaque",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    coutPV: "1d4°",
    note: "Sorcier (G) : +INT à un d20 ou en DEF (avant résolution, MJ) + VOL aux DR auto (max).",
  },
  {
    talent: "Siphon des âmes",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    montantMJ: "soin",
    note: "Sorcier, 1/round : mort d'un humanoïde vivant à 20 m = +NC PV (NC saisi par le MJ ; variante 1 PM si niv. 3+ et NC>4 : manuelle).",
  },
  {
    talent: "Armure d'os",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +3 DEF auto (+1 par rang 4 en voie sorcier, auto), 10 min d'entretien/jour, sans malus AGI.",
  },
  {
    talent: "Exsangue",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +2 DEF auto (+3 si rang 5 en Voie du sang, −1 si torse mundane sans Armure d'os) ; à 0 PV agit avec dé malus (MJ).",
  },
  {
    talent: "Pacte ténébreux",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "Sorcier : CON +1 auto (PV, DR), vision nocturne, dé bonus CON (MJ) ; +2d4° aux DM du prochain sort : coût auto, bonus via le champ +DM du panneau Attaque (MJ).",
  },
  {
    talent: "Prouesse",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "1/round (G) : sacrifier 1d4° PV pour +5 à un test de FOR ou CON, même après le jet (MJ : test manuel).",
  },
  {
    talent: "Tour de force",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    coutPV: "1d4°",
    note: "+10 à un test de FOR (pas DM ni attaque) pour 1d4° PV (MJ : test manuel).",
  },
  {
    talent: "Feindre la mort",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    soin: "1d4°",
    note: "1/combat (G) : passe pour mort (INT 20 pour percer, MJ), se relève avec adversaire surpris.",
  },
  {
    talent: "Phénix",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    soin: "2d4°+CHA",
    note: "Automatique 1/jour (moteur : déclenché à 0 PV, jet unique, alliés 20 m au montant, prêtre au double). Le bouton reste en secours MJ (1 cible).",
  },
  {
    talent: "Attaque puissante",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Cocher Puissante dans le panneau Attaque (dé malus +2d4° DM, L +3d4°).",
  },
  {
    talent: "Attaque brutale",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : +1d4 DM, ou −3 en attaque pour +2d4 ; recul 3 m ou renversé NC < rang (MJ).",
  },
  {
    talent: "Double attaque",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : deux attaques à −2 (MJ : −2 en Mod. attaque, 2 lancers).",
  },
  {
    talent: "Attaque circulaire",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Contact (L) : une attaque à −2 par adversaire au contact, 1 lancer chacun (MJ).",
  },
  {
    talent: "Charge",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Charge 5-10 m (10-20 m à cheval) : cocher Parfaite (dé bonus +1d4°) ; bloqueur FOR 20 ou passage cédé (MJ).",
  },
  {
    talent: "Attaque bondissante",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Charge druide/félin 5-10 m : Parfaite (dé bonus +1d4°) ; pas au contact.",
  },
  {
    talent: "Tir de barrage",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Surveillance 20 m (L) : DM arme ×2 ou stoppé sans DM (MJ : +DM).",
  },
  {
    talent: "Tir de grenaille",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Cône (L), 1 test contre tous : moitié DM (MJ : diviser).",
  },
  {
    talent: "Attaque tourbillon",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (L) : DM de l'arme à tous dans 5 m (MJ : résoudre chacun).",
  },
  {
    talent: "Frappe du justicier",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Attaque ratée = moitié DM, 1 naturel = rien (MJ : diviser).",
  },
  {
    talent: "As de la gâchette",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "Poudre/arbalète, jet ≥ DEF+10 : +2d4 DM (MJ : +DM).",
  },
  {
    talent: "Ouverture mortelle",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (L) : critique auto + sournoise non doublée (MJ).",
  },
  {
    talent: "Mon armure est une arme",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (G) : 1d4+FOR auto + renversé/étourdi/recul si FOR inférieure (MJ).",
  },
  {
    talent: "Fureur du dragon",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1/combat (L) : 3d4+FOR auto à tous au contact + FOR 10 ou renversés (MJ).",
  },
  {
    talent: "Maître du poison",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "3 doses/jour : arme +2d4 DM (création) + affaibli CON 10+INT, inconscience 2d6 min si ingéré (MJ).",
  },
  {
    talent: "Esquive acrobatique",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test distance vs attaque = 0 DM, critique = DM normaux (MJ).",
  },
  {
    talent: "Esquive de la magie",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test distance opposé pour échapper à un sort à DM (MJ).",
  },
  {
    talent: "Feinte",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(L) : CHA vs PER puis +2×rang en attaque et +2d4 DM si réussie (MJ : Mod.).",
  },
  {
    talent: "Intelligence du combat",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(M) 1/combat : désarmer/renverser/aveugler 1 round, NC inférieur, INT opposé (MJ).",
  },
  {
    talent: "Baratin",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    note: "Rang+2 baratin/séduction/marché noir ; parchemins et baguettes, test magique diff 10+2×rang (MJ).",
  },
  {
    talent: "Provocation",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(L) : CHA vs INT (humanoïde 10 m) forcé à l'attaquer + riposte gratuite sournoise ou +1d4 (MJ).",
  },
  {
    talent: "Pression mortelle",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "(M) : mains nues, +1d4/attaque comptabilisés puis libérés sur test contact (L) dans l'heure (MJ).",
  },
  {
    talent: "Rage du berserk",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/jour (L) : +1d4 DM contact, −2 DEF (Équip. DEF), dé bonus VOL ; ni sorts ni concentration (MJ).",
  },
  {
    talent: "Furie du berserk",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "2 rages (L) : +2d4 au lieu d'1d4, −4 DEF (MJ), fin sur VOL 20 (MJ).",
  },
  {
    talent: "Défier la mort",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/combat : DM létaux → 1 PV sur CON 10, auto si enragé (MJ).",
  },
  {
    talent: "Repli",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "(L) en nature : 30 m + AGI 10 (15 à découvert) pour disparaître (MJ).",
  },
  {
    talent: "Acrobaties",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : AGI 15 pour franchir ou dos + sournoise/+1d4 (MJ).",
  },
  {
    talent: "Piège explosif",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "1 min, rayon 5 m : 5d4+INT feu, moitié si AGI 15, détection INT 15+INT (MJ : poser + résoudre).",
  },
  {
    talent: "Disparition",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "(M) 1/combat : disparaît sauf DM de zone, réapparaît ≤20 m (MJ).",
  },
  {
    talent: "Démolition",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    note: "3 rounds : 3d4+INT structure (RD/2), 2d4 dans 2 m, charges/jour = rang (MJ).",
  },
  {
    talent: "Résistance à la magie",
    effetCle: null,
    dureeTours: null,
    cibles: "soi",
    note: "1/round (G) : test d'attaque magique opposé pour ignorer un sort, dé malus si hybride (MJ).",
  },
  {
    talent: "Charge fantastique",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "1/combat (G) : +10 m puis dé bonus et +1d4 DM — cocher Parfaite (MJ).",
  },
  {
    talent: "Manœuvre",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    note: "Dé bonus aux manœuvres (MJ : jets manuels).",
  },
  {
    talent: "Vigueur divine",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    actionSpeciale: "vigueur",
    nettoie: true,
    note: "Limitée (L) au contact, sans PM : guérit poison/maladie. Auto = purge ; Test MJ = test d'attaque magique (opposé si surnaturel) puis purge si réussi. Rang+2 vs maladies/poisons (MJ).",
  },
  {
    talent: "Parer un coup",
    effetCle: "Parade",
    dureeTours: 1,
    cibles: "soi",
    mods: { parade: 1 },
    note: "Guerrier (M, bouclier requis) : posture sur soi — la prochaine attaque réussie (contact ou distance, pas les touches auto) est bloquée sur test opposé d'attaque au contact (niv + FOR/AGI + arme + mods). Rang 5 : (G) 1/round avec dé malus (MJ). Énorme/colossale : moitié DM (MJ).",
  },
  {
    talent: "Absorber un sort",
    effetCle: "Absorption",
    dureeTours: 1,
    cibles: "soi",
    mods: { absorption: 1 },
    note: "Guerrier (après parade préparée) : le prochain sort réussi est annulé sur test opposé (zones : autres affectés, MJ). Stocké pour Renvoi.",
  },
  {
    talent: "Renvoi de sort",
    effetCle: null,
    dureeTours: null,
    cibles: "ennemis",
    actionSpeciale: "renvoi",
    note: "Guerrier (G, bouclier requis) : renvoie le sort absorbé contre son lanceur (effets appliqués ; zones rejouées en mono-cible, MJ).",
  },
  {
    talent: "Science du critique",
    effetCle: "Critique 19-20",
    dureeTours: null,
    cibles: "soi",
    mods: { seuilCrit: 19 },
    note: "Guerrier (arme de prédilection, MJ) : critique sur 19-20. À appliquer sur soi quand l'arme convient.",
  },
  {
    talent: "Increvable",
    effetCle: "Increvable",
    dureeTours: 1,
    cibles: "soi",
    mods: { defense: 5 },
    soin: "4d4°+CON",
    nettoie: true,
    note: "Rôdeur (L), 1/combat (MJ) : à 0 PV, +4d4°+CON au prochain tour, +5 DEF 1 round, purge des états non permanents.",
  },
  {
    talent: "Travail d'équipe",
    effetCle: "travail-equipe",
    dureeTours: null,
    cibles: "allies",
    mods: { deBonus: 1 },
    note: "Rôdeur, loup au contact (MJ : adjacence déclarée) : dé bonus en attaque au loup ciblé (retirer l'effet à la séparation). Piste/anti-surprise du rôdeur : MJ.",
  },
  {
    talent: "Lien empathique",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    montantMJ: "lien",
    actionSpeciale: "lien-empathique",
    note: "Rôdeur (L) : télépathie + 1 PV rôdeur = 1 PV loup (2 PV avec Tactiques), sans limite. Saisir les PV dépensés.",
  },
];

/**
 * Un talent est-il lançable en combat (au moins une mécanique : effet,
 * coût PV, soin, purge, renvoi) ? Les passifs (Armure d'os, Exsangue...),
 * les manœuvres gérées par le panneau Attaque et les talents narratifs
 * sont exclus du panneau Capacités (ni sorts ni effets à appliquer).
 */
export function estLancable(u: CapaciteUsable | undefined): boolean {
  if (!u) return false;
  return !!(u.effetCle || u.mods || u.coutPV || u.soin || u.montantMJ || u.nettoie || u.actionSpeciale);
}

/** Talents lançables parmi des noms connus (panneau Capacités, badge). */
export function talentsLancables(talents: string[]): string[] {
  return talents.filter((t) => {
    const q = normaliserNomCapacite(t);
    return estLancable(CAPACITES_USABLES.find((u) => normaliserNomCapacite(u.talent) === q));
  });
}
