// Règles d'équipement COF (port des armes et armures). Pur TypeScript, sans React.
// Logique :
//   - 2 mains au total. Arme à 1 main = 1, à 2 mains / arc = 2, bouclier = 1, torse = 0.
//   - 2 armes à 1 main OK (1+1), 2 armes à 2 mains KO, arc (2) + épée (1) KO.
//   - 1 seul torse équipé à la fois, 1 seul bouclier équipé à la fois.
//   - Bâtons = 2 mains, baguette = 1 main (données : champ `mains` des objets).

import type { InventaireEntree } from "@/src/lib/rules/types";
import { estTorse, mainsDe, type Item } from "@/src/lib/rules/world/types";

export const MAINS_MAX = 2;

export interface EquipementEtat {
  /** Total des mains occupées par l'équipé. */
  mains: number;
  /** Noms des torses équipés. */
  torses: string[];
  /** Noms des boucliers équipés. */
  boucliers: string[];
  /** Noms des accessoires équipés (ni torse ni bouclier). */
  accessoires: string[];
  /** Noms des armes équipées (avec leurs mains). */
  armes: { nom: string; mains: number }[];
}

export function etatEquipement(
  inventaire: InventaireEntree[] = [],
  catalogue: Item[] = []
): EquipementEtat {
  const etat: EquipementEtat = { mains: 0, torses: [], boucliers: [], accessoires: [], armes: [] };
  for (const e of inventaire) {
    if (!e.equipe) continue;
    const item = catalogue.find((o) => o.id === e.itemId);
    if (!item) continue;
    etat.mains += mainsDe(item);
    if (item.categorie === "armure") {
      if (item.emplacement === "bouclier") etat.boucliers.push(item.nom);
      else if (item.emplacement === "accessoire") etat.accessoires.push(item.nom);
      else etat.torses.push(item.nom);
    }
    if (item.estArme) etat.armes.push({ nom: item.nom, mains: mainsDe(item) });
  }
  return etat;
}

export interface ValidationEquipement {
  ok: boolean;
  raisons: string[];
  etat: EquipementEtat;
}

/** Valide l'équipé actuel : mains ≤ 2, 1 torse max, 1 bouclier max. */
export function validerEquipement(
  inventaire: InventaireEntree[] = [],
  catalogue: Item[] = []
): ValidationEquipement {
  const etat = etatEquipement(inventaire, catalogue);
  const raisons: string[] = [];
  if (etat.mains > MAINS_MAX)
    raisons.push(`Mains ${etat.mains}/${MAINS_MAX} : trop d'objets en mains`);
  if (etat.torses.length > 1)
    raisons.push(`Un seul torse à la fois (${etat.torses.join(", ")})`);
  if (etat.boucliers.length > 1)
    raisons.push(`Un seul bouclier à la fois (${etat.boucliers.join(", ")})`);
  return { ok: raisons.length === 0, raisons, etat };
}

/** Peut-on équiper cet objet (simulation) ? Déséquiper est toujours OK. */
export function peutEquiper(
  inventaire: InventaireEntree[] = [],
  catalogue: Item[] = [],
  itemId: string
): ValidationEquipement {
  const cible = inventaire.find((e) => e.itemId === itemId);
  // Nouvel objet : testé comme équipé.
  if (!cible) {
    const item = catalogue.find((o) => o.id === itemId);
    if (!item) return { ok: false, raisons: ["Objet inconnu"], etat: etatEquipement(inventaire, catalogue) };
    return validerEquipement([...inventaire, { itemId, quantite: 1, equipe: true }], catalogue);
  }
  if (cible.equipe) {
    // Déséquiper ne peut que libérer.
    return { ok: true, raisons: [], etat: etatEquipement(inventaire, catalogue) };
  }
  return validerEquipement(
    inventaire.map((e) => (e.itemId === itemId ? { ...e, equipe: true } : e)),
    catalogue
  );
}

/**
 * Ajoute un objet à un inventaire (non équipé, quantités fusionnées).
 * `charges` initialise le compteur d'une baguette ; lors d'une fusion, les
 * charges s'additionnent (deux baguettes identiques = deux réserves).
 */
export function ajouterAInventaire(
  inventaire: InventaireEntree[] = [],
  itemId: string,
  quantite = 1,
  charges?: number
): InventaireEntree[] {
  const qte = Math.max(1, Math.floor(quantite));
  const chargesAjoutees = charges == null ? null : Math.max(0, Math.floor(charges));
  const inv = [...inventaire];
  const i = inv.findIndex((e) => e.itemId === itemId);
  if (i >= 0) {
    const existant = inv[i];
    inv[i] = {
      ...existant,
      quantite: existant.quantite + qte,
      ...(chargesAjoutees != null
        ? { charges: (existant.charges ?? 0) + chargesAjoutees }
        : {}),
    };
  } else {
    inv.push({
      itemId,
      quantite: qte,
      equipe: false,
      ...(chargesAjoutees != null ? { charges: chargesAjoutees } : {}),
    });
  }
  return inv;
}

/** Libellé court des mains d'un objet (ex. "1 main", "2 mains", "torse"). */
export function libelleMains(item: Item): string {
  if (item.categorie === "armure" && item.emplacement === "accessoire") return "accessoire";
  if (item.categorie === "armure" && item.emplacement !== "bouclier") return "torse";
  const m = mainsDe(item);
  if (m === 0) return "torse";
  return m === 1 ? "1 main" : "2 mains";
}

// Re-export utile : un torse = armure non-bouclier.
export { estTorse };
