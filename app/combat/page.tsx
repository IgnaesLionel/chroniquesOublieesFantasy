"use client";
import { useMemo, useState } from "react";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { useLocalCollection } from "@/src/lib/store/useLocalCollection";
import type { Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import type { AttackResolution, CombatParticipant, CombatState } from "@/src/lib/rules/combat/types";
import { DEFAULT_COMBAT_OPTIONS } from "@/src/lib/rules/combat/types";
import { createCombat, getActive, nextTurn, prevTurn, rollInitiatives, addParticipantEffect, removeParticipantEffect } from "@/src/lib/rules/combat/initiative";
import { applyDamage, applyHeal, castSoutien, construireLoupCompagnon, depenserChanceApresCoup, frapperZone, renvoyerSort, resolveAttack, talentConnu, utiliserCapacite, type AttaqueOpts } from "@/src/lib/rules/combat/attack";
import { monsterInstances, participantFromCharacter } from "@/src/lib/rules/combat/factory";
import { normaliserPersonnage } from "@/src/lib/rules/personnage";
import { createEffect } from "@/src/lib/rules/effects/effects";
import { CombatTable } from "@/src/components/combat/CombatTable";
import { AttackPanel } from "@/src/components/combat/AttackPanel";
import { SoutienPanel } from "@/src/components/combat/SoutienPanel";
import { CapacitesPanel } from "@/src/components/combat/CapacitesPanel";
import { EquipementPanel } from "@/src/components/combat/EquipementPanel";
import { CombatLog } from "@/src/components/combat/CombatLog";
import { EffectsPanel } from "@/src/components/combat/EffectsPanel";

export default function CombatPage() {
  const { items: characters, setItems: setCharacters } = useLocalCollection<Character>("cof.characters.v2", SEED_CHARACTERS);
  const { items: monsters } = useLocalCollection<MonsterTemplate>("cof.monsters.v2", SEED_MONSTERS);
  const { items: catalogue } = useLocalCollection<Item>("cof.items.v2", SEED_ITEMS);

  const [staging, setStaging] = useState<CombatParticipant[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [attackId, setAttackId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [last, setLast] = useState<AttackResolution | null>(null);
  const [lastAttaque, setLastAttaque] = useState<{ attackerId: string; targetId: string; attackId: string } | null>(null);

  const active = combat ? getActive(combat) : null;

  /** PJ (+ loup éventuel) reconstruits depuis la fiche : attaques/sorts/talents à jour. */
  const pjNeufs = (c: Character): CombatParticipant[] => {
    const frais = participantFromCharacter(normaliserPersonnage(c as unknown as Record<string, unknown>), catalogue);
    if (!talentConnu(frais, "Le loup")) return [frais];
    return [frais, construireLoupCompagnon(frais, {
      instanceId: `compagnon-${frais.instanceId}`,
      templateId: `compagnon:loup:${c.id}`,
      initMod: frais.initMod,
      initiative: null,
    })];
  };
  /** Reconstruit les PJ depuis leurs fiches (staging et demarrage). */
  const stagingAJour = (liste: CombatParticipant[]): CombatParticipant[] =>
    liste.flatMap((p) => {
      if (p.templateId.startsWith("compagnon:loup")) return [];
      const fiche = characters.find((c) => c.id === p.templateId);
      return fiche && p.camp === "pj" ? pjNeufs(fiche) : [p];
    });
  const addPJ = (c: Character) => {
    setStaging((s) => [...s.filter((p) => p.templateId !== c.id && p.templateId !== `compagnon:loup:${c.id}`), ...pjNeufs(c)]);
  };
  const addMonsters = (m: MonsterTemplate) => {
    const n = Math.max(1, Math.min(12, quantities[m.id] ?? 1));
    setStaging((s) => [...s, ...monsterInstances(m, n)]);
  };

  const resyncStaging = () => setStaging((s) => stagingAJour(s));
  const start = () => {
    if (staging.length < 2) return;
    const frais = stagingAJour(staging);
    setStaging(frais);
    const rolled = rollInitiatives(createCombat(frais));
    setCombat(rolled);
    setAttackerId(rolled.participants[rolled.tourIndex]?.instanceId ?? null);
    setTargetId(rolled.participants.find((p) => p.instanceId !== rolled.participants[rolled.tourIndex]?.instanceId && p.statut === "actif")?.instanceId ?? null);
    setAttackId(null);
    setLast(null);
  };

  const rollAttack = (opts?: AttaqueOpts) => {
    if (!combat || !attackerId || !targetId) return;
    const atk = combat.participants.find((p) => p.instanceId === attackerId);
    const aid = attackId ?? atk?.attaques[0]?.id;
    if (!atk || !aid) return;
    const cbl = combat.participants.find((p) => p.instanceId === targetId);
    if (!cbl || cbl.statut !== "actif") {
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: "Cible invalide ou hors combat — re-sélectionnez la cible." }] } : c
      );
      return;
    }
    try {
      // Coûts (mana + PV) et limites vérifiés dans le moteur.
      const { state, resolution } = resolveAttack(combat, attackerId, targetId, aid, Math.random, DEFAULT_COMBAT_OPTIONS, opts);
      setCombat(state);
      setLast(resolution);
      setLastAttaque({ attackerId, targetId, attackId: aid });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Attaque impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  const useChance = () => {
    if (!combat || !last || !lastAttaque) return;
    try {
      const { state, resolution } = depenserChanceApresCoup(combat, lastAttaque.attackerId, lastAttaque.targetId, lastAttaque.attackId, last);
      setCombat(state);
      setLast(resolution);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Chance impossible.";
      setCombat((c) =>
        c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
      );
    }
  };

  const syncIds = useMemo(() => {
    if (!combat) return [] as string[];
    return combat.participants
      .filter((p) => characters.some((c) => c.id === p.templateId))
      .map((p) => p.instanceId);
  }, [combat, characters]);

  /** Applique une fiche à son participant (attaques, sorts, talents) : PV, effets et état conservés. */
  const appliquerFiche = (instanceId: string, cibleNom: string, fiche: Character) => {
    const frais = participantFromCharacter(normaliserPersonnage(fiche as unknown as Record<string, unknown>), catalogue);
    setCombat((c) => {
      if (!c) return c;
      const cible = c.participants.find((x) => x.instanceId === instanceId);
      if (!cible) return c;
      // Attaques accordées en cours de combat (sort-tmp:) conservées.
      const gardees = cible.attaques.filter((a) => a.id.startsWith("sort-tmp:"));
      const attaques = [...frais.attaques.filter((a) => !gardees.some((g) => g.id === a.id)), ...gardees];
      const nouvelles = frais.attaques.filter((a) => !cible.attaques.some((x) => x.id === a.id)).map((a) => a.nom);
      return {
        ...c,
        participants: c.participants.map((x) => (x.instanceId === instanceId
          ? { ...x, attaques, sorts: frais.sorts, capacites: frais.capacites, bonusMagique: frais.bonusMagique, niveau: frais.niveau, caracs: frais.caracs }
          : x)),
        log: [...c.log, { id: `sync-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: `${cibleNom} resynchronisé depuis sa fiche (${attaques.length} attaque(s)${nouvelles.length > 0 ? `, + ${nouvelles.join(", ")}` : ""}).` }],
      };
    });
    setAttackId(null);
  };

  /** Resynchronise un PJ depuis sa fiche (raccourci du bouton ↻). */
  const syncDepuisFiche = (instanceId: string) => {
    if (!combat) return;
    const cible = combat.participants.find((x) => x.instanceId === instanceId);
    const fiche = characters.find((x) => x.id === cible?.templateId);
    if (!cible || !fiche) {
      setCombat((x) => (x ? { ...x, log: [...x.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: x.manche, message: "Resynchronisation impossible : pas de fiche liée." }] } : x));
      return;
    }
    appliquerFiche(instanceId, cible.nom, fiche);
  };

  /** Équiper / déséquiper en combat (sortir du sac) : fiche + participant à jour aussitôt. */
  const toggleEquipe = (instanceId: string, itemId: string) => {
    const cible = combat?.participants.find((x) => x.instanceId === instanceId);
    const fiche = characters.find((x) => x.id === cible?.templateId);
    const entree = (fiche?.inventaire ?? []).find((x) => x.itemId === itemId);
    const item = catalogue.find((x) => x.id === itemId);
    if (!cible || !fiche || !entree || !item?.estArme) return;
    const updated: Character = { ...fiche, inventaire: (fiche.inventaire ?? []).map((x) => (x.itemId === itemId ? { ...x, equipe: !x.equipe } : x)) };
    setCharacters((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    appliquerFiche(instanceId, cible.nom, updated);
    setCombat((x) => (x ? { ...x, log: [...x.log, { id: `eq-${Date.now()}`, at: new Date().toISOString(), manche: x.manche, message: `${cible.nom} ${entree.equipe ? "rengaine" : "sort"} ${item.nom} (${entree.equipe ? "déséquipée" : "équipée"}).` }] } : x));
  };
  const selectedParticipant = combat?.participants.find((p) => p.instanceId === attackerId) ?? null;

  /** Re-cible si l'ancienne cible est devenue invalide (ex. l'attaquant lui-même) : priorité aux ennemis. */
  const recibrerCible = (c: CombatState, attacker: string | null, prev: string | null): string | null => {
    const opts = c.participants.filter((p) => p.statut === "actif" && p.instanceId !== attacker);
    if (prev && opts.some((p) => p.instanceId === prev)) return prev;
    const atk = c.participants.find((p) => p.instanceId === attacker);
    const foes = opts.filter((p) => p.camp !== atk?.camp);
    return (foes[0] ?? opts[0])?.instanceId ?? null;
  };

  const opponentsOf = useMemo(() => {
    if (!combat || !attackerId) return [];
    const atk = combat.participants.find((p) => p.instanceId === attackerId);
    return combat.participants.filter((p) => p.statut === "actif" && p.instanceId !== attackerId && p.camp !== atk?.camp);
  }, [combat, attackerId]);

  if (!combat) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Combat — préparation</h1>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <h2 className="font-bold text-sm uppercase text-zinc-400">Personnages</h2>
            {characters.map((c) => (
              <div key={c.id} className="flex justify-between items-center text-sm py-1 border-b border-zinc-800/50">
                <span>{c.nom} <span className="text-zinc-500">({c.pv}/{c.pvMax})</span></span>
                <button onClick={() => addPJ(c)} className="px-2.5 py-1 rounded bg-blue-900 text-xs hover:bg-blue-800">+ Ajouter</button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <h2 className="font-bold text-sm uppercase text-zinc-400">Monstres (quantité puis ajouter)</h2>
            {monsters.map((m) => (
              <div key={m.id} className="flex justify-between items-center text-sm py-1 border-b border-zinc-800/50 gap-2">
                <span className="flex-1">{m.nom} <span className="text-zinc-500">({m.pv} PV)</span></span>
                <input
                  type="number" min={1} max={12} value={quantities[m.id] ?? 1}
                  onChange={(e) => setQuantities((q) => ({ ...q, [m.id]: Number(e.target.value) }))}
                  className="w-14 bg-zinc-800 rounded px-1.5 py-1 text-center"
                />
                <button onClick={() => addMonsters(m)} className="px-2.5 py-1 rounded bg-red-900 text-xs hover:bg-red-800">+ Ajouter</button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-bold text-sm uppercase text-zinc-400 mb-2">Rencontre ({staging.length})</h2>
          {staging.length === 0 && <p className="text-sm text-zinc-500">Ajoutez PJ + monstres. Ex : 4 PJ + Gobelin ×4.</p>}
          <div className="flex flex-wrap gap-2">
            {staging.map((p) => {
              const nbSorts = p.attaques.filter((a) => a.id.startsWith("sort:")).length;
              return (
                <span key={p.instanceId} className="text-xs px-2 py-1 rounded bg-zinc-800" title={`${p.attaques.length} attaque(s) (${p.attaques.map((a) => a.nom).join(", ") || "aucune"}) dont ${nbSorts} sort(s)}`}>
                  {p.templateId.startsWith("compagnon:loup") ? "🐺 " : ""}{p.nom} <span className="text-zinc-500">⚔{p.attaques.length}{nbSorts > 0 ? ` ✦${nbSorts}` : ""}</span> <button onClick={() => setStaging((s) => s.filter((x) => x.instanceId !== p.instanceId && x.instanceId !== `compagnon-${p.instanceId}`))} className="text-red-400 ml-1">✕</button>
                </span>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={resyncStaging} title="Reconstruit chaque PJ depuis sa fiche (attaques, sorts, talents, loup)" className="px-4 py-2 rounded bg-zinc-800 text-sm">↻ Actualiser</button>
            <button onClick={() => setStaging([])} className="px-4 py-2 rounded bg-zinc-800 text-sm">Vider</button>
            <button onClick={start} disabled={staging.length < 2} className="flex-1 py-2.5 rounded bg-amber-400 text-black font-bold disabled:opacity-40">
              Lancer les initiatives ({staging.length})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-4 text-center font-bold text-lg border ${combat.termine ? "bg-green-900/40 border-green-700" : "bg-amber-400 text-black"}`}>
        {combat.termine
          ? `COMBAT TERMINÉ — ${combat.gagnant === "pj" ? "victoire des PJ" : combat.gagnant === "monstre" ? "victoire des monstres" : "égalité"}`
          : `TOUR : ${active?.nom?.toUpperCase() ?? "—"} — manche ${combat.manche}`}
      </div>

      {active && !combat.termine && (
        <div className="rounded-lg border border-amber-400/50 bg-zinc-900 p-3 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center">
          <span className="font-bold text-amber-300">{active.nom}</span>
          <span className="font-mono">{active.pv}/{active.pvMax} PV · Déf {active.defense}</span>
          <span className="text-zinc-400">{active.attaques.map((a) => `${a.nom} +${a.bonus} (${a.degats})`).join(" · ")}</span>
          {active.effets.length > 0 && (
            <span className="text-violet-300">✦ {active.effets.map((e) => `${e.nom} (${e.toursRestants ?? "∞"})`).join(", ")}</span>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCombat((c) => (c ? prevTurn(c) : c))} className="flex-1 min-w-28 py-2.5 rounded bg-zinc-800 font-semibold hover:bg-zinc-700">◀ Précédent</button>
        <button
          onClick={() => setCombat((c) => {
            if (!c) return c;
            const n = nextTurn(c);
            const suivant = n.participants[n.tourIndex]?.instanceId ?? null;
            setAttackerId(suivant);
            setTargetId(recibrerCible(n, suivant, targetId));
            return n;
          })}
          className="flex-[2] min-w-40 py-2.5 rounded bg-amber-400 text-black font-bold hover:bg-amber-300"
        >
          Tour suivant ▶
        </button>
        <button
          onClick={() => setCombat((c) => (c ? { ...c, termine: true, log: [...c.log, { id: `end-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message: "Combat terminé manuellement par le MJ." }] } : c))}
          className="flex-1 min-w-28 py-2.5 rounded bg-zinc-800 font-semibold hover:bg-zinc-700"
        >
          Terminer
        </button>
        <button onClick={() => { setCombat(null); setStaging([]); setLast(null); setLastAttaque(null); }} className="px-4 py-2.5 rounded bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          Nouvelle rencontre
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          <CombatTable
            combat={combat}
            attackerId={attackerId}
            syncIds={syncIds}
            onSync={syncDepuisFiche}
            onSelectAttacker={(id) => {
              setAttackerId(id);
              setAttackId(null);
              const others = combat.participants.filter((p) => p.instanceId !== id && p.statut === "actif");
              const atk = combat.participants.find((p) => p.instanceId === id);
              const foes = others.filter((p) => p.camp !== atk?.camp);
              setTargetId((foes[0] ?? others[0])?.instanceId ?? null);
            }}
            onHit={(id, n) => setCombat((c) => (c ? applyDamage(c, id, n) : c))}
            onHeal={(id, n) => setCombat((c) => (c ? applyHeal(c, id, n) : c))}
          />
          <CombatLog log={combat.log} />
        </div>
        <div className="space-y-3">
          <AttackPanel
            participants={combat.participants}
            attackerId={attackerId}
            attackId={attackId ?? combat.participants.find((p) => p.instanceId === attackerId)?.attaques[0]?.id ?? null}
            targetId={targetId}
            last={last}
            onAttacker={(id) => {
              setAttackerId(id);
              setAttackId(null);
              if (combat) setTargetId(recibrerCible(combat, id, targetId));
            }}
            onAttack={(id) => setAttackId(id)}
            onTarget={(id) => setTargetId(id)}
            onRoll={rollAttack}
            onChance={useChance}
          />
          <EquipementPanel
            participants={combat.participants}
            lanceurId={attackerId}
            characters={characters}
            catalogue={catalogue}
            onToggle={toggleEquipe}
          />
          <SoutienPanel
            participants={combat.participants}
            lanceurId={attackerId}
            onCast={(lanceurId, cibleId, sort) => {
              try {
                // Frappe de zone (Armée des morts) : tous les ennemis.
                const { state } = sort.zone
                  ? frapperZone(combat, lanceurId, sort)
                  : castSoutien(combat, lanceurId, cibleId, sort);
                setCombat(state);
                setLast(null);
              } catch (e) {
                const message = e instanceof Error ? e.message : "Sort impossible.";
                setCombat((c) =>
                  c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
                );
              }
            }}
          />
          <CapacitesPanel
            participants={combat.participants}
            lanceurId={attackerId}
            onUtiliser={(lanceurId, cibleId, talentNom, opts) => {
              try {
                const { state } = opts.actionSpeciale === "renvoi"
                  ? renvoyerSort(combat, lanceurId, cibleId)
                  : utiliserCapacite(combat, lanceurId, cibleId, talentNom, {
                      effetCle: opts.effetCle,
                      dureeTours: opts.dureeTours,
                      mods: opts.mods,
                      coutPV: opts.coutPV,
                      soin: opts.soin,
                      nettoie: opts.nettoie,
                    });
                setCombat(state);
                setLast(null);
              } catch (e) {
                const message = e instanceof Error ? e.message : "Capacité impossible.";
                setCombat((c) =>
                  c ? { ...c, log: [...c.log, { id: `err-${Date.now()}`, at: new Date().toISOString(), manche: c.manche, message }] } : c
                );
              }
            }}
          />
          <EffectsPanel
            participant={selectedParticipant}
            onAdd={(key, duree) =>
              setCombat((c) => (c && attackerId ? addParticipantEffect(c, attackerId, createEffect(key, { dureeTours: duree })) : c))
            }
            onRemove={(effetId) =>
              setCombat((c) => (c && attackerId ? removeParticipantEffect(c, attackerId, effetId) : c))
            }
          />
          {opponentsOf.length > 0 && attackerId && (
            <div className="text-xs text-zinc-500">Cibles suggérées : {opponentsOf.map((p) => p.nom).join(", ")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
