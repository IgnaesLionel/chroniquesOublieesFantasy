// Fiche de créature en combat : capacités lisibles pour le MJ.
// Purement informatif — le moteur n'applique pas ces capacités (sauf mention
// contraire du bestiaire) : le MJ les joue, la fiche évite de rouvrir le
// bestiaire en pleine manche.
//
// Sources, par ordre de priorité :
//   1. capacitesPartagees (catalogue CAPACITES_PARTAGEES : texte de référence) ;
//   2. capacitesDetails (texte propre à la fiche) ;
//   3. capacites (noms seuls, enrichis si le catalogue partagé les connaît).
// Les doublons « Vol rapide » / « Vol rapide (Capacité) » sont fusionnés.

import type { CombatParticipant } from "@/src/lib/rules/combat/types";
import { CAPACITES_PARTAGEES } from "@/src/lib/data/capacites-partagees";
import { normaliserNomCapacite } from "@/src/lib/rules/personnage";

export interface CapaciteCreature {
  nom: string;
  /** Résumé court (catalogue partagé). */
  resume?: string;
  /** Texte de règle (peut être absent si le bestiaire ne le fournit pas). */
  texte?: string;
  /** D'où vient le texte : catalogue partagé, fiche de la créature, ou nom seul. */
  origine: "partagee" | "fiche" | "nom";
}

const PARTAGEES = new Map(CAPACITES_PARTAGEES.map((c) => [c.cle, c]));
const PARTAGEES_PAR_NOM = new Map(
  CAPACITES_PARTAGEES.map((c) => [cleCapacite(c.nom), c])
);

/** « Vol rapide (Capacité) » -> « vol rapide ». */
function cleCapacite(nom: string): string {
  return normaliserNomCapacite(nom.replace(/\s*\([^)]*\)\s*$/, "").trim());
}

/**
 * Nettoie les descriptions importées du bestiaire Notion : références
 * d'images (`- ./images/img-1.webp`) et lignes vides.
 */
export function texteCapaciteLisible(texte: string): string {
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^-\s*`?\.\/images\//i.test(l))
    .join("\n")
    .trim();
}

/**
 * Capacités affichables d'un participant (monstre ou créature invoquée) :
 * dédoublonnées, suffixe « (Capacité) » retiré, textes nettoyés.
 * L'ordre suit le bestiaire (partagées d'abord, puis la fiche).
 */
export function capacitesCreature(
  p: Pick<CombatParticipant, "capacites" | "capacitesDetails" | "capacitesPartagees">
): CapaciteCreature[] {
  const vues = new Set<string>();
  const out: CapaciteCreature[] = [];
  const ajouter = (c: CapaciteCreature) => {
    const cle = cleCapacite(c.nom);
    if (!cle || vues.has(cle)) return;
    vues.add(cle);
    out.push(c);
  };

  for (const ref of p.capacitesPartagees ?? []) {
    const c = PARTAGEES.get(ref);
    if (c) ajouter({ nom: c.nom, resume: c.resume, texte: c.texte, origine: "partagee" });
  }

  for (const d of p.capacitesDetails ?? []) {
    const nom = d.nom.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const texte = texteCapaciteLisible(d.description);
    ajouter({ nom, texte: texte || undefined, origine: "fiche" });
  }

  for (const nom of p.capacites ?? []) {
    const lisible = nom.replace(/\s*\([^)]*\)\s*$/, "").trim();
    // Nom libre identique à une capacité partagée : on récupère son texte.
    const partagee = PARTAGEES_PAR_NOM.get(cleCapacite(lisible));
    ajouter(
      partagee
        ? { nom: partagee.nom, resume: partagee.resume, texte: partagee.texte, origine: "partagee" }
        : { nom: lisible, origine: "nom" }
    );
  }

  return out;
}
