import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASSES } from "@/src/lib/data/classes";
import { SEED_SORTS } from "@/src/lib/data/sorts";
import { REGLES_PROFILS } from "@/src/lib/rules/personnage";
import {
  classeFamille,
  familleDeLaVoie,
  familleDesProfils,
  familleDuProfil,
  familleDuSort,
} from "@/src/lib/ui/famille";

// Vestiaire des familles : chaque fiche, sort, voie ou capacité doit pouvoir
// dire sa famille (donc sa couleur) sans deviner ; le CSS doit rester lisible.

describe("Couleurs de famille : lecture d'un profil, d'une voie, d'un sort", () => {
  it("classe CSS par famille (et repli neutre)", () => {
    expect(classeFamille("Combattant")).toBe("fam-combattant");
    expect(classeFamille("Aventurier")).toBe("fam-aventurier");
    expect(classeFamille("Mystique")).toBe("fam-mystique");
    expect(classeFamille("Mage")).toBe("fam-mage");
    // Ni famille, ni famille connue (profil de monstre, saisie libre) : neutre.
    expect(classeFamille(null)).toBe("fam-neutre");
    expect(classeFamille("")).toBe("fam-neutre");
    expect(classeFamille("Rat géant")).toBe("fam-neutre");
  });

  it("les 14 profils tombent sur la famille de la règle", () => {
    for (const [profil, regle] of Object.entries(REGLES_PROFILS)) {
      expect(familleDuProfil(profil), profil).toBe(regle.famille);
    }
    expect(familleDuProfil("  Sorcier ")).toBe("Mage"); // espaces tolérés
    expect(familleDuProfil("Rat géant")).toBeNull(); // monstre : pas de famille
    expect(familleDuProfil(undefined)).toBeNull();
  });

  it("famille commune d'une liste de profils (sorts) ; null si mixte ou vide", () => {
    expect(familleDesProfils(["Prêtre"])).toBe("Mystique");
    expect(familleDesProfils(["Sorcier", "Ensorceleur", "Magicien", "Forgesort"])).toBe("Mage");
    expect(familleDesProfils([])).toBeNull(); // toutes classes
    expect(familleDesProfils(null)).toBeNull();
    expect(familleDesProfils(["Prêtre", "Voleur"])).toBeNull(); // jamais un accent faux
  });

  it("les 70 voies de profil portent la famille de leur profil (+ Voie du mage)", () => {
    for (const classe of CLASSES) {
      for (const voie of classe.voies) {
        expect(familleDeLaVoie(voie), `${classe.profil} / ${voie}`).toBe(classe.famille);
      }
    }
    expect(familleDeLaVoie("Voie du mage")).toBe("Mage");
    expect(familleDeLaVoie("Voie du nain")).toBeNull(); // voie de peuple : neutre
    expect(familleDeLaVoie(undefined)).toBeNull();
  });

  it("chaque sort du grimoire a une famille (ou aucune : toutes classes)", () => {
    for (const sort of SEED_SORTS) {
      const profils = sort.familles ?? [];
      const famille = familleDuSort(sort);
      if (profils.length === 0) expect(famille, sort.nom).toBeNull();
      else expect(famille, `${sort.nom} (${profils.join(", ")})`).not.toBeNull();
    }
    // `familles: []` = toutes classes : aucune famille, même si la voie en a une.
    expect(familleDuSort({ familles: [], voie: "Voie de la foi" })).toBeNull();
    // Voie seule (sort d'auteur sans profils renseignés) : la voie tranche.
    expect(familleDuSort({ voie: "Voie de la foi" })).toBe("Mystique");
    expect(familleDuSort({ familles: null, voie: "Voie inconnue" })).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Garde-fou sur app/globals.css : couleurs distinctes et texte lisible.
// --------------------------------------------------------------------------
function contraste(hexA: string, hexB: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [la, lb] = [lum(hexA), lum(hexB)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function valeurCss(css: string, variable: string): string {
  const m = css.match(new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`${variable} introuvable dans app/globals.css`);
  return m[1];
}

const css = fs.readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("Palette des familles (app/globals.css)", () => {
  const FAMILLES_COULEUR = ["Combattant", "Aventurier", "Mystique", "Mage"] as const;

  it("chaque famille pose trait, fond et texte", () => {
    for (const famille of FAMILLES_COULEUR) {
      const bloc = css.match(new RegExp(`\\.${classeFamille(famille)}\\s*\\{([^}]*)\\}`));
      expect(bloc, classeFamille(famille)).toBeTruthy();
      for (const variable of ["--fam-trait", "--fam-fond", "--fam-texte"]) {
        expect(bloc![1], `${famille} ${variable}`).toContain(variable);
      }
    }
  });

  it("le texte reste lisible sur les fonds sombres (≥ 4.5:1)", () => {
    const fonds = [valeurCss(css, "--color-zinc-950"), valeurCss(css, "--color-zinc-900")];
    for (const famille of FAMILLES_COULEUR) {
      const bloc = css.match(new RegExp(`\\.${classeFamille(famille)}\\s*\\{([^}]*)\\}`))![1];
      const texte = bloc.match(/--fam-texte:\s*(#[0-9a-fA-F]{6})/)![1];
      for (const fond of fonds) {
        expect(contraste(texte, fond), `${famille} ${texte} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("les 4 traits restent bien distincts (pas deux familles de la même couleur)", () => {
    const traits = FAMILLES_COULEUR.map((f) => {
      const bloc = css.match(new RegExp(`\\.${classeFamille(f)}\\s*\\{([^}]*)\\}`))![1];
      return bloc.match(/--fam-trait:\s*(#[0-9a-fA-F]{6})/)![1].toLowerCase();
    });
    expect(new Set(traits).size).toBe(4);
    for (let i = 0; i < traits.length; i++) {
      for (let j = i + 1; j < traits.length; j++) {
        const canaux = [1, 3, 5].map((k) => Math.abs(parseInt(traits[i].slice(k, k + 2), 16) - parseInt(traits[j].slice(k, k + 2), 16)));
        expect(canaux.reduce((a, b) => a + b, 0), `${traits[i]} vs ${traits[j]}`).toBeGreaterThan(60);
      }
    }
  });
});
