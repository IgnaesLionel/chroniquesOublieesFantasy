"use client";
import { useState } from "react";
import type { AttackResolution, CombatParticipant } from "@/src/lib/rules/combat/types";
import type { MonsterTemplate, Sort } from "@/src/lib/rules/types";
import { sortUtilisable, type AttaqueOpts, type PaiementSort } from "@/src/lib/rules/combat/attack";
import { capacitesCreature } from "@/src/lib/rules/combat/fiche-creature";
import { talentsLancables } from "@/src/lib/data/capacites-usables";
import { AttackPanel } from "@/src/components/combat/AttackPanel";
import { CapacitesPanel } from "@/src/components/combat/CapacitesPanel";
import { SoutienPanel } from "@/src/components/combat/SoutienPanel";
import { classeFamille, familleDuProfil } from "@/src/lib/ui/famille";
import { FamilleBadge } from "@/src/components/ui/Famille";

type Onglet = "action" | "capacites" | "soutien";

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
}

/**
 * Panneau d'action unique (combat) : Action, Capacités, Soutien.
 * Un seul acteur partagé pour les 3 onglets. L'onglet Action regroupe les
 * attaques (armes, sorts, options tactiques) et les postures self-buff
 * (défenses, riposte) + soutenir un allié. Chaque onglet garde sa logique
 * (réutilise les panneaux existants).
 */
export function ActionPanel(props: Props) {
  const { participants, attackerId } = props;
  const [onglet, setOnglet] = useState<Onglet>("action");
  const acteur = participants.find((p) => p.instanceId === attackerId) ?? null;
  const nbAttaques = acteur?.attaques.length ?? 0;
  const nbSoutiens = (acteur?.sorts ?? []).filter(
    (s) => s.type !== "offensif" && sortUtilisable(acteur!.niveau, s).ok
  ).length;
  const nbCapacites = talentsLancables(acteur?.capacites ?? []).length;
  /** Créature (monstre) : capacités du bestiaire, lisibles sous les onglets. */
  const capacitesCreatureActeur = acteur?.camp === "monstre" ? capacitesCreature(acteur) : [];

  const onglets: { id: Onglet; label: string; titre: string; badge: string | null; vide: string | null; teinte: string }[] = [
    {
      id: "action", label: "⚔️ Action", titre: "Attaques (armes, sorts, options tactiques), défenses, riposte, soutenir",
      badge: nbAttaques > 0 ? String(nbAttaques) : null, vide: null, teinte: "text-red-200",
    },
    {
      id: "capacites", label: "✨ Capacités", titre: "Talents utilisables (effets, soins, parades...)",
      badge: nbCapacites > 0 ? String(nbCapacites) : null,
      vide: !acteur ? "Choisissez un acteur." : nbCapacites === 0 ? `${acteur.nom} ne connaît aucun talent utilisable.` : null,
      teinte: "text-amber-200",
    },
    {
      id: "soutien", label: "🛡️ Soutien", titre: "Sorts de soutien (défensifs, utilitaires)",
      badge: nbSoutiens > 0 ? String(nbSoutiens) : null,
      vide: !acteur ? "Choisissez un acteur." : nbSoutiens === 0 ? `${acteur.nom} n'a aucun sort de soutien lançable.` : null,
      teinte: "text-emerald-200",
    },
  ];
  const actif = onglets.find((o) => o.id === onglet)!;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3 fam-rail ${classeFamille(familleDuProfil(acteur?.profil))}`}>
        <h2 className="font-bold text-sm uppercase text-zinc-400">👤 Acteur — {acteur?.nom ?? "—"} <FamilleBadge famille={familleDuProfil(acteur?.profil)} /></h2>
        <label className="block text-sm">Acteur
          <select id="combat-acteur" name="acteur" value={attackerId ?? ""} onChange={(e) => props.onAttacker(e.target.value)} className="mt-1 w-full bg-zinc-800 rounded px-2 py-2">
            {participants.map((p) => (
              <option key={p.instanceId} value={p.instanceId}>{p.nom} ({p.pv}/{p.pvMax})</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-1.5" role="tablist">
          {onglets.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={onglet === o.id}
              title={o.titre}
              onClick={() => setOnglet(o.id)}
              className={`px-2 py-2 rounded text-sm font-semibold ${onglet === o.id ? "bg-amber-400 text-black" : `bg-zinc-800 hover:bg-zinc-700 ${o.teinte}`}`}
            >
              {o.label}{o.badge ? <span className="ml-1 font-mono text-xs opacity-70">{o.badge}</span> : null}
            </button>
          ))}
        </div>
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
      {actif.vide ? (
        <p className="text-xs text-zinc-500">{actif.vide}</p>
      ) : (
        <>
          {onglet === "action" && (
            <AttackPanel
              participants={props.participants}
              attackerId={props.attackerId}
              attackId={props.attackId}
              targetId={props.targetId}
              last={props.last}
              onAttack={props.onAttack}
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
          {onglet === "capacites" && (
            <CapacitesPanel
              participants={props.participants}
              lanceurId={props.attackerId}
              profils={props.profils}
              onUtiliser={props.onUtiliserCapacite}
              onLogMJ={props.onLogMJ}
            />
          )}
          {onglet === "soutien" && (
            <SoutienPanel
              participants={props.participants}
              lanceurId={props.attackerId}
              onCast={props.onCastSoutien}
              onLogMJ={props.onLogMJ}
            />
          )}
        </>
      )}
    </div>
  );
}
