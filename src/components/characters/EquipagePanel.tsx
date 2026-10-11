"use client";
import { useState } from "react";
import type { Character } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import { manaMax } from "@/src/lib/rules/personnage";
import { apprendreTalentComplet, compterCapacites, normaliserNomCapacite, peutApprendre, peutDesapprendre, sortDuTalent, talentsRang2Gratuits } from "@/src/lib/rules/creation";
import { ACTION_LABEL, infererAction, voiesDe } from "@/src/lib/data/capacites";
import { SEED_SORTS } from "@/src/lib/data/sorts";

interface Props {
  character: Character;
  stock: Item[];
  onUpdate: (c: Character) => void;
}

export function EquipagePanel({ character, stock, onUpdate }: Props) {
  const [addId, setAddId] = useState("");
  const [voieOuverte, setVoieOuverte] = useState<string | null>(null);
  const inv = character.inventaire ?? [];
  const sorts = character.sorts ?? [];
  const talents = character.capacites ?? [];
  const profil = (character.profil ?? "").trim() || (character.classe ?? "").trim();
  const compte = compterCapacites(character);
  const optsR2 = talentsRang2Gratuits(character);

  const resolveItem = (itemId: string) => stock.find((o) => o.id === itemId);

  const addItem = () => {
    if (!addId) return;
    const exists = inv.find((e) => e.itemId === addId);
    const item = resolveItem(addId);
    const updated = exists
      ? inv.map((e) => (e.itemId === addId ? { ...e, quantite: e.quantite + 1 } : e))
      : [...inv, { itemId: addId, quantite: 1, equipe: !!item?.estArme }];
    onUpdate({ ...character, inventaire: updated });
    setAddId("");
  };

  const removeSort = (id: string) => {
    const sorts = (character.sorts ?? []).filter((x) => x.id !== id);
    const max = manaMax(character.caracteristiques.VOL, sorts.length);
    const prev = character.ressources?.mana ?? { max, actuel: max };
    onUpdate({
      ...character,
      sorts,
      ressources: { ...(character.ressources ?? {}), mana: { max, actuel: Math.min(prev.actuel, max) } },
    });
  };

  const removeTalent = (nom: string) =>
    onUpdate({ ...character, capacites: (character.capacites ?? []).filter((t) => t !== nom) });

  const learnTalent = (nom: string) => {
    if (!nom) return;
    // Un talent qui est aussi un sort crée l'entrée lançable (+ mana).
    onUpdate(apprendreTalentComplet(character, nom, SEED_SORTS));
  };

  return (
    <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
      <div>
        <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Inventaire ({inv.length})</div>
        <p className="text-xs text-zinc-500 mb-1">Seules les armes « Équipée » partent en combat.</p>
        {inv.length === 0 && <p className="text-xs text-zinc-500">Vide — ajoutez depuis le stock d'objets.</p>}
        <div className="space-y-1">
          {inv.map((e) => {
            const item = resolveItem(e.itemId);
            return (
              <div key={e.itemId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {item?.estArme ? "🗡 " : "🎒 "}{item?.nom ?? e.itemId}
                  <span className="text-zinc-500 text-xs"> ×{e.quantite}</span>
                  {item?.estArme && <span className="text-zinc-500 text-xs"> (+{item.bonusAttaque ?? 0} · {item.degats ?? "1d6"})</span>}
                </span>
                {item?.estArme && (
                  <button
                    onClick={() => onUpdate({ ...character, inventaire: inv.map((x) => (x.itemId === e.itemId ? { ...x, equipe: !x.equipe } : x)) })}
                    title={e.equipe ? "Équipée : utilisable en combat — cliquer pour déséquiper" : "Équiper : l'arme apparaîtra en combat"}
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${e.equipe ? "bg-green-700" : "bg-zinc-800"}`}
                  >
                    {e.equipe ? "✓ Équipée" : "Équiper"}
                  </button>
                )}
                <button
                  onClick={() => onUpdate({ ...character, inventaire: inv.filter((x) => x.itemId !== e.itemId) })}
                  className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {stock.length > 0 && (
          <div className="flex gap-2 mt-2">
            <select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1 bg-zinc-800 rounded px-2 py-1.5 text-sm">
              <option value="">+ Objet du stock…</option>
              {stock.filter((o) => !inv.some((e) => e.itemId === o.id)).map((o) => (
                <option key={o.id} value={o.id}>{o.nom}{o.estArme ? " (arme)" : ""}</option>
              ))}
            </select>
            <button onClick={addItem} disabled={!addId} className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-40">Ajouter</button>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Sorts ({sorts.length})</div>
        <p className="text-xs text-zinc-500 mb-1.5">Créer un sort : onglet Sorts & Capacités (avec coûts et attribution).</p>
        <div className="space-y-1">
          {sorts.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {s.type === "offensif" ? "✦ " : "🛡 "}{s.nom}
                <span className="text-zinc-500 text-xs">
                  {" "}· {s.type}{s.ecole ? ` ${s.ecole}` : ""}{s.voie ? ` · ${s.voie}${s.rang ? ` R${s.rang}` : ""}` : s.rang ? ` · R${s.rang}` : ""}
                  {s.degats ? ` · ${s.degats}` : ""}{s.soin ? ` · +${s.soin}` : ""}
                  {s.effetCle ? ` · ✦${s.effetCle}` : ""}{s.cout ? ` · ${s.cout.montant} ${s.cout.ressource}` : ""}
                </span>
              </span>
              {(() => {
                const porte = peutDesapprendre(character, s.nom, "sorts");
                return porte.ok ? (
                  <button
                    onClick={() => removeSort(s.id)}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900"
                    title="Désapprendre le sort"
                  >
                    ✕
                  </button>
                ) : (
                  <span
                    title={porte.raisons.join(" · ")}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-900 text-zinc-600 cursor-not-allowed"
                  >
                    🔒
                  </span>
                );
              })()}
            </div>
          ))}
        </div>
        
      </div>

      <div>
        <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Talents ({talents.length})</div>
        <div className="text-xs text-zinc-400 mb-1.5">
          Points : {compte.depense}/{compte.points}{compte.restants > 0 ? ` (${compte.restants} restant${compte.restants > 1 ? "s" : ""})` : " (épuisés)"}
          {compte.rang2Nom ? ` · R2 gratuit : ${compte.rang2Nom} ✓` : optsR2.length > 0 ? " · R2 gratuit : disponible" : ""}
        </div>
        <div className="space-y-1">
          {talents.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm">
              <span className="flex-1">◈ {t}</span>
              {(() => {
                const sort = sortDuTalent(t, SEED_SORTS);
                const q = normaliserNomCapacite(t);
                const lanceable = character.sorts.some((s) => normaliserNomCapacite(s.nom) === q);
                if (!sort || lanceable) return null;
                return (
                  <button
                    onClick={() => learnTalent(t)}
                    title={`Créer le sort lançable (${sort.cout ? `${sort.cout.montant} PM` : "sans coût"})`}
                    className="text-xs px-2 py-0.5 rounded bg-violet-900 hover:bg-violet-800"
                  >
                    ✦
                  </button>
                );
              })()}
              {(() => {
                const porte = peutDesapprendre(character, t, "talents");
                return porte.ok ? (
                  <button
                    onClick={() => removeTalent(t)}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900"
                    title="Désapprendre le talent"
                  >
                    ✕
                  </button>
                ) : (
                  <span
                    title={porte.raisons.join(" · ")}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-900 text-zinc-600 cursor-not-allowed"
                  >
                    🔒
                  </span>
                );
              })()}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="text-xs text-zinc-500 font-bold">Choisir par voie (dépenser les points)</div>
          {voiesDe(profil).length === 0 && (
            <p className="text-xs text-zinc-500">Profil inconnu : aucune voie proposée.</p>
          )}
          {voiesDe(profil).map((v) => {
            const pris = v.capacites.filter((x) => talents.includes(x.nom)).length;
            const ouvert = voieOuverte === v.voie;
            return (
              <div key={v.voie} className="rounded border border-zinc-800">
                <button
                  onClick={() => setVoieOuverte(ouvert ? null : v.voie)}
                  className="w-full text-left px-2.5 py-1.5 text-xs flex justify-between items-center gap-2"
                >
                  <span className="font-semibold">{v.voie}</span>
                  <span className="text-zinc-500 shrink-0">{pris}/{v.capacites.length}{" "}{ouvert ? "▾" : "▸"}</span>
                </button>
                {ouvert && (
                  <div className="px-2.5 pb-2 space-y-1.5">
                    {v.capacites.map((c) => {
                      const connu = talents.includes(c.nom)
                        || sorts.some((s) => normaliserNomCapacite(s.nom) === normaliserNomCapacite(c.nom));
                      const porte = peutApprendre(character, { nom: c.nom, voie: v.voie, rang: c.rang });
                      const action = infererAction(c.resume);
                      return (
                        <div key={`${c.rang}-${c.nom}`} className="text-xs border-t border-zinc-800/60 pt-1.5">
                          <div className="flex justify-between gap-2 items-center">
                            <span>
                              <span className="font-mono text-amber-300 font-bold">R{c.rang}</span>
                              {" "}<span className="font-semibold">{c.sortId ? "✦ " : "◈ "}{c.nom}</span>
                              {action && <span className="ml-1.5 text-zinc-500">{ACTION_LABEL[action]}</span>}
                            </span>
                            {connu ? (
                              <span className="text-green-400 font-semibold shrink-0">✓</span>
                            ) : porte.ok ? (
                              <button
                                onClick={() => learnTalent(c.nom)}
                                title={porte.gratuit ? "Apprendre (gratuit)" : `Apprendre (${porte.cout} pt)`}
                                className={`text-xs px-2 py-0.5 rounded shrink-0 ${porte.gratuit ? "bg-violet-700 font-semibold" : "bg-zinc-800"}`}
                              >
                                {porte.gratuit ? "Gratuit" : `${porte.cout} pt`}
                              </button>
                            ) : (
                              <span title={porte.raisons.join(" · ")} className="shrink-0">🔒</span>
                            )}
                          </div>
                          <p className="text-zinc-500 pt-0.5">{c.resume}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-zinc-600 mt-1.5">✦ = aussi un sort (grimoire, mana). Traits du peuple : dans Éditer.</p>
      </div>
    </div>
  );
}
