import { beforeEach, describe, expect, it } from "vitest";
import {
  codeInterne,
  installerSurveillanceStockage,
  type MutationStockage,
} from "@/src/lib/store/surveillance";
import {
  avecInstance,
  detailMutation,
  lireTraces,
  noterEvenementStockage,
  noterResync,
} from "@/src/lib/store/repository";

// Les tests tournent en node : on fabrique un Storage crédible — les
// instances héritent d'un Storage.prototype que la surveillance peut ganter,
// exactement comme dans le navigateur.
class StorageFake {}

const cartes = new WeakMap<object, Map<string, string>>();
const carte = (o: object): Map<string, string> => {
  let m = cartes.get(o);
  if (!m) {
    m = new Map();
    cartes.set(o, m);
  }
  return m;
};

const proto = StorageFake.prototype as unknown as Record<string, unknown>;
proto.getItem = function (this: StorageFake, c: string): string | null {
  const m = carte(this);
  return m.has(c) ? (m.get(c) as string) : null;
};
proto.setItem = function (this: StorageFake, c: string, v: string): void {
  carte(this).set(c, String(v));
};
proto.removeItem = function (this: StorageFake, c: string): void {
  carte(this).delete(c);
};
proto.clear = function (this: StorageFake): void {
  carte(this).clear();
};
proto.key = function (this: StorageFake, i: number): string | null {
  return Array.from(carte(this).keys())[i] ?? null;
};
Object.defineProperty(proto, "length", {
  get(this: StorageFake): number {
    return carte(this).size;
  },
});

const local = new StorageFake() as unknown as Storage;
const session = new StorageFake() as unknown as Storage;
const mutations: MutationStockage[] = [];

describe("surveillance des mutations de stockage", () => {
  beforeEach(() => {
    local.clear();
    session.clear();
    mutations.length = 0;
    (globalThis as unknown as Record<string, unknown>).Storage = StorageFake;
    (globalThis as unknown as Record<string, unknown>).window = {
      localStorage: local,
      sessionStorage: session,
    };
    installerSurveillanceStockage((m) => mutations.push(m));
  });

  it("signale une écriture étrangère sur une clé cof.*, avec la valeur plantée", () => {
    local.setItem("cof.characters.v2", "[]");
    local.setItem("cof.characters.v2", '[{"id":"x","pv":9}]');
    const m = mutations.filter((x) => x.action === "setItem" && x.cle === "cof.characters.v2");
    expect(m).toHaveLength(2);
    expect(m[1].taille).toBe('[{"id":"x","pv":9}]'.length);
    // L'ancienne valeur est connue : on saura ce qui a été écrasé.
    expect(m[1].avant).toBe("[]".length);
    expect(m[1].cible).toBe("localStorage");
  });

  it("ignore les clés étrangères à l'application (pas de bruit)", () => {
    local.setItem("nextjs.hmr", "{}");
    local.removeItem("nextjs.hmr");
    expect(mutations).toHaveLength(0);
  });

  it("ignore nos propres écritures (codeInterne)", () => {
    codeInterne(() => local.setItem("cof.characters.v2", "[]"));
    // …et la valeur est bien écrite malgré le manteau.
    expect(local.getItem("cof.characters.v2")).toBe("[]");
    codeInterne(() => local.removeItem("cof.characters.v2"));
    codeInterne(() => local.clear());
    expect(mutations).toHaveLength(0);
    expect(local.getItem("cof.characters.v2")).toBeNull();
  });

  it("restitue la valeur de codeInterne et se remet à niveau même sur erreur", () => {
    expect(codeInterne(() => 42)).toBe(42);
    expect(() =>
      codeInterne(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    local.setItem("cof.characters.v2", "[]");
    expect(mutations).toHaveLength(1);
  });

  it("signale un effacement total avec l'inventaire des clés cof.* perdues", () => {
    const fiche = '[{"id":"nyssa","pv":5}]';
    local.setItem("cof.characters.v2", fiche);
    local.setItem("cof.sessions.v1", "[]");
    mutations.length = 0;
    local.clear();
    expect(local.length).toBe(0);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].action).toBe("clear");
    expect(mutations[0].perdues).toEqual([
      `cof.characters.v2 (${fiche.length} car.)`,
      "cof.sessions.v1 (2 car.)",
    ]);
  });

  it("signale une suppression, avec la taille de ce qui existait", () => {
    local.setItem("cof.characters.v2", "[]");
    mutations.length = 0;
    local.removeItem("cof.characters.v2");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].action).toBe("removeItem");
    expect(mutations[0].avant).toBe(2);
    expect(local.getItem("cof.characters.v2")).toBeNull();
  });

  it("distingue localStorage et sessionStorage", () => {
    session.setItem("cof.traces.chrono", "[]");
    const m = mutations.find((x) => x.cible === "sessionStorage");
    expect(m?.cible).toBe("sessionStorage");
  });
});

describe("detailMutation — formulation lisible", () => {
  it("décrit un clear avec les clés perdues", () => {
    expect(
      detailMutation({
        action: "clear",
        cible: "localStorage",
        perdues: ["cof.characters.v2 (4429 car.)"],
        pile: "",
      })
    ).toBe("EXTERNE clear(localStorage) — efface : cof.characters.v2 (4429 car.)");
  });

  it("décrit une suppression, y compris d'une clé déjà absente", () => {
    expect(
      detailMutation({ action: "removeItem", cible: "localStorage", cle: "cof.characters.v2", avant: 4429, pile: "" })
    ).toBe("EXTERNE removeItem(localStorage, cof.characters.v2) — avait 4429 car.");
    expect(
      detailMutation({ action: "removeItem", cible: "localStorage", cle: "cof.characters.v2", avant: 0, pile: "" })
    ).toBe("EXTERNE removeItem(localStorage, cof.characters.v2) — clé déjà absente");
  });

  it("décrit une écriture étrangère, avec le contenu et l'ancienne valeur", () => {
    const resume = (v: unknown) => (Array.isArray(v) ? `${v.length} fiches` : "obj.");
    const texte = detailMutation(
      {
        action: "setItem",
        cible: "localStorage",
        cle: "cof.characters.v2",
        valeur: '[{"id":"a"},{"id":"b"}]',
        taille: 22,
        avant: 4429,
        pile: "",
      },
      resume
    );
    expect(texte).toBe(
      "EXTERNE setItem(localStorage, cof.characters.v2) → 2 fiches (22 car.) · préc. 4429 car."
    );
  });

  it("reste lisible quand la valeur étrangère est illisible", () => {
    expect(
      detailMutation({ action: "setItem", cible: "localStorage", cle: "cof.x", valeur: "{", taille: 1, pile: "" })
    ).toBe("EXTERNE setItem(localStorage, cof.x) → 1 car. · préc. vide");
  });
});

describe("chronologie — épinglage et instances", () => {
  const CLE = "cof.test.chrono";

  it("une clé supprimée par un autre onglet est épinglée (jamais évincée)", () => {
    noterEvenementStockage(CLE, null);
    // On sature la chrono avec des traces ordinaires.
    for (let i = 0; i < 400; i++) noterResync(CLE, "test");
    const epinglees = lireTraces(CLE).filter((t) => t.epingle);
    expect(epinglees).toHaveLength(1);
    expect(epinglees[0].detail).toContain("SUPPRIMÉE");
  });

  it("nomme l'instance du hook dans l'origine", () => {
    avecInstance("characters#3 combat", () => noterResync(CLE, "focus"));
    const derniere = lireTraces(CLE).at(-1);
    expect(derniere?.origine).toBe("resync (focus) [characters#3 combat]");
  });
});
