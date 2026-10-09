"""Construit bestiaire/index.md a partir de scrape_data.json (sans vision)."""
import json, re
from pathlib import Path

OUT = Path("bestiaire")
data = json.loads((OUT / "scrape_data.json").read_text(encoding="utf-8"))
try:
    communs = json.loads((OUT / "capacites_communes.json").read_text(encoding="utf-8"))
except Exception:
    communs = {}

def nc_key(t: str):
    m = re.search(r"NC\s*([\d.,]+)", t or "")
    if not m:
        return (999, t or "")
    try:
        return (float(m.group(1).replace(",", ".")), t)
    except Exception:
        return (999, t)

cats = {}
for r in data:
    cats.setdefault(r.get("cat") or "Sans catégorie", []).append(r)

lines = []
lines.append("# Bestiaire — Index")
lines.append("")
lines.append(f"Source : https://silver-pen-32f.notion.site/Bestiaire-2edd3d06b0988074a972ce20c150046d")
lines.append(f"Fiches : {len(data)} — Images : {sum(len(r.get('images', [])) for r in data)}")
lines.append("")
for cat in ["Animaux", "Humains", "Monstres/Créatures", "Monstres-Creatures", "Compagnions"]:
    lst = cats.get(cat, [])
    if not lst:
        continue
    lines.append(f"## {cat} ({len(lst)})")
    lines.append("")
    lines.append("| Nom | Slug / dossier | Images | Fiche |")
    lines.append("|---|---|---|---|")
    for r in sorted(lst, key=lambda x: nc_key(x.get("text", ""))):
        slug = r["slug"]
        nim = len(r.get("images", []))
        warn = " ⚠" if r.get("warnings") else ""
        lines.append(f"| {r['text']} | `{slug}/` | {nim}{warn} | [{slug}.md](./{slug}/{slug}.md) |")
    lines.append("")
# categories restantes éventuelles
for cat, lst in cats.items():
    if cat in ["Animaux", "Humains", "Monstres/Créatures", "Monstres-Creatures", "Compagnions"]:
        continue
    lines.append(f"## {cat} ({len(lst)})")
    lines.append("")
    for r in sorted(lst, key=lambda x: nc_key(x.get("text", ""))):
        lines.append(f"- {r['text']} → ./{r['slug']}/{r['slug']}.md ({len(r.get('images', []))} img)")
    lines.append("")

lines.append("## Capacités communes (même image réutilisée sur plusieurs monstres)")
lines.append("")
if communs:
    lines.append(f"{len(communs)} images-attachments réutilisées détectées automatiquement.")
    lines.append("")
    for aid, uses in sorted(communs.items(), key=lambda x: -len(x[1])):
        lines.append(f"- `{aid}` ({len(uses)}) : {', '.join(uses)}")
else:
    lines.append("Aucune réutilisation détectée (ou scrape incomplet). Voir les fiches pour les noms de capacités partagées : Soutenir, Charge, Enragé, Embuscade, Venin, Vol rapide, Emporter dans les airs, etc.")
lines.append("")
lines.append("## Dossiers par monstre")
lines.append("")
lines.append("Chaque dossier `bestiaire/<slug>/` contient `images/img-N.webp|.png` (captures réseau complètes, vérifiées PIL) + `<slug>.md` (transcription intégrale des images lues).")
(OUT / "index.md").write_text("\n".join(lines), encoding="utf-8")
print(f"index.md écrit : {len(data)} fiches")
