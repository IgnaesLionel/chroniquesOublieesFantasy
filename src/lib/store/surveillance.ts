// Surveillance des mutations de stockage.
//
// Le bug « les fiches reviennent en pleine vie après Terminer » suppose une
// écriture de graines par-dessus la sauvegarde, ou un effacement de la clé
// suivi d'un montage sur clé vide. Or les effaceurs possibles ne sont pas tous
// dans notre code : une autre application servie sur la même origine, une
// dépendance, ou un simple `localStorage.clear()` de réglages peut vider la
// clé sans laisser la moindre trace côté adaptateur (qui ne voit que SES
// propres accès).
//
// On greffe donc un manteau sur Storage.prototype : toute mutation FAITE par
// un code qui n'est pas le nôtre (marqué par `codeInterne`) est déclarée dans
// la chronologie, avec sa pile d'appels. On ne modifie jamais le comportement :
// les méthodes d'origine sont rappelées telles quelles.

type Prototype = Record<string, unknown>;

/** Nombre de mutations en cours dans notre propre code (le manteau se tait). */
let interne = 0;

/** Marque `f` comme écriture interne : la surveillance ne la déclare pas. */
export function codeInterne<T>(f: () => T): T {
  interne++;
  try {
    return f();
  } finally {
    interne--;
  }
}

export type MutationStockage = {
  action: "setItem" | "removeItem" | "clear";
  cible: "localStorage" | "sessionStorage";
  cle?: string;
  /** Nouvelle valeur (setItem), tronquée pour rester lisible. */
  valeur?: string;
  taille?: number;
  /** Ancienne taille en caractères (0 = clé absente avant la mutation). */
  avant?: number;
  /** Clés cof.* effacées par un clear(), avec leur taille. */
  perdues?: string[];
  pile: string;
};

let installee = false;
let declarant: ((m: MutationStockage) => void) | null = null;

function pileAppels(): string {
  try {
    throw new Error("surveillance");
  } catch (e) {
    // Les premières lignes sont ce fichier et le manteau : on saute pour
    // atteindre le vrai coupable.
    return ((e as Error).stack ?? "").split("\n").slice(3, 14).join(" | ").slice(0, 600);
  }
}

/**
 * Greffe le manteau une seule fois par document. `sur` est appelé pour toute
 * mutation qui n'est pas marquée `codeInterne` (et qui concerne un espace
 * cof.* — hors clear(), toujours signalé car il efface tout).
 */
export function installerSurveillanceStockage(sur: (m: MutationStockage) => void): void {
  if (typeof window === "undefined" || installee) return;
  installee = true;
  declarant = sur;

  const proto = Storage.prototype as unknown as Prototype;
  const original = {
    setItem: proto.setItem as (cle: string, valeur: string) => void,
    removeItem: proto.removeItem as (cle: string) => void,
    clear: proto.clear as () => void,
    getItem: proto.getItem as (cle: string) => string | null,
    key: proto.key as (i: number) => string | null,
  };

  const cible = (celui: Storage): "localStorage" | "sessionStorage" =>
    celui === window.localStorage ? "localStorage" : "sessionStorage";

  const declarer = (m: Omit<MutationStockage, "pile">): void => {
    if (interne > 0) return;
    try {
      declarant?.({ ...m, pile: pileAppels() });
    } catch {
      // La surveillance ne doit jamais casser une écriture.
    }
  };

  const tailleAvant = (celui: Storage, cle: string): number => {
    try {
      const a = original.getItem.call(celui, cle);
      return a ? a.length : 0;
    } catch {
      return -1;
    }
  };

  proto.setItem = function (this: Storage, cle: string, valeur: string): void {
    if (cle.startsWith("cof.")) {
      declarer({
        action: "setItem",
        cible: cible(this),
        cle,
        valeur: String(valeur).slice(0, 120),
        taille: String(valeur).length,
        avant: tailleAvant(this, cle),
      });
    }
    original.setItem.call(this, cle, valeur);
  };

  proto.removeItem = function (this: Storage, cle: string): void {
    if (cle.startsWith("cof.")) {
      declarer({ action: "removeItem", cible: cible(this), cle, avant: tailleAvant(this, cle) });
    }
    original.removeItem.call(this, cle);
  };

  proto.clear = function (this: Storage): void {
    if (interne === 0) {
      const perdues: string[] = [];
      try {
        for (let i = 0; i < this.length; i++) {
          const k = original.key.call(this, i);
          if (k && k.startsWith("cof.")) perdues.push(`${k} (${tailleAvant(this, k)} car.)`);
        }
      } catch {
        // Inventaire impossible : le clear reste signalé sans détail.
      }
      declarer({ action: "clear", cible: cible(this), perdues });
    }
    original.clear.call(this);
  };
}
