"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Campagne" },
  { href: "/play", label: "▶ Partie" },
  { href: "/characters", label: "Personnages" },
  { href: "/classes", label: "Classes" },
  { href: "/sorts", label: "Sorts & Capacités" },
  { href: "/regles", label: "Règles" },
  { href: "/monsters", label: "Bestiaire" },
  { href: "/dice", label: "Dés" },
  { href: "/combat", label: "Combat" },
  { href: "/scenarios", label: "Scénarios" },
  { href: "/npcs", label: "PNJ" },
  { href: "/items", label: "Objets" },
  { href: "/settings", label: "Paramètres" },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex gap-2 flex-wrap">
      <span className="font-bold text-amber-400 mr-4">CO Fantasy · Assistant MJ</span>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            path === l.href ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
