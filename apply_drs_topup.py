#!/usr/bin/env python3
"""Compléments : notes manquantes + mentions ogres (vérification DRS bestiaire)."""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
BEST = os.path.join(ROOT, "bestiaire")
DRS_URL = "https://drs.chroniques-oubliees.fr/fantasy/creatures"
DATE = "11/10/2026"
log = []


def path(folder):
    for fn in os.listdir(os.path.join(BEST, folder)):
        if fn.endswith(".md"):
            return os.path.join(BEST, folder, fn)
    raise RuntimeError(folder)


def verif(folder, statut, divs=()):
    p = path(folder)
    t = open(p, encoding="utf-8").read()
    if "Vérification DRS" in t:
        log.append(f"SKIP {folder}")
        return
    bloc = "\n".join([f"- Source DRS : {DRS_URL}",
                      f"- Vérification DRS ({DATE}) : {statut}"] +
                     [f"  - {d}" for d in divs])
    t2, n = re.subn(r"^(- Source (Notion|DRS)[^\n]*\n)", r"\1" + bloc + "\n",
                    t, count=1, flags=re.M)
    assert n == 1, folder
    open(p, "w", encoding="utf-8").write(t2)
    log.append(f"verif {folder}")


verif("nc-0-animal-minuscule",
      "conforme + Attaques ridicules/Minuscule (DRS).")
verif("nc-0-milicien", "conforme (Pique + Soutenir).",
      ["NC 0 (VTT) conservé ; DRS en ligne : NC 1/2."])
verif("nc-0-orc", "conforme (Hache/masse + Sensible à la lumière).",
      ["NC 0 (VTT) conservé ; DRS en ligne : NC 1/2."])
verif("nc-7-chimere-draconique",
      "conforme (serpent 1d4+3+poison, triple 1d6+6 + Souffle/Poison/Riposte/Vol).",
      ["Riposte sournoise : couverte par les capacités communes (images partagées avec la chimère)."])
verif("nc-11-cryohydre-a-10-tetes",
      "créature distincte du « Cryohydre à dix têtes » du DRS (NC 5, DEF 23, PV 150).",
      ["DRS : Morsure(10) +13 1d8+4+1d6 froid + Souffle 6d6+18 + têtes. Non repris (homebrew)."])
verif("nc-7-grand-elephant", "absent du DRS en ligne (variante locale).",
      ["Voir « Grand mâle » (NC +1, +2 att/DEF/DM, +20 PV, DRS)."])
verif("araignee-moyenne",
      "bloc d'édition antérieure, distinct de l'Araignée géante du DRS (NC 3).",
      ["Toile solide (L) : paralysie + FOR 15 (ancienne édition)."])


def notes_add(folder, bullets):
    p = path(folder)
    t = open(p, encoding="utf-8").read()
    add = "".join(f"\n- {b}" for b in bullets if f"\n- {b}" not in t)
    if not add:
        log.append(f"SKIP notes {folder}")
        return
    if "## Notes" in t:
        t = t.replace("## Notes", "## Notes" + add, 1)
    else:
        t = t.rstrip() + "\n\n## Notes" + add + "\n"
    open(p, "w", encoding="utf-8").write(t)
    log.append(f"notes {folder}")


notes_add("nc-3-ogre", [
    "DRS : au choix Tape dur ou Imparable (note de conception : nombreux ogres Tape dur redoutables sans attaque groupée).",
])
notes_add("nc-6-chef-ogre", [
    "DRS : au choix Tape dur ou Imparable (note de conception : nombreux ogres Tape dur redoutables sans attaque groupée).",
])

print(len(log), "actions")
for l in log:
    print(l)
