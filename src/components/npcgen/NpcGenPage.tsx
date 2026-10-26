"use client";

import { useEffect, useState } from "react";
import { useMonsters, useScenarios, useSessions } from "@/src/lib/store/collections";
import {
  assurerInitialisationPnj,
  useNpcFactions,
  useNpcPlacements,
  useNpcProfiles,
  useNpcReferenceEntries,
  useNpcReferenceTables,
  useNpcSaved,
  useNpcStatBlocks,
} from "@/src/lib/store/npcgen";
import { NpcGenerator } from "@/src/components/npcgen/NpcGenerator";
import { NpcLibrary } from "@/src/components/npcgen/NpcLibrary";
import { ReferenceManager } from "@/src/components/npcgen/ReferenceManager";
import { FactionManager } from "@/src/components/npcgen/FactionManager";
import { ProfileManager } from "@/src/components/npcgen/ProfileManager";
import { LegacyNpcs } from "@/src/components/npcgen/LegacyNpcs";

const ONGLETS = [
  { id: "generation", label: "Génération" },
  { id: "bibliotheque", label: "Bibliothèque" },
  { id: "tables", label: "Tables de référence" },
  { id: "factions", label: "Factions" },
  { id: "profils", label: "Profils" },
  { id: "exemples", label: "Exemples" },
] as const;

type Onglet = (typeof ONGLETS)[number]["id"];

export function NpcGenPage() {
  const [onglet, setOnglet] = useState<Onglet>("generation");
  const [initialisation, setInitialisation] = useState("");

  const { items: tables, setItems: setTables } = useNpcReferenceTables();
  const { items: entries, setItems: setEntries } = useNpcReferenceEntries();
  const { items: saved, setItems: setSaved } = useNpcSaved();
  const { items: statBlocks, setItems: setStatBlocks } = useNpcStatBlocks();
  const { items: placements, setItems: setPlacements } = useNpcPlacements();
  const { items: factions, setItems: setFactions } = useNpcFactions();
  const { items: profiles, setItems: setProfiles } = useNpcProfiles();
  const { items: monsters } = useMonsters();
  const { items: scenarios } = useScenarios();
  const { items: sessions } = useSessions();

  useEffect(() => {
    const resultat = assurerInitialisationPnj();
    if (resultat.ajouts > 0 || resultat.retires > 0) {
      const messages: string[] = [];
      if (resultat.ajouts > 0) {
        messages.push(`${resultat.ajouts} élément(s) initial(aux) ajouté(s) à la base locale.`);
      }
      if (resultat.retires > 0) {
        messages.push(`${resultat.retires} ancienne(s) option(s) de sexe retirée(s) de la table.`);
      }
      const texte = messages.join(" ");
      // Initialisation = synchronisation avec le stockage ; le message qui en
      // rend compte est publié hors du corps de l'effet.
      const minuteur = window.setTimeout(() => setInitialisation(texte), 0);
      return () => window.clearTimeout(minuteur);
    }
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-bronze-400">Chroniques Oubliées Fantasy</p>
          <h1 className="font-display text-3xl font-bold text-gold-300">Générateur de PNJ</h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Fiches narratives complètes, tables administrables, bibliothèque persistante.
            Les profils de combat sont optionnels et toujours identifiés comme estimations ou copies du bestiaire.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-zinc-400 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">{tables.length} tables</span>
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">{entries.length} entrées</span>
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">{saved.length} PNJ sauvegardés</span>
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">{factions.length} factions</span>
        </div>
      </header>

      {initialisation && (
        <div className="text-xs rounded border border-emerald-800 bg-emerald-950/30 text-emerald-200 p-2">
          {initialisation}
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-zinc-800 pb-2" aria-label="Sections du générateur de PNJ">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`px-3 py-1.5 rounded-t text-sm border-b-2 ${
              onglet === o.id
                ? "border-amber-400 text-amber-200 bg-zinc-900"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
            aria-current={onglet === o.id ? "page" : undefined}
          >
            {o.label}
            {o.id === "bibliotheque" && saved.length > 0 ? ` (${saved.length})` : ""}
          </button>
        ))}
      </nav>

      {onglet === "generation" && (
        <NpcGenerator
          tables={tables}
          entries={entries}
          factions={factions}
          profiles={profiles}
          saved={saved}
          setSaved={setSaved}
          statBlocks={statBlocks}
          setStatBlocks={setStatBlocks}
          monsters={monsters}
          onOpenLibrary={() => setOnglet("bibliotheque")}
        />
      )}

      {onglet === "bibliotheque" && (
        <NpcLibrary
          saved={saved}
          setSaved={setSaved}
          statBlocks={statBlocks}
          setStatBlocks={setStatBlocks}
          placements={placements}
          setPlacements={setPlacements}
          tables={tables}
          entries={entries}
          factions={factions}
          monsters={monsters}
          scenarios={scenarios}
          sessions={sessions}
        />
      )}

      {onglet === "tables" && (
        <ReferenceManager tables={tables} setTables={setTables} entries={entries} setEntries={setEntries} />
      )}

      {onglet === "factions" && <FactionManager factions={factions} setFactions={setFactions} />}

      {onglet === "profils" && (
        <ProfileManager
          profiles={profiles}
          setProfiles={setProfiles}
          tables={tables}
          entries={entries}
          factions={factions}
        />
      )}

      {onglet === "exemples" && <LegacyNpcs />}
    </div>
  );
}
