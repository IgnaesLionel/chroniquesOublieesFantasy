"use client";
import Link from "next/link";
import { useCharacters, useMonsters, useScenarios, useSessions, useSorts } from "@/src/lib/store/collections";
import { useNpcSaved } from "@/src/lib/store/npcgen";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";

const CARDS: { href: string; t: string; d: string; key: string | null }[] = [
  { href: "/characters", t: "Personnages", d: "PV, défense, attaques", key: "characters" },
  { href: "/classes", t: "Classes", d: "Profils, voies, équipement", key: null },
  { href: "/sorts", t: "Sorts & Capacités", d: "Grimoire, voies, talents", key: "sorts" },
  { href: "/regles", t: "Règles", d: "Référence COF 2 à valider", key: null },
  { href: "/monsters", t: "Bestiaire", d: "Préparer rencontres", key: "monsters" },
  { href: "/dice", t: "Dés", d: "Lanceur + historique", key: null },
  { href: "/combat?vue=composition", t: "Combat", d: "Initiative, tours, effets", key: null },
  { href: "/scenarios", t: "Scénarios", d: "Scènes, choix, conditions", key: "scenarios" },
  { href: "/sessions", t: "Sessions", d: "Tables, groupes, campagnes", key: "sessions" },
  { href: "/npcs", t: "PNJ", d: "Générateur, bibliothèque, secrets MJ", key: "npcSaved" },
  { href: "/tresors", t: "Trésors & Objets", d: "Butin, catalogue, objets magiques", key: "items" },
  { href: "/settings", t: "Sauvegarde", d: "Export / import JSON", key: null },
];

export default function Dashboard() {
  // Les compteurs passent par les mêmes hooks que les écrans : les graines
  // comptent dès le premier rendu et toute création/suppression est reflétée
  // immédiatement (plus de lecture directe du localStorage, qui affichait 0
  // pour les collections non encore initialisées).
  const { items: characters } = useCharacters("tableau-de-bord");
  const { items: sorts } = useSorts();
  const { items: monsters } = useMonsters();
  const { items: scenarios } = useScenarios();
  const { items: sessions } = useSessions();
  const { items: npcSaved } = useNpcSaved();
  const { catalogue } = useCatalogueObjets();
  const counts: Record<string, number> = {
    characters: characters.length,
    sorts: sorts.length,
    monsters: monsters.length,
    scenarios: scenarios.length,
    sessions: sessions.length,
    npcSaved: npcSaved.length,
    items: catalogue.length,
  };

  return (
    <div className="space-y-6">
      <header className="text-center space-y-3 pt-4 pb-2">
        <p className="overline-rune">Grimoire du Maître de Jeu</p>
        <h1 className="text-3xl sm:text-4xl font-bold">Chroniques Oubliées Fantasy</h1>
        <div className="hr-rune max-w-md mx-auto" aria-hidden="true"><span>❖</span></div>
        <p className="text-zinc-400 text-sm italic font-body max-w-xl mx-auto">
          Personnages, monstres, dés, combat, scénarios à embranchements, PNJ, objets et trésors —
          tout le nécessaire pour mener la veillée.
        </p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="panel p-4 block transition-all hover:-translate-y-0.5 hover:border-gold-600 hover:shadow-[0_10px_30px_rgb(201_162_39/0.12)]">
            <div className="font-display font-bold text-gold-200 tracking-wide">
              {c.t}
              {c.key && <span className="chip-seal ml-2">{counts[c.key] ?? 0}</span>}
            </div>
            <div className="text-sm text-zinc-400 mt-1 italic">{c.d}</div>
          </Link>
        ))}
      </div>
      <div className="text-center pt-2">
        <Link href="/play" className="btn-gold text-base">
          ▶ Démarrer la partie
        </Link>
      </div>
    </div>
  );
}
