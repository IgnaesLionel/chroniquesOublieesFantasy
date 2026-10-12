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
  { href: "/tresors", label: "Trésors" },
  { href: "/settings", label: "Paramètres" },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-2.5 flex gap-2 items-center overflow-x-auto">
      <span className="font-bold text-amber-400 mr-2 whitespace-nowrap">CO Fantasy · Assistant MJ</span>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={path === l.href ? "page" : undefined}
          className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap shrink-0 ${
            path === l.href ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
