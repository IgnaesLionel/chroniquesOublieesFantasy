"use client";
import { useEffect, useMemo, useState } from "react";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";
import { useCharacters } from "@/src/lib/store/collections";
import { useCatalogueObjets } from "@/src/lib/store/useCatalogueObjets";
import { exportJson, instancesDe, localStorageAdapter, lireTraces } from "@/src/lib/store/repository";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { pvTexteColor } from "@/src/lib/ui/pv";
import { classeFamille } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";
import type { Character } from "@/src/lib/rules/types";
import { ARME_FAMILLES, labelFamilleArme } from "@/src/lib/rules/world/types";
import { EquipagePanel } from "@/src/components/characters/EquipagePanel";
import { BoursePanel } from "@/src/components/characters/BoursePanel";
import { CreateurPersonnage } from "@/src/components/characters/CreateurPersonnage";
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
  fusionnerEditionPersonnage,
  monterNiveau,
  normaliserPersonnage,
  recalculerPersonnage,
  remettreAZeroPersonnage,
  verifierPersonnage,
} from "@/src/lib/rules/personnage";
import { estEffective, etatCreation, normaliserNomCapacite } from "@/src/lib/rules/creation";
import { aUnLoup, ficheLoup, idFicheLoup, pvMaxLoup } from "@/src/lib/rules/compagnon";
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
  const { items: raw, setItems } = useCharacters("personnages");
  const { catalogue: stock } = useCatalogueObjets();
  const [editing, setEditing] = useState<Character | null>(null);
  const [creation, setCreation] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drMessage, setDrMessage] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState<Record<string, string>>({});

  // Normalise les vieilles sauvegardes v2 (stats -> caracteristiques) pour l'affichage.
  const items = useMemo(() => raw.map((c) => normaliserPersonnage(c as unknown as Record<string, unknown>)), [raw]);

  // Témoin de diagnostic « combat terminé puis vieux PV » : affiche côte à
  // côte ce que dit le stockage, ce que la page affiche, et la dernière
  // écriture tracée (heure + fichier appelant). S'exécute après chaque rendu
  // (sans dépendances) mais ne provoque pas de boucle : l'état n'est mis à
  // jour que s'il differe vraiment.
  const [diag, setDiag] = useState<
    { stockage: string; memoire: string; chrono: string; hote: string; actifs: string } | null
  >(null);
  useEffect(() => {
    const resume = (liste: Character[]) => liste.map((c) => `${c.nom} ${c.pv}/${c.pvMax}`).join(" · ") || "vide";
    let stockage = "clé absente / illisible";
    try {
      // Lecture directe (sans passer par l'adaptateur) pour ne pas polluer la
      // trace 📬 des vrais chargements de données.
      const brut = window.localStorage.getItem(STORAGE_KEYS.characters);
      if (brut) stockage = resume(JSON.parse(brut) as Character[]);
    } catch {
      stockage = "erreur de lecture";
    }
    const memoire = resume(items);
    const chronoBrute = lireTraces(STORAGE_KEYS.characters).slice(-14);
    const chrono =
      chronoBrute.length === 0
        ? "aucune"
        : chronoBrute
            .map((t) => {
              // Queue de la pile d'appel des ÉCRITURES : si un tampon périmé est
              // réécrit un jour, l'encart nomme le fichier/ligne coupable sans
              // ouvrir la console (la preuve doit survivre au réflexe « F5 et
              // je recopie l'encart »).
              const pile =
                t.type === "ecriture" && t.raw
                  ? ` ⌖ ${t.raw
                      .split("|")
                      .map((l) => l.trim())
                      .filter(
                        (l) =>
                          l.startsWith("at ") &&
                          !/examinerAppel|avecInstance|Object\.(save|load)/.test(l)
                      )
                      .slice(0, 2)
                      .join(" ← ")
                      .slice(0, 150)}`
                  : "";
              return `${t.h} ${
                t.type === "ecriture" ? "✍" : t.type === "lecture" ? "📥" : "🔔"
              }${t.epingle ? "📌" : ""} ${t.origine} → ${t.detail.slice(0, 200)}${pile}`;
            })
            .join("\n");
    const hote = window.location.host;
    const actifs = instancesDe(STORAGE_KEYS.characters);
    const ecrans = actifs.length > 0 ? actifs.join(" · ") : "aucun";
    setDiag((p) =>
      p && p.stockage === stockage && p.memoire === memoire && p.chrono === chrono && p.hote === hote && p.actifs === ecrans
        ? p
        : { stockage, memoire, chrono, hote, actifs: ecrans }
    );
  });

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
   * Récupération complète : +1 DR (plafond max) + mana à fond + quotas journaliers
   * (mineure, phénix, rétablissement...), puis proposition de dépenser aussitôt
   * 1 DR en valeur max (+ ½ niveau, sans lancer le dé).
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
    // Le loup récupère tous ses PV après une récupération complète (DRS).
    const avecLoup = aUnLoup(restaure)
      ? { ...restaure, compagnon: { pv: pvMaxLoup(restaure.niveau) } }
      : restaure;
    patch(id, () => avecLoup);
    const base = `Récupération complète : DR ${cible.desRecuperation?.actuel ?? 0} → ${dr?.actuel ?? 0}, mana ${cible.ressources?.mana?.actuel ?? 0} → ${mana?.actuel ?? 0}, quotas journaliers réinitialisés${avecLoup !== restaure ? ", 🐺 PV pleins" : ""}`;
    const bonus = Math.floor(restaure.niveau / 2);
    if (
      avecLoup.pv < avecLoup.pvMax &&
      window.confirm(
        `${avecLoup.nom} : récupération complète (DR et mana restaurés). Dépenser aussitôt 1 DR pour +${parseInt(dr?.type.slice(1) ?? "0", 10)}${bonus > 0 ? `+${bonus}` : ""} PV (valeur max, sans lancer le dé) ?`
      )
    ) {
      try {
        const { personnage, resolution } = depenserDeRecuperationMax(avecLoup);
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
  /**
   * Sauvegarde explicite d'une fiche : recalcule les dérivés (PV/DEF/mana...),
   * écrit aussitôt dans le stockage local puis relit pour vérifier.
   * Rassure avant d'aller en Combat (le staging y est reconstruit depuis ces fiches).
   */
  const sauvegarder = (id: string) => {
    const cible = items.find((x) => x.id === id);
    if (!cible) return;
    const fiche = recalculerPersonnage(cible, stock);
    const next = items.map((c) => (c.id === id ? fiche : c));
    setItems(next);
    try {
      localStorageAdapter.save(STORAGE_KEYS.characters, next);
      const relu = localStorageAdapter.load<Character[]>(STORAGE_KEYS.characters)?.find((c) => c.id === id);
      if (!relu || relu.niveau !== fiche.niveau || relu.pvMax !== fiche.pvMax || relu.nom !== fiche.nom) {
        throw new Error("relecture différente de la fiche enregistrée");
      }
      const heure = new Date().toLocaleTimeString();
      const sorts = fiche.sorts?.length ?? 0;
      const talents = fiche.capacites?.length ?? 0;
      const mana = fiche.ressources?.mana ? `${fiche.ressources.mana.actuel}/${fiche.ressources.mana.max}` : "—";
      setSaveMessage((m) => ({
        ...m,
        [id]: `✅ Fiche sauvegardée à ${heure} — Niv. ${fiche.niveau}, ${fiche.pv}/${fiche.pvMax} PV, DEF ${fiche.defense}, mana ${mana}, ${talents} talent(s), ${sorts} sort(s). Reprise telle quelle en Combat.`,
      }));
    } catch (e) {
      setSaveMessage((m) => ({
        ...m,
        [id]: `⚠ Sauvegarde locale impossible : ${e instanceof Error ? e.message : "stockage indisponible"}. La fiche reste en mémoire pour cette session.`,
      }));
    }
  };
  /** Sauvegarde explicite de toutes les fiches (recalcul + écriture vérifiée). */
  const toutSauvegarder = () => {
    const next = items.map((c) => recalculerPersonnage(c, stock));
    setItems(next);
    try {
      localStorageAdapter.save(STORAGE_KEYS.characters, next);
      const relu = localStorageAdapter.load<Character[]>(STORAGE_KEYS.characters);
      if (!relu || relu.length !== next.length) throw new Error("relecture incomplète");
      const heure = new Date().toLocaleTimeString();
      setSaveMessage((m) => ({
        ...m,
        __tout: `✅ ${next.length} fiche(s) sauvegardée(s) à ${heure}. Reprises telles quelles en Combat.`,
      }));
    } catch (e) {
      setSaveMessage((m) => ({
        ...m,
        __tout: `⚠ Sauvegarde locale impossible : ${e instanceof Error ? e.message : "stockage indisponible"}.`,
      }));
    }
  };
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
  /** Suppression définitive d'une fiche (avec son loup éventuel, dérivé de la fiche). */
  const supprimer = (id: string, nom: string) => {
    if (!window.confirm(`Supprimer définitivement ${nom} (fiche, inventaire, sorts et loup éventuel) ?`)) return;
    setItems((prev) => prev.filter((c) => c.id !== id));
    setOpenId((o) => (o === id ? null : o));
  };

  /** Loups compagnons (pseudo-fiches dérivées) : cibles de soins hors combat. */
  const loups = items.flatMap((m) => ficheLoup(m) ?? []);
  /** Répartit les mises à jour du panneau hors combat (fiches + loups vers maîtres). */
  const routerMajHorsCombat = (next: Character[]) => {
    const parId = new Map(next.map((c) => [c.id, c]));
    setItems((prev) =>
      prev.map((m) => {
        const maj = parId.get(m.id);
        const base = maj ?? m;
        const loup = parId.get(idFicheLoup(m.id));
        if (!loup || !aUnLoup(base)) return base;
        const max = pvMaxLoup(base.niveau);
        return { ...base, compagnon: { pv: Math.max(0, Math.min(max, loup.pv)) } };
      })
    );
  };
  /** ±1 PV au loup compagnon (persistés sur la fiche maître). */
  const degatLoup = (id: string) =>
    patch(id, (c) => {
      if (!aUnLoup(c)) return c;
      const cur = c.compagnon?.pv ?? pvMaxLoup(c.niveau);
      return { ...c, compagnon: { pv: Math.max(0, cur - 1) } };
    });
  const soinLoup = (id: string) =>
    patch(id, (c) => {
      if (!aUnLoup(c)) return c;
      const max = pvMaxLoup(c.niveau);
      const cur = c.compagnon?.pv ?? max;
      return { ...c, compagnon: { pv: Math.min(max, cur + 1) } };
    });
  /** Nouveau compagnon (accord MJ : mort du précédent) : repart avec tous ses PV. */
  const nouveauCompagnon = (id: string) => {
    const cible = items.find((x) => x.id === id);
    if (!cible || !aUnLoup(cible)) return;
    if (!window.confirm(`Nouveau compagnon pour ${cible.nom} (mort du précédent, accord MJ) : repartir avec tous ses PV (${pvMaxLoup(cible.niveau)}) ?`)) return;
    patch(id, (c) => ({ ...c, compagnon: { pv: pvMaxLoup(c.niveau) } }));
  };

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
    setItems((prev) => prev.map((c) => (c.id === norm.id ? fusionnerEditionPersonnage(c, norm) : c)));
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Personnages ({items.length})</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCreation(true)} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold hover:bg-amber-300">+ Nouveau personnage</button>
          <button onClick={toutRecalculer} title="INIT=10+PER · DEF=10+AGI+Équip+Mod · PV=base+CON · Chance=2+CHA(+1 Aventurier) · DR=2+CON(+1 Mystique) · Mana=VOL+sorts" className="px-3 py-1.5 rounded bg-zinc-800 text-sm font-semibold hover:bg-zinc-700">↻ Recalculer</button>
          <button onClick={toutSauvegarder} title="Recalcule toutes les fiches, écrit aussitôt dans le stockage local et vérifie par relecture. Le Combat repart de ces fiches." className="px-3 py-1.5 rounded bg-blue-800 text-sm font-semibold hover:bg-blue-700">💾 Tout sauvegarder</button>
          <button onClick={toutRemettreAZero} title="Retour création : niveau 1, talents/sorts vidés, traits et inventaires de base restaurés, PV/chance/mana au max" className="px-3 py-1.5 rounded bg-green-800 text-sm font-semibold hover:bg-green-700">✦ Remise à zéro</button>
          <button onClick={() => exportJson("personnages.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={reset} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Réinitialiser</button>
        </div>
      </div>
      {/* Témoin diagnostic (voir plus haut) : lignes à recopier au dev. */}
      <p className="text-[11px] leading-4 text-zinc-500 border border-dashed border-zinc-800 rounded px-2 py-1">
        🔎 Stockage : {diag?.stockage ?? "…"}<br />
        🖥 Affiché : {diag?.memoire ?? "…"}<br />
        🧩 Écrans tiennent la clé : {diag?.actifs ?? "…"}<br />
        ✍ écriture · 📥 lecture · 🔔 autre onglet · 📌 anomalie · Chrono : <span className="whitespace-pre-line">{diag?.chrono ?? "…"}</span> — {diag?.hote ?? ""}
      </p>
      <p className="text-xs text-zinc-500">
        COF Fantasy : INIT 10+PER · DEF 10+AGI+Équip+Mod · Vigueur Combattant 10+CON / Aventurier 8+CON / Mystique 8+CON / Mage 6+CON ·
        Chance 2+CHA (3+CHA Aventurier) · DR d10 Combattant / d8 Aventurier / d8+1 Mystique / d6 Mage, nombre 2+CON (+1 Mystique) ·
        Contact niv+FOR / Distance niv+AGI / Magique niv+VOL · Mana VOL+sorts · Idéal/travers narratifs.
        Création niv. 1 : 2 pts → 2 capacités de rang 1 du profil + rang 1 de peuple gratuit (+ rang 2 gratuit : les 4 Mages).
        Progression : 2 pts/niveau, R1-2 = 1 pt, R3-5 = 2 pts, rangs précédents requis, niveau ≥ rang, désapprentissage du haut vers le bas.
        Niveau : PV +gain+CON (rétroactif), attaques +1 (max niv. 10), +2 pts à dépenser, mana via nouveaux sorts, dé évolutif d4→d6 (6)→d8 (9)→…
      </p>

      <HorsCombatPanel characters={[...items, ...loups]} onUpdate={routerMajHorsCombat} />
      {saveMessage.__tout && (
        <div className="rounded-lg border border-green-700 bg-green-900/40 p-3 text-sm text-green-200">
          {saveMessage.__tout}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c) => {
          const d = deriverPersonnage(c, stock);
          const ecarts = verifierPersonnage(c, stock);
          const mana = c.ressources?.mana ?? { max: d.manaMax, actuel: d.manaMax };
          const chance = c.ressources?.chance ?? { max: d.chanceMax, actuel: d.chanceMax };
          const dr = c.desRecuperation ?? { type: d.drType, max: d.drNombre, actuel: drInitial(c.caracteristiques.CON, c.profil || c.classe, d.famille) };
          return (
            <div key={c.id} className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2 fam-rail ${classeFamille(d.famille)}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-lg">{c.nom} <FamilleBadge famille={d.famille} /> {c.exemple && <span className="text-xs text-amber-400 font-normal">· exemple</span>}</div>
                  <div className="text-sm text-zinc-400">{c.peuple} · {c.profil || c.classe} · Niv. {c.niveau}{c.voieMage ? " · Voie du mage" : ""}</div>
                  {(c.idealHeroique || c.travers) && (
                    <div className="text-xs text-zinc-500 italic">Idéal : {c.idealHeroique ?? "—"} · Travers : {c.travers ?? "—"} (narratif)</div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => sauvegarder(c.id)} title="Recalcule la fiche (PV/DEF/mana...), l'écrit aussitôt dans le stockage local et vérifie par relecture. Le Combat repart de cette fiche." className="text-sm px-2.5 py-1 rounded bg-blue-800 hover:bg-blue-700 font-semibold">💾</button>
                  <button onClick={() => remettreAZero(c.id, c.nom)} title="Remise à zéro : niveau 1, talents/sorts vidés, traits et inventaire de base restaurés" className="text-sm px-2.5 py-1 rounded bg-green-900 hover:bg-green-800">✦</button>
                  <button onClick={() => recalculer(c.id)} title="Resynchroniser PV/DEF/Init/Chance/DR/Mana depuis les formules" className="text-sm px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700">↻</button>
                  <button onClick={() => setEditing({ ...c })} className="text-sm px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Éditer</button>
                  <button onClick={() => supprimer(c.id, c.nom)} title="Supprimer définitivement cette fiche (avec son loup éventuel)" className="text-sm px-2.5 py-1 rounded bg-red-900 hover:bg-red-800 font-semibold">🗑</button>
                </div>
              </div>
              {saveMessage[c.id] && (
                <div className="text-xs rounded px-2.5 py-1.5 border border-green-800/40 bg-green-950/30 text-green-300/90">
                  {saveMessage[c.id]}
                </div>
              )}

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
              {(() => {
                const loup = ficheLoup(c);
                if (!loup) return null;
                const mort = loup.pv <= 0;
                return (
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="font-semibold">🐺 {loup.nom} <span className="text-zinc-500 font-normal">· DEF {loup.defense} · Morsure au bonus magique</span></span>
                      <span className="font-mono">{loup.pv}/{loup.pvMax} PV</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => degatLoup(c.id)} disabled={loup.pv <= 0} title="Infliger 1 DM au loup (persisté sur la fiche)" className="flex-1 py-1.5 rounded bg-red-900 hover:bg-red-800 text-sm font-bold disabled:opacity-40">−1 PV</button>
                      <button onClick={() => soinLoup(c.id)} disabled={loup.pv >= loup.pvMax} title="Soigner 1 PV au loup (persisté sur la fiche)" className="flex-1 py-1.5 rounded bg-green-900 hover:bg-green-800 text-sm font-bold disabled:opacity-40">+1 PV</button>
                    </div>
                    {mort ? (
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-xs text-red-300/90 flex-1">À 0 PV : fuite en nature (retour 8 h, MJ) ou à soigner comme un personnage.</span>
                        <button onClick={() => nouveauCompagnon(c.id)} className="text-xs px-2.5 py-1 rounded bg-green-900 hover:bg-green-800 font-semibold">🐺 Nouveau compagnon</button>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Soins : sorts hors combat ci-dessus (bénéficiaire/patient), magie en combat, Lien empathique, ou récupération complète (PV pleins).</p>
                    )}
                  </div>
                );
              })()}
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
          <div className={`bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-2xl space-y-3 max-h-[90vh] overflow-y-auto fam-rail ${classeFamille(editing.famille)}`}>
            <h2 className="font-bold">Éditer {editing.nom} <FamilleBadge famille={editing.famille} /></h2>
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
              const normTalents = (editing.capacites ?? []).map(normaliserNomCapacite);
              const maitreArmes =
                normTalents.includes(normaliserNomCapacite("Armes de prédilection")) ||
                normTalents.includes(normaliserNomCapacite("Spécialisation")) ||
                normTalents.includes(normaliserNomCapacite("Science du critique"));
              if (!maitreArmes) return null;
              return (
                <div className="rounded border border-amber-900/60 bg-zinc-900 p-2.5 space-y-1.5">
                  <div className="text-sm font-semibold">Maître d&apos;armes{editing.famillePredilection ? ` — ${labelFamilleArme(editing.famillePredilection)}` : ""}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">Famille de prédilection
                      <select
                        value={editing.famillePredilection ?? ""}
                        onChange={(e) => setEditing({ ...editing, famillePredilection: (e.target.value || undefined) as Character["famillePredilection"] })}
                        title="Rang 1 (Voie du maître d'armes) : catégorie annoncée au MJ puis posée ici — +1 attaque, Science du critique 19-20 et Spécialisation appliqués automatiquement en combat sur ces armes (mains nues incluses, corrections LDB p88)."
                        className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
                      >
                        <option value="">— non choisie (MJ : annoncer)</option>
                        {ARME_FAMILLES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </label>
                    {normTalents.includes(normaliserNomCapacite("Spécialisation")) && (
                      <label className="text-sm">Spécialisation (+DM, max 6)
                        <input
                          type="number" min={0} max={6}
                          value={editing.bonusSpecialisation ?? 0}
                          onChange={(e) => setEditing({ ...editing, bonusSpecialisation: Math.min(6, Math.max(0, Number(e.target.value) || 0)) })}
                          title="Rang 3 (Voie du maître d'armes) : +1 DM, +1 par rang 5 en voie au choix MJ (max +6) — ajouté automatiquement aux coups d'armes de prédilection."
                          className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono"
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}
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

      {creation && (
        <CreateurPersonnage
          onAnnuler={() => setCreation(false)}
          onCreer={(c) => {
            setItems((prev) => [...prev, c]);
            setCreation(false);
          }}
        />
      )}
    </div>
  );
}
