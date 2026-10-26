"use client";
import { useState } from "react";
import type { Character } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import { manaMax, recalculerPersonnage } from "@/src/lib/rules/personnage";
import { libelleMains, peutEquiper, validerEquipement } from "@/src/lib/rules/equipement";
import { verifierArmurePortee } from "@/src/lib/rules/limitesArmures";
import { apprendreTalentComplet, compterCapacites, desapprendreTalentComplet, normaliserNomCapacite, peutApprendre, peutDesapprendre, sortDuTalent, talentsRang2Gratuits } from "@/src/lib/rules/creation";
import { actionDeCapacite, actionDeTalent, voiesDe } from "@/src/lib/data/capacites";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import {
  chargesInitialesObjet,
  chargesRestantesObjet,
  natureObjetCombat,
} from "@/src/lib/rules/combat/objets";
import { ITEM_CATEGORIES, type ItemCategorie } from "@/src/lib/rules/world/types";
import { ActionBadge } from "@/src/components/ui/ActionBadge";

function normaliserRecherche(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

interface Props {
  character: Character;
  stock: Item[];
  onUpdate: (c: Character) => void;
}

export function EquipagePanel({ character, stock, onUpdate }: Props) {
  const [addId, setAddId] = useState("");
  const [rechercheObjet, setRechercheObjet] = useState("");
  const [filtreObjet, setFiltreObjet] = useState<"toutes" | ItemCategorie>("toutes");
  const [equipMsg, setEquipMsg] = useState<string | null>(null);
  const [voieOuverte, setVoieOuverte] = useState<string | null>(null);
  const inv = character.inventaire ?? [];
  const sorts = character.sorts ?? [];
  const talents = character.capacites ?? [];
  const profil = (character.profil ?? "").trim() || (character.classe ?? "").trim();
  const compte = compterCapacites(character);
  const optsR2 = talentsRang2Gratuits(character);

  const resolveItem = (itemId: string) => stock.find((o) => o.id === itemId);

  /** Une armure / un bouclier (bonus DEF) s'équipe comme une arme. */
  const estEquipable = (item?: Item) =>
    !!item && (!!item.estArme || item.categorie === "armure" || (item.bonusDefense ?? 0) > 0);

  const appliquerInventaire = (inventaire: Character["inventaire"]) => {
    setEquipMsg(null);
    onUpdate(recalculerPersonnage({ ...character, inventaire }, stock));
  };

  const addItem = () => {
    if (!addId) return;
    const exists = inv.find((e) => e.itemId === addId);
    const item = resolveItem(addId);
    const charges =
      item && natureObjetCombat(item) === "baguette"
        ? chargesInitialesObjet(item) ?? undefined
        : undefined;
    if (exists) {
      appliquerInventaire(
        inv.map((e) =>
          e.itemId === addId
            ? {
                ...e,
                quantite: e.quantite + 1,
                ...(charges != null && item
                  ? { charges: (chargesRestantesObjet(e, item) ?? 0) + charges }
                  : {}),
              }
            : e
        )
      );
      setAddId("");
      return;
    }
    // Nouvel objet : équipé seulement si les mains / emplacements le permettent.
    let equipe = estEquipable(item);
    if (equipe) {
      const test = peutEquiper(inv, stock, addId);
      if (!test.ok) {
        equipe = false;
        setEquipMsg(`Ajouté non équipé : ${test.raisons.join(" · ")}`);
      }
    }
    onUpdate(
      recalculerPersonnage(
        {
          ...character,
          inventaire: [
            ...inv,
            { itemId: addId, quantite: 1, equipe, ...(charges != null ? { charges } : {}) },
          ],
        },
        stock
      )
    );
    setAddId("");
  };

  const toggleEquipe = (itemId: string) => {
    const cible = inv.find((x) => x.itemId === itemId);
    if (cible && !cible.equipe) {
      const test = peutEquiper(inv, stock, itemId);
      if (!test.ok) {
        setEquipMsg(`Impossible d'équiper : ${test.raisons.join(" · ")}`);
        return;
      }
    }
    appliquerInventaire(inv.map((x) => (x.itemId === itemId ? { ...x, equipe: !x.equipe } : x)));
  };

  const removeItem = (itemId: string) => {
    appliquerInventaire(inv.filter((x) => x.itemId !== itemId));
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

  // Désapprendre un talent retire aussi son sort lié (ex. Bénédiction) :
  // un sort orphelin n'est plus lançable. Dérivés resynchronisés (DEF, mana...).
  const removeTalent = (nom: string) =>
    onUpdate(desapprendreTalentComplet(character, nom, SEED_SORTS, stock));

  const learnTalent = (nom: string) => {
    if (!nom) return;
    // Un talent qui est aussi un sort crée l'entrée lançable (+ mana).
    onUpdate(apprendreTalentComplet(character, nom, SEED_SORTS, stock));
  };

  return (
    <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
      <div>
        <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Inventaire ({inv.length})</div>
        <p className="text-xs text-zinc-500 mb-1">Armes et armures « Équipé » partent en combat (DEF recalculée, 2 mains max, 1 torse + 1 bouclier max).</p>
        {(() => {
          const v = validerEquipement(inv, stock);
          const port = verifierArmurePortee(character, stock);
          return (
            <p className={`text-xs font-mono mb-1 ${v.ok && port.length === 0 ? "text-zinc-500" : "text-amber-300"}`}>
              👐 {v.etat.mains}/2 mains{v.ok ? "" : ` · ⚠ ${v.raisons.join(" · ")}`}
              {port.length > 0 && ` · ⚠ ${port.join(" · ")}`}
            </p>
          );
        })()}
        {equipMsg && <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1 mb-1">{equipMsg}</p>}
        {inv.length === 0 && <p className="text-xs text-zinc-500">Vide — ajoutez depuis le stock d&apos;objets.</p>}
        <div className="space-y-1">
          {inv.map((e) => {
            const item = resolveItem(e.itemId);
            const equipable = estEquipable(item);
            const porte = !e.equipe && equipable ? peutEquiper(inv, stock, e.itemId) : { ok: true, raisons: [] as string[] };
            return (
              <div key={e.itemId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {item?.estArme ? "🗡 " : item?.categorie === "armure" ? "🛡 " : "🎒 "}{item?.nom ?? e.itemId}
                  {item?.magique && <span className="text-xs text-violet-300 ml-1">✦ magique</span>}
                  <span className="text-zinc-500 text-xs"> ×{e.quantite}</span>
                  {item && equipable && <span className="text-zinc-500 text-xs"> ({libelleMains(item)})</span>}
                  {item?.estArme && <span className="text-zinc-500 text-xs"> (+{item.bonusAttaque ?? 0} · {item.degats ?? "1d6"})</span>}
                  {(item?.bonusDefense ?? 0) > 0 && <span className="text-sky-300 text-xs"> (+{item?.bonusDefense} DEF{item?.magique ? ", non cumulé" : ""}{e.equipe ? "" : " — non équipé"})</span>}
                </span>
                {equipable && (
                  porte.ok ? (
                    <button
                      onClick={() => toggleEquipe(e.itemId)}
                      title={e.equipe ? "Équipé : bonus actif — cliquer pour déséquiper" : "Équiper : le bonus s'appliquera (DEF recalculée)"}
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${e.equipe ? "bg-green-700" : "bg-zinc-800"}`}
                    >
                      {e.equipe ? "✓ Équipé" : "Équiper"}
                    </button>
                  ) : (
                    <span
                      title={`Impossible : ${porte.raisons.join(" · ")} (déséquipez autre chose d'abord)`}
                      className="text-xs px-2 py-0.5 rounded bg-zinc-900 text-zinc-600 cursor-not-allowed"
                    >
                      🔒
                    </span>
                  )
                )}
                <button
                  onClick={() => removeItem(e.itemId)}
                  className="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        {stock.length > 0 && (() => {
          const aiguille = normaliserRecherche(rechercheObjet.trim());
          const candidats = stock
            .filter((o) => !inv.some((e) => e.itemId === o.id))
            .filter((o) => filtreObjet === "toutes" || o.categorie === filtreObjet)
            .filter((o) => aiguille === "" || normaliserRecherche(o.nom).includes(aiguille));
          const selectionValide = candidats.some((o) => o.id === addId) ? addId : "";
          return (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={rechercheObjet}
                  onChange={(e) => setRechercheObjet(e.target.value)}
                  placeholder="Rechercher un objet par son nom…"
                  className="flex-1 bg-zinc-800 rounded px-2 py-1.5 text-sm"
                />
                <select value={filtreObjet} onChange={(e) => setFiltreObjet(e.target.value as "toutes" | ItemCategorie)} title="Filtrer par catégorie" className="bg-zinc-800 rounded px-2 py-1.5 text-sm max-w-32">
                  <option value="toutes">Toutes</option>
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {(aiguille !== "" || filtreObjet !== "toutes") && (
                <p className="text-xs text-zinc-500">{candidats.length} résultat{candidats.length > 1 ? "s" : ""}</p>
              )}
              <div className="flex gap-2">
                <select value={selectionValide} onChange={(e) => setAddId(e.target.value)} className="flex-1 bg-zinc-800 rounded px-2 py-1.5 text-sm">
                  <option value="">+ Objet du stock…</option>
                  {candidats.map((o) => (
                    <option key={o.id} value={o.id}>{o.nom}{o.estArme ? " (arme)" : ""}{(o.bonusDefense ?? 0) > 0 ? ` (+${o.bonusDefense} DEF)` : ""}{o.magique ? " ✦" : ""}</option>
                  ))}
                </select>
                <button onClick={addItem} disabled={!selectionValide} className="px-3 py-1.5 rounded bg-zinc-800 text-sm disabled:opacity-40">Ajouter</button>
              </div>
              {candidats.length === 0 && (
                <p className="text-xs text-zinc-500">Aucun objet ne correspond à cette recherche.</p>
              )}
            </div>
          );
        })()}
      </div>

      <div>
        <div className="text-xs uppercase text-zinc-400 font-bold mb-1.5">Sorts ({sorts.length})</div>
        <p className="text-xs text-zinc-500 mb-1.5">Créer un sort : onglet Sorts & Capacités (avec coûts et attribution).</p>
        <div className="space-y-1">
          {sorts.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {s.type === "offensif" ? "✦ " : "🛡 "}{s.nom}
                <ActionBadge action={s.action} className="ml-1.5" />
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
              <span className="flex-1">◈ {t} <ActionBadge action={actionDeTalent(t, profil)} className="ml-1.5" /></span>
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
                      return (
                        <div key={`${c.rang}-${c.nom}`} className="text-xs border-t border-zinc-800/60 pt-1.5">
                          <div className="flex justify-between gap-2 items-center">
                            <span>
                              <span className="font-mono text-amber-300 font-bold">R{c.rang}</span>
                              {" "}<span className="font-semibold">{c.sortId ? "✦ " : "◈ "}{c.nom}</span>
                              <ActionBadge action={actionDeCapacite(c)} className="ml-1.5" />
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
