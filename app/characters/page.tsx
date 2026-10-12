"use client";
import { useMemo, useState } from "react";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { useCharacters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { exportJson } from "@/src/lib/store/repository";
import { pvTexteColor } from "@/src/lib/ui/pv";
import type { Character } from "@/src/lib/rules/types";
import { EquipagePanel } from "@/src/components/characters/EquipagePanel";
import { BoursePanel } from "@/src/components/characters/BoursePanel";
import { HorsCombatPanel } from "@/src/components/combat/HorsCombatPanel";
import {
  FAMILLES,
  PROFILS_PAR_FAMILLE,
  changerFamille,
  deriverPersonnage,
  depenserDeRecuperation,
  depenserDeRecuperationMax,
  recuperationComplete,
  descendreNiveau,
  drInitial,
  monterNiveau,
  normaliserPersonnage,
  recalculerPersonnage,
  remettreAZeroPersonnage,
  verifierPersonnage,
} from "@/src/lib/rules/personnage";
import { estEffective, etatCreation } from "@/src/lib/rules/creation";
import { validerEquipement } from "@/src/lib/rules/equipement";
import { verifierArmurePortee } from "@/src/lib/rules/limitesArmures";
import {
  VOIE_MAGE,
  adopterVoieMage,
  traitsInitiaux,
  voiePeupleDe,
} from "@/src/lib/data/peuples";

const CARACS = ["AGI", "CON", "FOR", "PER", "CHA", "INT", "VOL"] as const;
const PEUPLES = ["Humain", "Demi-Elfe", "Elfe haut", "Nain"];

export default function CharactersPage() {
  const { items: raw, setItems } = useCharacters();
  const { catalogue: stock } = useCatalogueObjets();
  const [editing, setEditing] = useState<Character | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drMessage, setDrMessage] = useState<Record<string, string>>({});

  // Normalise les vieilles sauvegardes v2 (stats -> caracteristiques) pour l'affichage.
  const items = useMemo(() => raw.map((c) => normaliserPersonnage(c as unknown as Record<string, unknown>)), [raw]);

  const patch = (id: string, fn: (c: Character) => Character) =>
    setItems((prev) => prev.map((c) => (c.id === id ? fn(normaliserPersonnage(c as unknown as Record<string, unknown>)) : c)));

  const damage = (id: string, n: number) =>
    patch(id, (c) => ({ ...c, pv: Math.max(0, c.pv - n) }));
  const heal = (id: string, n: number) =>
    patch(id, (c) => ({ ...c, pv: Math.min(c.pvMax, c.pv + n) }));
  const niveauPlus = (id: string) => patch(id, (c) => monterNiveau(c));
  const niveauMoins = (id: string) => patch(id, (c) => descendreNiveau(c));

  const depenserChance = (id: string) =>
    patch(id, (c) => {
      const cur = c.ressources?.chance;
      if (!cur || cur.actuel <= 0) return c;
      return { ...c, ressources: { ...c.ressources, chance: { ...cur, actuel: cur.actuel - 1 } } };
    });
  const rendreChance = (id: string) =>
    patch(id, (c) => {
      const cur = c.ressources?.chance;
      if (!cur) return c;
      return { ...c, ressources: { ...c.ressources, chance: { ...cur, actuel: Math.min(cur.max, cur.actuel + 1) } } };
    });
  const depenserMana = (id: string) =>
    patch(id, (c) => {
      const cur = c.ressources?.mana;
      if (!cur || cur.actuel <= 0) return c;
      return { ...c, ressources: { ...c.ressources, mana: { ...cur, actuel: cur.actuel - 1 } } };
    });
  const rendreMana = (id: string) =>
    patch(id, (c) => {
      const cur = c.ressources?.mana;
      if (!cur) return c;
      return { ...c, ressources: { ...c.ressources, mana: { ...cur, actuel: Math.min(cur.max, cur.actuel + 1) } } };
    });
  /** Dépense 1 DR : soin = dé (d6/d8/d10) + moitié du niveau, PV plafonnés. */
  const soignerDR = (id: string) => {
    const cible = items.find((x) => x.id === id);
    if (!cible) return;
    try {
      const { personnage, resolution } = depenserDeRecuperation(cible);
      patch(id, () => personnage);
      const bonus = resolution.bonusNiveau > 0 ? `+${resolution.bonusNiveau}` : "";
      setDrMessage((m) => ({
        ...m,
        [id]: `+${resolution.soinTotal} PV (${cible.desRecuperation?.type ?? "d?"}${bonus} [${resolution.details.join(", ")}]) : ${resolution.pvAvant} → ${resolution.pvApres}`,
      }));
    } catch (e) {
      setDrMessage((m) => ({ ...m, [id]: e instanceof Error ? e.message : "Récupération impossible." }));
    }
  };
  /** Ajustement manuel de la réserve DR (MJ : repos, malus…), sans soin. */
  const ajusterDR = (id: string, d: number) =>
    patch(id, (c) => {
      const dr = c.desRecuperation;
      if (!dr) return c;
      return { ...c, desRecuperation: { ...dr, actuel: Math.max(0, Math.min(dr.max, dr.actuel + d)) } };
    });
  /**
   * Récupération complète : +1 DR (plafond max) + mana à fond, puis proposition
   * de dépenser aussitôt 1 DR en valeur max (+ ½ niveau, sans lancer le dé).
   */
  const recuperationCompleteUi = (id: string) => {
    const cible = items.find((x) => x.id === id);
    if (!cible) return;
    let restaure: Character;
    try {
      const r = recuperationComplete(cible);
      restaure = r.personnage;
    } catch (e) {
      setDrMessage((m) => ({ ...m, [id]: e instanceof Error ? e.message : "Récupération impossible." }));
      return;
    }
    const dr = restaure.desRecuperation;
    const mana = restaure.ressources?.mana;
    patch(id, () => restaure);
    const base = `Récupération complète : DR ${cible.desRecuperation?.actuel ?? 0} → ${dr?.actuel ?? 0}, mana ${cible.ressources?.mana?.actuel ?? 0} → ${mana?.actuel ?? 0}`;
    const bonus = Math.floor(restaure.niveau / 2);
    if (
      restaure.pv < restaure.pvMax &&
      window.confirm(
        `${restaure.nom} : récupération complète (DR et mana restaurés). Dépenser aussitôt 1 DR pour +${parseInt(dr?.type.slice(1) ?? "0", 10)}${bonus > 0 ? `+${bonus}` : ""} PV (valeur max, sans lancer le dé) ?`
      )
    ) {
      try {
        const { personnage, resolution } = depenserDeRecuperationMax(restaure);
        patch(id, () => personnage);
        const b = resolution.bonusNiveau > 0 ? `+${resolution.bonusNiveau}` : "";
        setDrMessage((m) => ({
          ...m,
          [id]: `${base}, puis +${resolution.soinTotal} PV (${dr?.type} max [${resolution.details.join(", ")}]${b}) : ${resolution.pvAvant} → ${resolution.pvApres}`,
        }));
      } catch (e) {
        setDrMessage((m) => ({
          ...m,
          [id]: `${base} (dé gardé pour plus tard).${e instanceof Error ? ` ${e.message}` : ""}`,
        }));
      }
    } else {
      setDrMessage((m) => ({ ...m, [id]: `${base} (dés gardés pour plus tard).` }));
    }
  };

  const recalculer = (id: string) => patch(id, (c) => recalculerPersonnage(c, stock));
  const toutRecalculer = () => setItems((prev) => prev.map((c) => recalculerPersonnage(normaliserPersonnage(c as unknown as Record<string, unknown>), stock)));
  const remettreAZero = (id: string, nom: string) => {
    if (!window.confirm(`Remettre ${nom} à zéro (retour création : niveau 1, talents/sorts vidés, traits du peuple réinitialisés, inventaire de base restauré, PV/chance/mana au max) ?`)) return;
    const base = SEED_CHARACTERS.find((s) => s.id === id)?.inventaire ?? [];
    patch(id, (c) => remettreAZeroPersonnage(c, base));
  };
  const toutRemettreAZero = () => {
    if (!window.confirm("Remettre tous les personnages à zéro (retour création : niveau 1, talents/sorts vidés, inventaires de base restaurés) ?")) return;
    setItems((prev) => prev.map((c) => {
      const n = normaliserPersonnage(c as unknown as Record<string, unknown>);
      const base = SEED_CHARACTERS.find((s) => s.id === n.id)?.inventaire ?? [];
      return remettreAZeroPersonnage(n, base);
    }));
  };
  const reset = () => setItems(SEED_CHARACTERS);

  /** Changement de peuple : les traits de l'ancien peuple ne suivent pas (état canonique du nouveau). */
  const changePeuple = (peuple: string) => {
    setEditing((e) => (e ? { ...e, peuple, traitsPeuple: e.voieMage ? adopterVoieMage(peuple) : traitsInitiaux(peuple) } : e));
  };

  /** Changement de famille : les sorts/talents des voies ne suivent pas (vidés),
   * le profil est ramené sur la nouvelle famille (choix impossibles interdits).
   * Quitter Mage retire aussi la Voie du mage. */
  const changeFamille = (famille: Character["famille"]) => {
    if (!editing || editing.famille === famille) return;
    const nbVoies = (editing.capacites ?? []).length + (editing.sorts ?? []).length;
    if (nbVoies > 0 && !window.confirm(
      `Changer de famille (${editing.famille} → ${famille}) effacera ${nbVoies} sort(s)/talent(s) des voies. Continuer ?`
    )) return;
    setEditing(changerFamille(editing, famille));
  };

  /** Adoption de la Voie du mage (famille Mage, avant le rang 2 de peuple) : garde le rang 1 du peuple. */
  const toggleVoieMage = () => {
    setEditing((e) => {
      if (!e) return e;
      if (e.voieMage) return { ...e, voieMage: undefined, traitsPeuple: traitsInitiaux(e.peuple) };
      return { ...e, voieMage: true, traitsPeuple: adopterVoieMage(e.peuple) };
    });
  };

  const toggleTrait = (nom: string) => {
    setEditing((e) => {
      if (!e) return e;
      const cur = e.traitsPeuple ?? [];
      return { ...e, traitsPeuple: cur.includes(nom) ? cur.filter((t) => t !== nom) : [...cur, nom] };
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const norm = normaliserPersonnage(editing as unknown as Record<string, unknown>);
    // Garde classe synchronisée avec le profil (compat combat / anciens exports).
    norm.classe = norm.profil || norm.classe;
    setItems((prev) => prev.map((c) => (c.id === norm.id ? norm : c)));
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Personnages ({items.length})</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={toutRecalculer} title="INIT=10+PER · DEF=10+AGI+Équip+Mod · PV=base+CON · Chance=2+CHA(+1 Aventurier) · DR=2+CON(+1 Mystique) · Mana=VOL+sorts" className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-semibold hover:bg-amber-300">↻ Recalculer</button>
          <button onClick={toutRemettreAZero} title="Retour création : niveau 1, talents/sorts vidés, traits et inventaires de base restaurés, PV/chance/mana au max" className="px-3 py-1.5 rounded bg-green-800 text-sm font-semibold hover:bg-green-700">✦ Remise à zéro</button>
          <button onClick={() => exportJson("personnages.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={reset} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Réinitialiser</button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        COF Fantasy : INIT 10+PER · DEF 10+AGI+Équip+Mod · Vigueur Combattant 10+CON / Aventurier 8+CON / Mystique 8+CON / Mage 6+CON ·
        Chance 2+CHA (3+CHA Aventurier) · DR d10 Combattant / d8 Aventurier / d8+1 Mystique / d6 Mage, nombre 2+CON (+1 Mystique) ·
        Contact niv+FOR / Distance niv+AGI / Magique niv+VOL · Mana VOL+sorts · Idéal/travers narratifs.
        Création niv. 1 : 2 pts → 2 capacités de rang 1 du profil + rang 1 de peuple gratuit (+ rang 2 gratuit : les 4 Mages).
        Progression : 2 pts/niveau, R1-2 = 1 pt, R3-5 = 2 pts, rangs précédents requis, niveau ≥ rang, désapprentissage du haut vers le bas.
        Niveau : PV +gain+CON (rétroactif), attaques +1 (max niv. 10), +2 pts à dépenser, mana via nouveaux sorts, dé évolutif d4→d6 (6)→d8 (9)→…
      </p>

      <HorsCombatPanel characters={items} onUpdate={(next) => setItems(next)} />

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c) => {
          const d = deriverPersonnage(c, stock);
          const ecarts = verifierPersonnage(c, stock);
          const mana = c.ressources?.mana ?? { max: d.manaMax, actuel: d.manaMax };
          const chance = c.ressources?.chance ?? { max: d.chanceMax, actuel: d.chanceMax };
          const dr = c.desRecuperation ?? { type: d.drType, max: d.drNombre, actuel: drInitial(c.caracteristiques.CON, c.profil || c.classe, d.famille) };
          return (
            <div key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-lg">{c.nom} {c.exemple && <span className="text-xs text-amber-400 font-normal">· exemple</span>}</div>
                  <div className="text-sm text-zinc-400">{c.peuple} · {d.famille} · {c.profil || c.classe} · Niv. {c.niveau}{c.voieMage ? " · Voie du mage" : ""}</div>
                  {(c.idealHeroique || c.travers) && (
                    <div className="text-xs text-zinc-500 italic">Idéal : {c.idealHeroique ?? "—"} · Travers : {c.travers ?? "—"} (narratif)</div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => remettreAZero(c.id, c.nom)} title="Remise à zéro : niveau 1, talents/sorts vidés, traits et inventaire de base restaurés" className="text-sm px-2.5 py-1 rounded bg-green-900 hover:bg-green-800">✦</button>
                  <button onClick={() => recalculer(c.id)} title="Resynchroniser PV/DEF/Init/Chance/DR/Mana depuis les formules" className="text-sm px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">↻</button>
                  <button onClick={() => setEditing({ ...c })} className="text-sm px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Éditer</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                {CARACS.map((k) => (
                  <span key={k} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800">{k} <b>{c.caracteristiques[k] >= 0 ? `+${c.caracteristiques[k]}` : c.caracteristiques[k]}</b></span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Initiative</div>
                  <div className="font-bold font-mono text-base">{d.initiative}</div>
                  <div className="text-[11px] text-zinc-500">10+PER</div>
                </div>
                <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
                  <div className="text-[11px] uppercase text-zinc-500">🛡️ Défense</div>
                  <div className="font-bold font-mono text-base">{c.defense}</div>
                  <div className="text-[11px] text-zinc-500">10+AGI+Éq+Mod</div>
                </div>
                <div className={`rounded bg-zinc-950 border border-zinc-800 p-2 font-bold font-mono text-base ${pvTexteColor(c.pv, c.pvMax)}`}>
                  <div className="text-[11px] uppercase text-zinc-500 font-sans font-normal">❤️ Vigueur</div>
                  {c.pv}/{c.pvMax}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
                  <div className="text-[11px] uppercase text-zinc-500" title="Ajustement manuel de la réserve (gain/perte, sans utilisation en test)">Chance {chance.actuel}/{chance.max}</div>
                  <div className="flex gap-1 justify-center mt-1">
                    <button onClick={() => depenserChance(c.id)} className="px-2 py-0.5 rounded bg-zinc-800 text-xs">−1</button>
                    <button onClick={() => rendreChance(c.id)} className="px-2 py-0.5 rounded bg-zinc-800 text-xs">+1</button>
                  </div>
                </div>
                <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
                  <div className="text-[11px] uppercase text-zinc-500" title="Réserve de dés de récupération (repos, MJ). Le soin se fait via le bouton +PV (DR) plus bas.">
                    Récup {dr.type} {dr.actuel}/{dr.max}
                  </div>
                  <div className="flex gap-1 justify-center mt-1">
                    <button onClick={() => ajusterDR(c.id, -1)} title="Perdre 1 DR (manuel, sans soin)" className="px-2 py-0.5 rounded bg-zinc-800 text-xs">−1</button>
                    <button onClick={() => ajusterDR(c.id, 1)} title="Gagner 1 DR (repos, manuel)" className="px-2 py-0.5 rounded bg-zinc-800 text-xs">+1</button>
                  </div>
                </div>
                <div className="rounded bg-zinc-950 border border-zinc-800 p-2">
                  <div className="text-[11px] uppercase text-zinc-500">Mana {mana.actuel}/{mana.max}</div>
                  <div className="flex gap-1 justify-center mt-1">
                    <button onClick={() => depenserMana(c.id)} className="px-2 py-0.5 rounded bg-zinc-800 text-xs">−1</button>
                    <button onClick={() => rendreMana(c.id)} className="px-2 py-0.5 rounded bg-zinc-800 text-xs">+1</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 text-xs font-mono">
                <span className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-center">CONTACT <b>{d.attaques.contact >= 0 ? `+${d.attaques.contact}` : d.attaques.contact}</b> <span className="text-zinc-500">niv+FOR</span></span>
                <span className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-center">DISTANCE <b>{d.attaques.distance >= 0 ? `+${d.attaques.distance}` : d.attaques.distance}</b> <span className="text-zinc-500">niv+AGI</span></span>
                <span className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-center">MAGIQUE <b>{d.attaques.magique >= 0 ? `+${d.attaques.magique}` : d.attaques.magique}</b> <span className="text-zinc-500">niv+VOL</span></span>
                <span className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-center" title="Dé évolutif : d4 (1-5), d6 (6-8), d8 (9-11), d10 (12-14), d12 (15+)">DÉ ÉVOL. <b>d{d.de}</b></span>
              </div>

              <BoursePanel bourse={c.bourse} onChange={(bourse) => patch(c.id, (ch) => ({ ...ch, bourse }))} />

              {ecarts.length > 0 && (
                <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded px-2.5 py-1.5">
                  ⚠ Écarts aux formules : {ecarts.join(" · ")} <button onClick={() => recalculer(c.id)} className="underline ml-1">Recalculer</button>
                </div>
              )}

              {(() => {
                const crea = c.niveau === 1 ? etatCreation(c) : null;
                if (!crea) return null;
                const ok = crea.alertes.length === 0;
                return (
                  <div className={`text-xs rounded px-2.5 py-1.5 border ${ok ? "text-green-300/90 bg-green-950/30 border-green-800/40" : "text-amber-300/90 bg-amber-950/30 border-amber-800/40"}`}>
                    <div>
                      ● Création : {crea.depense}/{crea.points} pts{crea.restants > 0 ? ` (${crea.restants} restant${crea.restants > 1 ? "s" : ""})` : ""} · Peuple {crea.peupleOk ? "✓" : `✗ "${crea.peupleAttendue}" manquant`}
                      {crea.rang2Nom ? ` · R2 gratuit : ${crea.rang2Nom} ✓` : ""}
                    </div>
                    {crea.alertes.map((a) => (
                      <div key={a}>⚠ {a}</div>
                    ))}
                  </div>
                );
              })()}

              <div className="text-xs text-zinc-400">
                {(c.traitsPeuple ?? []).length > 0 && <div>◈ Peuple : {(c.traitsPeuple ?? []).join(", ")}</div>}
                {c.capacites.length > 0 && (
                  <div>
                    ✦{" "}
                    {c.capacites.map((t, i) => {
                      const e = estEffective(c, t);
                      return (
                        <span key={`${t}-${i}`}>
                          {i > 0 && " · "}
                          {e.effectif ? (
                            t
                          ) : (
                            <span title={`${t} : ${e.raison} — non effectif`} className="line-through opacity-50">
                              🔒 {t}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                {c.attaques.length > 0 && <div>{c.attaques.map((a) => `⚔ ${a.nom} +${a.bonus} · ${a.degats}`).join(" · ")}</div>}
                <div className="text-zinc-500 pt-0.5">🎒 {(c.inventaire ?? []).length} objet(s) · ✦ {(c.sorts ?? []).length} sort(s){c.armure?.nom ? ` · 🛡 ${c.armure.nom}${c.armure.def ? ` (+${c.armure.def})` : ""}` : ""}</div>
                {(() => {
                  const v = validerEquipement(c.inventaire ?? [], stock);
                  const port = verifierArmurePortee(c, stock);
                  if (v.ok && port.length === 0) return null;
                  return <div className="text-xs text-amber-300/90 pt-0.5">⚠ Équipement : {[...(v.ok ? [] : v.raisons), ...port].join(" · ")} (ouvrir Inventaire pour corriger)</div>;
                })()}
              </div>

              <button
                onClick={() => setOpenId(openId === c.id ? null : c.id)}
                className="w-full text-left text-sm px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300"
              >
                {openId === c.id ? "▾ Masquer inventaire & sorts" : "▸ Inventaire & sorts"}
              </button>
              {openId === c.id && (
                <EquipagePanel
                  character={c}
                  stock={stock}
                  onUpdate={(updated) => setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                />
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => damage(c.id, 1)} className="flex-1 py-2 rounded bg-red-900 hover:bg-red-800 font-bold">−1 PV</button>
                <button onClick={() => heal(c.id, 1)} className="flex-1 py-2 rounded bg-green-900 hover:bg-green-800 font-bold">+1 PV</button>
              </div>
              <div>
                <div className="flex gap-2">
                  <button
                    onClick={() => soignerDR(c.id)}
                    disabled={dr.actuel <= 0 || c.pv >= c.pvMax}
                    title={dr.actuel <= 0 ? "Plus de dé de récupération (repos : +1 dans le bloc Récup)" : c.pv >= c.pvMax ? "Vigueur au maximum" : `Dépenser 1 DR : soin ${dr.type}${Math.floor(c.niveau / 2) > 0 ? `+${Math.floor(c.niveau / 2)}` : ""} PV (dé lancé)`}
                    className="flex-1 py-2 rounded bg-green-900 hover:bg-green-800 text-sm font-bold disabled:opacity-40"
                  >
                    🎲 Récupération rapide (+PV)
                  </button>
                  <button
                    onClick={() => recuperationCompleteUi(c.id)}
                    disabled={(dr.actuel >= dr.max) && (mana.actuel >= mana.max)}
                    title={(dr.actuel >= dr.max) && (mana.actuel >= mana.max) ? "DR et mana au maximum" : "Récupération complète : +1 DR et mana à fond, avec proposition de dépenser aussitôt 1 DR en valeur max"}
                    className="flex-1 py-2 rounded bg-teal-900 hover:bg-teal-800 text-sm font-bold disabled:opacity-40"
                  >
                    🛌 Récupération complète (+1 DR, mana full)
                  </button>
                </div>
                {drMessage[c.id] && <div className="text-xs text-green-300/90 mt-1">{drMessage[c.id]}</div>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => niveauMoins(c.id)} disabled={c.niveau <= 1}
                  title="Perdre un niveau (erreur) : PV recalculés, alertes éventuelles à corriger"
                  className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold disabled:opacity-40"
                >
                  −1 Niveau
                </button>
                <button
                  onClick={() => niveauPlus(c.id)}
                  title="Gagner un niveau : PV +gain+CON, attaques +1 (max niv. 10), +2 pts de capacité à dépenser, dé évolutif"
                  className="flex-1 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold"
                >
                  +1 Niveau (niv. {c.niveau})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold">Éditer {editing.nom}</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block text-sm">Nom<input value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="block text-sm">Niveau<input type="number" min={1} value={editing.niveau} onChange={(e) => setEditing({ ...editing, niveau: Math.max(1, Number(e.target.value)) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="block text-sm">Peuple
                <select value={editing.peuple} onChange={(e) => changePeuple(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  {PEUPLES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block text-sm">Famille
                <select value={editing.famille} onChange={(e) => changeFamille(e.target.value as Character["famille"])} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  {FAMILLES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block text-sm">Profil (classe de la famille)
                <select value={editing.profil || editing.classe} onChange={(e) => setEditing({ ...editing, profil: e.target.value, classe: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  {(PROFILS_PAR_FAMILLE[editing.famille] ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block text-sm">Armure (nom)<input value={editing.armure?.nom ?? ""} onChange={(e) => setEditing({ ...editing, armure: { ...(editing.armure ?? {}), nom: e.target.value } })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="block text-sm">Idéal héroïque (narratif)<input value={editing.idealHeroique ?? ""} onChange={(e) => setEditing({ ...editing, idealHeroique: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="block text-sm">Travers (narratif)<input value={editing.travers ?? ""} onChange={(e) => setEditing({ ...editing, travers: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">Caractéristiques</div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {CARACS.map((k) => (
                  <label key={k} className="text-sm text-center">{k}
                    <input type="number" value={editing.caracteristiques[k]} onChange={(e) => setEditing({ ...editing, caracteristiques: { ...editing.caracteristiques, [k]: Number(e.target.value) } })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 text-center font-mono" />
                  </label>
                ))}
              </div>
              {editing && (
                <div className="text-xs text-zinc-400 mt-1 font-mono">
                  INIT {deriverPersonnage(editing, stock).initiative} · DEF {deriverPersonnage(editing, stock).defense} ·
                  PV {deriverPersonnage(editing, stock).pvMax} · Chance {deriverPersonnage(editing, stock).chanceMax} ·
                  DR {deriverPersonnage(editing, stock).drType}×{deriverPersonnage(editing, stock).drNombre} · Mana {deriverPersonnage(editing, stock).manaMax} ·
                  C {deriverPersonnage(editing, stock).attaques.contact >= 0 ? "+" : ""}{deriverPersonnage(editing, stock).attaques.contact} /
                  D {deriverPersonnage(editing, stock).attaques.distance >= 0 ? "+" : ""}{deriverPersonnage(editing, stock).attaques.distance} /
                  M {deriverPersonnage(editing, stock).attaques.magique >= 0 ? "+" : ""}{deriverPersonnage(editing, stock).attaques.magique}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm">PV<input type="number" value={editing.pv} onChange={(e) => setEditing({ ...editing, pv: Number(e.target.value) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="text-sm">Équip. DEF<input type="number" value={editing.defenseEquipement ?? editing.armure?.def ?? 0} onChange={(e) => setEditing({ ...editing, defenseEquipement: Number(e.target.value) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="text-sm">Mod. DEF<input type="number" value={editing.defenseMod ?? 0} onChange={(e) => setEditing({ ...editing, defenseMod: Number(e.target.value) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            {(() => {
              const voie = voiePeupleDe(editing.peuple);
              const montreMage = editing.famille === "Mage";
              return (
                <div className="rounded border border-zinc-800 p-2.5">
                  <div className="text-sm font-semibold mb-1.5">
                    Voie du peuple{voie ? ` — ${voie.voie}` : ""}
                  </div>
                  {voie ? (
                    <div className="space-y-1">
                      {voie.capacites.map((c) => {
                        const verrouille = !!editing.voieMage && c.rang > 1;
                        return (
                          <label key={c.nom} className={`flex items-start gap-2 text-sm ${verrouille ? "opacity-40" : ""}`}>
                            <input
                              type="checkbox" className="mt-1"
                              checked={(editing.traitsPeuple ?? []).includes(c.nom)}
                              disabled={verrouille}
                              title={verrouille ? "Bloqué : voie du peuple remplacée par la Voie du mage" : undefined}
                              onChange={() => toggleTrait(c.nom)}
                            />
                            <span><b>R{c.rang} · {c.nom}</b> — <span className="text-zinc-400">{c.resume}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Peuple inconnu : aucun trait proposé.</p>
                  )}
                  {montreMage && (
                    <div className="mt-2 border-t border-zinc-800 pt-2">
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={!!editing.voieMage} onChange={toggleVoieMage} />
                        <span>
                          <b>Adopter la {VOIE_MAGE.voie}</b>
                          <span className="text-zinc-400"> — remplace la voie du peuple (garde son rang 1, bloque ses rangs 2-5). Choix définitif, avant le rang 2. Débloque le R2 gratuit (voie du profil ou Maîtrise de la magie).</span>
                        </span>
                      </label>
                      {editing.voieMage && (
                        <div className="space-y-1 mt-1.5">
                          {VOIE_MAGE.capacites.map((c) => (
                            <label key={c.nom} className="flex items-start gap-2 text-sm">
                              <input
                                type="checkbox" className="mt-1"
                                checked={(editing.traitsPeuple ?? []).includes(c.nom)}
                                onChange={() => toggleTrait(c.nom)}
                              />
                              <span><b>R{c.rang} · {c.nom}</b> — <span className="text-zinc-400">{c.resume}</span></span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex gap-2 justify-between flex-wrap">
              <button
                onClick={() => setEditing((e) => (e ? recalculerPersonnage(e, stock) : e))}
                className="px-4 py-2 rounded bg-zinc-800 text-sm"
                title="Appliquer les formules COF aux champs stockés"
              >
                ↻ Appliquer formules
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
                <button onClick={saveEdit} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
