import Link from "next/link";
import type { ReactNode } from "react";
import { FAMILLES, PROFILS_PAR_FAMILLE, PV_BASE_PAR_FAMILLE, PV_GAIN_PAR_FAMILLE, DE_RECUP_PAR_FAMILLE, REGLES_PROFILS } from "@/src/lib/rules/personnage";
import { VOIES_PEUPLE } from "@/src/lib/data/peuples";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { CAPACITES } from "@/src/lib/data/capacites";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";

type Source = "DRS" | "Fiches" | "Tableau" | "Règle" | "Supposition";

const SRC_STYLE: Record<Source, string> = {
  DRS: "bg-blue-900 text-blue-200",
  Fiches: "bg-amber-900 text-amber-200",
  Tableau: "bg-green-900 text-green-200",
  Règle: "bg-violet-900 text-violet-200",
  Supposition: "bg-red-900 text-red-200",
};

const SRC_TITRE: Record<Source, string> = {
  DRS: "Transcrit du DRS (drs.chroniques-oubliees.fr)",
  Fiches: "Lu sur les 4 fiches papier",
  Tableau: "Tableau récapitulatif fourni",
  Règle: "Règle donnée par message",
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

const SOMMAIRE: { id: string; t: string }[] = [
  { id: "aconfirmer", t: "⚠ Points à confirmer" },
  { id: "personnage", t: "Personnage (caracs, INIT, DEF, PV, Chance, DR, attaques, mana)" },
  { id: "creation", t: "Création niveau 1" },
  { id: "progression", t: "Progression (niveaux, points, rangs, dé évolutif)" },
  { id: "peuples-classes", t: "Peuples, classes et voies" },
  { id: "sorts", t: "Sorts et grimoire" },
  { id: "des", t: "Dés (explosifs, dE, caracs)" },
  { id: "actions", t: "Actions (A+M ou L) et coûts des sorts" },
  { id: "combat", t: "Combat" },
  { id: "effets", t: "Effets (buffs, debuffs, dots)" },
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
          <li>Points de chance : +10 à un test, utilisables sur tout test (détection, crochetage…) — en combat c&apos;est appliqué, hors combat au jugement MJ <Src de="Règle" /></li>
          <li>Dés de récupération : soin (d + 1/2 niveau) PV (lu sur fiche) — boutons ±1 manuels pour l&apos;instant <Src de="Fiches" /></li>
          <li>Dé évolutif au-delà de d8 (d10 au 12, d12 au 15, d20 au 18+) : extrapolé du « etc. » <Src de="Supposition" /></li>
          <li>Note « 2* » du tableau des rangs : lue comme l&apos;exception R2 gratuit des Mages <Src de="Supposition" /></li>
          <li>2 points de capacité par niveau (cohérent avecWiki Foundry + création 2 pts) <Src de="Supposition" /></li>
          <li>Robustesse (Guerrier) : « PV max +rang+2 » contredit la fiche de Dorain (13 = 10+CON sans bonus) — non appliqué, manuel via Éditer <Src de="Supposition" /></li>
        </ul>
      </Section>

      <Section id="personnage" titre="Personnage">
        <p>Caractéristiques : AGI, CON, FOR, PER, CHA, INT, VOL (modificateurs, ex. +4/-1). Idéal héroïque et travers : narratifs, aucun bonus.<Src de="Fiches" /></p>
        <Formule>INIT = 10 + PER (+3 Vivacité, +rang archer) · DEF = 10 + AGI + Équipement + Mod + talents (os +3, bouclier/dur/rempart/parade +1, tactiques +N)<Src de="Fiches" /><Src de="Règle" /></Formule>
        <p>Vigueur : base + CON × niveau + gains. La CON est rétroactive (ex. Lhagva : 12 PV niv. 1, +7 = 19 au niv. 2).<Src de="Règle" /></p>
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
        <Formule>Chance = 2 + CHA (+1 si Aventurier, soit 3 + CHA) · 1 PC = +10 à un test, après le résultat, même sur un 1 naturel<Src de="Tableau" /><Src de="Règle" /></Formule>
        <p>Dés de récupération : type selon famille ({FAMILLES.map((f) => `${f} ${DE_RECUP_PAR_FAMILLE[f]}${f === "Mystique" ? "+1" : ""}`).join(" · ")}), nombre 2 + CON (+1 si Mystique), réserve initiale sans le CON : 2 dés (3 si Mystique).<Src de="Tableau" /><Src de="Règle" /></p>
        <Formule>Contact = niv + FOR · Distance = niv + AGI · Magique = niv + VOL (attaques capées niv. 10, sorts : niv + VOL)<Src de="Fiches" /></Formule>
        <Formule>Mana = VOL + sorts connus · coût d&apos;un sort = son rang (Rune de garde : 3 PM)<Src de="Règle" /></Formule>
      </Section>

      <Section id="creation" titre="Création niveau 1">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>2 points</b> → 2 capacités de rang 1 parmi les voies du profil (1 pt chacune).<Src de="Règle" /></li>
          <li><b>+ gratuit</b> : le rang 1 de la voie du peuple (ni point, ni remplacement des 2 choix). Standard : 3 capacités (2 profil + 1 peuple).<Src de="Règle" /></li>
          <li><b>Mages</b> (Ensorceleur, Forgesort, Magicien, Sorcier) : +1 capacité de rang 2 gratuite + option Voie du mage.<Src de="Tableau" /></li>
          <li>Voie du mage : remplace la voie du peuple (garde son rang 1, bloque ses rangs 2-5), définitif, avant le rang 2.<Src de="Règle" /></li>
        </ul>
        <p className="text-xs text-zinc-500">Exceptions configurables par profil, jamais codées en dur (CREATION_PROFILS).</p>
      </Section>

      <Section id="progression" titre="Progression">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Niveau +1</b> : PV +gain+CON, attaques +1 (max niv. 10), +2 points à dépenser aussitôt, mana via les nouveaux sorts.<Src de="Règle" /></li>
          <li><b>Niveau −1</b> (erreur) : inverse le gain (plancher PV 1, niv. 1 min), alertes à corriger.</li>
          <li>Coûts : R1-2 = 1 pt, R3-5 = 2 pts. Rangs précédents requis, pas de saut, pas de mise de côté, désapprentissage du haut vers le bas.<Src de="Règle" /></li>
          <li>Niveaux min par rang : R1→1, R2→2, R3→3, R4→5, R5→7 (puis 9/11/13).<Src de="Tableau" /></li>
          <li>Dé évolutif (d4°) : d4, d6 au niv. 6, d8 au 9, d10 au 12, d12 au 15, d20 au 18+.<Src de="Règle" /></li>
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
        <p className="text-xs text-zinc-500">Voie du mage : option spéciale (pas un peuple), famille Mage uniquement.<Src de="Règle" /></p>
      </Section>

      <Section id="sorts" titre="Sorts et grimoire">
        <ul className="list-disc pl-5 space-y-1">
          <li>{NB_SORTS} sorts transcrits du DRS (Prêtre, Sorcier, Barde, Druide, Ensorceleur, Forgesort, Magicien + voie du mage). Guerrier, Rôdeur, Voleur, Moine : aucun sort à PM.<Src de="DRS" /></li>
          <li>Les voies sont des arbres de talents ; seuls les sorts (capacités à PM, *) vont au grimoire.<Src de="Règle" /></li>
          <li>Talent connu ≠ lançable : apprendre un talent-sort crée l&apos;entrée lançable (+ mana).<Src de="Règle" /></li>
          <li>Familles par sort = profils pouvant l&apos;apprendre (vide = toutes classes).</li>
        </ul>
      </Section>

      <Section id="des" titre="Dés">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Explosifs (°)</b> : tout dé au max est relancé <b>une seule fois</b> et ajouté — ex. 1d4° : 4 puis 3 = 7, max 8.<Src de="Règle" /></li>
          <li><b>dE</b> : dé évolutif selon le niveau (attaque et grimoire le substituent).<Src de="Règle" /></li>
          <li><b>Caracs</b> : <span className="font-mono">1d4°+INT</span> devient <span className="font-mono">1d4°+2</span> avec INT+2 (Un pied dans la tombe).<Src de="Règle" /></li>
          <li>Convention moteur : 0 DM = <span className="font-mono">1d1-1</span> (sorts à effet sans dégâts).</li>
        </ul>
      </Section>

      <Section id="actions" titre="Actions (A+M ou L) et coûts des sorts">
        <Formule>Par tour : 1 action (A) + 1 mouvement (M), OU 1 action limitée (L) = tour complet. (G) = gratuit — géré en réel, pas suivi par l&apos;app.<Src de="Règle" /></Formule>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sorts : coût PM = rang, payé avant le jet. Certains sacrifient aussi des PV en dés (Pacte démoniaque, Invocation, Rituel : 1d4°), payés au lancer.<Src de="Règle" /></li>
          <li>Vol de vie (Baiser du vampire, Succube) : le lanceur récupère autant de PV que de DM infligés.<Src de="Règle" /></li>
          <li>Limites : 1/combat (Ensevelissement), 1/combat par cible (Malédiction, Briser), 1/jour ≈ 1 combat (Armée). Par cible = au touché, sinon au lancer.<Src de="Règle" /></li>
          <li>Rituel de sang : sans test (touche auto). Briser les cœurs : moitié des dégâts si raté.<Src de="Règle" /></li>
          <li>Invocations : démon (PV niveau×5, DEF 18, épée 2d4°+5) et zombie (PV 10+niveau, DEF 10, contact 1d4°+2), au camp du lanceur, en fin d&apos;ordre.<Src de="Règle" /></li>
          <li>Parade (Guerrier, M, bouclier) : la prochaine attaque réussie est bloquée sur test opposé auto (niv+FOR/AGI) ; absorption des sorts pareil, stockée pour Renvoi (G, pas les zones). Énorme/colossale : moitié DM (MJ).<Src de="Règle" /></li>
          <li>Riposte (G) : un raté au contact est signalé (1/round, MJ : attaque manuelle). Coups spéciaux (panneau Attaque) : Puissante (dé malus +2d4°, L +3d4°), Parfaite (dé bonus +1d4°, prédilection MJ), mod. ±N, +DM (Double/Circulaire −2, prédilection +1, spécialisation +1).<Src de="Règle" /></li>
          <li>Science du critique : 19-20 avec prédilection (effet à appliquer via Capacités, MJ).<Src de="Règle" /></li>
          <li>Rôdeur archer : Dans le mille (dé malus +2d4°, L +3d4°), Flèche de mort (dé bonus +1d4° ou état 1 round : aveuglé/affaibli/ralenti/immobilisé, NC inférieur, 1/combat chacun, MJ), Éclair (bonus et DM à l&apos;AGI) — à cocher dans le panneau Attaque ; Double (L) et Tir rapide (L) : mod. −2, 2 lancers.<Src de="Règle" /></li>
          <li>Compagnon : le loup est ajouté auto en préparation (DEF 12+rang, PV niv×4, alpha auto) ; Double peine +1d4° auto à la 2e touche ; À-suivre et Riposte signalés au raté (MJ) ; Increvable via Capacités (+4d4°+CON, +5 DEF, purge, 1/combat MJ) ; Éclaireur : +1 DR au lieu du +1 PC.<Src de="Règle" /></li>
          <li>Dé bonus = 2d20 garder le meilleur, dé malus = garder le pire (annulation mutuelle, ex. Malédiction).<Src de="Supposition" /></li>
          <li>Tests opposés du livre approximés par 1d20 + bonus ≥ DEF ; sauvegarde CON 10 du Pied lancée auto (carac inconnue = 0, ex. monstres) ; durées en INT et cas MJ au jugement.<Src de="Supposition" /></li>
          <li>Armure d&apos;os : +3 DEF automatiques à l&apos;apprentissage (retirés au désapprentissage). Passifs restants (Exsangue, Pacte ténébreux) et déclenchés (Siphon, Sang mordant) : manuels — Éditer (Équip. DEF, CON) et boutons ±PV.<Src de="Supposition" /></li>
        </ul>
      </Section>

      <Section id="combat" titre="Combat">
        <ul className="list-disc pl-5 space-y-1">
          <li>Toucher : 1d20 + bonus ≥ DEF. 20 naturel = touche auto + critique ×{DEFAULT_COMBAT_OPTIONS.critique.multiplicateur} (bonus inclus, physique et magique), 1 naturel = échec auto — sauf +10 de chance, utilisable même sur un 1.<Src de="Règle" /></li>
          <li>0 PV = KO. Initiative 1d20+mod, tri décroissant, tours + manches, KO sautés.<Src de="Supposition" /></li>
          <li>Objet équipé en cours de route : le staging se resynchronise au lancement (bouton Actualiser) et chaque PJ peut être resynchronisé depuis sa fiche en combat (↻).</li>
          <li>Effets : tick en début de tour (dots/soins, expiration). Soutien : soin + effet, coût mana. Capacités utilisables : effet auto ou usage narratif.<Src de="Règle" /></li>
          <li>Sorts à effet sans dégâts (Malédiction, Peur…), dégâts par tour lancés au toucher (Saignements, Ensevelissement…). Les lettres A/M/L des attaques et sorts sont indicatives (économie gérée en réel).</li>
          <li>Attaques de sorts : bonus niv+VOL sauf bonus explicite, PM (+ PV) déduits avant le jet. Soutien : invocations, attaques accordées (griffes, contact). Zone (Armée) : tous les ennemis.</li>
        </ul>
      </Section>

      <Section id="effets" titre="Effets (buffs, debuffs, dots)">
        <p className="text-xs text-zinc-500">Valeurs d&apos;exemple du catalogue, ajustables par le MJ. Badges en combat : vert = buff, rouge = dot/contrôle, violet = neutre, avec tours restants.</p>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-950 text-zinc-400 uppercase"><tr><th className="text-left px-2 py-1">Effet</th><th className="text-left px-2 py-1">Mécanique</th><th className="text-left px-2 py-1">Durée</th></tr></thead>
            <tbody>
              {EFFECT_CATALOG.map((e) => (
                <tr key={e.key} className="border-t border-zinc-800">
                  <td className="px-2 py-1 font-semibold">{e.nom}</td>
                  <td className="px-2 py-1">{e.description}</td>
                  <td className="px-2 py-1 font-mono">{e.dureeDefaut ?? "∞"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
