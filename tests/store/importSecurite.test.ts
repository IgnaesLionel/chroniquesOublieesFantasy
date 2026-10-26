import { afterEach, describe, expect, it, vi } from "vitest";
import { applyBackup, detecterCollection, validateBackup } from "@/src/lib/store/backup";
import { monsterSchema, urlAffichable } from "@/src/lib/data/validation";
import { SEED_ITEMS } from "@/src/lib/data/worldSeeds";
import { SEED_CHARACTERS, SEED_MONSTERS } from "@/src/lib/data/seeds";
import { STORAGE_KEYS } from "@/src/lib/store/backup";

function installerStockage() {
  const donnees = new Map<string, string>();
  const localStorage = {
    getItem: (cle: string) => donnees.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      donnees.set(cle, valeur);
    },
    removeItem: (cle: string) => {
      donnees.delete(cle);
    },
    clear: () => donnees.clear(),
    key: (i: number) => [...donnees.keys()][i] ?? null,
    get length() {
      return donnees.size;
    },
  };
  vi.stubGlobal("window", {
    localStorage,
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return donnees;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("import : seules les collections du fichier sont remplacées", () => {
  it("un export partiel ne prétend pas contenir les autres collections", () => {
    const { backup } = validateBackup({ data: { items: [SEED_ITEMS[0]] } });
    expect(backup).not.toBeNull();
    expect(backup!.present).toEqual(["items"]);
  });

  it("un tableau nu est reconnu par son schéma", () => {
    expect(detecterCollection([SEED_ITEMS[0], SEED_ITEMS[1]])).toBe("items");
    const { backup, report } = validateBackup([SEED_ITEMS[0]]);
    expect(report.imported.items).toBe(1);
    expect(backup!.present).toEqual(["items"]);
  });

  it("applyBackup écrit les collections présentes et laisse les autres intactes", () => {
    const stockage = installerStockage();
    stockage.set(STORAGE_KEYS.monsters, JSON.stringify([SEED_MONSTERS[0]]));
    const { backup } = validateBackup({ data: { items: [SEED_ITEMS[0]] } });

    applyBackup(backup!);

    expect(JSON.parse(stockage.get(STORAGE_KEYS.items) ?? "[]")).toHaveLength(1);
    expect(JSON.parse(stockage.get(STORAGE_KEYS.monsters) ?? "[]")).toHaveLength(1);
  });

  it("les personnages ne sont pas importés par défaut (progression locale)", () => {
    const stockage = installerStockage();
    stockage.set(STORAGE_KEYS.characters, JSON.stringify(SEED_CHARACTERS));
    const { backup } = validateBackup({ data: { characters: SEED_CHARACTERS } });

    applyBackup(backup!);
    expect(stockage.get(STORAGE_KEYS.characters)).toBe(JSON.stringify(SEED_CHARACTERS));

    applyBackup(backup!, { importerPersonnages: true });
    expect(JSON.parse(stockage.get(STORAGE_KEYS.characters) ?? "[]")).toHaveLength(SEED_CHARACTERS.length);
  });
});

describe("URL des fiches importées", () => {
  it("refuse les protocoles exécutables", () => {
    expect(urlAffichable("javascript:alert(1)")).toBeNull();
    expect(urlAffichable("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(urlAffichable("vbscript:msgbox")).toBeNull();
  });

  it("accepte http(s), mailto et chemins relatifs", () => {
    expect(urlAffichable("https://exemple.test/fiche")).toBe("https://exemple.test/fiche");
    expect(urlAffichable("mailto:mj@exemple.test")).toBe("mailto:mj@exemple.test");
    expect(urlAffichable("/monstres/1")).toBe("/monstres/1");
  });

  it("le schéma monstre rejette une sourceUrl dangereuse", () => {
    const fiche = { ...SEED_MONSTERS[0], sourceUrl: "javascript:alert(1)" };
    expect(monsterSchema.safeParse(fiche).success).toBe(false);
    expect(monsterSchema.safeParse({ ...SEED_MONSTERS[0], sourceUrl: "https://exemple.test" }).success).toBe(true);
  });
});
