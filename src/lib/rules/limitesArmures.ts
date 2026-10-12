// Port des armures par profil : limite DEF + bouclier + extensions de talents.
// Pur TypeScript, sans React. Comparaison sur le bonus DEF (échelle 0-7 :
// vêtements 0, matelassé 1, cuir 2, cuir renforcé 3, chemise 4, cotte 5,
// plaque 6, plaque complète 7). Avertissements uniquement, jamais bloquants.

import type { Character } from "@/src/lib/rules/types";
import type { Item } from "@/src/lib/rules/world/types";
import { normaliserNomCapacite } from "@/src/lib/rules/creation";

/** Échelle des armures (bonus DEF → nom). */
export const ECHELLE_ARMURES: { def: number; nom: string; note: string }[] = [
  { def: 0, nom: "Vêtements en tissu", note: "Vêtements, pas une armure" },
  { def: 1, nom: "Tissu matelassé", note: "Interdit aux profils limités aux vêtements" },
  { def: 2, nom: "Cuir", note: "Cuir simple" },
  { def: 3, nom: "Cuir renforcé", note: "Cuir renforcé" },
  { def: 4, nom: "Chemise de mailles", note: "Intermédiaire" },
  { def: 5, nom: "Cotte de mailles", note: "Intermédiaire" },
  { def: 6, nom: "Armure de plaque", note: "Plaque" },
  { def: 7, nom: "Plaque complète", note: "Plaque complète" },
];

export function nomArmureLimite(def: number): string {
  return ECHELLE_ARMURES.find((e) => e.def === def)?.nom ?? `DEF +${def}`;
}

export interface ExtensionArmure {
  talent: string;
  limite: number;
}

export interface LimitePort {
  /** Bonus DEF max du torse porté. */
  limite: number;
  /** Bouclier autorisé (Druide/Prêtre : petit bouclier). */
  bouclier: boolean;
  /** Talents relevant la limite. */
  extensions: ExtensionArmure[];
}

/** Limite de base par profil (voies utilisables + bouclier). */
export const LIMITES_ARMURE: Record<string, LimitePort> = {
  Magicien: { limite: 0, bouclier: false, extensions: [] },
  Ensorceleur: { limite: 0, bouclier: false, extensions: [] },
  Sorcier: { limite: 0, bouclier: false, extensions: [] },
  Forgesort: { limite: 2, bouclier: false, extensions: [] },
  Voleur: { limite: 2, bouclier: false, extensions: [] },
  Druide: { limite: 2, bouclier: true, extensions: [] },
  Moine: { limite: 0, bouclier: false, extensions: [] },
  Barde: { limite: 3, bouclier: false, extensions: [] },
  Rôdeur: { limite: 3, bouclier: false, extensions: [] },
  Arquebusier: { limite: 4, bouclier: false, extensions: [] },
  Barbare: {
    limite: 3, bouclier: true,
    extensions: [
      { talent: "Tour de force", limite: 4 },
      { talent: "Briseur d'os", limite: 5 },
    ],
  },
  Guerrier: {
    limite: 5, bouclier: true,
    extensions: [{ talent: "Armure lourde", limite: 6 }],
  },
  Chevalier: {
    limite: 6, bouclier: true,
    extensions: [{ talent: "Autorité naturelle", limite: 7 }],
  },
  Prêtre: { limite: 4, bouclier: true, extensions: [] },
};

export interface LimiteEffective extends LimitePort {
  /** Talent ayant relevé la limite, le cas échéant. */
  via?: string;
}

/** Limite effective d'un profil avec ses talents (null si profil inconnu : aucun contrôle). */
export function limiteEffective(
  profil: string,
  capacites: string[] = []
): LimiteEffective | null {
  const base = LIMITES_ARMURE[(profil ?? "").trim()];
  if (!base) return null;
  const connus = new Set(capacites.map(normaliserNomCapacite));
  let limite = base.limite;
  let via: string | undefined;
  for (const ext of base.extensions) {
    if (connus.has(normaliserNomCapacite(ext.talent)) && ext.limite > limite) {
      limite = ext.limite;
      via = ext.talent;
    }
  }
  return { limite, bouclier: base.bouclier, extensions: base.extensions, ...(via ? { via } : {}) };
}

/**
 * Vérifie le torse et le bouclier ÉQUIPÉS contre la limite du profil
 * (talents d'extension déduits). Armures magiques incluses (porter de la
 * plaque, c'est porter de la plaque). Saisie manuelle (champ armure) : MJ.
 */
export function verifierArmurePortee(
  c: Pick<Character, "profil" | "classe" | "capacites" | "inventaire">,
  catalogue: Item[] = []
): string[] {
  const profil = (c.profil ?? "").trim() || (c.classe ?? "").trim();
  const limite = limiteEffective(profil, c.capacites ?? []);
  if (!limite) return [];
  const alertes: string[] = [];
  for (const e of c.inventaire ?? []) {
    if (!e.equipe) continue;
    const item = catalogue.find((o) => o.id === e.itemId);
    if (!item || item.categorie !== "armure") continue;
    if (item.emplacement === "bouclier") {
      if (!limite.bouclier) alertes.push(`🛡 ${item.nom} : ${profil} sans bouclier`);
      continue;
    }
    if (item.emplacement === "accessoire") continue; // ni torse ni bouclier : pas de limite de port
    const def = item.bonusDefense ?? 0;
    if (def > limite.limite) {
      alertes.push(
        `🛡 ${item.nom} (+${def}) dépasse ${profil} (max ${nomArmureLimite(limite.limite)} +${limite.limite}${limite.via ? ` via ${limite.via}` : ""})`
      );
    }
  }
  return alertes;
}
