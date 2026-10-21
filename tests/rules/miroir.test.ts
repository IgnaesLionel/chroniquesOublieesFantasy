import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localStorageAdapter } from "@/src/lib/store/repository";

// Les tests tournent en node (pas de jsdom) : on fournit un faux navigateur
// avec localStorage + sessionStorage réels en mémoire, pour vérifier le
// miroir d'onglet — le cœur du garde-fou contre un localStorage.clear()
// venant d'une autre application partageant l'origine.
class MemoireFake {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(cle: string): string | null {
    return this.map.has(cle) ? (this.map.get(cle) as string) : null;
  }
  setItem(cle: string, valeur: string): void {
    this.map.set(cle, String(valeur));
  }
  removeItem(cle: string): void {
    this.map.delete(cle);
  }
  clear(): void {
    this.map.clear();
  }
}

const CLÉ = "cof.miroir.test";
const DONNÉES = [{ id: "pj-test", pv: 4, pvMax: 7 }];

describe("localStorageAdapter — miroir d'onglet", () => {
  let stockageLocal: MemoireFake;
  let stockageSession: MemoireFake;

  beforeEach(() => {
    stockageLocal = new MemoireFake();
    stockageSession = new MemoireFake();
    (globalThis as unknown as Record<string, unknown>).window = {
      localStorage: stockageLocal,
      sessionStorage: stockageSession,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).window;
  });

  it("une écriture alimente aussi le miroir d'onglet", () => {
    localStorageAdapter.save(CLÉ, DONNÉES);
    expect(stockageLocal.getItem(CLÉ)).toBe(JSON.stringify(DONNÉES));
    expect(stockageSession.getItem(`cof.miroir:${CLÉ}`)).toBe(JSON.stringify(DONNÉES));
  });

  it("un effacement externe (clear) est restauré depuis le miroir, à l'identique", () => {
    localStorageAdapter.save(CLÉ, DONNÉES);
    // Une AUTRE application de la même origine vide localStorage :
    stockageLocal.clear();
    const relu = localStorageAdapter.load<typeof DONNÉES>(CLÉ);
    expect(relu).toEqual(DONNÉES);
    // …et localStorage est re-rempli pour les lectures suivantes :
    expect(stockageLocal.getItem(CLÉ)).toBe(JSON.stringify(DONNÉES));
  });

  it("un clear sans miroir (onglet neuf) renvoie bien « vide »", () => {
    localStorageAdapter.save(CLÉ, DONNÉES);
    stockageLocal.clear();
    stockageSession.clear();
    expect(localStorageAdapter.load(CLÉ)).toBeNull();
  });

  it("le miroir suit les valeurs successives (pas un ancien état)", () => {
    localStorageAdapter.save(CLÉ, DONNÉES);
    const abîmé = [{ ...DONNÉES[0], pv: 1 }];
    localStorageAdapter.save(CLÉ, abîmé);
    stockageLocal.clear();
    expect(localStorageAdapter.load(CLÉ)).toEqual(abîmé);
  });
});
