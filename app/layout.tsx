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
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <AppNav />
        <main className="flex-1 max-w-6xl w-full mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
