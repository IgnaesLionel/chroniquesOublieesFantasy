"use client";
import { useState } from "react";
import type { AttackResolution, CombatParticipant } from "@/src/lib/rules/combat/types";
import type { Character, MonsterTemplate, Sort } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import { canAct } from "@/src/lib/rules/effects/effects";
import {
  actionDeAttaque,
  etatLimite,
  raisonSeuilPv,
  raisonExigeVivant,
  sortUtilisable,
  estCadavre,
  estLoupCompagnon,
  trouverMaitreLoup,
  profilAnimable,
  NC_MAX_ANIMATION,
  type AttaqueOpts,
  type PaiementSort,
} from "@/src/lib/rules/combat/attack";
import { capacitesCreature } from "@/src/lib/rules/combat/fiche-creature";
import { CAPACITES_USABLES, talentsLancables } from "@/src/lib/data/capacites-usables";
import { actionDeTalent, infererAction } from "@/src/lib/data/capacites";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";
import { AttackPanel } from "@/src/components/combat/AttackPanel";
import { CapacitesPanel } from "@/src/components/combat/CapacitesPanel";
import { ObjetPanel } from "@/src/components/combat/ObjetPanel";
import { SoutienPanel } from "@/src/components/combat/SoutienPanel";
import {
  ACTION_OBJET,
  LIBELLE_OBJET,
  chargesRestantesObjet,
  natureObjetCombat,
  resumeObjetCombat,
} from "@/src/lib/rules/combat/objets";
import { ActionEconomie } from "@/src/components/combat/ActionEconomie";
import {
  ActionPalette,
  type EntreeActionCombat,
  type SelectionActionCombat,
} from "@/src/components/combat/ActionPalette";
import { classeFamille, familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

interface Props {
  participants: CombatParticipant[];
  attackerId: string | null;
  attackId: string | null;
  targetId: string | null;
  last: AttackResolution | null;
  onAttacker: (id: string) => void;
  onAttack: (id: string) => void;
  onTarget: (id: string) => void;
  onRoll: (opts?: AttaqueOpts, paiement?: PaiementSort) => void;
  onMulti?: (attackerId: string, attackId: string, cibleIds: string[], opts?: AttaqueOpts, paiement?: PaiementSort) => void;
  /** Attaque double (L, arme au contact) : 2 résolutions à −2, même cible (page). */
  onDouble?: () => void;
  /** Attaque circulaire (L) : 1 résolution à −2 par cible armée cochée (page). */
  onMultiArmes?: (attackerId: string, attackId: string, cibleIds: string[], opts?: AttaqueOpts) => void;
  onChance: () => void;
  onCastSoutien: (lanceurId: string, cibleId: string, sort: Sort, paiement?: PaiementSort) => void;
  onUtiliserCapacite: (
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
  onTactique: (cibleId: string, cle: string, duree: number | null) => void;
  /** Trace « MJ a validé » au journal de combat (pop-up de validation). */
  onLogMJ?: (message: string) => void;
  /** Profils du bestiaire proposés comme cadavres (Animer un cadavre, NC ≤ 2). */
  profils?: MonsterTemplate[];
  /** Renvoi immédiat d'un sort absorbé (résultat de l'attaque en cours). */
  onRenvoiImmediat?: () => void;
  /** Fiches liées (inventaires) : potions, parchemins et baguettes proposés en actions. */
  characters?: Character[];
  /** Catalogue partagé pour résoudre les objets d'inventaire. */
  catalogue?: Item[];
  /** Utilise un objet d'inventaire (consommation, soin éventuel, journal). */
  onUtiliserObjet?: (lanceurId: string, itemId: string, cibleId: string) => void;
}

/**
 * Panneau d'action unique (combat) : plus d'onglets Action / Capacités /
 * Soutien. Une palette cherche et regroupe toutes les actions de l'acteur
 * (armes, sorts offensifs, sorts de soutien, talents), puis le composeur
 * correspondant s'ouvre sous la palette. L'acteur reste partagé.
 */
export function ActionPanel(props: Props) {
  const { participants, attackerId } = props;
  const [selection, setSelection] = useState<SelectionActionCombat | null>(null);
  // Changer d'acteur remet la sélection sur la première action disponible.
  // Ajustement d'état pendant le rendu (pattern React) plutôt qu'un effet.
  const [acteurCle, setActeurCle] = useState<string | null>(attackerId);
  if (acteurCle !== attackerId) {
    setActeurCle(attackerId);
    setSelection(null);
  }

  const acteur = participants.find((p) => p.instanceId === attackerId) ?? null;
  const mana = acteur?.ressources["mana"] ?? null;
  const manaActuel = mana?.actuel ?? 0;
  const actifs = participants.filter((p) => p.statut === "actif");
  const bloque = acteur ? !canAct(acteur.effets) : false;

  const entrees: EntreeActionCombat[] = [];

  if (acteur) {
    // ── Attaques : armes + sorts offensifs fusionnés par la fiche ─────────
    for (const a of acteur.attaques) {
      const sort = a.id.startsWith("sort:")
        ? acteur.sorts.find((s) => `sort:${s.id}` === a.id)
        : undefined;
      const raisons: string[] = [];
      const notes: string[] = [];
      const cout = sort?.cout?.montant ?? 0;
      if (bloque) raisons.push("ne peut pas agir");
      if (sort) {
        const u = sortUtilisable(acteur.niveau, sort);
        if (!u.ok && u.raison) raisons.push(u.raison);
        const lim = etatLimite(acteur, sort, props.targetId ?? undefined);
        if (!lim.ok && lim.raison) raisons.push(lim.raison);
      }
      if (cout > 0 && manaActuel < cout) {
        if (manaActuel === 0 && acteur.deRecuperation) notes.push("brûlure possible");
        else raisons.push("mana insuffisant");
      }
      const rSeuil = raisonSeuilPv(acteur, a);
      if (rSeuil) raisons.push(rSeuil);
      if (a.exigeVivant) {
        const cible = participants.find((p) => p.instanceId === props.targetId);
        const r = raisonExigeVivant(a, cible);
        if (r) raisons.push(r);
      }
      const details = [
        `+${a.bonus}`,
        a.degats === "1d1-1" ? "effet" : a.degats,
        cout > 0 ? `${cout} PM` : "",
        ...notes,
        sort?.coutPV ? `${sort.coutPV} PV` : "",
        a.volDeVie ? "vol de vie" : "",
        a.seuilPv != null ? `≤ ${Math.round(a.seuilPv * 100)} % PV` : "",
        a.exigeVivant ? "cible vivante" : "",
        sort?.limiteCombat != null && !sort.limiteParCible ? `1×${sort.limiteCombat}/combat` : "",
        sort?.limiteParCible ? "1/combat/cible" : "",
        sort?.zone ? "zone" : "",
        sort?.ciblesMax != null && sort.ciblesMax > 1 ? `×${sort.ciblesMax} cibles` : "",
        sort?.ciblesLibres ? "cibles multiples" : "",
        a.toucheAuto ? "auto" : "",
        sort?.cibleEspeces?.length ? `💀 ${sort.cibleEspeces.join("/")}` : "",
      ].filter(Boolean).join(" · ");
      entrees.push({
        type: "attaque",
        id: a.id,
        nom: a.nom,
        action: actionDeAttaque(a, sort),
        sousTitre: sort ? "Sort" : "Arme",
        details,
        disponible: raisons.length === 0,
        raison: [...new Set(raisons)].join(", "),
      });
    }

    // ── Sorts de soutien ─────────────────────────────────────────────────
    for (const s of (acteur.sorts ?? []).filter((x) => x.type !== "offensif")) {
      const raisons: string[] = [];
      const notes: string[] = [];
      const cout = s.cout?.montant ?? 0;
      if (bloque) raisons.push("ne peut pas agir");
      const u = sortUtilisable(acteur.niveau, s);
      if (!u.ok && u.raison) raisons.push(u.raison);
      if (s.rituelHorsCombat) raisons.push("rituel hors combat");
      if (cout > 0 && manaActuel < cout) {
        if (manaActuel === 0 && acteur.deRecuperation && !s.soin) notes.push("brûlure possible");
        else raisons.push("mana insuffisant");
      }
      const details = [
        s.soin ? `soin ${s.soin}` : "",
        cout > 0 ? `${cout} PM` : "",
        ...notes,
        s.coutPV ? `${s.coutPV} PV` : "",
        s.invocation ? "invocation" : "",
        s.zone ? "zone" : "",
        s.attaqueAccordee ? "+attaque" : "",
        s.limiteCombat != null && !s.limiteParCible ? `1×${s.limiteCombat}/combat` : "",
        s.limiteParCible ? "1/combat/cible" : "",
        s.questionMJ ? "⚖️ MJ" : "",
      ].filter(Boolean).join(" · ");
      entrees.push({
        type: "soutien",
        id: s.id,
        nom: s.nom,
        action: s.action ?? null,
        sousTitre: "Sort",
        details,
        disponible: raisons.length === 0,
        raison: [...new Set(raisons)].join(", "),
      });
    }

    // ── Capacités lançables ──────────────────────────────────────────────
    for (const t of talentsLancables(acteur.capacites ?? [])) {
      const defaut = CAPACITES_USABLES.find(
        (u) => normaliserNomCapacite(u.talent) === normaliserNomCapacite(t)
      );
      const action = actionDeTalent(t, acteur.profil) ?? infererAction(defaut?.note ?? "");
      const raisons: string[] = [];
      const notes: string[] = [];
      if (bloque) raisons.push("ne peut pas agir");

      const estRenvoi = defaut?.actionSpeciale === "renvoi";
      const estLien = defaut?.actionSpeciale === "lien-empathique";
      if (estRenvoi) {
        if (!acteur.sortAbsorbe) {
          raisons.push("aucun sort absorbé");
        } else {
          const lanceurAbsorbe = participants.find(
            (p) => p.instanceId === acteur.sortAbsorbe!.lanceurId && p.statut === "actif"
          );
          if (!lanceurAbsorbe) raisons.push("lanceur d'origine hors combat");
          else notes.push(`cible : ${lanceurAbsorbe.nom}`);
        }
      }

      const estAnimer = normaliserNomCapacite(t) === "animer un cadavre";
      if (estAnimer) {
        const cadavres = participants.filter((p) => p.instanceId !== acteur.instanceId && estCadavre(p));
        const profilsCadavres = (props.profils ?? []).filter((m) => profilAnimable(m));
        const total = cadavres.length + profilsCadavres.length;
        if (total === 0) raisons.push(`aucun cadavre NC ≤ ${NC_MAX_ANIMATION}`);
        else notes.push(`${total} cadavre${total > 1 ? "s" : ""}`);
      } else if (!estRenvoi && defaut) {
        if (estLien) {
          // Lien empathique ne cible jamais un PJ : uniquement le loup du rôdeur.
          const loupsLies = participants.filter(
            (p) =>
              p.statut !== "mort" &&
              estLoupCompagnon(p) &&
              trouverMaitreLoup(participants, p)?.instanceId === acteur.instanceId
          );
          if (loupsLies.length === 0) raisons.push("aucun loup compagnon");
          else notes.push(`loup : ${loupsLies.map((p) => p.nom).join(", ")}`);
        } else {
          // Mêmes règles de cible que le panneau Capacités : un soin peut viser
          // un allié KO, les autres talents exigent une cible active.
          const soinCapacite = !!defaut.soin || defaut.montantMJ === "soin";
          const alliesCiblables = participants.filter(
            (p) => p.camp === acteur.camp && (p.statut === "actif" || (soinCapacite && p.statut === "ko"))
          );
          const ciblesPossibles =
            defaut.cibles === "soi"
              ? actifs.filter((p) => p.instanceId === acteur.instanceId)
              : defaut.cibles === "allies"
                ? alliesCiblables.filter((p) => p.instanceId !== acteur.instanceId)
                : defaut.cibles === "ennemis"
                  ? actifs.filter((p) => p.camp !== acteur.camp)
                  : actifs;
          if (ciblesPossibles.length === 0) raisons.push("aucune cible valide");
        }
      }

      const details = [
        defaut?.soin ? `soin ${defaut.soin}` : "",
        defaut?.coutPV ? `${defaut.coutPV} PV` : "",
        ...notes,
        defaut?.montantMJ === "soin" ? "montant MJ" : "",
        defaut?.montantMJ === "lien" ? "lien" : "",
        defaut?.nettoie ? "purge" : "",
        defaut?.dureeTours != null ? `${defaut.dureeTours} tour${defaut.dureeTours > 1 ? "s" : ""}` : "",
        defaut?.questionMJ ? "⚖️ MJ" : "",
        estRenvoi ? "renvoi immédiat" : "",
        estAnimer ? "animation" : "",
      ].filter(Boolean).join(" · ");
      entrees.push({
        type: "capacite",
        id: t,
        nom: t,
        action,
        sousTitre: "Talent",
        details: details || "narratif",
        disponible: raisons.length === 0,
        raison: [...new Set(raisons)].join(", "),
      });
    }

    // ── Objets utilisables : potions, parchemins, baguettes ───────────────
    const fiche = (props.characters ?? []).find((c) => c.id === acteur.templateId);
    for (const entree of fiche?.inventaire ?? []) {
      const item = (props.catalogue ?? []).find((o) => o.id === entree.itemId);
      const nature = item ? natureObjetCombat(item) : null;
      if (!item || !nature) continue;
      const raisons: string[] = [];
      if (bloque) raisons.push("ne peut pas agir");
      if (entree.quantite <= 0) raisons.push("plus en stock");
      const charges = nature === "baguette" ? chargesRestantesObjet(entree, item) : null;
      if (nature === "baguette" && charges === 0) raisons.push("baguette épuisée");
      const details = [
        resumeObjetCombat(item, nature, nature === "baguette" ? charges : undefined),
        `×${entree.quantite}`,
      ]
        .filter(Boolean)
        .join(" · ");
      entrees.push({
        type: "objet",
        id: item.id,
        nom: item.nom,
        action: ACTION_OBJET[nature],
        sousTitre: LIBELLE_OBJET[nature],
        details,
        disponible: raisons.length === 0,
        raison: [...new Set(raisons)].join(", "),
      });
    }
  }

  const contientDisponible = (s: SelectionActionCombat) =>
    entrees.some((e) => e.type === s.type && e.id === s.id && e.disponible);
  const selectionValide = selection && contientDisponible(selection) ? selection : null;
  const attaquePage =
    props.attackId && entrees.some((e) => e.type === "attaque" && e.id === props.attackId && e.disponible)
      ? { type: "attaque" as const, id: props.attackId }
      : null;
  const premiere = entrees.find((e) => e.disponible) ?? null;
  const selectionEffective: SelectionActionCombat | null =
    selectionValide ?? attaquePage ?? (premiere ? { type: premiere.type, id: premiere.id } : null);
  const jouables = entrees.filter((e) => e.disponible).length;

  const choisir = (s: SelectionActionCombat) => {
    setSelection(s);
    if (s.type === "attaque") props.onAttack(s.id);
  };

  const capacitesCreatureActeur = acteur?.camp === "monstre" ? capacitesCreature(acteur) : [];

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3 fam-rail ${classeFamille(familleDuProfil(acteur?.profil))}`}>
        <h2 className="font-bold text-sm uppercase text-zinc-400">
          👤 Acteur — {acteur?.nom ?? "—"} <FamilleBadge famille={familleDuProfil(acteur?.profil)} />
        </h2>
        <label className="block text-sm">Acteur
          <select id="combat-acteur" name="acteur" value={attackerId ?? ""} onChange={(e) => props.onAttacker(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            {participants.map((p) => (
              <option key={p.instanceId} value={p.instanceId}>{p.nom} ({p.pv}/{p.pvMax})</option>
            ))}
          </select>
        </label>
        {acteur && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span className="font-mono">{acteur.pv}/{acteur.pvMax} PV</span>
            <span>Déf {acteur.defense}</span>
            {mana && <span className="font-mono text-violet-300">mana {mana.actuel}/{mana.max}</span>}
            {acteur.statut !== "actif" && <span className="text-amber-300">{acteur.statut}</span>}
            {bloque && <span className="text-red-400">ne peut pas agir</span>}
          </div>
        )}
        <ActionEconomie />
        {capacitesCreatureActeur.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs uppercase text-zinc-500 font-bold" title="Capacités du bestiaire — informatives, le MJ les applique">
              🧠 Capacités de la créature
            </div>
            {capacitesCreatureActeur.map((c) => (
              <details key={c.nom} className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                <summary className="cursor-pointer text-sm text-sky-200 hover:text-sky-100">
                  {c.origine === "partagee" ? "⛓ " : ""}
                  {c.nom}
                  {c.resume ? <span className="text-xs font-normal text-zinc-400"> — {c.resume}</span> : null}
                </summary>
                <p className="mt-1 text-xs text-zinc-300 whitespace-pre-line">
                  {c.texte ?? "Texte non fourni par le bestiaire (voir la fiche)."}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>

      {!acteur ? (
        <p className="text-xs text-zinc-500">Choisissez un acteur pour afficher ses actions.</p>
      ) : entrees.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {acteur.nom} n&apos;a aucune action utilisable en combat. Équipez une arme ou vérifiez sa fiche.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400">⚡ Actions disponibles</h3>
              <span className="text-[11px] text-zinc-500">{jouables}/{entrees.length} jouables</span>
            </div>
            <ActionPalette key={attackerId ?? "aucun"} entrees={entrees} selection={selectionEffective} onSelection={choisir} />
          </div>

          {selectionEffective ? (
            <>
              {selectionEffective.type === "attaque" && (
                <AttackPanel
                  participants={props.participants}
                  attackerId={props.attackerId}
                  attackId={selectionEffective.id}
                  targetId={props.targetId}
                  last={props.last}
                  onAttack={(id) => {
                    setSelection({ type: "attaque", id });
                    props.onAttack(id);
                  }}
                  onTarget={props.onTarget}
                  onRoll={props.onRoll}
                  onMulti={props.onMulti}
                  onDouble={props.onDouble}
                  onMultiArmes={props.onMultiArmes}
                  onChance={props.onChance}
                  onTactique={props.onTactique}
                  onLogMJ={props.onLogMJ}
                  onRenvoiImmediat={props.onRenvoiImmediat}
                />
              )}
              {selectionEffective.type === "soutien" && (
                <SoutienPanel
                  participants={props.participants}
                  lanceurId={props.attackerId}
                  sortId={selectionEffective.id}
                  onSortChange={(id) => setSelection({ type: "soutien", id })}
                  masquerSelecteur
                  onCast={props.onCastSoutien}
                  onLogMJ={props.onLogMJ}
                />
              )}
              {selectionEffective.type === "capacite" && (
                <CapacitesPanel
                  participants={props.participants}
                  lanceurId={props.attackerId}
                  talentNom={selectionEffective.id}
                  onTalentChange={(nom) => setSelection({ type: "capacite", id: nom })}
                  masquerSelecteur
                  profils={props.profils}
                  onUtiliser={props.onUtiliserCapacite}
                  onLogMJ={props.onLogMJ}
                />
              )}
              {selectionEffective.type === "objet" && (
                <ObjetPanel
                  participants={props.participants}
                  lanceurId={props.attackerId}
                  itemId={selectionEffective.id}
                  characters={props.characters ?? []}
                  catalogue={props.catalogue ?? []}
                  onUtiliser={props.onUtiliserObjet}
                />
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              Aucune action disponible pour le moment. Les raisons sont indiquées dans la palette ci-dessus.
            </p>
          )}
        </>
      )}
    </div>
  );
}
