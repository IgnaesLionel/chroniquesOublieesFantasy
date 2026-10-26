"use client";

import { useMemo, useState } from "react";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import {
  basculerVerrou,
  modifierChamp,
} from "@/src/lib/npcgen/engine";
import {
  estVerrouille,
  lireChamp,
  nomComplet,
  type Faction,
  type NpcGen,
  type NpcRelation,
  type NpcStatBlock,
  type ReferenceEntry,
  type ReferenceTable,
} from "@/src/lib/npcgen/types";
import { statBlockDepuisMonstre, libelleSourceStatBlock } from "@/src/lib/npcgen/statblock";

interface Props {
  npc: NpcGen;
  onChange: (npc: NpcGen) => void;
  entries: ReferenceEntry[];
  tables: ReferenceTable[];
  factions: Faction[];
  monsters?: MonsterTemplate[];
  statBlock?: NpcStatBlock;
  onStatBlockChange?: (bloc: NpcStatBlock | undefined) => void;
  onGenererEstimation?: () => void;
  onRegen?: (chemin: string) => void;
  warnings?: string[];
}

const input =
  "w-full bg-zinc-950/60 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:border-amber-500";

function valeursTable(entries: ReferenceEntry[], tableId: string): string[] {
  return [...new Set(entries.filter((e) => e.tableId === tableId && e.actif).map((e) => e.valeur))];
}

function BoutonsChamp({
  chemin,
  npc,
  onChange,
  onRegen,
}: {
  chemin: string;
  npc: NpcGen;
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
}) {
  const verrou = estVerrouille(npc, chemin);
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <button
        type="button"
        title={verrou ? "Déverrouiller ce champ" : "Verrouiller ce champ avant de régénérer"}
        aria-label={verrou ? `Déverrouiller ${chemin}` : `Verrouiller ${chemin}`}
        onClick={() => onChange(basculerVerrou(npc, chemin))}
        className={`text-[11px] px-1.5 py-0.5 rounded border ${
          verrou
            ? "bg-amber-400/20 border-amber-500 text-amber-200"
            : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-200"
        }`}
      >
        {verrou ? "🔒" : "🔓"}
      </button>
      {onRegen && (
        <button
          type="button"
          title="Régénérer uniquement ce champ"
          onClick={() => onRegen(chemin)}
          className="text-[11px] px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-gold-200"
        >
          ↻
        </button>
      )}
    </span>
  );
}

function ChampTexte({
  npc,
  label,
  chemin,
  onChange,
  onRegen,
  type = "text",
}: {
  npc: NpcGen;
  label: string;
  chemin: string;
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
  type?: string;
}) {
  const valeur = lireChamp(npc, chemin);
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">{label}</span>
      <BoutonsChamp chemin={chemin} npc={npc} onChange={onChange} onRegen={onRegen} />
      <input
        type={type}
        value={type === "number" ? Number(valeur ?? 0) : String(valeur ?? "")}
        onChange={(e) =>
          onChange(
            modifierChamp(
              npc,
              chemin,
              type === "number" ? Math.max(0, Number(e.target.value) || 0) : e.target.value
            )
          )
        }
        className={`${input} mt-1`}
      />
    </label>
  );
}

function ChampZone({
  npc,
  label,
  chemin,
  onChange,
  onRegen,
  rows = 2,
}: {
  npc: NpcGen;
  label: string;
  chemin: string;
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
  rows?: number;
}) {
  const valeur = String(lireChamp(npc, chemin) ?? "");
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">{label}</span>
      <BoutonsChamp chemin={chemin} npc={npc} onChange={onChange} onRegen={onRegen} />
      <textarea
        value={valeur}
        rows={rows}
        onChange={(e) => onChange(modifierChamp(npc, chemin, e.target.value))}
        className={`${input} mt-1`}
      />
    </label>
  );
}

function ChampSelect({
  npc,
  label,
  chemin,
  options,
  onChange,
  onRegen,
  vide = "—",
  labels,
}: {
  npc: NpcGen;
  label: string;
  chemin: string;
  options: string[];
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
  vide?: string;
  labels?: Record<string, string>;
}) {
  const valeur = String(lireChamp(npc, chemin) ?? "");
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">{label}</span>
      <BoutonsChamp chemin={chemin} npc={npc} onChange={onChange} onRegen={onRegen} />
      <select
        value={valeur}
        onChange={(e) => onChange(modifierChamp(npc, chemin, e.target.value))}
        className={`${input} mt-1`}
      >
        {!options.includes(valeur) && <option value={valeur}>{labels?.[valeur] ?? (valeur || vide)}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{labels?.[option] ?? option}</option>
        ))}
      </select>
    </label>
  );
}

function ListeEditable({
  npc,
  label,
  chemin,
  onChange,
  onRegen,
  placeholder = "Ajouter…",
}: {
  npc: NpcGen;
  label: string;
  chemin: string;
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
  placeholder?: string;
}) {
  const valeurs = (lireChamp(npc, chemin) as string[] | undefined) ?? [];
  const [saisie, setSaisie] = useState("");
  const ecrire = (liste: string[]) => onChange(modifierChamp(npc, chemin, liste));
  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-zinc-400">{label} ({valeurs.length})</span>
        <BoutonsChamp chemin={chemin} npc={npc} onChange={onChange} onRegen={onRegen} />
      </div>
      {valeurs.length > 0 && (
        <ul className="space-y-1">
          {valeurs.map((valeur, index) => (
            <li key={`${valeur}-${index}`} className="flex gap-1 items-start">
              <input
                value={valeur}
                onChange={(e) => ecrire(valeurs.map((v, i) => (i === index ? e.target.value : v)))}
                className="flex-1 bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => ecrire(valeurs.filter((_, i) => i !== index))}
                className="px-2 py-1 rounded bg-zinc-800 text-xs text-red-300"
                aria-label={`Retirer ${valeur}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && saisie.trim()) {
              ecrire([...valeurs, saisie.trim()]);
              setSaisie("");
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={() => {
            if (!saisie.trim()) return;
            ecrire([...valeurs, saisie.trim()]);
            setSaisie("");
          }}
          disabled={!saisie.trim()}
          className="px-2 py-1 rounded bg-zinc-800 text-xs disabled:opacity-40"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}

function ChampTags({
  npc,
  onChange,
  onRegen,
}: {
  npc: NpcGen;
  onChange: (npc: NpcGen) => void;
  onRegen?: (chemin: string) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const ajouter = () => {
    const valeurs = saisie.split(",").map((t) => t.trim()).filter(Boolean);
    if (valeurs.length === 0) return;
    const fusion = [...npc.tags];
    valeurs.forEach((v) => {
      if (!fusion.some((t) => t.toLowerCase() === v.toLowerCase())) fusion.push(v);
    });
    onChange(modifierChamp(npc, "tags", fusion));
    setSaisie("");
  };
  return (
    <div className="text-sm">
      <div className="flex items-center gap-1">
        <span className="text-zinc-400">Tags ({npc.tags.length})</span>
        <BoutonsChamp chemin="tags" npc={npc} onChange={onChange} onRegen={onRegen} />
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {npc.tags.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300">
            {tag}
            <button
              type="button"
              onClick={() => onChange(modifierChamp(npc, "tags", npc.tags.filter((t) => t !== tag)))}
              className="ml-1 text-zinc-500 hover:text-red-300"
              aria-label={`Retirer le tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ajouter()}
          placeholder="tag1, tag2…"
          className="flex-1 bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs"
        />
        <button type="button" onClick={ajouter} className="px-2 py-1 rounded bg-zinc-800 text-xs">+</button>
      </div>
    </div>
  );
}

function RelationsEditeur({
  npc,
  onChange,
}: {
  npc: NpcGen;
  onChange: (npc: NpcGen) => void;
}) {
  const [nom, setNom] = useState("");
  const [type, setType] = useState("Allié");
  const [description, setDescription] = useState("");
  const maj = (relations: NpcRelation[]) => onChange(modifierChamp(npc, "relations", relations));
  const ajouter = () => {
    if (!nom.trim()) return;
    maj([
      ...npc.relations,
      {
        id: `rel-${Date.now().toString(36)}-${npc.relations.length}`,
        nom: nom.trim(),
        type: type.trim() || "Relation",
        intensite: 1,
        description: description.trim(),
        publique: true,
      },
    ]);
    setNom("");
    setDescription("");
    setType("Allié");
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="text-zinc-400">Relations ({npc.relations.length})</div>
      {npc.relations.map((relation, index) => (
        <div key={relation.id} className="rounded border border-zinc-800 bg-zinc-950/40 p-2 grid sm:grid-cols-[1fr_120px_80px_auto] gap-1">
          <input value={relation.nom} onChange={(e) => maj(npc.relations.map((x, i) => i === index ? { ...x, nom: e.target.value } : x))} className="bg-zinc-900 rounded px-2 py-1 text-xs" placeholder="Nom" />
          <input value={relation.type} onChange={(e) => maj(npc.relations.map((x, i) => i === index ? { ...x, type: e.target.value } : x))} className="bg-zinc-900 rounded px-2 py-1 text-xs" placeholder="Type" />
          <select value={relation.intensite} onChange={(e) => maj(npc.relations.map((x, i) => i === index ? { ...x, intensite: Number(e.target.value) as NpcRelation["intensite"] } : x))} className="bg-zinc-900 rounded px-2 py-1 text-xs">
            {[-3, -2, -1, 0, 1, 2, 3].map((n) => <option key={n} value={n}>{n > 0 ? `+${n}` : n}</option>)}
          </select>
          <button type="button" onClick={() => maj(npc.relations.filter((_, i) => i !== index))} className="px-2 py-1 rounded bg-zinc-800 text-xs text-red-300" aria-label="Supprimer la relation">✕</button>
          <input value={relation.description} onChange={(e) => maj(npc.relations.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} className="sm:col-span-4 bg-zinc-900 rounded px-2 py-1 text-xs" placeholder="Description (publique ou secrète)" />
          <label className="sm:col-span-4 flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={relation.publique} onChange={(e) => maj(npc.relations.map((x, i) => i === index ? { ...x, publique: e.target.checked } : x))} />
            Relation connue publiquement
          </label>
        </div>
      ))}
      <div className="grid sm:grid-cols-[1fr_120px_1fr_auto] gap-1">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom ou description" className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs" />
        <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1 text-xs" />
        <button type="button" onClick={ajouter} disabled={!nom.trim()} className="px-2 py-1 rounded bg-zinc-800 text-xs disabled:opacity-40">+ Relation</button>
      </div>
    </div>
  );
}

function BlocCombat({
  npc,
  statBlock,
  monsters = [],
  onChange,
  onGenererEstimation,
}: {
  npc: NpcGen;
  statBlock?: NpcStatBlock;
  monsters?: MonsterTemplate[];
  onChange?: (bloc: NpcStatBlock | undefined) => void;
  onGenererEstimation?: () => void;
}) {
  const [monstreId, setMonstreId] = useState("");
  const [attaqueNom, setAttaqueNom] = useState("");
  const [attaqueBonus, setAttaqueBonus] = useState("2");
  const [attaqueDegats, setAttaqueDegats] = useState("1d6");

  if (!statBlock) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-zinc-400">Aucun profil de combat. Le PNJ est narratif ; aucun bloc n&apos;est nécessaire.</p>
        <div className="flex flex-wrap gap-2 items-end">
          {onGenererEstimation && (
            <button type="button" onClick={onGenererEstimation} className="px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
              Générer une estimation
            </button>
          )}
          {monsters.length > 0 && onChange && (
            <>
              <label className="text-xs text-zinc-400">
                Copier depuis le bestiaire
                <select value={monstreId} onChange={(e) => setMonstreId(e.target.value)} className={`${input} mt-1`}>
                  <option value="">Choisir une créature…</option>
                  {monsters.map((m) => <option key={m.id} value={m.id}>{m.nom} (NC {m.niveau})</option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={!monstreId}
                onClick={() => {
                  const monstre = monsters.find((m) => m.id === monstreId);
                  if (monstre) onChange(statBlockDepuisMonstre(monstre, npc.id));
                }}
                className="px-3 py-1.5 rounded bg-amber-400 text-black text-xs font-bold disabled:opacity-40"
              >
                Utiliser ce profil
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const maj = (partiel: Partial<NpcStatBlock>) => onChange?.({ ...statBlock, ...partiel, updatedAt: new Date().toISOString() });
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${statBlock.source === "bestiaire" ? "text-emerald-300" : "text-amber-300"}`}>
          {libelleSourceStatBlock(statBlock)}
        </p>
        {onChange && (
          <button type="button" onClick={() => onChange(undefined)} className="text-xs px-2 py-1 rounded bg-zinc-800 text-red-300">
            Retirer le bloc de combat
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label>Niveau<input type="number" value={statBlock.niveau} onChange={(e) => maj({ niveau: Number(e.target.value) })} className={input} /></label>
        <label>PV<input type="number" min={1} value={statBlock.pv} onChange={(e) => maj({ pv: Math.max(1, Number(e.target.value)) })} className={input} /></label>
        <label>Défense<input type="number" value={statBlock.defense} onChange={(e) => maj({ defense: Number(e.target.value) })} className={input} /></label>
        <label>Init.<input type="number" value={statBlock.initMod} onChange={(e) => maj({ initMod: Number(e.target.value) })} className={input} /></label>
      </div>
      <div>
        <div className="text-xs uppercase text-zinc-500 mb-1">Attaques</div>
        {statBlock.attaques.map((a, i) => (
          <div key={a.id} className="grid sm:grid-cols-[1fr_70px_100px_auto] gap-1 mb-1">
            <input value={a.nom} onChange={(e) => maj({ attaques: statBlock.attaques.map((x, j) => j === i ? { ...x, nom: e.target.value } : x) })} className={input} />
            <input type="number" value={a.bonus} onChange={(e) => maj({ attaques: statBlock.attaques.map((x, j) => j === i ? { ...x, bonus: Number(e.target.value) } : x) })} className={input} />
            <input value={a.degats} onChange={(e) => maj({ attaques: statBlock.attaques.map((x, j) => j === i ? { ...x, degats: e.target.value } : x) })} className={input} />
            <button type="button" onClick={() => maj({ attaques: statBlock.attaques.filter((_, j) => j !== i) })} className="px-2 rounded bg-zinc-800 text-xs text-red-300" aria-label="Supprimer l'attaque">✕</button>
          </div>
        ))}
        <div className="grid sm:grid-cols-[1fr_70px_100px_auto] gap-1">
          <input value={attaqueNom} onChange={(e) => setAttaqueNom(e.target.value)} placeholder="Nouvelle attaque" className={input} />
          <input type="number" value={attaqueBonus} onChange={(e) => setAttaqueBonus(e.target.value)} className={input} />
          <input value={attaqueDegats} onChange={(e) => setAttaqueDegats(e.target.value)} className={input} />
          <button
            type="button"
            disabled={!attaqueNom.trim()}
            onClick={() => {
              maj({
                attaques: [...statBlock.attaques, {
                  id: `atk-${Date.now().toString(36)}`, nom: attaqueNom.trim(),
                  bonus: Number(attaqueBonus) || 0, degats: attaqueDegats.trim() || "1d6",
                }],
              });
              setAttaqueNom("");
            }}
            className="px-2 rounded bg-zinc-800 text-xs disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <label className="block">Capacités de combat (une par ligne)
        <textarea
          rows={3}
          value={statBlock.capacites.join("\n")}
          onChange={(e) => maj({ capacites: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })}
          className={`${input} mt-1`}
        />
      </label>
      <label className="block">Notes de combat
        <textarea rows={2} value={statBlock.notes} onChange={(e) => maj({ notes: e.target.value })} className={`${input} mt-1`} />
      </label>
    </div>
  );
}

export function NpcFiche({
  npc,
  onChange,
  entries,
  tables,
  factions,
  monsters = [],
  statBlock,
  onStatBlockChange,
  onGenererEstimation,
  onRegen,
  warnings = [],
}: Props) {
  const especes = useMemo(() => valeursTable(entries, "especes"), [entries]);
  const cultures = useMemo(() => valeursTable(entries, "cultures"), [entries]);
  const sexes = useMemo(() => valeursTable(entries, "sexes"), [entries]);
  const professions = useMemo(() => valeursTable(entries, "professions"), [entries]);
  const niveaux = useMemo(() => valeursTable(entries, "niveaux_sociaux"), [entries]);
  const importances = useMemo(() => valeursTable(entries, "importances"), [entries]);
  const lieux = useMemo(() => valeursTable(entries, "lieux"), [entries]);
  const titreSection = "font-display font-bold text-gold-300 tracking-wide border-b border-bronze-700 pb-1";

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded border border-amber-700/60 bg-amber-950/20 p-2 text-xs text-amber-200 space-y-0.5">
          {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}

      <section className="space-y-2">
        <h3 className={titreSection}>Identité</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <ChampTexte npc={npc} label="Prénom" chemin="prenom" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Nom de famille" chemin="nomFamille" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Nom complet" chemin="nom" onChange={onChange} />
          <ChampTexte npc={npc} label="Titre / surnom" chemin="titre" onChange={onChange} />
          <ChampSelect npc={npc} label="Espèce" chemin="espece" options={especes} onChange={onChange} onRegen={onRegen} />
          <ChampSelect npc={npc} label="Culture" chemin="culture" options={cultures} onChange={onChange} onRegen={onRegen} />
          <ChampSelect npc={npc} label="Sexe" chemin="sexe" options={sexes} onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Âge" chemin="age" type="number" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Taille (cm)" chemin="tailleCm" type="number" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Poids (kg)" chemin="poidsKg" type="number" onChange={onChange} onRegen={onRegen} />
          <ChampSelect npc={npc} label="Profession" chemin="profession" options={professions} onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Rôle affiché" chemin="role" onChange={onChange} />
          <ChampTexte npc={npc} label="Catégorie de profession" chemin="categorieProfession" onChange={onChange} />
          <ChampSelect npc={npc} label="Niveau social" chemin="niveauSocial" options={niveaux} onChange={onChange} onRegen={onRegen} />
          <ChampSelect npc={npc} label="Importance" chemin="importance" options={importances} onChange={onChange} onRegen={onRegen} />
          <ChampSelect
            npc={npc}
            label="Faction"
            chemin="factionId"
            options={["", ...factions.filter((f) => f.actif).map((f) => f.id)]}
            labels={{
              "": "Aucune faction",
              ...Object.fromEntries(factions.map((f) => [f.id, f.nom])),
            }}
            onChange={(n) => {
              const faction = factions.find((f) => f.id === n.factionId);
              onChange({ ...n, factionNom: faction?.nom ?? "" });
            }}
            onRegen={onRegen}
          />
          <ChampSelect npc={npc} label="Lieu" chemin="lieu" options={lieux} onChange={onChange} onRegen={onRegen} />
          <div className="sm:col-span-2"><ChampTags npc={npc} onChange={onChange} onRegen={onRegen} /></div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Apparence et présence</h3>
        <ChampZone npc={npc} label="Description" chemin="description" rows={3} onChange={onChange} onRegen={onRegen} />
        <ChampZone npc={npc} label="Apparence" chemin="apparence" rows={2} onChange={onChange} onRegen={onRegen} />
        <div className="grid sm:grid-cols-2 gap-2">
          <ChampTexte npc={npc} label="Maintien" chemin="maintien" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Voix" chemin="voix" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Vêtements" chemin="vetements" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Gestes" chemin="gestes" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Signes distinctifs" chemin="signesDistinctifs" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Particularités" chemin="particularites" onChange={onChange} onRegen={onRegen} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Personnalité</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <ListeEditable npc={npc} label="Traits positifs" chemin="personnalite.traitsPositifs" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Traits négatifs" chemin="personnalite.traitsNegatifs" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Traits ambivalents" chemin="personnalite.traitsAmbivalents" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Qualités morales" chemin="personnalite.qualitesMorales" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Défauts" chemin="personnalite.defauts" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Peurs" chemin="personnalite.peurs" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Préjugés" chemin="personnalite.prejuges" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Habitudes" chemin="personnalite.habitudes" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Tics verbaux" chemin="personnalite.ticsVerbaux" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Expressions" chemin="personnalite.expressions" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Sous pression" chemin="personnalite.reactionsPression" onChange={onChange} onRegen={onRegen} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <ChampTexte npc={npc} label="Attitude — autorité" chemin="personnalite.attitudeAutorite" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Attitude — danger" chemin="personnalite.attitudeDanger" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Attitude — argent" chemin="personnalite.attitudeArgent" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Attitude — magie" chemin="personnalite.attitudeMagie" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Style — négociation" chemin="personnalite.styleNegociation" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Style — mensonge" chemin="personnalite.styleMensonge" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Style — séduction" chemin="personnalite.styleSeduction" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Style — menace" chemin="personnalite.styleMenace" onChange={onChange} onRegen={onRegen} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Motivations et secrets</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <ChampTexte npc={npc} label="Objectif immédiat" chemin="motivations.objectifImmediat" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Ambition" chemin="motivations.ambition" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Désir" chemin="motivations.desir" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Besoin" chemin="motivations.besoin" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Problème actuel" chemin="motivations.probleme" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Dette" chemin="motivations.dette" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Regret" chemin="motivations.regret" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Conflit" chemin="motivations.conflit" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Objet recherché" chemin="motivations.objetRecherche" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Personne protégée" chemin="motivations.personneProtegee" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Personne recherchée" chemin="motivations.personneRecherchee" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Rumeur" chemin="motivations.rumeur" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Opportunité" chemin="motivations.opportunite" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Raison de coopérer" chemin="motivations.raisonCooperation" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Raison de s'opposer" chemin="motivations.raisonOpposition" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Mensonge / version officielle" chemin="motivations.mensonge" onChange={onChange} onRegen={onRegen} />
        </div>
        <ChampZone npc={npc} label="Secret MJ" chemin="motivations.secret" rows={3} onChange={onChange} onRegen={onRegen} />
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Roleplay</h3>
        <ChampZone npc={npc} label="Accroche de scène" chemin="roleplay.accroche" rows={2} onChange={onChange} onRegen={onRegen} />
        <div className="grid sm:grid-cols-2 gap-2">
          <ChampTexte npc={npc} label="Attitude initiale" chemin="roleplay.attitudeInitiale" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Raison de l'attitude" chemin="roleplay.raisonAttitude" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Première réaction" chemin="roleplay.premiereReaction" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Offre" chemin="roleplay.offre" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Demande" chemin="roleplay.demande" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Levier" chemin="roleplay.levier" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Déclencheur d'hostilité" chemin="roleplay.declencheurHostilite" onChange={onChange} onRegen={onRegen} />
          <ChampTexte npc={npc} label="Fuite / retraite" chemin="roleplay.fuite" onChange={onChange} onRegen={onRegen} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Équipement</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <ListeEditable npc={npc} label="Équipement" chemin="equipement" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Objets de valeur" chemin="objetsValeurs" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Objets personnels" chemin="objetsPersonnels" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Objets suspects" chemin="objetsSuspects" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Objets magiques" chemin="objetsMagiques" onChange={onChange} onRegen={onRegen} />
          <ListeEditable npc={npc} label="Documents" chemin="documents" onChange={onChange} onRegen={onRegen} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Relations</h3>
        <RelationsEditeur npc={npc} onChange={onChange} />
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Combat (optionnel)</h3>
        <BlocCombat npc={npc} statBlock={statBlock} monsters={monsters} onChange={onStatBlockChange} onGenererEstimation={onGenererEstimation} />
      </section>

      <section className="space-y-2">
        <h3 className={titreSection}>Notes du MJ</h3>
        <ChampZone npc={npc} label="Notes privées" chemin="notesMJ" rows={3} onChange={onChange} />
        <p className="text-[11px] text-zinc-600">Graine : {npc.seed || "—"} · Version {npc.version} · Modifié {npc.updatedAt ? new Date(npc.updatedAt).toLocaleString("fr-FR") : "—"}</p>
      </section>
    </div>
  );
}

/** Petite fiche de lecture, utilisée dans les listes. */
export function resumeCourt(npc: NpcGen): string {
  return [nomComplet(npc.prenom, npc.nomFamille), npc.profession, npc.espece].filter(Boolean).join(" · ");
}
