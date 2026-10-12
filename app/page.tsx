"use client";
import { useState } from "react";
import Link from "next/link";
import { STORAGE_KEYS, type CollectionName } from "@/src/lib/store/backup";

const CARDS: { href: string; t: string; d: string; key: CollectionName | null }[] = [
  { href: "/characters", t: "Personnages", d: "PV, défense, attaques", key: "characters" },
  { href: "/classes", t: "Classes", d: "Profils, voies, équipement", key: null },
  { href: "/sorts", t: "Sorts & Capacités", d: "Grimoire, voies, talents", key: "sorts" },
  { href: "/regles", t: "Règles", d: "Référence COF 2 à valider", key: null },
  { href: "/monsters", t: "Bestiaire", d: "Préparer rencontres", key: "monsters" },
  { href: "/dice", t: "Dés", d: "Lanceur + historique", key: null },
  { href: "/combat", t: "Combat", d: "Initiative, tours, effets", key: null },
  { href: "/scenarios", t: "Scénarios", d: "Scènes, choix, conditions", key: "scenarios" },
  { href: "/npcs", t: "PNJ", d: "Dialogues et secrets MJ", key: "npcs" },
  { href: "/items", t: "Objets", d: "Inventaire et quête", key: "items" },
  { href: "/tresors", t: "Trésors", d: "Trésors & objets magiques", key: null },
  { href: "/settings", t: "Sauvegarde", d: "Export / import JSON", key: null },
];

export default function Dashboard() {
  const [counts] = useState<Record<string, number> | null>(() => {
    if (typeof window === "undefined") return null;
    const c: Record<string, number> = {};
    (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((k) => {
      try {
        c[k] = (JSON.parse(window.localStorage.getItem(STORAGE_KEYS[k]) ?? "[]") as unknown[]).length;
      } catch {
        c[k] = 0;
      }
    });
    return c;
  });

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
              {c.key && counts !== null && <span className="chip-seal ml-2">{counts[c.key] ?? 0}</span>}
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
