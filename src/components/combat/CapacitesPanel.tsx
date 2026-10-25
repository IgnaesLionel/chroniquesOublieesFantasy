"use client";
import { useState } from "react";
import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import type { MonsterTemplate } from "@/src/lib/rules/types";
import { CAPACITES_USABLES, talentsLancables } from "@/src/lib/data/capacites-usables";
import { ACTION_LETTER, actionDeTalent, infererAction } from "@/src/lib/data/capacites";
import { EFFECT_CATALOG } from "@/src/lib/rules/effects/catalog";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";
import { canAct } from "@/src/lib/rules/effects/effects";
import { estCadavre, profilAnimable, NC_MAX_ANIMATION } from "@/src/lib/rules/combat/attack";
import { PopupValidationMJ } from "@/src/components/combat/PopupValidationMJ";
import { mjDejaValide } from "@/src/lib/ui/validations-mj";
import { familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";
import { ActionBadge } from "@/src/components/ui/ActionBadge";

interface Props {
  participants: CombatParticipant[];
  lanceurId: string | null;
  /**
   * Profils du bestiaire proposés comme cadavres (Animer un cadavre : NC ≤ 2,
   * le MJ choisit la créature morte relevée). Absent = cadavres du combat seuls.
   */
  profils?: MonsterTemplate[];
  onUtiliser: (
    lanceurId: string,
    cibleId: string,
    talentNom: string,
    opts: {
      effetCle: string | null;
      dureeTours: number | null;
      mods: Record<string, number> | undefined;
      coutPV: string | undefined;
      actionSpeciale: "renvoi" | "proteger" | "vigueur" | "lien-empathique" | "animer" | undefined;
      soin: string | undefined;
      soinFixe: number | undefined;
      nettoie: boolean | undefined;
      outrepasserSoin: boolean | undefined;
      modeVigueur: "auto" | "test" | undefined;
      lienMontant: number | undefined;
      /** Cadavre relevé depuis un profil du bestiaire (id du template, action « animer »). */
      profilId: string | undefined;
    }
  ) => void;
  /** Trace « MJ a validé » au journal de combat. */
  onLogMJ?: (message: string) => void;
}

function defautPour(nom: string) {
  const q = normaliserNomCapacite(nom);
  return CAPACITES_USABLES.find((u) => normaliserNomCapacite(u.talent) === q);
}

export function CapacitesPanel({ participants, lanceurId, profils, onUtiliser, onLogMJ }: Props) {
  const lanceur = participants.find((p) => p.instanceId === lanceurId) ?? null;
  const [talentNom, setTalentNom] = useState<string | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  /** Cadavre choisi pour « Animer un cadavre » : "cadavre:<instanceId>" ou "profil:<templateId>". */
  const [cadavreChoisi, setCadavreChoisi] = useState<string | null>(null);
  const [effetCle, setEffetCle] = useState<string>("");
  const [duree, setDuree] = useState<string>("");
  const [montant, setMontant] = useState<string>("");
  const [modeVigueur, setModeVigueur] = useState<"auto" | "test">("auto");
  const [outrepasserSoin, setOutrepasserSoin] = useState(false);
  /** Question MJ en attente (pop-up ouverte) : bloque la résolution. */
  const [attenteMj, setAttenteMj] = useState<{ cle: string; question: string; note?: string } | null>(null);

  if (!lanceur) return null;
  // Passifs, manœuvres du panneau Attaque et talents narratifs exclus :
  // seules les capacités lançables (effet, coût, soin, purge, renvoi).
  const lancables = talentsLancables(lanceur.capacites);
  if (lancables.length === 0) return null;
  const talent = lancables.includes(talentNom ?? "") ? talentNom! : lancables[0];
  const defaut = defautPour(talent);
  /** Type d'action du talent : catalogue des voies, puis note mécanique. */
  const actionTalent = (nom: string) =>
    actionDeTalent(nom, lanceur.profil) ?? infererAction(defautPour(nom)?.note ?? "");
  const effetActif = effetCle || defaut?.effetCle || "";
  const dureeActive = duree !== "" ? Number(duree) : defaut?.dureeTours ?? null;
  const actifs = participants.filter((p) => p.statut === "actif");
  // Un soin peut relever un allié KO (le moteur repasse son statut à « actif »
  // dès que les PV remontent) ; les autres capacités exigent un allié actif.
  const soinCapacite = !!defaut?.soin || defaut?.montantMJ === "soin";
  const alliesCiblables = participants
    .filter((p) => p.camp === lanceur.camp && (p.statut === "actif" || (soinCapacite && p.statut === "ko")))
    .sort((a, b) => Number(b.statut === "actif") - Number(a.statut === "actif"));
  // Animer un cadavre : la « cible » n'est pas un participant actif mais un
  // cadavre de zombie — relevé sur place (hors combat, NC ≤ 2, jamais animé)
  // ou choisi dans le bestiaire (le MJ déclare un corps de zombie sur place).
  const estAnimer = normaliserNomCapacite(talent) === "animer un cadavre";
  /** Renvoi de sort : seule cible autorisée = le lanceur du sort absorbé. */
  const estRenvoi = defaut?.actionSpeciale === "renvoi";
  const cadavres = participants.filter((p) => p.instanceId !== lanceur.instanceId && estCadavre(p));
  const profilsCadavres = (profils ?? [])
    .filter((m) => profilAnimable(m))
    .sort((a, b) => (a.niveau - b.niveau) || a.nom.localeCompare(b.nom));
  const optionsCadavre = [
    ...cadavres.map((p) => ({
      valeur: `cadavre:${p.instanceId}`,
      groupe: "Cadavres du combat (zombies hors combat, NC ≤ 2)",
      label: `${p.nom} — NC ${p.niveau}${p.camp === lanceur.camp ? " · votre camp" : ""}`,
    })),
    ...profilsCadavres.map((m) => ({
      valeur: `profil:${m.id}`,
      groupe: "Bestiaire — zombies (corps trouvé sur place, NC ≤ 2)",
      label: `${m.nom} — NC ${m.niveau} · ${m.pvMax} PV`,
    })),
  ];
  const groupesCadavre = [...new Set(optionsCadavre.map((o) => o.groupe))];
  const cadavre = optionsCadavre.find((o) => o.valeur === cadavreChoisi)?.valeur
    ?? optionsCadavre[0]?.valeur ?? null;
  // Cibles proposées selon le type de capacité : "soi" = posture sur soi
  // (Parer, Absorber...), "allies" = alliés hors soi (Protéger...),
  // "ennemis" = camp adverse, "tous" = tout le monde. Renvoi de sort :
  // uniquement le lanceur mémorisé lors de l'absorption.
  const cibleRenvoi = lanceur.sortAbsorbe?.lanceurId ?? null;
  const ciblesPossibles = estRenvoi
    ? actifs.filter((p) => p.instanceId === cibleRenvoi)
    : defaut?.cibles === "soi"
      ? actifs.filter((p) => p.instanceId === lanceur.instanceId)
      : defaut?.cibles === "allies"
        ? alliesCiblables.filter((p) => p.instanceId !== lanceur.instanceId)
        : defaut?.cibles === "ennemis"
          ? actifs.filter((p) => p.camp !== lanceur.camp)
          : actifs;
  // Strict : pas de repli vers soi ou vers un ennemi. Si la liste est vide
  // (ex. Protéger sans allié actif), le bouton reste désactivé.
  const cibles = ciblesPossibles;
  const cible = cibles.find((p) => p.instanceId === cibleId)
    ?? cibles[0] ?? null;
  /** « Animer un cadavre » choisit dans `optionsCadavre`, les autres talents dans `cibles`. */
  const choixValide = estAnimer ? !!cadavre : !!cible;
  const choixVide = estAnimer ? !cadavre : cibles.length === 0;
  const bloque = !canAct(lanceur.effets);
  const estVigueur = normaliserNomCapacite(talent) === "vigueur divine";
  const estPhenix = normaliserNomCapacite(talent) === "phénix";
  const phenixUtilise = lanceur.usagesJournaliers?.["phénix"] ?? 0;

  /** Résolution de l'usage du talent (après validation MJ éventuelle). */
  const executerUtilisation = () => {
    if (estAnimer ? !cadavre : !cible) return;
    // « Animer un cadavre » : "cadavre:<instanceId>" (relevé sur place) ou
    // "profil:<templateId>" (cadavre trouvé sur place, entré en fin d'ordre).
    const sep = cadavre?.indexOf(":") ?? -1;
    const genre = sep >= 0 ? cadavre!.slice(0, sep) : "";
    const idCadavre = sep >= 0 ? cadavre!.slice(sep + 1) : "";
    const cibleIdEffectif = estAnimer
      ? (genre === "cadavre" ? idCadavre : "")
      : cible!.instanceId;
    if (defaut?.questionMJ) onLogMJ?.(`⚖️ MJ validé — ✨ ${talent} : ${defaut.questionMJ}`);
    const soinFixe = defaut?.montantMJ === "soin" && montant.trim() !== "" ? Number(montant) : undefined;
    const lienMontant = defaut?.montantMJ === "lien" && montant.trim() !== "" ? Number(montant) : undefined;
    onUtiliser(lanceur.instanceId, cibleIdEffectif, talent, {
      effetCle: effetActif || null,
      dureeTours: dureeActive,
      mods: defaut?.mods,
      coutPV: defaut?.coutPV,
      actionSpeciale: defaut?.actionSpeciale,
      soin: soinFixe !== undefined ? undefined : defaut?.soin,
      soinFixe,
      nettoie: estVigueur ? undefined : defaut?.nettoie,
      outrepasserSoin,
      modeVigueur: estVigueur ? modeVigueur : undefined,
      lienMontant,
      profilId: estAnimer && genre === "profil" ? idCadavre : undefined,
    });
  };

  return (
    <div className="rounded-lg border border-amber-900 bg-zinc-900 p-4 space-y-2.5">
      <h2 className="font-bold text-sm uppercase text-amber-300">✨ Capacités — {lanceur.nom} <FamilleBadge famille={lanceur.camp === "pj" ? familleDuProfil(lanceur.profil) : null} className="ml-1" /></h2>
      <p className="text-xs text-zinc-500" title="Talents connus du personnage (◈ = utilisable ici, · passif ou géré ailleurs : panneau Attaque, MJ)">
        Connus : {lanceur.capacites.length > 0
          ? lanceur.capacites.map((t, i) => (
            <span key={`${t}-${i}`}>
              {i > 0 && " · "}
              <ActionBadge action={actionTalent(t)} className="mr-1" />
              <span title={lancables.includes(t) ? "Utilisable dans ce panneau" : "Passif ou géré ailleurs (panneau Attaque, MJ)"}>
                {lancables.includes(t) ? `◈ ${t}` : t}
              </span>
            </span>
          ))
          : "aucun"}
      </p>
      <label className="block text-sm">Talent
        <select
          value={talent}
          onChange={(e) => { setTalentNom(e.target.value); setEffetCle(""); setDuree(""); setMontant(""); setCibleId(null); setCadavreChoisi(null); setAttenteMj(null); }}
          className="mt-1 w-full bg-zinc-800 rounded px-2 py-2"
        >
          {lancables.map((t) => {
            const q = CAPACITES_USABLES.find((u) => normaliserNomCapacite(u.talent) === normaliserNomCapacite(t))?.questionMJ;
            const action = actionTalent(t);
            const lettre = action ? ACTION_LETTER[action] : "P";
            return <option key={t} value={t}>[{lettre}] ◈ {t}{q ? " ⚖️" : ""}</option>;
          })}
        </select>
      </label>
      {defaut && (
        <p className="text-xs text-zinc-500">
          <ActionBadge action={actionTalent(talent)} className="mr-1" />
          Effet suggéré : {defaut.effetCle ? (EFFECT_CATALOG.find((t) => t.key === defaut.effetCle)?.nom ?? defaut.effetCle) : "aucun (narratif)"}
          {defaut.dureeTours != null ? ` (${defaut.dureeTours} tour${defaut.dureeTours > 1 ? "s" : ""})` : ""}{defaut.coutPV ? ` · sacrifie ${defaut.coutPV} PV` : ""}{defaut.soin ? ` · soigne ${defaut.soin}` : ""}{defaut.montantMJ ? " · montant saisi par le MJ" : ""}{defaut.nettoie ? " · purge" : ""} · Cibles : {defaut.cibles === "allies" ? "alliés" : defaut.cibles === "ennemis" ? "ennemis" : defaut.cibles === "soi" ? "soi-meme" : "tous"}.
          {defaut.note ? ` ${defaut.note}` : ""}
          {defaut.questionMJ ? ` ⚖️ ${defaut.questionMJ}` : ""}
        </p>
      )}
      <label className="block text-sm">{estAnimer ? `Cadavre de zombie (NC ≤ ${NC_MAX_ANIMATION})` : "Cible"}
        {estAnimer ? (
          <select value={cadavre ?? ""} onChange={(e) => setCadavreChoisi(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            {groupesCadavre.map((g) => (
              <optgroup key={g} label={g}>
                {optionsCadavre.filter((o) => o.groupe === g).map((o) => (
                  <option key={o.valeur} value={o.valeur}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <select value={cible?.instanceId ?? ""} onChange={(e) => setCibleId(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            {cibles.map((p) => (
              <option key={p.instanceId} value={p.instanceId}>
                {`${p.nom} — ${p.pv}/${p.pvMax} PV${p.statut === "ko" ? " (KO — soin possible)" : ""}${p.effets.length > 0 ? ` · ✦${p.effets.length}` : ""}`}
              </option>
            ))}
          </select>
        )}
      </label>
      {!estAnimer && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Effet appliqué
            <select value={effetActif} onChange={(e) => setEffetCle(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
              <option value="">Aucun (narratif)</option>
              {EFFECT_CATALOG.map((t) => <option key={t.key} value={t.key}>{t.nom}</option>)}
            </select>
          </label>
          <label className="block text-sm">Durée (tours)<input
            type="number" min={1} value={duree} placeholder={defaut?.dureeTours != null ? String(defaut.dureeTours) : "∞"}
            onChange={(e) => setDuree(e.target.value)}
            className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
          /></label>
        </div>
      )}
      {defaut?.montantMJ === "soin" && (
        <label className="block text-sm">Montant du soin (MJ, ex. NC du Siphon)
          <input
            type="number" min={0} value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="PV rendus"
            className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
          />
        </label>
      )}
      {defaut?.montantMJ === "lien" && (
        <label className="block text-sm">PV du rôdeur à dépenser (1 PV = 1 PV loup, 2 PV avec Tactiques)
          <input
            type="number" min={1} value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="PV dépensés"
            className="mt-1 w-full bg-zinc-800 rounded px-2 py-1.5"
          />
        </label>
      )}
      {estVigueur && (
        <div className="rounded border border-zinc-800 p-2 space-y-1.5 text-sm">
          <div className="text-xs uppercase text-zinc-500 font-bold">Vigueur divine (L, contact, sans PM)</div>
          <label className="flex items-center gap-2" title="Guérit poison/maladie sans jet (rang+2 vs maladies/poisons, MJ)">
            <input type="radio" checked={modeVigueur === "auto"} onChange={() => setModeVigueur("auto")} />
            <span>Guérison automatique</span>
          </label>
          <label className="flex items-center gap-2" title="Infection surnaturelle : test d'attaque magique (opposé), purge si réussi">
            <input type="radio" checked={modeVigueur === "test"} onChange={() => setModeVigueur("test")} />
            <span>Test d&apos;attaque magique (MJ, surnaturel)</span>
          </label>
        </div>
      )}
      {estPhenix && (
        <div className="text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-800 rounded px-2 py-1.5">
          Phénix auto 1/jour : se déclenche à 0 PV (jet unique, alliés 20 m, prêtre au double).
          {phenixUtilise >= 1 ? " — déjà utilisé aujourd'hui." : " — disponible."} Le bouton reste en secours MJ (1 cible).
        </div>
      )}
      {(defaut?.soin || defaut?.montantMJ === "soin") && cible?.soinMagiqueRecu && (
        <label className="flex items-center gap-2 text-xs text-zinc-400" title="Règle de table : 1 soin magique / cible / combat.">
          <input type="checkbox" checked={outrepasserSoin} onChange={(e) => setOutrepasserSoin(e.target.checked)} />
          <span>{cible.nom} déjà soigné ce combat — outrepasser MJ</span>
        </label>
      )}
      {choixVide && (
        <p className="text-xs text-red-400">
          {estAnimer
            ? `Aucun cadavre de zombie utilisable (zombie hors combat jamais animé, ou profil de zombie du bestiaire, NC ≤ ${NC_MAX_ANIMATION}).`
            : estRenvoi
              ? "Aucun sort absorbé à renvoyer (ou lanceur d'origine hors combat). Le renvoi doit être immédiat."
              : "Aucune cible valide pour ce talent (aucun allié actif)."}
        </p>
      )}
      <button
        onClick={() => {
          const question = defaut?.questionMJ;
          if (question && !mjDejaValide(`cap:${normaliserNomCapacite(talent)}`)) {
            setAttenteMj({ cle: `cap:${normaliserNomCapacite(talent)}`, question, note: defaut?.note });
            return;
          }
          executerUtilisation();
        }}
        disabled={bloque || !choixValide}
        className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40"
      >
        <ActionBadge action={actionTalent(talent)} className="mr-1.5" />
        Utiliser {talent}{defaut?.coutPV ? ` (${defaut.coutPV} PV)` : ""}{defaut?.actionSpeciale === "renvoi" ? " ↩" : ""}
      </button>
      {attenteMj && (
        <PopupValidationMJ
          titre={talent}
          questions={[{ cle: attenteMj.cle, question: attenteMj.question }]}
          note={attenteMj.note}
          onValider={() => {
            setAttenteMj(null);
            executerUtilisation();
          }}
          onAnnuler={() => setAttenteMj(null)}
        />
      )}
    </div>
  );
}
