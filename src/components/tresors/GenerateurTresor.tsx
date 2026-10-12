"use client";
import { useState } from "react";
import {
  CATEGORIES_OBJETS_MAGIQUES,
  PALIERS_MAGIQUES,
  TYPES_OBJETS_MAGIQUES,
  formaterPlage,
  type PalierMagique,
} from "@/src/lib/rules/objetsMagiques";
import {
  ARMES_CONTACT,
  ARMES_DISTANCE,
  NIVEAU_PROPRIETE,
  PROPRIETES_CONTACT,
  PROPRIETES_DISTANCE,
  REGLE_PROJECTILES,
  TYPES_ARME_MAGIQUE,
} from "@/src/lib/rules/armesMagiques";
import {
  ARMURES_MAGIQUES,
  PROPRIETES_ARMURES,
} from "@/src/lib/rules/armuresMagiques";
import {
  FORMES_PUISSANCE,
  LEGENDE_CARACS_MINEURES,
  TABLE_PUISSANCE,
} from "@/src/lib/rules/puissance";
import {
  CATEGORIES_POTION,
  EFFETS_POTIONS,
  USAGE_POTION,
} from "@/src/lib/rules/potions";
import {
  RANGS_PARCHEMIN,
  USAGE_PARCHEMIN,
  VOIES_PARCHEMIN,
} from "@/src/lib/rules/parchemins";
import { USAGE_BAGUETTE } from "@/src/lib/rules/baguettes";
import {
  TABLE_TRESORS,
  formaterJet,
  formaterPa,
  formaterRepartition,
  formaterTest,
  genererTresor,
  type ResultatTresor,
} from "@/src/lib/rules/tresors";
import { VersementTresor } from "@/src/components/tresors/VersementTresor";
import { AttributionObjet } from "@/src/components/tresors/AttributionObjet";

const MAGIQUE_LABEL = { mineur: "mineurs", moyen: "moyens", majeur: "majeurs" } as const;

function LigneMagique({ tests, succes, seuil }: { tests: number[]; succes: number; seuil: number }) {
  return (
    <span className="font-mono">
      {tests.map((j, i) => (
        <span key={i}>
          {i > 0 && ", "}
          <span className={j >= seuil ? "text-green-300 font-bold" : "text-zinc-500"}>
            {j}{j >= seuil ? " ✓" : ""}
          </span>
        </span>
      ))}
      {" → "}
      <b className={succes > 0 ? "text-amber-300" : undefined}>{succes}</b>
    </span>
  );
}

export function GenerateurTresor() {
  const [niveau, setNiveau] = useState(8);
  const [dernier, setDernier] = useState<ResultatTresor | null>(null);
  const [historique, setHistorique] = useState<ResultatTresor[]>([]);

  const generer = () => {
    const r = genererTresor(niveau);
    setDernier(r);
    setHistorique((h) => [r, ...h].slice(0, 20));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-end">
          <label className="block text-sm flex-1 min-w-52">Niveau de trésor
            <select
              value={niveau}
              onChange={(e) => setNiveau(Number(e.target.value))}
              className="mt-1 w-full bg-zinc-800 rounded px-2 py-2 text-sm font-mono"
            >
              {TABLE_TRESORS.map((l) => (
                <option key={l.niveau} value={l.niveau}>
                  Niv. {l.label} — {formaterJet(l.monetaire)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={generer} className="px-5 py-2 rounded bg-amber-400 text-black font-bold">
            Générer
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          100 pa = 10 po = 1 pp · Joyaux testés au d20 jusqu&apos;au niv. 9, automatiques dès le niv. 10 ·
          Objets magiques : un objet différent par succès.
        </p>
      </div>

      {dernier && (
        <div className="rounded-lg border border-amber-400/50 bg-zinc-900 p-4 space-y-2.5">
          <h2 className="font-bold">Trésor de niveau {dernier.label}</h2>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase text-zinc-500">Monétaire ({dernier.monetaire.formule} : [{dernier.monetaire.jets.join(", ")}])</div>
            <div className="font-bold text-lg font-mono">{formaterPa(dernier.monetaire.totalPa)}</div>
            <div className="text-xs text-zinc-400">≈ {formaterRepartition(dernier.monetaire.repartition)} (indicatif : le MJ répartit librement)</div>
          </div>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase text-zinc-500">Joyaux, bijoux, orfèvrerie</div>
            {dernier.joyaux.present && dernier.joyaux.gain ? (
              <>
                <div className="font-bold font-mono">{formaterPa(dernier.joyaux.gain.totalPa)}</div>
                <div className="text-xs text-zinc-400">
                  {dernier.joyaux.tests.length > 0 ? `d20 : ${dernier.joyaux.tests.join(", ")} ✓ · ` : "Automatique (niv. 10+) · "}
                  {dernier.joyaux.gain.formule} : [{dernier.joyaux.gain.jets.join(", ")}]
                </div>
              </>
            ) : (
              <div className="text-zinc-500">Aucun{dernier.joyaux.tests.length > 0 && ` (d20 : ${dernier.joyaux.tests.join(", ")})`}</div>
            )}
          </div>
          <div className="rounded bg-zinc-950 border border-zinc-800 p-3 text-sm space-y-1">
            <div className="text-[11px] uppercase text-zinc-500">Objets magiques</div>
            {dernier.magiques.length === 0 && <div className="text-zinc-500">Aucun test à ce niveau.</div>}
            {dernier.magiques.map((m) => {
              const ligne = TABLE_TRESORS.find((l) => l.niveau === dernier.niveau)!;
              const objets = dernier.objets.filter((o) => o.palier === m.type);
              return (
                <div key={m.type} className="space-y-0.5">
                  <div>
                    {m.succes > 0 ? "✦ " : "· "}{m.succes} objet(s) {MAGIQUE_LABEL[m.type]}{" "}
                    <span className="text-zinc-500 text-xs">({formaterTest(ligne[m.type])} : </span>
                    <LigneMagique tests={m.tests} succes={m.succes} seuil={ligne[m.type]!.seuil} />
                    <span className="text-zinc-500 text-xs">)</span>
                  </div>
                  {objets.map((o, i) => (
                    <div key={i} className="ml-4 text-zinc-200">
                      <div>✦ {o.label} <span className="text-zinc-500 text-xs">({o.detail})</span></div>
                      <AttributionObjet objet={o} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <VersementTresor resultat={dernier} />
        </div>
      )}

      {historique.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-1">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm uppercase text-zinc-400">Historique ({historique.length})</h2>
            <button onClick={() => { setHistorique([]); setDernier(null); }} className="text-xs text-zinc-500 underline">Effacer</button>
          </div>
          {historique.map((r, i) => (
            <button
              key={`${r.label}-${i}`}
              onClick={() => setDernier(r)}
              className="block w-full text-left text-xs font-mono text-zinc-400 hover:text-zinc-200"
            >
              Niv. {r.label} : {formaterPa(r.monetaire.totalPa)}
              {r.joyaux.gain ? ` + joyaux ${formaterPa(r.joyaux.gain.totalPa)}` : ""}
              {r.objets.length > 0 ? ` ✦ ${r.objets.map((o) => o.label).join(", ")}` : ""}
            </button>
          ))}
        </div>
      )}

      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Table de référence (trésors)</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs font-mono">
            <thead className="text-zinc-500 uppercase">
              <tr>
                <th className="text-left px-2 py-1">Niv.</th>
                <th className="text-left px-2 py-1">Monétaire</th>
                <th className="text-left px-2 py-1">Joyaux</th>
                <th className="text-left px-2 py-1">Mineur</th>
                <th className="text-left px-2 py-1">Moyen</th>
                <th className="text-left px-2 py-1">Majeur</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_TRESORS.map((l) => (
                <tr key={l.niveau} className="border-t border-zinc-800/60">
                  <td className="px-2 py-1 text-amber-300 font-bold">{l.label}</td>
                  <td className="px-2 py-1">{formaterJet(l.monetaire)}</td>
                  <td className="px-2 py-1">{l.joyauxTest ? `${formaterTest(l.joyauxTest)} ${formaterJet(l.joyauxGain)}` : formaterJet(l.joyauxGain)}</td>
                  <td className="px-2 py-1">{formaterTest(l.mineur)}</td>
                  <td className="px-2 py-1">{formaterTest(l.moyen)}</td>
                  <td className="px-2 py-1">{formaterTest(l.majeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (objets magiques)</summary>
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          {(PALIERS_MAGIQUES as PalierMagique[]).map((p) => (
            <div key={p} className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">
                Objet {p} — type (1d12)
              </div>
              <div className="space-y-0.5 text-xs font-mono">
                {TYPES_OBJETS_MAGIQUES[p].plages.map((pl) => (
                  <div key={pl.label}>
                    <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                  </div>
                ))}
              </div>
              <div className="text-xs uppercase text-amber-300 font-bold mt-3 mb-1.5">
                Catégorie (1d{CATEGORIES_OBJETS_MAGIQUES[p].de})
              </div>
              <div className="space-y-0.5 text-xs font-mono">
                {CATEGORIES_OBJETS_MAGIQUES[p].plages.map((pl) => (
                  <div key={pl.label}>
                    <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (potions)</summary>
        <p className="text-[11px] text-zinc-500 mt-1">
          {USAGE_POTION} Les potions moyennes contiennent trois doses du même contenu, à consommer indépendamment.
        </p>
        <div className="grid md:grid-cols-2 gap-3 mt-2">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Catégorie (1d6)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {CATEGORIES_POTION.plages.map((pl) => (
                <div key={pl.label}>
                  <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                </div>
              ))}
            </div>
          </div>
          {(
            [
              ["Soins (1d6)", EFFETS_POTIONS.soins],
              ["Communes (1d10)", EFFETS_POTIONS.commune],
              ["Rares (1d20)", EFFETS_POTIONS.rare],
            ] as const
          ).map(([titre, table]) => (
            <div key={titre} className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Potions {titre}</div>
              <div className="space-y-0.5 text-xs font-mono">
                {table.effets.map((e) => (
                  <div key={e.nom}>
                    <span className="text-zinc-500">{formaterPlage(e.min, e.max)} :</span> {e.nom}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">* : sorts de Prêtre (note du livre).</p>
      </details>

      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (parchemins)</summary>
        <p className="text-[11px] text-zinc-500 mt-1">{USAGE_PARCHEMIN}</p>
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          {(["mineur", "moyen"] as const).map((p) => (
            <div key={p} className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">
                Rang du sort — objet {p} (1d6)
              </div>
              <div className="space-y-0.5 text-xs font-mono">
                {RANGS_PARCHEMIN[p].plages.map((pl) => (
                  <div key={pl.rang}>
                    <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> rang {pl.rang}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Voie du sort (1d20)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {VOIES_PARCHEMIN.plages.map((pl) => (
                <div key={pl.min}>
                  <span className="text-zinc-500">{pl.min} :</span> {pl.voie}{" "}
                  <span className="text-zinc-600">({pl.profil})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          Voie sans sort au rang tiré (astérisque) : relancer le d20. Le sort est
          choisi dans le grimoire de l&apos;onglet Sorts.
        </p>
        <p className="text-[11px] text-zinc-500 mt-1">
          <b className="text-zinc-300">Baguettes</b> : {USAGE_BAGUETTE} Mêmes tables
          de rang et de voie que les parchemins.
        </p>
      </details>
      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (armes magiques)</summary>
        <p className="text-[11px] text-zinc-500 mt-1">
          Bonus +N en attaque et aux DM (= niveau N de l&apos;objet). Niveau de magie = bonus +
          propriétés. Propriété si 1d6 &lt; niveau. 11-12 : deux tirages fusionnés si identiques (doublée).
        </p>
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Type d&apos;arme (1d6)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {TYPES_ARME_MAGIQUE.plages.map((pl) => (
                <div key={pl.label}>
                  <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Sceptre : DM 1d6 comme un bâton, bonus en attaque magique et DM des sorts.</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Propriétés contact (1d12)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {PROPRIETES_CONTACT.plages.map((pl) => (
                <div key={pl.label}>
                  <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Propriétés distance (1d12)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {PROPRIETES_DISTANCE.plages.map((pl) => (
                <div key={pl.label}>
                  <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">De précision = Affûtée à distance (crit +1, +1d4°, niveau +1).</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Bases contact (1d20)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {ARMES_CONTACT.armes.map((e) => (
                <div key={e.nom}>
                  <span className="text-zinc-500">{formaterPlage(e.min, e.max)} :</span> {e.nom}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Bases distance (1d20)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {ARMES_DISTANCE.armes.map((e) => (
                <div key={e.nom}>
                  <span className="text-zinc-500">{formaterPlage(e.min, e.max)} :</span> {e.nom}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Niveaux des propriétés</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div><span className="text-zinc-500">Affûtée :</span> +{NIVEAU_PROPRIETE.affutee} (crit +1, +1d4° aux critiques)</div>
              <div><span className="text-zinc-500">Fléau :</span> +{NIVEAU_PROPRIETE.fleau} (+1d4° vs catégorie)</div>
              <div><span className="text-zinc-500">Élément :</span> +{NIVEAU_PROPRIETE.element} (+1d4° d&apos;élément)</div>
              <div><span className="text-zinc-500">Parade :</span> +N DEF, simple et cumulable (10 % au tirage)</div>
              <div><span className="text-zinc-500">Doublée :</span> dés et niveau ×2</div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">{REGLE_PROJECTILES}</p>
          </div>
        </div>
      </details>
      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (armures magiques)</summary>
        <p className="text-[11px] text-zinc-500 mt-1">
          Bonus +N = niveau N (supposition). Un seul bonus magique retenu (le plus haut) ; bouclier et armure
          non cumulés (bonus inutilisé → RD critiques si MJ). Propriété si 1d6 &lt; niveau (1 chacune, supérieure +2).
        </p>
        <div className="grid md:grid-cols-2 gap-3 mt-2">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Bases (1d20)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {ARMURES_MAGIQUES.armures.map((e) => (
                <div key={e.nom}>
                  <span className="text-zinc-500">{formaterPlage(e.min, e.max)} :</span> {e.nom}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Propriétés (1d12)</div>
            <div className="space-y-0.5 text-xs font-mono">
              {PROPRIETES_ARMURES.plages.map((pl) => (
                <div key={pl.label}>
                  <span className="text-zinc-500">{formaterPlage(pl.min, pl.max)} :</span> {pl.label}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              12 : deux tirages (fusionnés si identiques : deux défenses = supérieure), ou doublée / spéciale (MJ,
              ex. robe d&apos;Image décalée). Défense : RD 2 (+1), supérieure RD 4 (+2). Résistances : X au choix du MJ.
            </p>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <summary className="font-bold text-sm uppercase text-zinc-400 cursor-pointer">Tables de référence (pouvoir et puissance)</summary>
        <p className="text-[11px] text-zinc-500 mt-1">
          Pouvoir : calqué sur des capacités de lanceur, 1/jour en général (parfois permanent), forme en rapport
          avec son pouvoir. Puissance : bonus 1-2 au d2 (mineures DR/PC 1-2, PM 3/6, PV 5/10) ; niveau = bonus × 3
          (mineurs : DR/PC 1 par point, PM 1 par tranche de 3, PV 1 par tranche de 5).
        </p>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 mt-2">
          <div className="text-xs uppercase text-amber-300 font-bold mb-1.5">Puissance — caractéristique (1d12)</div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="space-y-0.5 text-xs font-mono">
              {TABLE_PUISSANCE.plages.filter((p) => p.carac !== "relancer").map((p) => (
                <div key={p.carac}>
                  <span className="text-zinc-500">{formaterPlage(p.min, p.max)} :</span> {p.carac}
                  {FORMES_PUISSANCE[p.carac] ? ` (${FORMES_PUISSANCE[p.carac]})` : ` (${LEGENDE_CARACS_MINEURES[p.carac]}, mineur)`}
                </div>
              ))}
            </div>
            <div className="space-y-0.5 text-xs font-mono">
              <div><span className="text-zinc-500">12 :</span> relancer</div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
