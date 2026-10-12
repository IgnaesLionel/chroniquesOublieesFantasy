import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/src/components/layout/AppNav";

export const metadata: Metadata = {
  title: "Assistant MJ — Chroniques Oubliées Fantasy V2",
  description: "Copilote du MJ : personnages, monstres, combats, scénarios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full dark">
      <body className="min-h-full flex flex-col font-body">
        <AppNav />
        <main className="flex-1 max-w-6xl w-full mx-auto p-4">{children}</main>
        <footer className="pb-6 pt-2 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="hr-rune" aria-hidden="true"><span>❖</span></div>
            <p className="text-center text-xs mt-2 text-zinc-500 font-display tracking-[0.2em] uppercase">
              Chroniques Oubliées Fantasy · Grimoire du Maître de Jeu
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
