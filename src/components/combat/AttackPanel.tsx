"use client";
import { useState } from "react";
import type { AttackResolution, CombatParticipant } from "@/src/lib/rules/combat/types";
import { canAct, getModifier } from "@/src/lib/rules/effects/effects";
import { etatLimite, sortUtilisable, type AttaqueOpts } from "@/src/lib/rules/combat/attack";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";

/** Lettre d'action COF : Attaque (A) + Mouvement (M) par tour, ou Limitée (L). */
const LETTRE_ACTION: Record<string, string> = { attaque: "A", mouvement: "M", limitee: "L", gratuite: "G" };

interface Props {
  participants: CombatParticipant[];
  attackerId: string | null;
  attackId: string | null;
  targetId: string | null;
  last: AttackResolution | null;
  onAttacker: (id: string) => void;
  onAttack: (id: string) => void;
  onTarget: (id: string) => void;
  onRoll: (opts?: AttaqueOpts) => void;
  onChance: () => void;
}

export function AttackPanel({ participants, attackerId, attackId, targetId, last, onAttacker, onAttack, onTarget, onRoll, onChance }: Props) {
  const attacker = participants.find((p) => p.instanceId === attackerId) ?? null;
  const vivants = participants.filter((p) => p.statut === "actif");
  const bloque = attacker !== null && !canAct(attacker.effets);
  const modAttaque = attacker ? getModifier(attacker.effets, "attaque") : 0;
  const [puissante, setPuissante] = useState(false);
  const [variante, setVariante] = useState<"A" | "L">("A");
  const [parfaite, setParfaite] = useState(false);
  const [mille, setMille] = useState(false);
  const [varianteMille, setVarianteMille] = useState<"A" | "L">("A");
  const [fleche, setFleche] = useState(false);
  const [modeFleche, setModeFleche] = useState<"dm" | "statut">("dm");
  const [statutFleche, setStatutFleche] = useState("aveugle");
  const [eclair, setEclair] = useState(false);
  const [mod, setMod] = useState("");
  const [dm, setDm] = useState("");
  const talents = new Set((attacker?.capacites ?? []).map(normaliserNomCapacite));
  const connaitPuissante = talents.has(normaliserNomCapacite("Attaque puissante"));
  const connaitParfaite = talents.has(normaliserNomCapacite("Attaque parfaite"));
  const connaitMille = talents.has(normaliserNomCapacite("Dans le mille"));
  const connaitFleche = talents.has(normaliserNomCapacite("Flèche de mort"));
  const connaitEclair = talents.has(normaliserNomCapacite("Attaque éclair"));
  const STATUTS_FLECHE = [
    { cle: "aveugle", nom: "Aveuglé" },
    { cle: "Affaibli", nom: "Affaibli" },
    { cle: "Ralenti", nom: "Ralenti" },
    { cle: "immobilise", nom: "Immobilisé" },
  ];
  const lancer = () => {
    const opts: AttaqueOpts = {};
    const modN = Number(mod);
    if (mod.trim() !== "" && Number.isFinite(modN) && modN !== 0) opts.modAttaque = modN;
    const dmN = Number(dm);
    if (dm.trim() !== "" && Number.isFinite(dmN) && dmN !== 0) opts.bonusDM = dmN;
    if (puissante && connaitPuissante) {
      opts.deMalus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), variante === "L" ? "3d4°" : "2d4°"];
    }
    if (parfaite && connaitParfaite) {
      opts.deBonus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), "1d4°"];
    }
    if (mille && connaitMille) {
      opts.deMalus = true;
      opts.degatsBonus = [...(opts.degatsBonus ?? []), varianteMille === "L" ? "3d4°" : "2d4°"];
    }
    if (fleche && connaitFleche) {
      opts.deBonus = true;
      if (modeFleche === "dm") opts.degatsBonus = [...(opts.degatsBonus ?? []), "1d4°"];
      else opts.effetSupp = { cle: statutFleche, duree: 1 };
    }
    if (eclair && connaitEclair && attacker) {
      const agi = attacker.caracs?.AGI ?? 0;
      opts.bonusOverride = attacker.niveau + agi;
      const courante = attacker.attaques.find((x) => x.id === (attackId ?? attacker.attaques[0]?.id));
      const des = courante?.degats.match(/^(\d*d\d+°?)(.*)$/);
      if (courante && des) opts.degatsOverride = `${des[1]}+${agi}`;
    }
    onRoll(opts);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase text-zinc-400">Attaque</h2>
      <label className="block text-sm">Attaquant
        <select value={attackerId ?? ""} onChange={(e) => onAttacker(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {participants.map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} ({p.pv}/{p.pvMax})</option>
          ))}
        </select>
      </label>
      {attacker && (() => {
        const mana = attacker.ressources["mana"];
        const info = (id: string) => {
          const attaque = attacker.attaques.find((x) => x.id === id);
          const sort = id.startsWith("sort:") ? attacker.sorts.find((x) => `sort:${x.id}` === id) : undefined;
          const cout = sort?.cout?.montant ?? 0;
          const raisons: string[] = [];
          if ((mana?.actuel ?? 0) < cout) raisons.push("manque de mana");
          if (sort) {
            const u = sortUtilisable(attacker.niveau, sort);
            if (!u.ok && u.raison) raisons.push(u.raison);
            const lim = etatLimite(attacker, sort, targetId ?? undefined);
            if (!lim.ok && lim.raison) raisons.push(lim.raison);
          }
          return { cout, raisons, sort, attaque };
        };
        return (
          <label className="block text-sm">Arme / sort
            {mana && <span className="ml-2 font-mono text-xs text-violet-300">mana {mana.actuel}/{mana.max}</span>}
            <select value={attackId ?? attacker.attaques[0]?.id ?? ""} onChange={(e) => onAttack(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
              {attacker.attaques.map((a) => {
                const { cout, raisons, sort } = info(a.id);
                const jouable = raisons.length === 0;
                const lettre = LETTRE_ACTION[a.action ?? sort?.action ?? "attaque"] ?? "A";
                const tags = [
                  lettre,
                  a.degats === "1d1-1" ? "effet" : a.degats,
                  cout > 0 ? `${cout} PM` : "",
                  sort?.coutPV ? `${sort.coutPV} PV` : "",
                  a.volDeVie ? "vol" : "",
                  sort?.limiteCombat != null && !sort.limiteParCible ? `1×${sort.limiteCombat}/combat` : "",
                  sort?.limiteParCible ? "1/combat/cible" : "",
                  a.toucheAuto ? "auto" : "",
                ].filter(Boolean).join(" · ");
                return (
                  <option key={a.id} value={a.id} disabled={!jouable}>
                    {a.nom} +{a.bonus}{modAttaque !== 0 ? ` (${modAttaque > 0 ? "+" : ""}${modAttaque} effets)` : ""} · {tags}{jouable ? "" : ` (${raisons.join(", ")})`}
                  </option>
                );
              })}
            </select>
          </label>
        );
      })()}
      {attacker && attacker.attaques.length === 0 && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {attacker.nom} n'a aucune attaque : équipez une arme ci-dessous (Équipement du sac) ou sur sa fiche, puis ↻ sur sa ligne.
        </div>
      )}
      {bloque && (
        <div className="text-xs font-bold text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1.5">
          {attacker?.nom} ne peut pas agir (Étourdi/Immobilisé) — retirez l&apos;effet ou passez son tour.
        </div>
      )}
      <label className="block text-sm">Cible
        <select value={targetId ?? ""} onChange={(e) => onTarget(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
          {vivants.filter((p) => p.instanceId !== attackerId).map((p) => (
            <option key={p.instanceId} value={p.instanceId}>{p.nom} — Déf {p.defense} — {p.pv}/{p.pvMax} PV</option>
          ))}
        </select>
      </label>
      {(connaitPuissante || connaitParfaite || connaitMille || connaitFleche || connaitEclair) && (
        <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
          <div className="text-xs uppercase text-zinc-500 font-bold">Coup spécial</div>
          {connaitPuissante && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={puissante} onChange={(e) => setPuissante(e.target.checked)} />
              <span>Puissante (dé malus, +{variante === "L" ? "3d4°" : "2d4°"})</span>
              <select value={variante} onChange={(e) => setVariante(e.target.value as "A" | "L")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="A">A</option>
                <option value="L">L</option>
              </select>
            </label>
          )}
          {connaitParfaite && (
            <label className="flex items-center gap-2" title="Arme de prédilection requise (MJ)">
              <input type="checkbox" checked={parfaite} onChange={(e) => setParfaite(e.target.checked)} />
              <span>Parfaite (dé bonus, +1d4°)</span>
            </label>
          )}
          {connaitMille && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mille} onChange={(e) => setMille(e.target.checked)} />
              <span>Dans le mille (dé malus, +{varianteMille === "L" ? "3d4°" : "2d4°"})</span>
              <select value={varianteMille} onChange={(e) => setVarianteMille(e.target.value as "A" | "L")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="A">A</option>
                <option value="L">L</option>
              </select>
            </label>
          )}
          {connaitFleche && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2" title="NC inférieur au vôtre, 1/combat par état (MJ)">
                <input type="checkbox" checked={fleche} onChange={(e) => setFleche(e.target.checked)} />
                <span>Flèche de mort (dé bonus)</span>
              </label>
              <select value={modeFleche} onChange={(e) => setModeFleche(e.target.value as "dm" | "statut")} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                <option value="dm">+1d4°</option>
                <option value="statut">état 1 round</option>
              </select>
              {modeFleche === "statut" && (
                <select value={statutFleche} onChange={(e) => setStatutFleche(e.target.value)} className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs">
                  {STATUTS_FLECHE.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
                </select>
              )}
            </div>
          )}
          {connaitEclair && (
            <label className="flex items-center gap-2" title="Bonus et DM à l'AGI au lieu de la FOR (+10 m au rang 5, MJ)">
              <input type="checkbox" checked={eclair} onChange={(e) => setEclair(e.target.checked)} />
              <span>Attaque éclair (AGI)</span>
            </label>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Mod. attaque<input value={mod} onChange={(e) => setMod(e.target.value)} placeholder="+1 / −2" title="Prédilection +1, Double/Circulaire −2…" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
        <label className="block text-xs">Bonus DM<input value={dm} onChange={(e) => setDm(e.target.value)} placeholder="+1" title="Spécialisation +1…" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
      </div>
      <button onClick={lancer} disabled={!attackerId || !targetId || bloque} className="w-full py-2.5 rounded bg-red-600 hover:bg-red-500 font-bold disabled:opacity-40">
        Lancer l&apos;attaque
      </button>
      {last && (
        <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-0.5">
          <div className="font-semibold">{last.attaquantNom} → {last.cibleNom} ({last.attaqueNom})</div>
          {last.toucheAuto ? (
            <div className="font-mono">Automatique (sans jet)</div>
          ) : (
            <div className="font-mono">
              Jet : {last.jetNaturel}{last.jetSecondaire != null ? ` (dé ${last.desAvantage} : ${last.jetNaturel}, ${last.jetSecondaire})` : ""} + {last.jetTotal - last.jetNaturel} = {last.jetTotal}
            </div>
          )}
          <div>Défense : {last.defenseCible}</div>
          <div className={`font-bold ${last.touche ? "text-green-400" : "text-red-400"}`}>
            → {last.touche ? (last.critique ? "CRITIQUE" : "TOUCHÉ") : "MANQUÉ"}
          </div>
          {!last.touche && (() => {
            const lanceur = participants.find((p) => p.instanceId === last.attaquantId);
            const pc = lanceur?.ressources["chance"]?.actuel ?? 0;
            return (
              <button
                onClick={onChance}
                disabled={pc < 1 || bloque}
                title={pc < 1 ? "Plus de point de chance" : "Dépenser 1 PC : +10 au jet, même sur un 1 naturel"}
                className="w-full mt-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40"
              >
                🍀 Chance +10 ({pc} PC)
              </button>
            );
          })()}
          {last.touche && (
            <>
              <div>Dégâts : [{last.degatsDetails.join(", ")}] = {last.degatsTotal}</div>
              <div className="font-mono">{last.cibleNom} : {last.pvAvant} → {last.pvApres} PV</div>
              {last.cibleTombe && <div className="text-red-400 font-bold">{last.cibleNom} est hors combat</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
