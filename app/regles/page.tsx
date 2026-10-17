import Link from "next/link";
import type { ReactNode } from "react";
import { FAMILLES, PROFILS_PAR_FAMILLE, PV_BASE_PAR_FAMILLE, PV_GAIN_PAR_FAMILLE, DE_RECUP_PAR_FAMILLE, REGLES_PROFILS } from "@/src/lib/rules/personnage";
import { VOIES_PEUPLE } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { CAPACITES } from "@/src/lib/data/capacites";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { decrireModificateurs } from "@/src/lib/rules/effects/effects";
import { NIVEAU_PROPRIETE, PROPRIETES_CONTACT, PROPRIETES_DISTANCE } from "@/src/lib/rules/armesMagiques";
import { exempleProprieteArmure, PROPRIETES_ARMURES, type PlageProprieteArmure, type SorteProprieteArmure } from "@/src/lib/rules/armuresMagiques";
import { ECHELLE_ARMURES, LIMITES_ARMURE, nomArmureLimite } from "@/src/lib/rules/limitesArmures";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";

type Source = "DRS" | "Fiches" | "Tableau" | "Règle LDB" | "Maison" | "Supposition";

const SRC_STYLE: Record<Source, string> = {
  DRS: "bg-blue-900 text-blue-200",
  Fiches: "bg-amber-900 text-amber-200",
  Tableau: "bg-green-900 text-green-200",
  "Règle LDB": "bg-violet-900 text-violet-200",
  Maison: "bg-orange-900 text-orange-200",
  Supposition: "bg-red-900 text-red-200",
};

const SRC_TITRE: Record<Source, string> = {
  DRS: "Transcrit du DRS (drs.chroniques-oubliees.fr)",
  Fiches: "Lu sur les 4 fiches papier",
  Tableau: "Tableau récapitulatif fourni",
  "Règle LDB": "Règle du livre de base",
  Maison: "Règle maison de la table (remplace le livre)",
  Supposition: "Mon interprétation — à confirmer",
};

function Src({ de }: { de: Source }) {
  return (
    <span title={SRC_TITRE[de]} className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-mono cursor-help ${SRC_STYLE[de]}`}>
      {de}
    </span>
  );
}

function Section({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2 scroll-mt-4">
      <h2 className="text-lg font-bold text-amber-300">{titre}</h2>
      <div className="text-sm text-zinc-300 space-y-1.5">{children}</div>
    </section>
  );
}

function Formule({ children }: { children: ReactNode }) {
  return <div className="font-mono text-sm bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5">{children}</div>;
}

const PROFILS = Object.values(PROFILS_PAR_FAMILLE).flat();
const NB_TALENTS = Object.values(CAPACITES).flatMap((v) => v.flatMap((x) => x.capacites)).length;
const NB_SORTS = SEED_SORTS.length;

/** Lignes du tableau des propriétés d'armes : fusion contact/distance, 11-12 exclus (tirage MJ). */
function lignesProprietesArmes(): { nom: string; porte: string; mecanique: string; niveau: string }[] {
  const vues = new Map<string, { nom: string; porte: string; mecanique: string; niveau: string }>();
  const push = (table: typeof PROPRIETES_CONTACT, porte: string) => {
    for (const p of table.plages) {
      if (p.sorte === "double") continue;
      const cle = `${p.sorte}:${p.objet ?? ""}`;
      const mecanique =
        p.sorte === "affutee" || p.sorte === "precision"
          ? "+1 critique, +1d4 aux DM"
          : p.sorte === "fleau"
            ? `+1d4 aux DM contre les ${p.objet}`
            : `+1d4 aux DM de ${p.objet}`;
      const ex = vues.get(cle);
      if (ex) ex.porte = "Contact + Distance";
      else vues.set(cle, { nom: p.label, porte: porte, mecanique, niveau: `+${NIVEAU_PROPRIETE[p.sorte]}` });
    }
  };
  push(PROPRIETES_CONTACT, "Contact");
  push(PROPRIETES_DISTANCE, "Distance");
  return [...vues.values()];
}

const LIGNES_ARMES = lignesProprietesArmes();
const LIGNES_ARMURES = PROPRIETES_ARMURES.plages
  .filter((p): p is PlageProprieteArmure & { sorte: Exclude<SorteProprieteArmure, "double"> } => p.sorte !== "double")
  .map((p) => ({ d12: p.min, ...exempleProprieteArmure(p.sorte) }));

const SORTES_RESISTANCE_MAISON: string[] = ["resistance-feu", "resistance-froid", "resistance-electricite", "resistance-acide"];

const SOMMAIRE: { id: string; t: string }[] = [
  { id: "aconfirmer", t: "⚠ Points à confirmer" },
  { id: "personnage", t: "Personnage (caracs, INIT, DEF, PV, Chance, DR, attaques, mana)" },
  { id: "creation", t: "Création niveau 1" },
  { id: "progression", t: "Progression (niveaux, points, rangs, dé évolutif)" },
  { id: "peuples-classes", t: "Peuples, classes et voies" },
  { id: "armures", t: "Armures (échelle et limites par profil)" },
  { id: "sorts", t: "Sorts et grimoire" },
  { id: "lancement", t: "Lancement des sorts (3 options)" },
  { id: "consommables", t: "Potions et parchemins (usage)" },
  { id: "defense-magique", t: "Objets magiques défensifs (cumul)" },
  { id: "pouvoir-puissance", t: "Objets de pouvoir et de puissance" },
  { id: "des", t: "Dés (évolutifs, caracs)" },
  { id: "actions", t: "Actions (A+M ou L) et coûts des sorts" },
  { id: "combat", t: "Combat" },
  { id: "effets", t: "Effets (buffs, debuffs, dots)" },
  { id: "proprietes-armes", t: "Armes magiques (propriétés exactes)" },
  { id: "proprietes-armures", t: "Armures magiques (propriétés exactes)" },
];

export default function ReglesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Règles — Chroniques Oubliées Fantasy 2</h1>
        <p className="text-xs text-zinc-500 pt-1">
          Tout ce que l&apos;assistant applique, généré depuis son code (aucune divergence possible).
          Chaque règle porte sa source — corrige-moi sur tout badge <span className="text-red-300">Supposition</span>.
        </p>
      </div>

      <nav className="flex gap-1.5 flex-wrap">
        {SOMMAIRE.map((s) => (
          <Link key={s.id} href={`#${s.id}`} className="px-2.5 py-1 rounded bg-zinc-800 text-xs hover:bg-zinc-700">
            {s.t}
          </Link>
        ))}
      </nav>

      <Section id="aconfirmer" titre="⚠ Points à confirmer">
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Points de chance : +10 à un test, utilisables sur tout test (détection, crochetage…) — en combat c&apos;est appliqué, hors combat au jugement MJ <Src de="Règle LDB" /></li>
          <li>Dés de récupération : <b>rapide</b> = 1 DR dépensé, soin (d + 1/2 niveau) PV au dé ; <b>complète</b> = +1 DR et mana à fond, avec proposition de dépenser aussitôt 1 DR en valeur max (d max + 1/2 niveau, sans lancer) <Src de="Fiches" /></li>
          <li>Dé évolutif (°) : d4 (niv. 1-5), d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+) — pas de relance au max <Src de="DRS" /></li>
          <li>Mages : la capacité de rang 2 gratuite (une voie du profil, ou Maîtrise de la magie) exige la Voie du mage adoptée — abandon de la voie du peuple (rang 1 conservé, rangs 2-5 bloqués) <Src de="Règle LDB" /></li>
          <li>2 points de capacité par niveau (cohérent avecWiki Foundry + création 2 pts) <Src de="Règle LDB" /></li>
          <li>Robustesse (Guerrier) : PV max +rang+2 appliqué automatiquement par le moteur (ex. Dorain : 10+CON 3+3 = 16) ; +rang+2 aux tests pour résister aux efforts physiques, à la chaleur et au froid = manuel, au jugement du MJ <Src de="Règle LDB" /></li>
          <li>Armes magiques : bonus +N = niveau N de l&apos;objet (ex. Arme niv. 2 → +2 ; niv. 1 → +1 sans propriété) <Src de="Règle LDB" /></li>
          <li>Armes magiques 11-12 : deux tirages 1-10 (pas de récursion), fusionnés en propriété doublée si identiques <Src de="Règle LDB" /></li>
          <li>Parade : +N DEF (= bonus de l&apos;arme), simple et cumulable (bouclier, armure), niveau += N ; tirée en plus à 10 % (d100) <Src de="Règle LDB" /><Src de="Supposition" /></li>
          <li>Armes à distance : mêmes propriétés qu&apos;au contact, Affûtée → de précision (crit +1, +1d4°, niveau +1) <Src de="Règle LDB" /></li>
        </ul>
      </Section>

      <Section id="personnage" titre="Personnage">
        <p>Caractéristiques : AGI, CON, FOR, PER, CHA, INT, VOL (modificateurs, ex. +4/-1). Idéal héroïque et travers : narratifs, aucun bonus.<Src de="Fiches" /></p>
        <p>Conversion officielle V1 → V2 (blocs 6 stats) : FOR, DEX→AGI, CON, INT et CHA inchangés ; <b>1 Sagesse = 1 Perception ET 1 Volonté</b> (la même valeur aux deux).<Src de="Règle LDB" /></p>
        <Formule>INIT = 10 + PER (+3 Vivacité, +rang archer) · DEF = 10 + AGI + Équipement + Mod + talents (os +3, bouclier/dur/rempart/parade +1, tactiques +N)<Src de="Fiches" /><Src de="Règle LDB" /></Formule>
        <p>Vigueur : base + CON × niveau + gains. La CON est rétroactive (ex. Lhagva : 12 PV niv. 1, +7 = 19 au niv. 2).<Src de="Règle LDB" /></p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Famille</th><th className="text-left px-2 py-1">Base niv. 1</th><th className="text-left px-2 py-1">Gain / niveau</th></tr></thead>
            <tbody>
              {FAMILLES.map((f) => (
                <tr key={f} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{f}</td>
                  <td className="px-2 py-1 font-mono">{PV_BASE_PAR_FAMILLE[f]} + CON</td>
                  <td className="px-2 py-1 font-mono">+{PV_GAIN_PAR_FAMILLE[f]} + CON</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Formule>Chance = 2 + CHA (+1 si Aventurier, soit 3 + CHA) · 1 PC = +10 à un test, après le résultat, même sur un 1 naturel<Src de="Tableau" /><Src de="Règle LDB" /></Formule>
        <p>Dés de récupération : type selon famille ({FAMILLES.map((f) => `${f} ${DE_RECUP_PAR_FAMILLE[f]}${f === "Mystique" ? "+1" : ""}`).join(" · ")}), nombre 2 + CON (+1 si Mystique), réserve initiale sans le CON : 2 dés (3 si Mystique).<Src de="Tableau" /><Src de="Règle LDB" /></p>
        <Formule>Contact = niv + FOR · Distance = niv + AGI · Magique = niv + VOL (attaques capées niv. 10, sorts : niv + VOL)<Src de="Fiches" /></Formule>
        <Formule>Mana = VOL + sorts connus · coût d&apos;un sort = son rang (Rune de garde : 3 PM)<Src de="Règle LDB" /></Formule>
      </Section>

      <Section id="creation" titre="Création niveau 1">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>2 points</b> → 2 capacités de rang 1 parmi les voies du profil (1 pt chacune).<Src de="Règle LDB" /></li>
          <li><b>+ gratuit</b> : le rang 1 de la voie du peuple (ni point, ni remplacement des 2 choix). Standard : 3 capacités (2 profil + 1 peuple).<Src de="Règle LDB" /></li>
          <li><b>Mages</b> (Ensorceleur, Forgesort, Magicien, Sorcier) : +1 capacité de rang 2 gratuite (voie du profil ou Maîtrise de la magie) <b>avec</b> la Voie du mage adoptée — sans elle, création standard sans R2 gratuit.<Src de="Règle LDB" /></li>
          <li>Voie du mage : remplace la voie du peuple (garde son rang 1, bloque ses rangs 2-5), définitif, avant le rang 2 — et débloque le R2 gratuit.<Src de="Règle LDB" /></li>
        </ul>
        <p className="text-xs text-zinc-500">Exceptions configurables par profil, jamais codées en dur (CREATION_PROFILS).</p>
      </Section>

      <Section id="progression" titre="Progression">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Niveau +1</b> : PV +gain+CON, attaques +1 (max niv. 10), +2 points à dépenser aussitôt, mana via les nouveaux sorts.<Src de="Règle LDB" /></li>
          <li><b>Niveau −1</b> (erreur) : inverse le gain (plancher PV 1, niv. 1 min), alertes à corriger.</li>
          <li>Coûts : R1-2 = 1 pt, R3-5 = 2 pts. Rangs précédents requis, pas de saut, pas de mise de côté, désapprentissage du haut vers le bas.<Src de="Règle LDB" /></li>
          <li>Niveaux min par rang : R1→1, R2→2, R3→3, R4→5, R5→7 (puis 9/11/13).<Src de="Tableau" /></li>
          <li>Dé évolutif (d4°) : d4 (niv. 1-5), d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+).<Src de="DRS" /></li>
        </ul>
      </Section>

      <Section id="peuples-classes" titre="Peuples, classes et voies">
        <p>4 peuples ({VOIES_PEUPLE.map((v) => v.peuple).join(", ")}, Demi-Elfe → voie sylvain), 14 profils, 70 voies de profils + 5 de peuple/mage, {NB_TALENTS} talents.<Src de="DRS" /></p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Profil</th><th className="text-left px-2 py-1">Famille</th><th className="text-left px-2 py-1">PV niv. 1</th><th className="text-left px-2 py-1">DR</th><th className="text-left px-2 py-1">Chance</th></tr></thead>
            <tbody>
              {PROFILS.map((p) => {
                const r = REGLES_PROFILS[p];
                return (
                  <tr key={p} className="border-t border-zinc-800">
                    <td className="px-2 py-1 font-semibold">{p}</td>
                    <td className="px-2 py-1">{r.famille}</td>
                    <td className="px-2 py-1 font-mono">{PV_BASE_PAR_FAMILLE[r.famille]}+CON</td>
                    <td className="px-2 py-1 font-mono">{r.de}{r.bonusDR > 0 ? "+1" : ""}</td>
                    <td className="px-2 py-1 font-mono">{2 + r.bonusChance}+CHA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">Voie du mage : option spéciale (pas un peuple), famille Mage uniquement.<Src de="Règle LDB" /></p>
      </Section>

      <Section id="armures" titre="Armures (échelle et limites par profil)">
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Armure</th><th className="text-left px-2 py-1">DEF</th><th className="text-left px-2 py-1">Note</th></tr></thead>
            <tbody>
              {ECHELLE_ARMURES.map((e) => (
                <tr key={e.def} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{e.nom}</td>
                  <td className="px-2 py-1 font-mono">+{e.def}</td>
                  <td className="px-2 py-1 text-zinc-400">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Profil</th><th className="text-left px-2 py-1">Max torse</th><th className="text-left px-2 py-1">Bouclier</th><th className="text-left px-2 py-1">Extension (talent)</th></tr></thead>
            <tbody>
              {Object.entries(LIMITES_ARMURE).map(([profil, l]) => (
                <tr key={profil} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{profil}</td>
                  <td className="px-2 py-1 font-mono">{nomArmureLimite(l.limite)} +{l.limite}</td>
                  <td className="px-2 py-1">{l.bouclier ? "Oui" : "Non"}</td>
                  <td className="px-2 py-1 text-zinc-400">{l.extensions.length > 0 ? l.extensions.map((e) => `${e.talent} → +${e.limite}`).join(" · ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">Druide et Prêtre : petit bouclier. Dépassement signalé en avertissement (jamais bloqué) dans Inventaire et sur la fiche.<Src de="Règle LDB" /></p>
      </Section>

      <Section id="sorts" titre="Sorts et grimoire">
        <ul className="list-disc pl-5 space-y-1">
          <li>{NB_SORTS} sorts transcrits du DRS (Prêtre, Sorcier, Barde, Druide, Ensorceleur, Forgesort, Magicien + voie du mage). Guerrier, Rôdeur, Voleur, Moine : aucun sort à PM.<Src de="DRS" /></li>
          <li>Dégâts au rang de voie : certains sorts grandissent avec le rang du lanceur dans la voie (ex. Arc de feu 1d4°+INT, 2d4°+INT au rang 4 ; Destruction du mal 3d4° au rang 5).<Src de="Règle LDB" /></li>
          <li>Sauvegardes paramétrées : difficulté en formule (ex. AGI diff 10+INT), moitié des DM si réussie au lieu d&apos;annuler (ex. Explosion de feu, Foudre).<Src de="Règle LDB" /></li>
          <li>Cibles multiples : ×N cibles ou cibles au choix (ex. Arc de feu ×3, Appel de la foudre) — résoudre une fois par cible.<Src de="Règle LDB" /></li>
          <li>Les voies sont des arbres de talents ; seuls les sorts (capacités à PM, *) vont au grimoire.<Src de="Règle LDB" /></li>
          <li>Talent connu ≠ lançable : apprendre un talent-sort crée l&apos;entrée lançable (+ mana).<Src de="Règle LDB" /></li>
          <li>Familles par sort = profils pouvant l&apos;apprendre (vide = toutes classes).</li>
        </ul>
      </Section>

      <Section id="lancement" titre="Lancement des sorts (3 options)">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Incantation classique</b> : paie le coût du sort en mana (coût = rang), avant le jet. Sans mana suffisante, le sort ne part pas.<Src de="Règle LDB" /></li>
          <li><b>Brûlure de mana</b> : à 0 PM, le lanceur peut sacrifier son énergie vitale pour continuer à lancer — <b>1 DR par PM</b> du sort en PV perdus (ex. 2 PM au d6 = 2d6 PV), <b>sans RD</b>, KO possible. <b>Impossible pour lancer un sort de soins.</b> En combat (panneaux Attaque/Soutien) comme hors combat.<Src de="Règle LDB" /></li>
          <li><b>Concentration accrue</b> : un sort qui nécessite une action d&apos;attaque (A) peut être lancé en se concentrant pour <b>−2 PM</b> (plancher 0) — en combat, il est lancé en action <b>limitée (L)</b> et le lanceur se prive de déplacement ; hors combat, le lanceur prend simplement le temps de se concentrer. Les sorts (L/M/G) et ceux sans action d&apos;attaque gardent le coût de leur rang, non réductible. En combat (panneaux Attaque/Soutien) comme hors combat.<Src de="Règle LDB" /></li>
        </ul>
      </Section>

      <Section id="consommables" titre="Potions et parchemins (usage)">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Potion</b> : boire une potion est une action de mouvement (M), utilisable par tout le monde.<Src de="Règle LDB" /></li>
          <li><b>Parchemin</b> : usage limité (L), consommable unique (le sort est effacé après usage).<Src de="Règle LDB" /></li>
          <li>Un parchemin est <b>illisible</b> pour un lanceur d&apos;une autre famille de profil (ex. un Magicien ne lit pas un parchemin de Prêtre).<Src de="Règle LDB" /></li>
          <li><b>Sans test</b> si le sort est issu du profil du PJ et d&apos;un rang qu&apos;il maîtrise (au moins un sort connu de même rang ou supérieur), même sans connaître ce sort précis.<Src de="Règle LDB" /></li>
          <li>Rang supérieur au maîtrisé : test d&apos;attaque magique, difficulté 5 × rang du sort (ex. maîtrise rang 1 + parchemin rang 4 → difficulté 20).<Src de="Règle LDB" /></li>
          <li>Autre profil mais <b>même famille</b> (ex. moine ou druide + sort de prêtre) : difficulté +5 (ex. sort de prêtre rang 3 → 15 + 5 = 20).<Src de="Règle LDB" /></li>
          <li><b>Échec</b> : le sort n&apos;est pas lancé ; échec d&apos;au moins 10 points → le sort est effacé et le parchemin devient inutilisable.<Src de="Règle LDB" /></li>
          <li><b>Baguette</b> : lanceurs de sorts uniquement (bardes, druides et prêtres inclus), de niveau au moins égal au rang du sort. Activer une baguette = action d&apos;attaque, un sort par charge (2d20 charges au départ).<Src de="Règle LDB" /></li>
          <li>Niveau de magie d&apos;une baguette : moitié du rang (arrondi inf.) sous 30 charges, rang du sort à 30 charges et plus.<Src de="Règle LDB" /></li>
        </ul>
        <Formule>Difficulté = 5 × rang du sort (+5 si autre profil de même famille)<Src de="Règle LDB" /></Formule>
      </Section>

      <Section id="defense-magique" titre="Objets magiques défensifs (cumul)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Un objet magique défensif ajoute son bonus à la DEF, mais un PJ ne retient qu&apos;<b>un seul bonus de DEF magique : le plus haut</b> (pas de cumul).<Src de="Règle LDB" /></li>
          <li>Objets mundanes (bouclier, mailles…) : cumulés normalement. Talents, Mod et buffs : cumulés.<Src de="Règle LDB" /></li>
          <li>Bouclier et armure magiques non cumulés en DEF ; si le MJ l&apos;autorise, le bonus inutilisé devient une RD contre les critiques (ex. armure +3 et bouclier +2 → DEF +3, −2 DM aux critiques).<Src de="Règle LDB" /></li>
          <li>Anneau +2 : +2 DEF, non cumulé à une armure magique, mais cumulé au sort Armure de mage (considéré comme une armure).<Src de="Règle LDB" /></li>
          <li>Une armure retranche son bonus aux pénalités qu&apos;elle inflige (tests d&apos;AGI), sans changer l&apos;AGI max (ex. cotte +2 : DEF +7, pénalité AGI −3).<Src de="Règle LDB" /></li>
          <li>Niveau de magie = bonus + propriétés (1 chacune, Défense supérieure +2).<Src de="Règle LDB" /></li>
          <li>Bonus +N = niveau N de l&apos;objet (comme les armes).<Src de="Règle LDB" /></li>
        </ul>
        <Formule>DEF magique retenue = max des bonus (bouclier et armure non cumulés)<Src de="Règle LDB" /></Formule>
      </Section>

      <Section id="pouvoir-puissance" titre="Objets de pouvoir et de puissance">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Pouvoir</b> : pouvoirs calqués sur des capacités de lanceur, utilisables 1/jour en général, parfois permanents (ex. sac sans fond = rang 3 des artefacts du forgesort) ; forme en rapport avec son pouvoir.<Src de="Règle LDB" /></li>
          <li><b>Puissance</b> : +caractéristique (ceinture FOR, bandeau INT/VOL, gantelets AGI, masque PER, robe CHA, amulette CON) ; mineurs : +DR/PC/PM/PV.<Src de="Règle LDB" /></li>
          <li>Niveau de magie = bonus × 3 (+2 conseillé en classique, +3 en high fantasy ; ex. cape de charisme +2 → 6). Mineurs : DR/PC 1 par point, PM 1 par tranche de 3, PV 1 par tranche de 5.<Src de="Règle LDB" /></li>
          <li>Bonus 1-2 au d2, sans lien avec le niveau (mineures : DR/PC 1-2, PM 3/6, PV 5/10).<Src de="Règle LDB" /></li>
        </ul>
        <Formule>Niveau puissance = bonus × 3 (d12 : 1-7 majeures, 8-11 mineures, 12 relancer)<Src de="Règle LDB" /></Formule>
      </Section>

      <Section id="des" titre="Dés">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Évolutifs (°)</b> : le dé grandit avec le niveau — ex. 1d4°+INT vaut 1d4+INT au niv. 3, 1d6+INT au niv. 7, 1d10+INT au niv. 12. Table : d4 (1-5), d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+). Aucune relance.<Src de="DRS" /></li>
          <li><b>dE</b> : dé évolutif selon le niveau (attaque et grimoire le substituent).<Src de="Règle LDB" /></li>
          <li><b>Caracs</b> : <span className="font-mono">1d4°+INT</span> devient <span className="font-mono">1d4°+2</span> avec INT+2 (Un pied dans la tombe).<Src de="Règle LDB" /></li>
          <li>Convention moteur : 0 DM = <span className="font-mono">1d1-1</span> (sorts à effet sans dégâts).</li>
        </ul>
      </Section>

      <Section id="actions" titre="Actions (A+M ou L) et coûts des sorts">
        <Formule>Par tour : 1 action (A) + 1 mouvement (M), OU 1 action limitée (L) = tour complet. (G) = gratuit — géré en réel, pas suivi par l&apos;app.<Src de="Règle LDB" /></Formule>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sorts : coût PM = rang, payé avant le jet. Certains sacrifient aussi des PV en dés (Pacte démoniaque, Invocation, Rituel : 1d4°), payés au lancer.<Src de="Règle LDB" /></li>
          <li>Vol de vie (Baiser du vampire, Succube) : le lanceur récupère autant de PV que de DM infligés.<Src de="Règle LDB" /></li>
          <li>Limites : 1/combat (Ensevelissement), 1/combat par cible (Malédiction, Briser), 1/jour ≈ 1 combat (Armée). Par cible = au touché, sinon au lancer.<Src de="Règle LDB" /></li>
          <li>Rituel de sang : sans test (touche auto). Briser les cœurs : moitié des dégâts si raté.<Src de="Règle LDB" /></li>
          <li>Invocations : démon (PV niveau×5, DEF 18, épée 2d4°+5) et zombie (PV 10+niveau, DEF 10, contact 1d4°+2), au camp du lanceur, en fin d&apos;ordre.<Src de="Règle LDB" /></li>
          <li>Voie du bouclier (bouclier manié requis partout, 🛡 affiché en combat) : Protéger (G) = mod. DEF du bouclier à un allié au contact contre la prochaine attaque (1/round, consommée au premier jet visant l’allié, pas si surpris) ; Parer (M, posture) = prochaine attaque réussie au contact ou à distance bloquée sur test opposé d’attaque au contact auto (niv + FOR/AGI + arme + mods) ; Défense passive +1 DEF (+2 au rang 5) et −rang aux DM de zone et souffles sauf surpris ; Absorber = remplace une parade préparée contre un sort (test contact vs attaque magique, seul le guerrier protégé en zone, sort stocké) ; Renvoi (G) = sort absorbé rejoué sans coût contre son lanceur (zones rejouées en mono-cible, MJ). Énorme/colossale : moitié DM (MJ).<Src de="Règle LDB" /></li>
          <li>Riposte (G) : un raté au contact est signalé (1/round, MJ : attaque manuelle). Coups spéciaux (panneau Attaque) : Puissante (dé malus +2d4°, L +3d4°), Parfaite (dé bonus +1d4°, prédilection MJ), mod. ±N, +DM (Double/Circulaire −2, prédilection +1, spécialisation +1).<Src de="Règle LDB" /></li>
          <li>Talents → panneau : Attaque puissante = Puissante, Charge/Charge fantastique/Attaque bondissante = Parfaite à cocher ; Tir de barrage/grenaille, Tourbillon, Frappe du justicier, As de la gâchette = +DM ou division manuelle ; le panneau Capacités affiche la mécanique exacte (coûts PV et soins automatiques : Prouesse, Tour de force, Siphon, Feindre la mort ; Phénix auto à 0 PV, Vigueur auto/test).<Src de="Supposition" /></li>
          <li>Science du critique : 19-20 avec prédilection (effet à appliquer via Capacités, MJ).<Src de="Règle LDB" /></li>
          <li>Rôdeur archer : Dans le mille (dé malus +2d4°, L +3d4°), Flèche de mort (dé bonus +1d4° ou état 1 round : aveuglé/affaibli/ralenti/immobilisé, NC inférieur, 1/combat chacun, MJ), Éclair (bonus et DM à l&apos;AGI) — à cocher dans le panneau Attaque ; Double (L) et Tir rapide (L) : mod. −2, 2 lancers.<Src de="Règle LDB" /></li>
          <li>Compagnon : le loup est ajouté auto en préparation (DEF 12+rang voie, PV niv×4, caracs loup/alpha, lien maître, alpha dès R4) ; PV persistés sur la fiche (fin de combat, pleins après récup complète, soignable hors combat comme un personnage, nouveau compagnon si mort MJ) ; Tactiques +1d4° auto même cible même manche, +1 DEF chacun par R5 (voie incluse) ; Travail d&apos;équipe proposé à l&apos;attaque du loup (case au contact MJ) ou via Capacités ; Lien empathique via Capacités (L, 1 PV = 1 PV, ×2 Tactiques) ; Double peine +1d4° auto à la 2e touche ; À-suivre et Riposte signalés au raté (MJ) ; Increvable via Capacités (+4d4°+CON, +5 DEF, purge, 1/combat MJ) ; Éclaireur : +1 DR au lieu du +1 PC.<Src de="Règle LDB" /></li>
          <li>Dé bonus : lance 2d20 et garde le meilleur résultat. Dé malus : lance 2d20 et garde le pire résultat. Un dé bonus et un dé malus s&apos;annulent mutuellement (ex. Malédiction).<Src de="Règle LDB" /></li>
          <li>Test opposé : vrai test opposé pour les sorts prévus (Pied dans la tombe, Ensevelissement : d20 + magie vs d20 + magie, attaquant gagne les égalités) ; pour le reste, l&apos;assistant approxime par 1d20 + bonus ≥ DEF ; sauvegarde CON 10 du Pied lancée auto (carac inconnue = estimation +0 explicite, ex. monstres) ; durées en INT et cas MJ au jugement.<Src de="Règle LDB" /></li>
          <li>Voie du sang (sorcier) : Armure d&apos;os +3 DEF auto (+1 par rang 4, retirés au désapprentissage) ; Exsangue +2 DEF auto (+3 si rang 5 en Voie du sang, −1 si torse mundane sans Armure d&apos;os — agir à 0 PV : MJ, 1 DM = inconscience) ; Siphon : +NC PV via le panneau Capacités (montant MJ, variante 1 PM manuelle) ; Sang mordant : riposte auto 1d4° d&apos;acide au contact (sorts et distance : MJ) ; Pacte ténébreux : CON +1 auto (PV, DR — tests CON : MJ), coût +2d4° DM via Capacités (bonus +DM manuel).<Src de="Supposition" /></li>
          <li>Voie de l&apos;outre-tombe (sorcier) : Pied = test opposé magique, vivants seuls ; Ensevelissement = test opposé magique, taille moyenne ou moins, inciblable, sortie FOR/AGI 15 en limitée (aides +2, max +10), décès au tour suivant à 0 PV ; Animation = zombie du bestiaire (1 +1 par rang 5 sorcier, cadavre MJ, poussière à 0 PV) ; Armée = 2d4°/round pendant NIVEAU rounds, sans hit initial, 1/jour (≈ 1/combat).<Src de="Règle LDB" /></li>
          <li>Voie des soins (prêtre) : mineure (A, contact/soi) = 1d4°+CHA, 1/jour par rang soins +1 par rang 3 hors soins (quota suivi, MJ : repos) ; Vigueur (L, contact, sans PM) = guérit poison/maladie (auto ou test magique MJ si surnaturel, rang+2 vs maladies/poisons) ; majeure (L, 20 m/soi) = 3d4°+CHA +1d4° par rang 5 prêtre ; Phénix = auto 1/jour à 0 PV (jet unique 2d4°+CHA aux alliés 20 m, double au prêtre, réactivé) ; Rétablissement = rituel hors combat 1/jour, 10 min, CHA patients au repos dans 5 m, chacun comme une majeure (jet par patient, concentration interdite). Règle de table : 1 soin magique / cible / combat (outrepassable MJ). Brûlure interdite pour les soins.<Src de="Règle LDB" /></li>
        </ul>
      </Section>

      <Section id="options-tactiques" titre="Options tactiques (au lieu d’une attaque normale)">
        <p className="text-xs text-zinc-500">Alternatives LDB à l’attaque normale. Assurée/précise/violente : à cocher dans l’onglet Action (armes au contact ou à distance, jamais sur attaque magique). Défenses et riposte : self-buffs sans jet ni cible (même onglet) ; soutenir : un allié actif ciblé. Postures = effets 1 round, économie d’actions gérée en réel par le MJ.<Src de="Règle LDB" /></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Attaque assurée (A)</b> : attaquer au contact ou à distance avec <b>+5 en attaque</b> (pas sur attaque magique), mais <b>DM divisés par 2</b>.<Src de="Règle LDB" /></li>
          <li><b>Attaque précise/violente (A)</b> : attaquer au contact ou à distance avec <b>−3 en attaque</b> (pas sur attaque magique), <b>+1d4° DM</b> (ou <b>−7 pour +2d4° DM</b> en violente).<Src de="Règle LDB" /></li>
          <li><b>Défense partielle (A)</b> : <b>+3 en DEF</b> et aux tests opposés pour résister à une attaque ou un effet pendant 1 round.<Src de="Règle LDB" /></li>
          <li><b>Défense totale (L)</b> : <b>+5 en DEF</b> et aux tests opposés pour résister à une attaque ou un effet pendant 1 round. Générales : fonctionnent contre n’importe quel type d’attaque (contact, distance ou magique).<Src de="Règle LDB" /></li>
          <li><b>Riposte (L ou A)</b> : se préparer à riposter à une attaque, au contact (voir ci-après).<Src de="Règle LDB" /></li>
          <li><b>Soutenir (L)</b> : sacrifiez toutes vos actions pour donner <b>+5 en attaque au contact</b> à un allié lors de sa prochaine attaque contre la créature désignée. Il faut être au contact de la créature désignée et cela compte comme une action offensive. Le bonus ne dure pas plus d’un round (jusqu’au tour du personnage, au round suivant).<Src de="Règle LDB" /></li>
        </ul>
        <p className="text-xs text-zinc-400 mt-2"><b>Riposte (détail)</b> : au début du round (avant le tour des protagonistes), le personnage déclare se mettre en posture de riposte. Durant ce round, si une créature l’attaque au contact, il peut prendre son tour pour riposter immédiatement (action normale, une seule fois par round). Toutefois, si cela l’amène à agir avant sa propre valeur d’initiative, il ne peut utiliser qu’une action d’attaque. Exemple : une créature en vol effectue une attaque en vol (déplacement, attaque puis nouveau déplacement) et n’est plus au contact du PJ quand vient son tour — en posture dès le début du round, il peut attaquer juste après elle, avant qu’elle ne s’éloigne (par exemple avec une action limitée) ; s’il agit avant son initiative, attaque seule.<Src de="Règle LDB" /></p>
      </Section>

      <Section id="combat" titre="Combat">
        <ul className="list-disc pl-5 space-y-1">
          <li>Toucher : 1d20 + bonus ≥ DEF — sauf sort à difficulté fixe (ex. Saignements : 1d20 + attaque magique ≥ 10 + CON de la cible, armure ignorée). 20 naturel = touche auto + critique ×{DEFAULT_COMBAT_OPTIONS.critique.multiplicateur} (bonus inclus, physique et magique), 1 naturel = échec auto — sauf +10 de chance, utilisable même sur un 1.<Src de="Règle LDB" /></li>
          <li>0 PV : le personnage tombe inconscient et est hors de combat (sauté dans l&apos;ordre d&apos;initiative) ; des soins arrivés rapidement peuvent le relever.<Src de="Règle LDB" /></li>
          <li>Initiative 1d20 + mod, tri décroissant, tours + manches : adaptation de D&D (pas une règle officielle), conservée par choix.<Src de="Maison" /></li>
          <li>Objet équipé en cours de route : le staging se resynchronise au lancement (bouton Actualiser) et chaque PJ peut être resynchronisé depuis sa fiche en combat (↻).</li>
          <li>Effets : dégâts/soins par tour à la fin du tour du porteur, puis expiration. Soutien : soin + effet, coût mana. Capacités utilisables : effet auto ou usage narratif.<Src de="Règle LDB" /></li>
          <li>Sorts multi-cibles et zones : cases à cocher dans le panneau Attaque (ennemis pré-cochés, MJ ajuste — alliés dans le rayon possibles, ex. Explosion de feu), une résolution par cible, un seul coût mana.</li>
          <li>Sorts à effet sans dégâts (Malédiction, Peur…), dégâts par tour lancés au toucher (Saignements, Ensevelissement…). Les lettres A/M/L des attaques et sorts sont indicatives (économie gérée en réel).</li>
          <li>Attaques de sorts : bonus niv+VOL sauf bonus explicite, PM (+ PV) déduits avant le jet. Soutien : invocations, attaques accordées (griffes, contact). Zone (Armée) : tous les ennemis.</li>
        </ul>
      </Section>

      <Section id="etats-prejudiciables" titre="États préjudiciables">
        <p className="text-xs text-zinc-500">Un état préjudiciable est un ensemble de pénalités standard infligées à un personnage (environnement, situation subie, capacité ou règle spécifique — mentionné en italique dans ce cas). Le moteur applique les jets d&apos;attaque, la DEF, les dés bonus/malus, le touché auto + critique du paralysé et le −10 à distance de l&apos;aveuglé ; la mention (MJ) = au jugement du MJ.<Src de="Règle LDB" /></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Aveuglé</b> : −5 en Init., en attaque et en DEF, −10 en attaque à distance. Les attaques magiques nécessitant de voir la cible sont impossibles (MJ).<Src de="Règle LDB" /></li>
          <li><b>Affaibli</b> : dé malus à tous les tests (moteur : jets d&apos;attaque ; autres tests : MJ).<Src de="Règle LDB" /></li>
          <li><b>Essoufflé</b> : déplacement limité à 5 m par action de mouvement (MJ).<Src de="Règle LDB" /></li>
          <li><b>Étourdi</b> : aucune action possible et −5 en DEF.<Src de="Règle LDB" /></li>
          <li><b>Immobilisé</b> : pas de déplacement (MJ) et dé malus aux tests d&apos;attaque — il peut toujours agir.<Src de="Règle LDB" /></li>
          <li><b>Invalide</b> : déplacement limité à 5 m par action de mouvement (MJ).<Src de="Règle LDB" /></li>
          <li><b>Paralysé</b> : aucune action possible ; en cas d&apos;attaque, touché automatiquement et subit un critique.<Src de="Règle LDB" /></li>
          <li><b>Ralenti</b> : une seule action par round, d&apos;attaque ou de mouvement (MJ).<Src de="Règle LDB" /></li>
          <li><b>Renversé</b> : −5 en attaque et en DEF ; se relever nécessite une action d&apos;attaque (MJ).<Src de="Règle LDB" /></li>
          <li><b>Surpris</b> : pas d&apos;action et −5 en DEF au premier round de combat.<Src de="Règle LDB" /></li>
          <li><b>Rendement décroissant</b> : contre une capacité pénible systématiquement répétée, le MJ peut assigner un bonus cumulatif de +5 au test de la cible pour y résister durant le combat.<Src de="Règle LDB" /></li>
        </ul>
      </Section>

      <Section id="effets" titre="Effets (buffs, debuffs, dots)">
        <p className="text-xs text-zinc-500">Les 10 états préjudiciables ci-dessus reprennent les valeurs officielles ; les autres entrées du catalogue sont génériques (assistant), ajustables par le MJ. Badges en combat : vert = buff, rouge = dot/contrôle, violet = neutre, avec tours restants. Colonne Moteur = ce que l&apos;assistant applique vraiment. Dots/soins à la fin du tour du porteur (un effet posé pendant son tour ne blesse qu’à partir du suivant) ; durées consommées à la fin de son tour (un effet « 1 tour » couvre tout le tour, ∞ = permanent).</p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Effet</th><th className="text-left px-2 py-1">Mécanique</th><th className="text-left px-2 py-1">Moteur (exact)</th><th className="text-left px-2 py-1">Durée</th></tr></thead>
            <tbody>
              {EFFECT_CATALOG.map((e) => (
                <tr key={e.key} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{e.nom}</td>
                  <td className="px-2 py-1">{e.description}</td>
                  <td className="px-2 py-1 font-mono text-amber-200/90">{decrireModificateurs(e.modificateurs).join(" · ") || "—"}</td>
                  <td className="px-2 py-1 font-mono">{e.dureeDefaut ?? "∞"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="proprietes-armes" titre="Armes magiques (propriétés exactes)">
        <p className="text-xs text-zinc-500">Bonus +N en attaque et aux DM (= niveau de l&apos;objet). Propriété si 1d6 &lt; niveau. Doublée (11-12 identiques) : dés et niveau doublés, « intense ».<Src de="Règle LDB" /></p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Propriété</th><th className="text-left px-2 py-1">Armes</th><th className="text-left px-2 py-1">Effet exact</th><th className="text-left px-2 py-1">Niv.</th></tr></thead>
            <tbody>
              {LIGNES_ARMES.map((l) => (
                <tr key={`${l.nom}-${l.porte}`} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{l.nom}</td>
                  <td className="px-2 py-1">{l.porte}</td>
                  <td className="px-2 py-1 font-mono text-amber-200/90">{l.mecanique}</td>
                  <td className="px-2 py-1 font-mono">{l.niveau}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Exemples : Fléau des morts = <span className="font-mono">+1d4 aux DM contre les morts</span> ; Feu = <span className="font-mono">+1d4 aux DM de feu</span>. Parade : +N DEF (= bonus de l&apos;arme), cumulable, niveau += N, tirée en plus à 10 % (d100).<Src de="Règle LDB" /><Src de="Supposition" /></p>
      </Section>

      <Section id="proprietes-armures" titre="Armures magiques (propriétés exactes)">
        <p className="text-xs text-zinc-500">Bonus +N en DEF (= niveau de l&apos;objet), un seul bonus magique retenu (le plus haut). Propriété si 1d6 &lt; niveau (niveau +1 chacune). 12 = deux tirages, doublée ou spéciale (MJ).<Src de="Règle LDB" /></p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">d12</th><th className="text-left px-2 py-1">Propriété</th><th className="text-left px-2 py-1">Effet exact</th><th className="text-left px-2 py-1">Niv.</th></tr></thead>
            <tbody>
              {LIGNES_ARMURES.map((l) => (
                <tr key={l.sorte} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-mono">{l.d12}</td>
                  <td className="px-2 py-1 font-semibold">{l.label}{SORTES_RESISTANCE_MAISON.includes(l.sorte) && <Src de="Maison" />}</td>
                  <td className="px-2 py-1">{l.effet}</td>
                  <td className="px-2 py-1 font-mono">+{l.niveau}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Défense supérieure (variante MJ) : RD 4, niveau +2. Doublée : niveau ×2 (« intense »). Résistances feu, froid, électricité, acide : −20 % aux DM du type, total arrondi à l&apos;inférieur — règle maison appliquée par le MJ (les dégâts ne sont pas typés dans le moteur).<Src de="Maison" /></p>
      </Section>
    </div>
  );
}
