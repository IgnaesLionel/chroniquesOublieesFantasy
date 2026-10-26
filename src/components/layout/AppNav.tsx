"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Campagne" },
  { href: "/play", label: "▶ Partie" },
  { href: "/sessions", label: "Sessions" },
  { href: "/characters", label: "Personnages" },
  { href: "/classes", label: "Classes" },
  { href: "/sorts", label: "Sorts & Capacités" },
  { href: "/regles", label: "Règles" },
  { href: "/monsters", label: "Bestiaire" },
  { href: "/combat", label: "Combat & rencontres" },
  { href: "/dice", label: "Dés" },
  { href: "/scenarios", label: "Scénarios" },
  { href: "/npcs", label: "PNJ" },
  { href: "/tresors", label: "Trésors & Objets" },
  { href: "/settings", label: "Paramètres" },
];

export function AppNav() {
  const path = usePathname();
  const actif = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur px-4 py-2.5 flex gap-2 items-center overflow-x-auto border-b-2 border-bronze-700 shadow-[0_4px_18px_rgb(0_0_0/0.6)]"
    >
      <Link
        href="/"
        aria-label="Assistant MJ — retour à la campagne"
        className="font-display font-bold text-gold-300 mr-2 whitespace-nowrap tracking-wider text-base hover:text-gold-200"
      >
        <span aria-hidden="true" className="text-gold-500 mr-1.5">❖</span>
        Assistant MJ
      </Link>
      {LINKS.map((l) => {
        const courant = actif(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={courant ? "page" : undefined}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap shrink-0 border transition-colors ${
              courant
                ? "bg-gold-400 text-[#1a1408] font-bold border-[#6d5618] shadow-[0_2px_10px_rgb(201_162_39/0.35)]"
                : "text-parchment-300 border-transparent hover:border-bronze-700 hover:text-gold-200 hover:bg-zinc-800"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
