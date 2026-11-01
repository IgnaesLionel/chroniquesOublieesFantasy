import type { Character, Sort } from "@/src/lib/rules/types";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";
import { CAPACITES, type Capacite, type VoieDetail } from "./capacites";
import { VOIE_MAGE, VOIES_PEUPLE, traitsInitiaux } from "./peuples";
import { CAPACITES_USABLES } from "./capacites-usables";
import { SEED_SORTS } from "./sorts";

/**
 * Fiches lisibles des talents, traits de peuple et sorts connus d'un
 * personnage. Le résumé DRS est la référence : il contient les bonus de
 * compétence, les aptitudes passives et les effets conditionnels même quand
 * le moteur ne les automatise pas encore. L'écran Personnages s'en sert pour
 * afficher ces effets sur la fiche.
 */
export interface AptitudeTalent {
  nom: string;
  resume: string;
  voie?: string;
  rang?: number;
  source: "peuple" | "mage" | "talent";
  /** Précision du moteur de combat (CAPACITES_USABLES), si elle existe. */
  noteMoteur?: string;
}

export interface AptitudeSort {
  nom: string;
  description: string;
  type: Sort["type"];
  voie?: string;
  rang?: number;
  cout?: string;
  noteMoteur?: string;
}

interface CapaciteLocalisee extends Capacite {
  voie: string;
}

function norm(texte: string): string {
  return normaliserNomCapacite(texte);
}

function chercherDansVoies(voies: VoieDetail[], nom: string): CapaciteLocalisee | undefined {
  const q = norm(nom);
  for (const v of voies) {
    for (const c of v.capacites) {
      if (norm(c.nom) === q) return { ...c, voie: v.voie };
    }
  }
  return undefined;
}

function voiesDuPeuple(peuple?: string): VoieDetail[] {
  const p = (peuple ?? "").trim();
  if (!p) return VOIES_PEUPLE;
  const voie = VOIES_PEUPLE.find((v) => v.peuple === p);
  return voie ? [voie] : VOIES_PEUPLE;
}

/**
 * Retrouve le texte d'un talent dans l'ordre le plus fiable : voie du profil,
 * voie du peuple, Voie du mage, puis les autres voies (talents empruntés par
 * Touche-à-tout / Formation d'élite). Le nom seul ne suffit pas toujours :
 * « Archer émérite » existe en version Rôdeur et en version Demi-Elfe.
 */
export function localiserTalent(
  nom: string,
  c: Pick<Character, "profil" | "classe" | "peuple" | "voieMage">
): CapaciteLocalisee | undefined {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const dansProfil = chercherDansVoies(CAPACITES[profil] ?? [], nom);
  if (dansProfil) return dansProfil;

  const dansPeuple = chercherDansVoies(voiesDuPeuple(c.peuple), nom);
  if (dansPeuple) return dansPeuple;

  const dansMage = chercherDansVoies([VOIE_MAGE], nom);
  if (dansMage) return dansMage;

  // Talents empruntés à un autre profil : dernier recours, par nom exact.
  for (const voies of Object.values(CAPACITES)) {
    const trouve = chercherDansVoies(voies, nom);
    if (trouve) return trouve;
  }
  return undefined;
}

/** Résumé DRS d'un talent (ou d'un trait de peuple), sans le moteur. */
export function resumeTalent(
  nom: string,
  c: Pick<Character, "profil" | "classe" | "peuple" | "voieMage">
): string | undefined {
  return localiserTalent(nom, c)?.resume;
}

function noteMoteur(nom: string): string | undefined {
  const q = norm(nom);
  return CAPACITES_USABLES.find((x) => norm(x.talent) === q)?.note;
}

/**
 * Talents et traits de peuple connus, avec leur résumé. Le rang 1 du peuple
 * est toujours inclus (bonus racial automatique, même sur une ancienne fiche
 * où `traitsPeuple` n'aurait pas été renseigné). Les doublons de nom sont
 * fusionnés : le trait de peuple garde la priorité de source, et le texte du
 * profil reste celui qui est affiché (localiserTalent le privilégie).
 */
export function aptitudesTalent(
  c: Pick<Character, "profil" | "classe" | "peuple" | "voieMage" | "capacites" | "traitsPeuple">
): AptitudeTalent[] {
  const traits = [...new Set([...traitsInitiaux(c.peuple ?? ""), ...(c.traitsPeuple ?? [])])];
  const talents = c.capacites ?? [];
  const vus = new Set<string>();
  const out: AptitudeTalent[] = [];

  for (const [liste, source] of [
    [traits, "peuple"] as const,
    [talents, "talent"] as const,
  ]) {
    for (const nom of liste) {
      const q = norm(nom);
      if (!q || vus.has(q)) continue;
      const loc = localiserTalent(nom, c);
      if (!loc?.resume?.trim()) continue;
      vus.add(q);
      out.push({
        nom,
        resume: loc.resume,
        voie: loc.voie,
        rang: loc.rang,
        source: loc.voie === VOIE_MAGE.voie ? "mage" : source,
        noteMoteur: noteMoteur(nom),
      });
    }
  }
  return out;
}

/** Sorts connus, avec la description du grimoire (ou de la fiche). */
export function aptitudesSort(c: Pick<Character, "sorts">): AptitudeSort[] {
  return (c.sorts ?? []).map((s) => {
    const ref = SEED_SORTS.find((x) => norm(x.nom) === norm(s.nom));
    const description = (s.description ?? ref?.description ?? "").trim();
    const cout = s.cout
      ? `${s.cout.montant} ${s.cout.ressource === "mana" ? "PM" : s.cout.ressource}`
      : ref?.cout
        ? `${ref.cout.montant} ${ref.cout.ressource === "mana" ? "PM" : ref.cout.ressource}`
        : undefined;
    return {
      nom: s.nom,
      description,
      type: s.type ?? ref?.type ?? "utilitaire",
      voie: s.voie ?? ref?.voie,
      rang: s.rang ?? ref?.rang,
      cout,
      noteMoteur: noteMoteur(s.nom),
    };
  });
}
