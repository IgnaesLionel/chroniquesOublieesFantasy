#!/usr/bin/env python3
"""Importe les fiches bestiaire/*.md (générées depuis Notion) vers src/lib/data/monstres-notion.json.

Usage: python3 bestiaire/import_notion.py
Ne fait que lire bestiaire/ et écrire le JSON + rapport console. Relançable.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "src" / "lib" / "data" / "monstres-notion.json"

SKIP_PREFIXES = ("voie-",)  # voies de compagnons : pas des créatures

CATEGORIE_TO_TYPE = {
    "Animaux": "Animal",
    "Humains": "Humanoïde",
    "Monstres/Créatures": "Créature",
    "Compagnons": "Compagnon",
}

# Aliases Notes "Capacités communes" -> clés du catalogue (src/lib/data/capacites-partagees.ts)
CYCLE_ZOMBIE = ["sans-esprit", "lenteur", "insensible-douleur", "resistance-zombie"]
CYCLE_VAMPIRIQUE = ["absorption-energie", "immortel", "forme-gazeuse", "regard-envoutant",
                    "resistance-impie", "riposte-eclair", "transformation-chauve-souris", "vulnerabilite-soleil"]
CYCLE_MOMIE = ["putrefaction", "resistance-momie"]
CYCLE_GOULE = ["paralysie", "fievre-goules", "miasmes"]

def norm_key(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.strip().rstrip(".").strip().lower())


ALIASES = {
    "cycle zombie": CYCLE_ZOMBIE,
    "cycle mort-vivant": CYCLE_ZOMBIE,
    "cycle vampirique": CYCLE_VAMPIRIQUE,
    "cycle vampirique complet": CYCLE_VAMPIRIQUE,
    "cycle momie": CYCLE_MOMIE,
    "cycle goule": CYCLE_GOULE,
    "soutenir": ["soutenir"],
    "vol rapide": ["vol-rapide"],
    "emporter dans les airs": ["emporter-airs"],
    "attaque en meute": ["attaque-en-meute"],
    "embuscade": ["embuscade"],
    "araignee chasseuse": ["embuscade"],
    "charge": ["charge"],
    "enrage": ["enrage"],
    "devorer": ["devorer"],
    "interchangeables": ["interchangeables"],
    "imparable": ["imparable"],
    "tape dur": ["tape-dur"],
    "teigneuse": ["teigneuse"],
    "souffle": ["souffle"],
    "fauchage": ["fauchage"],
    "balayage": ["fauchage"],
    "vision dans le noir": ["vision-noir"],
    "guerison acceleree": ["guerison-acceleree"],
    "sergent": ["sergent"],
    "capitaine": ["capitaine"],
    "commandant": ["commandant"],
    "chef de meute": ["chef-de-meute"],
    "chef": ["chef-bandit"],
    "attaque en traitre": ["attaque-en-traitre"],
    "l'hallali": ["hallali"],
    "hallali": ["hallali"],
    "rires insupportables": ["rires-insupportables"],
    "agripper": ["agripper"],
    "encorner": ["encorner"],
    "enlevement": ["enlevement"],
    "sensible a la lumiere": ["sensible-lumiere"],
    "tres petit": ["tres-petit"],
    "injonction mortelle": ["injonction-mortelle"],
    "lumiere": ["lumiere"],
    "familier": ["familier"],
    "vol": ["vol-stationnaire"],
    "teleportation": ["teleportation"],
    "inspirer la terreur": ["inspirer-terreur"],
    "paralysie": ["paralysie"],
    "fievre des goules": ["fievre-goules"],
    "miasmes": ["miasmes"],
    "putrefaction": ["putrefaction"],
    "animer un cadavre": ["animer-cadavre"],
    "vampirisation": ["vampirisation"],
    "brise-genou": ["brise-genou"],
    "brise genou": ["brise-genou"],
    "les 8 ci-dessus": CYCLE_VAMPIRIQUE,
    "reduction froid": ["reduction-froid"],
    "poison": ["poison-chimere"],
    "poison chimere": ["poison-chimere"],
    "riposte": ["riposte-sournoise"],
    "riposte sournoise": ["riposte-sournoise"],
    "resistances": ["resistances-demon"],
    "poison/riposte": ["poison-chimere", "riposte-sournoise"],
}

# Token ambigu selon la créature
def context_keys(tok: str, dirname: str) -> list[str] | None:
    if tok == "resistance aux dm":
        if "squelette" in dirname:
            return ["resistance-squelette"]
        if "momie" in dirname:
            return ["resistance-momie"]
        return ["resistance-zombie"]
    return None

DICE_RE = re.compile(r"^(\d+)d(\d+)([+-]\d+)?$")


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def normalize_degats(expr: str, warnings: list, ctx: str) -> tuple[str, str]:
    """Retourne (moteur, affiche). Le moteur doit passer parseDiceExpression."""
    affiche = expr.strip()
    e = affiche.replace("°", "").replace(" ", "")
    # Coupe le texte descriptif : parenthèses et suite après virgule (jamais des dés valides)
    e = re.sub(r"\(.*$", "", e).split(",")[0]
    if re.fullmatch(r"\d+", e):
        n = int(e)
        return (f"1d1{'+'+str(n-1) if n > 1 else ''}" if n >= 1 else "1d1-1", affiche)
    toks = [(m.group(0), m.start(), m.end()) for m in
            re.finditer(r"[+-]?\d*d\d+|[+-]\d+", e)]
    dice: dict[int, int] = {}
    mod = 0
    for tok, _, _ in toks:
        md = re.fullmatch(r"([+-]?)(\d*)d(\d+)", tok)
        if md:
            sign = -1 if md.group(1) == "-" else 1
            count = int(md.group(2)) if md.group(2) else 1
            dice[int(md.group(3))] = dice.get(int(md.group(3)), 0) + sign * count
        else:
            mod += int(tok)
    rest = e
    for tok, _, _ in toks:
        rest = rest.replace(tok, "", 1)
    junk = bool(re.search(r"[A-Za-z]", rest))
    if not dice:
        warnings.append(f"{ctx}: dégâts non normalisables '{affiche}' -> 1d1 (à vérifier)")
        return ("1d1", affiche + " [DM à vérifier]")
    if junk:
        warnings.append(f"{ctx}: extrait le jet de '{affiche}'")
    # Replie les groupes surnuméraires en bonus plat (moyenne arrondie inf.)
    faces = sorted(dice)[0]
    total = dice.pop(faces)
    if total < 1:
        total = 1
        warnings.append(f"{ctx}: nombre de dés corrigé à 1 ('{affiche}')")
    for f2, c2 in dice.items():
        mod += c2 * (f2 + 1) // 2
        warnings.append(f"{ctx}: dés hétérogènes '{affiche}' ({c2}d{f2} repliés en +plat)")
    moteur = f"{total}d{faces}"
    if mod:
        moteur += f"{mod:+d}"
    return (moteur, affiche)


ATK_PAREN_RE = re.compile(r"\(Attaque\s*([+-]?\d+)(?:,\s*Dommages?\s*([^)]+))?\)")


def parse_one_attack(chunk: str, mid: str, warnings: list, aid: str) -> dict | None:
    chunk = chunk.strip()
    bonus: int | None = None
    degats_raw: str | None = None
    nom = chunk
    # Le préfixe "Nom +X, DM Y" prime ; la parenthèse "(Attaque +X, Dommages Y)" n'est qu'un repli.
    prefix = chunk
    m = ATK_PAREN_RE.search(chunk)
    if m:
        prefix = chunk[: m.start()].strip().rstrip(",")
    m2 = re.match(r"(.+?)\s*([+-]?\d+)(?:\s*\([^)]*\))?\s*,\s*DM\s*(.*)", prefix)
    if m2:
        nom, bonus, degats_raw = m2.group(1).strip(), int(m2.group(2)), m2.group(3).strip()
    if degats_raw is None and m is not None:
        bonus = int(m.group(1))
        nom = prefix
        if m.group(2):
            inner = m.group(2).strip()
            dm = re.match(r"((?:\d*d?\d+(?:[+-]\d+)?))", inner.replace(" ", ""))
            degats_raw = dm.group(1) if dm else None
            if degats_raw is None:
                warnings.append(f"{mid}/{nom or chunk[:40]}: DM parenthèse inanalysables '{inner}'")
    if degats_raw is None:
        m3 = re.match(r"(.+?),\s*DM\s*(.+)", prefix)
        if m3:
            nom, bonus, degats_raw = m3.group(1).strip(), 0, m3.group(2).strip()
            warnings.append(f"{mid}/{nom[:40]}: bonus absent, +0 (à vérifier)")
    if degats_raw is None and ("DM" in chunk or "Attaque" in chunk):
        # Dernier recours : "Nom +X DM ..." sans virgule (ex: Attaque magique +15 DM)
        m4 = re.match(r"([^()]+?)\s*([+-]?\d+)\s+DM\b", prefix)
        if m4:
            nom, bonus, degats_raw = m4.group(1).strip(), int(m4.group(2)), ""
    if bonus is None or degats_raw is None:
        return None
    nom = re.sub(r"\s+", " ", nom)
    if not degats_raw:
        warnings.append(f"{mid}/{nom}: DM vides -> 1d1 (à vérifier)")
        return {"id": aid, "nom": nom, "bonus": bonus, "degats": "1d1",
                "degatsAffiche": "DM — [à vérifier]"}
    moteur, affiche = normalize_degats(degats_raw, warnings, f"{mid}/{nom}")
    return {"id": aid, "nom": nom, "bonus": bonus,
            "degats": moteur, "degatsAffiche": affiche}


def parse_attaques(line: str, mid: str, warnings: list) -> list[dict]:
    out = []
    for i, chunk in enumerate(re.split(r"\s*;\s*", line.strip())):
        a = parse_one_attack(chunk, mid, warnings, f"{mid}-a{i}")
        if a:
            out.append(a)
        else:
            warnings.append(f"{mid}: attaque inanalysable '{chunk[:80]}'")
    return out


def parse_fiche(path: Path, warnings: list) -> dict | None:
    text = path.read_text(encoding="utf-8")
    dirname = path.parent.name
    mid = f"notion-{dirname}"
    lines = text.splitlines()

    title = next((l[2:] for l in lines if l.startswith("# ")), dirname)
    get = lambda k: next((l.split(":", 1)[1].strip() for l in lines
                          if l.startswith(f"- {k} :")), "")
    categorie = get("Catégorie")
    nc_raw = get("NC")
    nc = float(nc_raw.replace(",", ".")) if re.fullmatch(r"\d+(?:[.,]\d+)?", nc_raw) else None
    source = get("Source Notion")
    description = get("Description")

    # Profils : le premier ## Profil est la référence
    profils = [i for i, l in enumerate(lines) if l.startswith("## Profil")]
    if not profils:
        warnings.append(f"{mid}: aucun profil, ignoré")
        return None
    p0, p1 = profils[0], profils[1] if len(profils) > 1 else len(lines)
    if len(profils) > 1:
        warnings.append(f"{mid}: {len(profils)} profils, premier conservé")
    block = "\n".join(lines[p0:p1])
    if nc is None:
        m = re.search(r"NC\s*(\d+(?:[.,]\d+)?)", title + "\n" + block)
        nc = float(m.group(1).replace(",", ".")) if m else None
    if nc is None:
        nc = 1
        warnings.append(f"{mid}: NC introuvable, défaut 1 (à vérifier)")
    bullets = [l[2:].strip() for l in lines[p0:p1] if l.startswith("- ")]
    bmap = {}
    for b in bullets:
        if " : " in b:
            k, v = b.split(" : ", 1)
            bmap[k.strip()] = v.strip()

    nom_profil = lines[p0].split("—", 1)[1].strip() if "—" in lines[p0] else title
    nom_profil = re.sub(r"\s*\(bloc ancienne édition.*$", "", nom_profil).strip()
    nom = re.sub(r"^NC\s*[\d.,]+\s*", "", title).strip() or nom_profil

    type_taille = bmap.get("Type", "")
    m = re.search(r"Initiative\s*(\d+)\s*[—-]\s*(?:Défense|DEF)\s*(\d+)(?:\s*\(RD\s*(\d+)\))?", block)
    initiative = int(m.group(1)) if m else 0
    defense = int(m.group(2)) if m else 10
    rd = int(m.group(3)) if m and m.group(3) else 0
    if not m:
        warnings.append(f"{mid}: initiative/défense introuvables (défaut 0/10)")
    m = re.search(r"(?:Vigueur|PV)\s*(\d+)", block)
    pv = int(m.group(1)) if m else 1
    if not m:
        warnings.append(f"{mid}: PV introuvables (défaut 1)")
    if pv < 1:
        warnings.append(f"{mid}: PV {pv} -> plancher 1 (à vérifier en jeu)")
        pv = 1
    m = re.search(r"(?:AGI|DEX)\s*([+-]?\d+)", block)
    init_mod = int(m.group(1)) if m else 0
    m = re.search(r"Déplacement\s*(\d+)\s*m", block)
    deplacement = int(m.group(1)) if m else None
    taille = ""
    mt = re.search(r"Taille\s*:\s*([^—\n]+)", block)
    if mt:
        taille = mt.group(1).strip()

    attaques = parse_attaques(bmap.get("Attaques", ""), mid, warnings) if bmap.get("Attaques") else []
    if not attaques:
        # Puces simples "- Nom +X, DM Y" sans label (blocs ancienne édition)
        n = 0
        for b in bullets:
            if " : " in b or b.startswith("Attaques"):
                continue
            for sub in re.split(r"\s*;\s*", b):
                a = parse_one_attack(sub, mid, warnings, f"{mid}-a{n}")
                if a:
                    attaques.append(a)
                    n += 1
    if not attaques:
        warnings.append(f"{mid}: aucune attaque (créature pacifique ou à saisir ?)")

    # Actions -> noms de capacités
    capacites: list[str] = []
    for act in re.split(r"\s*;\s*", bmap.get("Actions", "")):
        act = act.strip()
        if not act:
            continue
        nom_c = re.split(r"\s+-\s+", act, maxsplit=1)[0]
        nom_c = re.sub(r"\s*\(L\)\s*$", "", nom_c).strip()
        if nom_c and nom_c not in capacites:
            capacites.append(nom_c)

    # Capacités détaillées (### ...)
    details = []
    for i, l in enumerate(lines):
        if l.startswith("### "):
            nom_c = l[4:].strip()
            body = "\n".join(x for x in lines[i + 1:] if x.strip() and not x.startswith("#")).strip()
            body = body.split("\n## ")[0]
            if nom_c not in capacites and "ancienne édition" not in nom_c:
                capacites.append(nom_c)
            details.append({"nom": nom_c, "description": body[:600]})

    # Capacités communes (Notes)
    partagees: list[str] = []
    for l in lines:
        if l.startswith("- Capacités communes :"):
            brut = l.split(":", 1)[1]
            brut = re.sub(r"\([^)]*\)", "", brut)
            brut = re.sub(r"poison\s*/\s*riposte", "poison chimere, riposte sournoise", brut, flags=re.IGNORECASE)
            for tok in re.split(r",|\bet\b|\+|/", brut):
                tok = norm_key(tok)
                if not tok:
                    continue
                keys = ALIASES.get(tok) or context_keys(tok, dirname)
                if keys is None:
                    warnings.append(f"{mid}: capacité commune inconnue '{tok}'")
                    continue
                for k in keys:
                    if k not in partagees:
                        partagees.append(k)

    notes_extra = bmap.get("Notes (onglet Notes)", "")
    return {
        "id": mid, "kind": "monstre", "nom": nom_profil or nom,
        "type": type_taille.split("—")[0].replace("Type", "").strip() or CATEGORIE_TO_TYPE.get(categorie, "Créature"),
        "niveau": nc if nc is not None else 1,
        "pv": pv, "pvMax": pv, "defense": defense, "initMod": init_mod,
        "attaques": attaques, "capacites": capacites,
        "capacitesPartagees": partagees, "capacitesDetails": details,
        "description": description, "comportement": "",
        "taille": taille, "categorie": categorie, "rd": rd,
        "deplacement": deplacement, "initiativeFiche": initiative,
        "sourceUrl": source, "notes": notes_extra, "exemple": False,
    }


def main() -> None:
    creatures = sorted(p for p in ROOT.iterdir()
                       if p.is_dir() and not p.name.startswith(SKIP_PREFIXES)
                       and list(p.glob("*.md")))
    out, warnings, skipped = [], [], []
    for d in creatures:
        mds = sorted(d.glob("*.md"))
        fiche = parse_fiche(mds[0], warnings)
        if fiche:
            out.append(fiche)
        else:
            skipped.append(d.name)
    ids = [m["id"] for m in out]
    assert len(ids) == len(set(ids)), "IDs dupliqués !"
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Créatures : {len(out)} | Ignorés : {len(skipped)} {skipped}")
    print(f"Avertissements : {len(warnings)}")
    for w in warnings:
        print("  !", w.encode("ascii", "replace").decode())
    print(f"Écrit : {OUT}")


if __name__ == "__main__":
    main()
