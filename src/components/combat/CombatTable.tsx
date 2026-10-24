"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { LABEL_ATTAQUE_GRATUITE, type AttaqueGratuite, type TypeAttaqueGratuite } from "@/src/lib/rules/combat/types";
import { getModifier } from "@/src/lib/rules/effects/effects";
import { talentConnu } from "@/src/lib/rules/combat/attack";
import { capacitesCreature } from "@/src/lib/rules/combat/fiche-creature";
import { pvBarreColor, pvTexteColor } from "@/src/lib/ui/pv";
import { classeFamille, familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";
import { FicheCreature } from "@/src/components/combat/FicheCreature";

function tonEffet(e: { modificateurs: Record<string, number> }): string {
  const m = e.modificateurs ?? {};
  if ((m["pvParTour"] ?? 0) < 0 || (m["empecheAgir"] ?? 0) > 0) return "bg-red-900 text-red-200";
  if ((m["defense"] ?? 0) > 0 || (m["attaque"] ?? 0) > 0 || (m["pvParTour"] ?? 0) > 0) return "bg-green-900 text-green-200";
  return "bg-violet-900 text-violet-200";
}

interface Props {
  combat: { participants: CombatParticipant[]; tourIndex: number };
  onHit: (id: string, n: number) => void;
  onHeal: (id: string, n: number) => void;
  onSelectAttacker: (id: string) => void;
  attackerId: string | null;
  onSync?: (id: string) => void;
  syncIds?: string[];
  /** Lancer / écarter / poser (Teigneux MJ) une attaque gratuite. */
  onGratuite?: (id: string, g: AttaqueGratuite) => void;
  onEffaceGratuite?: (id: string, g: AttaqueGratuite) => void;
  onAjouteGratuite?: (id: string, type: TypeAttaqueGratuite) => void;
}

export function CombatTable({ combat, onHit, onHeal, onSelectAttacker, attackerId, onSync, syncIds, onGratuite, onEffaceGratuite, onAjouteGratuite }: Props) {
  /** Créature dont la fiche (capacités du bestiaire) est ouverte. */
  const [ficheId, setFicheId] = useState<string | null>(null);
  const fiche = ficheId ? combat.participants.find((p) => p.instanceId === ficheId) ?? null : null;
  return (
    <>
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2 border-l-[3px] border-transparent">Init</th>
            <th className="text-left px-3 py-2">Participant</th>
            <th className="text-left px-3 py-2">PV</th>
            <th className="text-left px-3 py-2">Déf</th>
            <th className="text-left px-3 py-2">État</th>
            <th className="text-left px-3 py-2">Tour</th>
          </tr>
        </thead>
        <tbody>
          {combat.participants.map((p, i) => {
            const active = i === combat.tourIndex;
            const isAttacker = p.instanceId === attackerId;
            // DEF effective : base (armure comprise) + effets (surpris, renversé...).
            const modDef = getModifier(p.effets, "defense");
            const nomDe = (id?: string) =>
              id ? (combat.participants.find((x) => x.instanceId === id)?.nom ?? "?") : "";
            // Créatures : capacités du bestiaire (aperçu + fiche détaillée au clic).
            const capacites = p.camp === "monstre" ? capacitesCreature(p) : [];
            const apercuCapacites = capacites.slice(0, 2).map((c) => c.nom).join(" · ");
            const resteCapacites = capacites.length - 2;
            return (
              <tr
                key={p.instanceId}
                onClick={() => onSelectAttacker(p.instanceId)}
                className={`border-t border-zinc-800 cursor-pointer ${
                  active ? "bg-amber-400/15 outline outline-1 outline-amber-400" : isAttacker ? "bg-zinc-800/60" : "bg-zinc-950"
                } ${p.statut !== "actif" ? "opacity-50" : ""}`}
              >
                <td className={`px-3 py-2 font-mono font-bold text-amber-300 fam-rail ${p.camp === "pj" ? classeFamille(familleDuProfil(p.profil)) : "fam-neutre"}`}>{p.initiative ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded mr-1.5 ${p.camp === "pj" ? "bg-blue-900 text-blue-200" : "bg-red-900 text-red-200"}`}>
                    {p.camp === "pj" ? "PJ" : "MO"}
                  </span>
                  {p.bouclierBonus != null && (
                    <span title={`Bouclier manié (+${p.bouclierBonus} DEF) — requis Voie du bouclier`} className="text-[10px] px-1.5 py-0.5 rounded mr-1.5 bg-sky-950 border border-sky-800 text-sky-200">
                      🛡 +{p.bouclierBonus}
                    </span>
                  )}
                  {p.reanime && (
                    <span title="Cadavre animé (Animer un cadavre) — −2 attaque/DEF/Init ; tombé à nouveau, non réanimable" className="text-[10px] px-1.5 py-0.5 rounded mr-1.5 bg-purple-950 border border-purple-800 text-purple-200">
                      ☠ animé
                    </span>
                  )}
                  <span className="font-semibold">{p.nom}</span>
                  <FamilleBadge famille={p.camp === "pj" ? familleDuProfil(p.profil) : null} className="ml-1.5" />
                  {capacites.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFicheId(p.instanceId); }}
                      title="Capacités de la créature (bestiaire) — cliquer pour le détail"
                      className="mt-1 block text-left text-[10px] text-sky-300/90 hover:text-sky-100"
                    >
                      🧠 {apercuCapacites}{resteCapacites > 0 ? ` +${resteCapacites}` : ""}
                    </button>
                  )}
                  {(p.sousCategories ?? []).length > 0 && (
                    <span className="block text-[10px] text-amber-300/80" title="Sous-catégories (dégâts bonus de certains sorts)">
                      💀 {(p.sousCategories ?? []).join(" · ")}
                    </span>
                  )}
                  {p.effets.length > 0 && (
                    <span className="block mt-1 space-x-1">
                      {p.effets.map((e) => (
                        <span
                          key={e.id}
                          title={`${e.description ?? ""}${e.source ? ` (par ${e.source})` : ""}`}
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${tonEffet(e)}`}
                        >
                          {e.nom}{e.toursRestants != null ? ` (${e.toursRestants})` : " (∞)"}
                        </span>
                      ))}
                    </span>
                  )}
                  {(p.attaquesGratuites ?? []).length > 0 && (
                    <span className="block mt-1 space-x-1">
                      {(p.attaquesGratuites ?? []).map((g) => (
                        <span
                          key={`${g.type}-${g.de ?? "-"}`}
                          title={`⚔ ${LABEL_ATTAQUE_GRATUITE[g.type]} (G, hors tour)${g.de ? ` → ${nomDe(g.de)}` : ""} — contact et conditions validés côté MJ`}
                          className="inline-block text-[10px] px-1 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-200"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!g.lancee && onGratuite) onGratuite(p.instanceId, g); }}
                            disabled={!!g.lancee}
                            title={g.lancee ? `Lancée cette manche (${LABEL_ATTAQUE_GRATUITE[g.type]}, 1/round)` : "Résoudre l'attaque gratuite (G — ne dépasse pas la quota 1/round du type)"}
                            className={`${g.lancee ? "text-zinc-500 cursor-default" : "hover:text-white"}`}
                          >
                            {g.lancee ? "✓" : "⚔"} {LABEL_ATTAQUE_GRATUITE[g.type]}{g.de ? ` → ${nomDe(g.de)}` : ""}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEffaceGratuite?.(p.instanceId, g); }}
                            title="Écarter le signal (le MJ peut lancer l'attaque à la main si besoin)"
                            className="ml-1 text-orange-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                  {onAjouteGratuite && talentConnu(p, "Teigneux") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAjouteGratuite(p.instanceId, "teigneux"); }}
                      title="Teigneux (G, 1/round — Rempart : AGI+2) : signal une attaque gratuite ; cible le fuyard au contact (MJ)"
                      className="mt-1 block text-[10px] px-1.5 py-0.5 rounded bg-orange-900 hover:bg-orange-800 text-orange-200"
                    >
                      + ⚔ Teigneux
                    </button>
                  )}
                  {active && <span className="ml-2 text-[10px] font-bold text-amber-300">▶ TOUR</span>}
                </td>
                <td className="px-3 py-2">
                  <div className={`font-mono font-bold ${pvTexteColor(p.pv, p.pvMax)}`}>{p.pv}/{p.pvMax}</div>
                  <div className="w-20 h-1.5 bg-zinc-800 rounded mt-1">
                    <div className={`h-full rounded ${pvBarreColor(p.pv, p.pvMax)}`} style={{ width: `${p.pvMax ? (100 * p.pv) / p.pvMax : 0}%` }} />
                  </div>
                  <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onHit(p.instanceId, 1)} className="px-1.5 rounded bg-red-900 text-xs">−1</button>
                    <button onClick={() => onHit(p.instanceId, 5)} className="px-1.5 rounded bg-red-900 text-xs">−5</button>
                    <button onClick={() => onHeal(p.instanceId, 5)} className="px-1.5 rounded bg-green-900 text-xs">+5</button>
                      {onSync && syncIds?.includes(p.instanceId) && (<button onClick={() => onSync(p.instanceId)} title="Resynchroniser depuis la fiche (attaques, sorts, talents)" className="px-1.5 rounded bg-zinc-700 text-xs">↻</button>)}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono" title={modDef !== 0 ? `Base ${p.defense} (${modDef > 0 ? "+" : ""}${modDef} effets)` : "Défense (armure comprise)"}>
                  <span className={modDef < 0 ? "text-red-300" : modDef > 0 ? "text-green-300" : ""}>{p.defense + modDef}</span>{modDef !== 0 && <span className="text-xs text-zinc-500"> ({p.defense})</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.statut === "actif" ? "bg-green-900 text-green-200" : p.statut === "mort" ? "bg-black border border-zinc-700 text-zinc-400" : "bg-zinc-800 text-zinc-400"}`}>
                    {p.statut === "actif" ? "actif" : p.statut === "mort" ? "mort" : "KO"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">{active ? "à jouer" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {fiche && <FicheCreature participant={fiche} onClose={() => setFicheId(null)} />}
    </>
  );
}
