"use client";
import { useEffect, useState } from "react";
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
  { href: "/settings", t: "Sauvegarde", d: "Export / import JSON", key: null },
];

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const c: Record<string, number> = {};
    (Object.keys(STORAGE_KEYS) as CollectionName[]).forEach((k) => {
      try {
        c[k] = (JSON.parse(window.localStorage.getItem(STORAGE_KEYS[k]) ?? "[]") as unknown[]).length;
      } catch {
        c[k] = 0;
      }
    });
    setCounts(c);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Campagne — Tableau de bord</h1>
      <p className="text-zinc-400 text-sm">
        Assistant MJ : personnages, monstres, dés, combat, scénarios à embranchements, PNJ et objets.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-400">
            <div className="font-semibold text-amber-300">
              {c.t}
              {c.key && counts !== null && <span className="ml-2 text-xs font-mono text-zinc-400">({counts[c.key] ?? 0})</span>}
            </div>
            <div className="text-sm text-zinc-400">{c.d}</div>
          </Link>
        ))}
      </div>
      <Link href="/play" className="inline-block bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-lg">
        Démarrer la partie
      </Link>
    </div>
  );
}
