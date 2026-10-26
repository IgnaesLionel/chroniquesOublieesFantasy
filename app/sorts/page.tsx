"use client";
import { useMemo, useState } from "react";
import { SEED_SORTS, VOIES_SORTS } from "@/src/lib/data/sorts";
import { CLASSES } from "@/src/lib/data/classes";
import { ACTION_LABEL, catalogueCapacites, type CapaciteCatalogue } from "@/src/lib/data/capacites";
import { useCharacters, useSorts } from "@/src/lib/store/collections";
import { exportJson } from "@/src/lib/store/repository";
import type { ActionDRS, Sort, SortType } from "@/src/lib/rules/types";
import { PROFILS_PAR_FAMILLE } from "@/src/lib/rules/personnage";
import { classeFamille, familleDuProfil, familleDuSort } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";
import { ActionBadge } from "@/src/components/ui/ActionBadge";
import { Modal } from "@/src/components/ui/Modal";
import { ajouterCapacite, apprendreSort, normaliserPersonnage } from "@/src/lib/rules/personnage";
import { apprendreTalentComplet, peutApprendre } from "@/src/lib/rules/creation";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { parseDiceExpression, substituerDeEvolutif, substituerStats } from "@/src/lib/rules/dice/roller";

function desValide(expr: string): boolean {
  try {
    // ° et dE acceptés, caracs (INT, CHA...) substituées à 0 pour la validation.
    parseDiceExpression(substituerDeEvolutif(substituerStats(expr, {}), 4));
    return true;
  } catch {
    return false;
  }
}

const EMPTY: Sort = {
  id: "", nom: "", type: "offensif", ecole: "", description: "",
  familles: [], bonus: 0, degats: "1d6", soin: "",
  effetCle: undefined, effetDuree: undefined, cout: undefined, action: undefined,
};

const TYPE_LABEL: Record<SortType, string> = {
  offensif: "Offensifs", defensif: "Défensifs", utilitaire: "Utilitaires",
};

const ACTION_OPTIONS: ActionDRS[] = ["attaque", "mouvement", "limitee", "gratuite"];

/** Un sort coûte des PM ; une capacité (talent, sans coût) s'apprend telle quelle. */
function estSort(s: Sort): boolean {
  return !!s.cout && s.cout.montant > 0;
}

function resumeEffet(s: Sort): string {
  const parts: string[] = [];
  if (s.action) parts.push(ACTION_LABEL[s.action]);
  if (s.degats) parts.push(`Dégâts ${s.degats}`);
  if (s.soin) parts.push(`Soin ${s.soin}`);
  if (s.effetCle) {
    const nom = EFFECT_CATALOG.find((e) => e.key === s.effetCle)?.nom ?? s.effetCle;
    parts.push(`✦ ${nom}${s.effetDuree ? ` (${s.effetDuree})` : ""}`);
  }
  if (s.cout) parts.push(`${s.cout.montant} ${s.cout.ressource}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function SortsPage() {
  const { items, setItems } = useSorts();
  const { items: persos, setItems: setPersos } = useCharacters("sorts");
  const [editing, setEditing] = useState<Sort | null>(null);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<"tous" | "sorts" | "capacites">("tous");
  const [filtreType, setFiltreType] = useState<"tous" | SortType>("tous");
  const [filtreFamille, setFiltreFamille] = useState<string>("toutes");
  const [filtreVoie, setFiltreVoie] = useState<string>("toutes");
  const [cible, setCible] = useState<Record<string, string>>({});

  const capacites = useMemo(() => catalogueCapacites(), []);

  // Les choix de voies suivent la classe filtrée (ex. Guerrier → ses 5 voies).
  const classeFiltree = filtreFamille !== "toutes" ? CLASSES.find((c) => c.profil === filtreFamille) : undefined;
  const changeFamille = (profil: string) => {
    setFiltreFamille(profil);
    if (profil !== "toutes") {
      const voies: string[] = CLASSES.find((c) => c.profil === profil)?.voies ?? [];
      if (!voies.includes(filtreVoie)) setFiltreVoie("toutes");
    }
  };

  const passeFiltresCommuns = (nom: string, voie: string | undefined, familles: string[], description: string | undefined) => {
    if (filtreFamille !== "toutes" && familles.length > 0 && !familles.includes(filtreFamille)) return false;
    if (filtreVoie !== "toutes" && (voie ?? "") !== filtreVoie) return false;
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      const hay = `${nom} ${voie ?? ""} ${description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const sortsVisibles = items.filter((s) => {
    if (categorie === "capacites") return false;
    if (categorie === "tous" && !estSort(s)) return false;
    if (filtreType !== "tous" && s.type !== filtreType) return false;
    return passeFiltresCommuns(s.nom, s.voie, s.familles ?? [], s.description);
  });

  const capacitesVisibles: (CapaciteCatalogue | Sort)[] = [
    ...capacites.filter((c) => {
      if (categorie === "sorts") return false;
      return passeFiltresCommuns(c.nom, c.voie, [c.profil], c.resume);
    }),
    // Entrées maison sans coût PM = capacités.
    ...items.filter((s) => {
      if (categorie === "sorts" || estSort(s)) return false;
      if (filtreType !== "tous" && s.type !== filtreType) return false;
      return passeFiltresCommuns(s.nom, s.voie, s.familles ?? [], s.description);
    }),
  ];

  const save = () => {
    if (!editing || !editing.nom.trim()) return;
    if (editing.type === "offensif" && editing.degats && !desValide(editing.degats)) return;
    if (editing.type === "defensif" && editing.soin && !desValide(editing.soin)) return;
    if (editing.rang !== undefined && (editing.rang < 1 || editing.rang > 5)) return;
    // Règle COF : un sort issu d'une voie coûte son rang en PM (sauf coût saisi).
    // Sans coût, l'entrée est une capacité (talent utilisable).
    const cout = editing.cout && editing.cout.montant > 0
      ? editing.cout
      : editing.voie && editing.rang
        ? { ressource: "mana", montant: editing.rang }
        : undefined;
    const clean: Sort = {
      ...editing,
      nom: editing.nom.trim(),
      ecole: editing.ecole?.trim() || undefined,
      voie: editing.voie?.trim() || undefined,
      rang: editing.rang,
      action: editing.action,
      description: editing.description?.trim() || undefined,
      familles: editing.familles ?? [],
      degats: editing.type === "offensif" ? editing.degats || "1d6" : undefined,
      soin: editing.type === "defensif" ? editing.soin || undefined : undefined,
      effetCle: editing.effetCle || undefined,
      effetDuree: editing.effetCle ? editing.effetDuree ?? null : undefined,
      cout,
    };
    setItems((prev) => {
      if (!clean.id) return [...prev, { ...clean, id: `sort-${Date.now().toString(36)}` }];
      return prev.map((s) => (s.id === clean.id ? clean : s));
    });
    setEditing(null);
  };

  const attribuerSort = (sort: Sort) => {
    const pid = cible[sort.id];
    if (!pid) return;
    setPersos((prev) =>
      prev.map((c) => {
        if (c.id !== pid) return c;
        const norm = normaliserPersonnage(c as unknown as Record<string, unknown>);
        // Garde-fou : points, rangs précédents, niveau (les customs sans voie restent libres, espace MJ).
        const porte = peutApprendre(norm, { nom: sort.nom, voie: sort.voie, rang: sort.rang });
        if (!porte.ok) return c;
        // Un sort appris est aussi connu comme talent de sa voie (même capacité).
        return ajouterCapacite(apprendreSort(norm, sort), sort.nom);
      })
    );
  };

  const attribuerCapacite = (id: string, entree: { nom: string; voie?: string; rang?: number }) => {
    const pid = cible[id];
    if (!pid) return;
    setPersos((prev) =>
      prev.map((c) => {
        if (c.id !== pid) return c;
        const norm = normaliserPersonnage(c as unknown as Record<string, unknown>);
        if (!peutApprendre(norm, entree).ok) return c;
        // Un talent qui est aussi un sort crée l'entrée lançable (+ mana).
        return apprendreTalentComplet(norm, entree.nom, items);
      })
    );
  };

  /** Bouton d'apprentissage avec garde-fous (points, prérequis, niveau). */
  const boutonApprendre = (
    entryId: string,
    nom: string,
    voie: string | undefined,
    rang: number | undefined,
    onLearn: () => void,
    liste: "talents" | "sorts" = "talents"
  ) => {
    const pid = cible[entryId];
    if (!pid) {
      return <button disabled className="text-xs px-2 py-1 rounded bg-violet-700 font-semibold disabled:opacity-40">+ Apprendre</button>;
    }
    const perso = persos.find((p) => p.id === pid);
    if (!perso) return null;
    const norm = normaliserPersonnage(perso as unknown as Record<string, unknown>);
    const porte = peutApprendre(norm, { nom, voie, rang }, liste);
    if (porte.connu) return <span className="text-xs text-green-400 font-semibold">✓</span>;
    if (!porte.ok) {
      return <span title={porte.raisons.join(" · ")} className="text-xs px-2 py-1 rounded bg-zinc-900 text-zinc-600 cursor-not-allowed">🔒</span>;
    }
    return (
      <button
        onClick={onLearn}
        title={porte.gratuit ? "Apprendre (gratuit)" : `Apprendre (${porte.cout} pt)`}
        className={`text-xs px-2 py-1 rounded font-semibold ${porte.gratuit ? "bg-violet-700" : "bg-zinc-800"}`}
      >
        {porte.gratuit ? "Gratuit" : "+ Apprendre"}
      </button>
    );
  };

  const toggleFamille = (profil: string) => {
    if (!editing) return;
    const cur = editing.familles ?? [];
    setEditing({ ...editing, familles: cur.includes(profil) ? cur.filter((f) => f !== profil) : [...cur, profil] });
  };

  const selectPJ = (id: string, entryFamilles: string[]) => (
    <select
      value={cible[id] ?? ""}
      onChange={(e) => setCible((m) => ({ ...m, [id]: e.target.value }))}
      className="bg-zinc-800 rounded px-1.5 py-1 text-xs max-w-28"
    >
      <option value="">PJ…</option>
      {persos.map((c) => {
        const p = normaliserPersonnage(c as unknown as Record<string, unknown>);
        const ok = entryFamilles.length === 0 || entryFamilles.includes(p.profil || p.classe);
        return <option key={c.id} value={c.id}>{c.nom}{ok ? "" : " ⚠"}</option>;
      })}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Sorts & Capacités</h1>
        <div className="flex gap-2">
          <button onClick={() => exportJson("sorts.json", items)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Export JSON</button>
          <button onClick={() => setItems(SEED_SORTS)} className="px-3 py-1.5 rounded bg-zinc-800 text-sm hover:bg-zinc-700">Réinitialiser</button>
          <button onClick={() => setEditing({ ...EMPTY, familles: [] })} className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-bold">+ Nouveau</button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Grimoire ({items.filter(estSort).length} sorts) + talents utilisables des voies ({capacites.length} capacités).
        Un sort coûte des PM à lancer et s&apos;apprend comme sort (mana = VOL + sorts, rang de voie accordé aussi) ; une capacité
        (ex. Protéger un allié, action gratuite) ne coûte rien à utiliser et s&apos;apprend telle quelle dans les capacités du PJ.
        Les rangs de voie qui sont des sorts (ex. Un pied dans la tombe, ✦ au grimoire) sont dans l&apos;onglet Sorts, pas ici.
        Familles = profils (aucune case = toutes classes).
        Apprentissage vérifié : points (R1-2 : 1 pt, R3-5 : 2 pts), rangs précédents requis, niveau ≥ rang. 🔒 = bloqué (raison au survol).
      </p>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (nom, voie…)"
          className="bg-zinc-800 rounded px-2.5 py-1.5 text-sm w-52"
        />
        <div className="flex gap-1.5">
          {(["tous", "sorts", "capacites"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategorie(c)}
              className={`px-2.5 py-1 rounded text-xs ${categorie === c ? "bg-amber-400 text-black font-bold" : "bg-zinc-800 text-zinc-300"}`}
            >
              {c === "tous" ? "Tout" : c === "sorts" ? "Sorts" : "Capacités"}
            </button>
          ))}
        </div>
        {categorie !== "capacites" && (
          <div className="flex gap-1.5">
            {(["tous", "offensif", "defensif", "utilitaire"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltreType(t)}
                className={`px-2.5 py-1 rounded text-xs ${filtreType === t ? "bg-amber-400 text-black font-bold" : "bg-zinc-800 text-zinc-300"}`}
              >
                {t === "tous" ? "Tous types" : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        <select value={filtreFamille} onChange={(e) => changeFamille(e.target.value)} className="bg-zinc-800 rounded px-2 py-1.5 text-sm">
          <option value="toutes">Toutes classes</option>
          {Object.entries(PROFILS_PAR_FAMILLE).map(([fam, profils]) => (
            <optgroup key={fam} label={fam}>
              {profils.map((p) => <option key={p} value={p}>{p}</option>)}
            </optgroup>
          ))}
        </select>
        {classeFiltree && <FamilleBadge famille={familleDuProfil(classeFiltree.profil)} titre={`Profil filtré : ${classeFiltree.profil}`} />}
        <select value={filtreVoie} onChange={(e) => setFiltreVoie(e.target.value)} className="bg-zinc-800 rounded px-2 py-1.5 text-sm">
          <option value="toutes">{classeFiltree ? `Voies du ${classeFiltree.profil}` : "Toutes voies"}</option>
          {classeFiltree ? (
            classeFiltree.voies.map((v) => <option key={v} value={v}>{v}</option>)
          ) : (
            CLASSES.map((c) => (
              <optgroup key={c.profil} label={c.profil}>
                {c.voies.map((v) => <option key={v} value={v}>{v}</option>)}
              </optgroup>
            ))
          )}
        </select>
      </div>

      {categorie !== "capacites" && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 border-l-[3px] border-transparent">Sort</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Classes</th>
                <th className="text-left px-3 py-2">Effet</th>
                <th className="text-left px-3 py-2">Apprendre à…</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortsVisibles.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800 bg-zinc-950">
                  <td className={`px-3 py-2 fam-rail ${classeFamille(familleDuSort(s))}`}>
                    <span className="font-semibold">{s.type === "offensif" ? "✦ " : s.type === "defensif" ? "🛡 " : "🔮 "}{s.nom}</span>
                    <ActionBadge action={s.action} className="ml-1.5" />
                    <FamilleBadge famille={familleDuSort(s)} className="ml-1.5" />
                    {s.rang !== undefined && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 font-mono">R{s.rang}</span>}
                    {s.ecole && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-200">{s.ecole}</span>}
                    {s.voie && <span className="block text-xs text-zinc-500">{s.voie}</span>}
                    {s.description && <span className="block text-xs text-zinc-500">{s.description}</span>}
                  </td>
                  <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{TYPE_LABEL[s.type].replace(/s$/, "")}</span></td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {(s.familles ?? []).length === 0 ? <span className="italic text-zinc-500">Toutes</span> : (s.familles ?? []).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-300 font-mono">{resumeEffet(s)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      {selectPJ(s.id, s.familles ?? [])}
                      {boutonApprendre(s.id, s.nom, s.voie, s.rang, () => attribuerSort(s), "sorts")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing({ ...EMPTY, ...s, familles: [...(s.familles ?? [])] })} className="text-xs px-2 py-1 rounded bg-zinc-800 mr-1">Éditer</button>
                    <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== s.id))} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-red-900">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortsVisibles.length === 0 && <p className="text-sm text-zinc-500 p-4">Aucun sort ne correspond aux filtres.</p>}
        </div>
      )}

      {categorie !== "sorts" && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 border-l-[3px] border-transparent">Capacité</th>
                <th className="text-left px-3 py-2">Classe</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Apprendre à…</th>
              </tr>
            </thead>
            <tbody>
              {capacitesVisibles.map((c) => {
                const famille = "profil" in c ? familleDuProfil(c.profil) : familleDuSort(c);
                return (
                  <tr key={c.id} className="border-t border-zinc-800 bg-zinc-950">
                    <td className={`px-3 py-2 fam-rail ${classeFamille(famille)}`}>
                      <span className="font-semibold">◈ {c.nom}</span>
                      <ActionBadge action={c.action} className="ml-1.5" />
                      <FamilleBadge famille={famille} className="ml-1.5" />
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 font-mono">R{c.rang}</span>
                      <span className="block text-xs text-zinc-500">{c.voie}</span>
                      <span className="block text-xs text-zinc-500">{"resume" in c ? c.resume : c.description}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{"profil" in c ? c.profil : ((c.familles ?? []).join(", ") || "Toutes")}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{c.action ? ACTION_LABEL[c.action] : <span className="italic text-zinc-500">Passive</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 items-center">
                        {selectPJ(c.id, "profil" in c ? [c.profil] : (c.familles ?? []))}
                        {boutonApprendre(c.id, c.nom, c.voie, c.rang, () => attribuerCapacite(c.id, c))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {capacitesVisibles.length === 0 && <p className="text-sm text-zinc-500 p-4">Aucune capacité ne correspond aux filtres.</p>}
        </div>
      )}

      {editing && (
        <Modal
          ouvert
          onFermer={() => setEditing(null)}
          ariaLabel={editing.id ? `Éditer ${editing.nom}` : "Nouveau sort ou capacité"}
          classePanneau="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg space-y-2.5 max-h-[90vh] overflow-auto"
        >
            <h2 className="font-bold">{editing.id ? `Éditer ${editing.nom}` : "Nouveau sort / capacité"}</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Nom*<input value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="text-sm">Type
                <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as SortType })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  <option value="offensif">Offensif</option>
                  <option value="defensif">Défensif</option>
                  <option value="utilitaire">Utilitaire</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-sm">École<input value={editing.ecole ?? ""} onChange={(e) => setEditing({ ...editing, ecole: e.target.value })} placeholder="Feu, Sacré…" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              <label className="text-sm">Voie
                <select value={editing.voie ?? ""} onChange={(e) => setEditing({ ...editing, voie: e.target.value || undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  <option value="">— (aucune)</option>
                  {VOIES_SORTS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block text-sm">Rang (1-5)<input type="number" min={1} max={5} value={editing.rang ?? ""} placeholder="= coût PM" onChange={(e) => setEditing({ ...editing, rang: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Action
                <select value={editing.action ?? ""} onChange={(e) => setEditing({ ...editing, action: (e.target.value || undefined) as ActionDRS | undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  <option value="">— (passive)</option>
                  {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                </select>
              </label>
              <label className="block text-sm">Coût mana<input type="number" min={0} value={editing.cout?.montant ?? ""} placeholder={editing.voie && editing.rang ? `défaut : ${editing.rang} (= rang)` : "vide = capacité"} onChange={(e) => setEditing({ ...editing, cout: e.target.value ? { ressource: "mana", montant: Number(e.target.value) } : undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <p className="text-xs text-zinc-500">Avec un coût PM : sort (appris comme sort). Sans coût : capacité (apprise telle quelle dans les capacités du PJ).</p>
            {editing.type === "offensif" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">Dégâts<input value={editing.degats ?? ""} onChange={(e) => setEditing({ ...editing, degats: e.target.value })} placeholder="1d6" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
                <label className="block text-sm">Bonus d&apos;attaque<input type="number" value={editing.bonus ?? 0} onChange={(e) => setEditing({ ...editing, bonus: Number(e.target.value) })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
              </div>
            )}
            {editing.type === "offensif" && editing.degats && !desValide(editing.degats) && (
              <p className="text-xs text-red-400">Dégâts invalides (attendu : 1d6, 2d6+3...).</p>
            )}
            {editing.type === "defensif" && (
              <label className="block text-sm">Soin<input value={editing.soin ?? ""} onChange={(e) => setEditing({ ...editing, soin: e.target.value })} placeholder="1d8+2 (optionnel)" className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5 font-mono" /></label>
            )}
            {editing.type === "defensif" && editing.soin && !desValide(editing.soin) && (
              <p className="text-xs text-red-400">Soin invalide (attendu : 1d8+2...).</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Effet
                <select value={editing.effetCle ?? ""} onChange={(e) => setEditing({ ...editing, effetCle: e.target.value || undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5">
                  <option value="">Aucun</option>
                  {EFFECT_CATALOG.map((t) => <option key={t.key} value={t.key}>{t.nom}</option>)}
                </select>
              </label>
              <label className="block text-sm">Durée (tours)<input type="number" min={1} value={editing.effetDuree ?? ""} placeholder="défaut" onChange={(e) => setEditing({ ...editing, effetDuree: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            </div>
            <div className="rounded border border-zinc-800 p-2.5">
              <div className="text-sm font-semibold mb-1.5">Classes (familles) — aucune case = toutes classes</div>
              <div className="grid sm:grid-cols-2 gap-x-3 gap-y-1">
                {Object.entries(PROFILS_PAR_FAMILLE).map(([fam, profils]) => (
                  <div key={fam} className={`fam-texte ${classeFamille(fam)}`}>
                    <div className="text-[11px] uppercase mt-1">{fam}</div>
                    {profils.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm py-0.5">
                        <input type="checkbox" checked={(editing.familles ?? []).includes(p)} onChange={() => toggleFamille(p)} />
                        {p}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <label className="block text-sm">Description<textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5" /></label>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded bg-zinc-800">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded bg-amber-400 text-black font-semibold">Enregistrer</button>
            </div>
        </Modal>
      )}
    </div>
  );
}
