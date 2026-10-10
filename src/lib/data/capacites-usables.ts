// Usages par défaut des talents en combat : quel effet appliquer quand on
// utilise tel talent, et sur qui par défaut. Le MJ peut toujours choisir un
// autre effet (ou aucun : usage noté au journal) dans le panneau Capacités.
// Seuls les cas mécaniquement directs y figurent ; le reste se gère au cas
// par cas (durées variables, dés bonus non modélisés, etc.).

export type CibleCapacite = "allies" | "ennemis" | "tous";

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
  /** Écart éventuel avec le texte DRS (approximation moteur). */
  note?: string;
}

export const CAPACITES_USABLES: CapaciteUsable[] = [
  {
    talent: "Protéger un allié",
    effetCle: "protection",
    dureeTours: 1,
    cibles: "allies",
    note: "DRS : +2 DEF contre 1 attaque ; moteur : +2 DEF pendant 1 round.",
  },
  {
    talent: "Pacte démoniaque",
    effetCle: null,
    dureeTours: null,
    cibles: "tous",
    coutPV: "1d4°",
    note: "Sorcier (G) : +INT à un d20 ou en DEF (avant résolution) + VOL aux DR — à appliquer par le MJ (DR via la fiche).",
  },
  {
    talent: "Siphon des âmes",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, 1/round : mort d'un humanoïde vivant à 20 m = +NC PV (ou 1 PM si niv. 3+ et NC>4) — déclenché par le MJ (boutons +PV).",
  },
  {
    talent: "Armure d'os",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +3 DEF automatiques à l'apprentissage (retirés au désapprentissage), +1 par rang 4 en voie sorcier (MJ). 10 min d'entretien/jour, sans malus AGI.",
  },
  {
    talent: "Exsangue",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : +2 DEF (+3 au rang 5, -1 si autre armure qu'os) — à saisir dans Éditer ; à 0 PV agit avec dé malus (MJ).",
  },
  {
    talent: "Pacte ténébreux",
    effetCle: null,
    dureeTours: null,
    cibles: "allies",
    note: "Sorcier, passif : CON +1 (Éditer), vision nocturne, dé bonus CON (MJ) ; +2d4° aux DM d'un sort pour 1d4° PV.",
  },
];
