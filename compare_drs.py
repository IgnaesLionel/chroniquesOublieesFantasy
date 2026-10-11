#!/usr/bin/env python3
"""Compare DRS creatures (drs-page*.json) vs local bestiaire — v2 (parsing corrigé)."""
import json, glob, re, unicodedata

NOMBRES = {"un": "1", "une": "1", "deux": "2", "trois": "3", "quatre": "4",
           "cinq": "5", "six": "6", "sept": "7", "huit": "8", "neuf": "9",
           "dix": "10", "demi": "0.5"}

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\bd['’](\w)", r"\1", s)  # d'élite -> elite
    toks = re.sub(r"[^a-z0-9/.]+", " ", s).split()
    toks = [NOMBRES.get(t, t) for t in toks]
    return " ".join(toks)

def norm_cap(s):
    """Nom de capacité normalisé : sans parenthèses ni suffixes ni lettre d'action."""
    s = re.sub(r"\(.*", "", s).strip()
    s = re.sub(r"\s+[LMAG]$", "", s).strip()
    return norm(s)

def parse_drs(text):
    lines = text.split("\n")
    nc_badge = lines[0].strip() if len(lines) > 0 else ""
    nom = lines[1].strip() if len(lines) > 1 else "?"
    typ = lines[2].strip() if len(lines) > 2 else ""
    rec = {"nom": nom, "nc": nc_badge, "type": typ}
    for i, l in enumerate(lines):
        s = l.strip()
        if s.startswith("TAILLE") and len(s) > 6:
            rec["taille"] = s[6:].strip()
        elif s == "TAILLE" and i + 1 < len(lines):
            rec["taille"] = lines[i + 1].strip()
    for car in ["AGI", "CON", "FOR", "PER", "CHA", "INT", "VOL"]:
        try:
            j = lines.index(car)
            rec[car] = lines[j + 1].strip()
        except (ValueError, IndexError):
            rec[car] = "?"
    for key in ["DEF", "PV", "INIT"]:
        try:
            j = lines.index(key)
            v = lines[j + 1].strip()
            m = re.match(r"^(\d+)", v)
            rec[key] = m.group(1) if m else v
        except (ValueError, IndexError):
            rec[key] = "?"
    # Attaques : lignes après "Attaques" contenant un bonus (+X) et DM, ou "DM 0"/"DM 1"
    try:
        j = lines.index("Attaques")
    except ValueError:
        rec["attaques"] = []
        rec["capacites"] = []
        return rec
    atk, k = [], j + 1
    while k < len(lines):
        s = lines[k].strip()
        if s == "" or s == "VOIR LE DÉTAIL":
            k += 1
            continue
        if re.search(r"\+\d", s) and "DM" in s:
            atk.append(s)
            k += 1
            continue
        break
    rec["attaques"] = atk
    # Capacités : à partir de k, paragraphes (titre + corps), marqueurs L/A/G/M seuls
    rest = lines[k:]
    # regroupe en tenant compte des lignes vides
    paras, cur = [], []
    for l in rest:
        if l.strip() == "":
            if cur:
                paras.append(" ".join(cur).strip())
                cur = []
        else:
            cur.append(l.strip())
    if cur:
        paras.append(" ".join(cur).strip())
    paras = [p for p in paras if p and p != "VOIR LE DÉTAIL"]
    caps, i = [], 0
    while i < len(paras):
        t = paras[i]
        if t in ("L", "A", "G", "M") and caps:
            caps[-1]["action"] = t
            i += 1
            continue
        if t in ("L", "A", "G", "M"):
            i += 1
            continue
        body = ""
        if i + 1 < len(paras) and paras[i + 1] not in ("L", "A", "G", "M"):
            nxt = paras[i + 1]
            # le corps est long ou contient un point ; un titre est court sans point
            if len(nxt) > 50 or "." in nxt:
                body = nxt
                i += 1
            elif len(t) > 50 or "." in t:
                # t est en fait un corps sans titre ? on le garde comme texte
                pass
        caps.append({"nom": t, "texte": body[:400]})
        i += 1
    rec["capacites"] = caps
    return rec

def nc_num(s):
    if s is None:
        return None
    s = str(s).strip().split()[0].replace(",", ".")
    if "/" in s:
        a, b = s.split("/")
        return float(a) / float(b)
    try:
        return float(s)
    except ValueError:
        return s

drs = []
for f in sorted(glob.glob("drs-page*.json")):
    for t in json.load(open(f, encoding="utf-8")):
        drs.append(parse_drs(t))

print(f"DRS: {len(drs)} créatures")
local = json.load(open("src/lib/data/monstres-notion.json", encoding="utf-8"))
print(f"LOCAL: {len(local)} créatures")

loc_idx = {}
for m in local:
    loc_idx.setdefault(norm(m["nom"]), []).append(m)

# Correspondances manuelles DRS -> id local (variantes, coquilles, ordres de mots).
MAP_MANUEL = {
    'bandit vetaran': 'notion-nc-1-bandit-veteran',
    'gnoll chef': 'notion-nc-4-chef-gnoll',
    'gnoll de base': 'notion-nc-1-gnoll',
    'gnoll sergent': 'notion-nc-2-sergent-gnoll',
    'gobelin chef': 'notion-nc-2-chef-goblin',
    'gobelin shaman': 'notion-nc-1-shaman-gobelin',
    'kobold chef': 'notion-nc-1-chef-kobold',
    'kobold de base': 'notion-nc-0-kobold',
    'kobold pretre': 'notion-nc-2-pretre-kobold',
    'ogre chef': 'notion-nc-6-chef-ogre',
    'ogre de base': 'notion-nc-3-ogre',
    'orc berserker': 'notion-nc-2-berserk-orc',
    'orc chef': 'notion-nc-6-chef-orc',
    'orc de base': 'notion-nc-0-orc',
    'orc sergent': 'notion-nc-3-sergent-orc',
    'orc shaman': 'notion-nc-3-shaman-orc',
    'goule abomination': 'notion-nc-4-ghoule-abomination',
    'squelette de base': 'notion-nc-1-squelette',
    'veteran ou garde du palais ducal': 'notion-nc-2-veteran',
}

def find_local(d):
    key = norm(d["nom"])
    if key in MAP_MANUEL:
        want = MAP_MANUEL[key]
        for m in local:
            if m["id"] == want:
                return [m]
        return []
    cands = loc_idx.get(key, [])
    if not cands:
        # repli partiel : nom DRS contenu dans nom local ou inverse (sans variantes)
        base = norm(re.sub(r"\(.*", "", d["nom"]))
        for k, v in loc_idx.items():
            kb = norm(re.sub(r"\(.*", "", v[0]["nom"]))
            if kb == base or kb == key or key == kb:
                cands = v
                break
    if len(cands) > 1:
        # départage par NC
        dnc = nc_num(d.get("nc"))
        for c in cands:
            if c["niveau"] == dnc:
                return [c]
    return cands

report, matched, ok = [], 0, 0
for d in drs:
    cands = find_local(d)
    if not cands:
        report.append(f"--- DRS '{d['nom']}' (NC {d.get('nc')}) : ABSENT du bestiaire local")
        continue
    matched += 1
    m = cands[0]
    diffs = []
    dnc, lnc = nc_num(d.get("nc")), m["niveau"]
    if dnc != lnc:
        diffs.append(f"NC DRS={d.get('nc')} vs local={lnc}")
    if str(d.get("DEF")) != str(m["defense"]):
        diffs.append(f"DEF DRS={d.get('DEF')} vs local={m['defense']}")
    if str(d.get("PV")) != str(m["pv"]):
        diffs.append(f"PV DRS={d.get('PV')} vs local={m['pv']}")
    if str(d.get("INIT")) != str(m.get("initiativeFiche")):
        diffs.append(f"INIT DRS={d.get('INIT')} vs local fiche={m.get('initiativeFiche')}")
    #attaques : compare (bonus, DM) par posição
    def atk_key(a):
        mm = re.search(r"\+(\d+)\s*[·.]\s*DM\s*(.+)", a)
        if mm:
            return (mm.group(1), mm.group(2).strip())
        return (None, a)
    da = [atk_key(a) for a in d.get("attaques", [])]
    la = [(str(a["bonus"]), a.get("degatsAffiche", a["degats"])) for a in m.get("attaques", [])]
    # compare par nom d'attaque (l'ordre peut différer : arc/épée, marteau/rocher...)
    def aname(a):
        w = norm(re.split(r"[+(·]", a["nom"])[0])
        w = re.sub(r"\b(et|ou)\b", " ", w)
        return " ".join(t[:-1] if len(t) > 4 and t.endswith("s") else t for t in w.split())
    lmap = {}
    for a in m.get("attaques", []):
        lmap.setdefault(aname(a), []).append(a)
    for src in d.get("attaques", []):
        db, dd = atk_key(src)
        braw = norm(re.split(r"[+(·]", src)[0])
        braw = re.sub(r"\b(et|ou)\b", " ", braw)
        base = " ".join(t[:-1] if len(t) > 4 and t.endswith("s") else t for t in braw.split())
        hit = None
        for k, v in lmap.items():
            if k == base or k.startswith(base) or base.startswith(k):
                hit = v[0]
                break
        if hit is None:
            diffs.append(f"attaque DRS '{src}' : SANS équivalent local")
            continue
        lb, ld = str(hit["bonus"]), hit.get("degatsAffiche", hit["degats"])
        if db != lb or norm(dd) != norm(ld):
            diffs.append(f"attaque '{hit['nom']}' : DRS bonus={db} DM={dd} vs local bonus={lb} DM={ld}")
    if len(da) != len(la):
        diffs.append(f"nb attaques : DRS={len(da)} vs local={len(la)}")
    dcaps = [(c["nom"], c.get("action")) for c in d.get("capacites", [])]
    lset = set(norm_cap(c) for c in m.get("capacites", []))
    manq = [n + (f" ({a})" if a else "") for n, a in dcaps if norm_cap(n) not in lset and len(n) < 60]
    if manq:
        diffs.append(f"capacités DRS non reprises en local: {manq}")
    status = "OK" if not diffs else "ÉCARTS"
    if not diffs:
        ok += 1
    report.append(f"[{status}] DRS '{d['nom']}' (NC {d.get('nc')}) <-> local '{m['nom']}' ({m['id']})")
    for x in diffs:
        report.append(f"    - {x}")

drs_names = set(norm(d["nom"]) for d in drs)
for m in local:
    km = norm(m["nom"])
    if km not in drs_names and not any(km in norm(d["nom"]) or norm(d["nom"]) in km for d in drs):
        report.append(f"--- local '{m['nom']}' ({m['id']}) : SANS équivalent DRS")

with open("drs-rapport.txt", "w", encoding="utf-8") as f:
    f.write(f"DRS: {len(drs)} / LOCAL: {len(local)} / MATCHES: {matched} / OK: {ok}\n\n")
    f.write("\n".join(report) + "\n")
print(f"MATCHES: {matched} / OK: {ok}")
