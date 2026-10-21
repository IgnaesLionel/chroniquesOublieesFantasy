import { describe, expect, it } from "vitest";
import { ecartsPv } from "@/src/lib/store/repository";

const f = (id: string, pv: number, pvMax: number, nom = id) => ({ id, nom, pv, pvMax });

/**
 * Régression du bug « plein vie après Terminer » : l'écriture AUTOMATIQUE de
 * l'effet de sauvegarde a déjà réécrit des PV pleins par-dessus des dégâts.
 * La garde doit détecter TOUTE divergence PV (même id, même pvMax) entre le
 * stockage et le tampon — dans les deux sens — et ignorer le reste.
 */
describe("ecartsPv : garde de l'écriture automatique", () => {
  it("détecte une remontée de PV (tampon plein vie par-dessus des dégâts)", () => {
    expect(ecartsPv([f("a", 3, 7, "Maë")], [f("a", 7, 7, "Maë")])).toEqual(["Maë 3→7"]);
  });

  it("détecte aussi une redescente (tampon stale effaçant un soin)", () => {
    expect(ecartsPv([f("a", 9, 9, "Nyssa")], [f("a", 5, 9, "Nyssa")])).toEqual(["Nyssa 9→5"]);
  });

  it("signale chaque fiche divergente, les autres ignorées", () => {
    const stock = [f("a", 3, 7), f("b", 8, 9), f("c", 4, 4)];
    const tampon = [f("a", 7, 7), f("b", 9, 9), f("c", 4, 4)];
    expect(ecartsPv(stock, tampon)).toEqual(["a 3→7", "b 8→9"]);
  });

  it("ignore un changement de pvMax (recalcul légitime, hors garde)", () => {
    expect(ecartsPv([f("a", 3, 7)], [f("a", 5, 9)])).toEqual([]);
  });

  it("ignore stockage vide, tampon non-tableau et valeurs non numériques", () => {
    expect(ecartsPv(null, [f("a", 7, 7)])).toEqual([]);
    expect(ecartsPv([f("a", 3, 7)], null)).toEqual([]);
    expect(ecartsPv([f("a", 3, 7)], [{ id: "a", pvMax: 7 }])).toEqual([]);
    expect(ecartsPv([{ id: "a", pvMax: 7 }], [f("a", 7, 7)])).toEqual([]);
  });

  it("ignore les fiches absentes du stockage (créations récentes)", () => {
    expect(ecartsPv([f("a", 3, 7)], [f("a", 3, 7), f("nouveau", 5, 5)])).toEqual([]);
  });
});
