#!/usr/bin/env python3
"""Applique les corrections issues de la vérification DRS des 91 créatures.

Conventions :
- VTT (captures Notion) = source du programme ; conservé en cas de conflit
  ambigu avec le DRS en ligne (noté sur la fiche pour arbitrage MJ).
- DRS (livre des règles en ligne) = référence ; ajouté quand absent,
  corrigé quand la valeur programme est impossible ou contredite par le VTT.
- Chaque fiche vérifiée reçoit une ligne « Source DRS » + « Vérification DRS ».
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
BEST = os.path.join(ROOT, "bestiaire")
JSON_PATH = os.path.join(ROOT, "src", "lib", "data", "monstres-notion.json")
DRS_URL = "https://drs.chroniques-oubliees.fr/fantasy/creatures"
DATE = "11/10/2026"

data = json.load(open(JSON_PATH, encoding="utf-8"))
idx = {m["id"]: m for m in data}
log = []


def md_path(folder):
    for fn in os.listdir(os.path.join(BEST, folder)):
        if fn.endswith(".md"):
            return os.path.join(BEST, folder, fn)
    raise RuntimeError("md introuvable: " + folder)


def read_md(folder):
    return open(md_path(folder), encoding="utf-8").read()


def write_md(folder, text):
    open(md_path(folder), "w", encoding="utf-8").write(text)


def add_verif(folder, statut, divergences=()):
    """Insère Source DRS + Vérification DRS après la ligne Source Notion/DRS."""
    t = read_md(folder)
    if "Vérification DRS" in t:
        log.append(f"SKIP verif (déjà) {folder}")
        return
    lines = [f"- Source DRS : {DRS_URL}",
             f"- Vérification DRS ({DATE}) : {statut}"]
    lines += [f"  - {d}" for d in divergences]
    bloc = "\n".join(lines)
    t, n = re.subn(r"^(- Source (Notion|DRS)[^\n]*\n)", r"\1" + bloc + "\n",
                    t, count=1, flags=re.M)
    if n == 0:
        t, n = re.subn(r"^(- Catégorie[^\n]*\n)", r"\n" + bloc + r"\1", t,
                       count=1, flags=re.M)
    assert n == 1, folder
    write_md(folder, t)
    log.append(f"verif {folder} : {statut[:60]}")


def add_section(folder, titre, corps, actions_nom=None):
    """Ajoute une section ### + nom aux Actions si action. Idempotent."""
    t = read_md(folder)
    if f"### {titre}" in t:
        log.append(f"SKIP section {titre} ({folder})")
        return t
    sec = f"\n### {titre}\n\n{corps}\n"
    if "## Images" in t:
        t = t.replace("## Images", sec + "\n## Images", 1)
    else:
        t = t.rstrip() + "\n" + sec
    if actions_nom:
        t = re.sub(r"^(- Actions : .*)$", r"\1 ; " + actions_nom, t, count=1,
                   flags=re.M)
    write_md(folder, t)
    log.append(f"section {titre} ({folder})")
    return t


def json_add_cap(mid, nom, description=None, shared=None):
    m = idx[mid]
    if nom not in m["capacites"]:
        m["capacites"].append(nom)
        log.append(f"json cap +{nom} ({mid})")
    else:
        log.append(f"SKIP json cap {nom} ({mid})")
    if description and not any(d["nom"] == nom for d in m.get("capacitesDetails", [])):
        m.setdefault("capacitesDetails", []).append(
            {"nom": nom, "description": description[:600]})
        log.append(f"json detail +{nom} ({mid})")
    if shared:
        m.setdefault("capacitesPartagees", [])
        if shared not in m["capacitesPartagees"]:
            m["capacitesPartagees"].append(shared)
            log.append(f"json shared +{shared} ({mid})")


def json_set(mid, **kw):
    m = idx[mid]
    for k, v in kw.items():
        if m.get(k) != v:
            m[k] = v
            log.append(f"json {mid}.{k} -> {v!r}")


def json_atk(mid, nom_ou_index, bonus=None, degats=None, affiche=None,
             renommer=None):
    m = idx[mid]
    a = m["attaques"][nom_ou_index] if isinstance(nom_ou_index, int) else next(
        x for x in m["attaques"] if x["nom"] == nom_ou_index)
    if renommer and a["nom"] != renommer:
        log.append(f"json atk rename {a['nom']!r} -> {renommer!r} ({mid})")
        a["nom"] = renommer
    if bonus is not None and a["bonus"] != bonus:
        a["bonus"] = bonus
        log.append(f"json atk {a['nom']}.bonus -> {bonus} ({mid})")
    if degats is not None and a["degats"] != degats:
        a["degats"] = degats
        log.append(f"json atk {a['nom']}.degats -> {degats} ({mid})")
    if affiche is not None and a.get("degatsAffiche") != affiche:
        a["degatsAffiche"] = affiche
        log.append(f"json atk {a['nom']}.affiche -> {affiche} ({mid})")


def md_sub(folder, old, new):
    t = read_md(folder)
    if new in t:
        log.append(f"SKIP sub (déjà) ({folder}): {new[:50]!r}...")
        return
    assert old in t, f"{folder}: introuvable {old[:60]!r}"
    write_md(folder, t.replace(old, new, 1))
    log.append(f"md sub ({folder}): {old[:50]!r}...")


# ============================================================ STATS IMPOSSIBLES
json_set("notion-nc-7-chimere", pv=100, pvMax=100)
md_sub("nc-7-chimere", "Vigueur 0 (affichée à 0 sur l'image)",
       "Vigueur 100")
md_sub("nc-7-chimere", "- Vigueur affichée à 0 sur la capture.",
       "- Vigueur : 100 (DRS ; la capture VTT affichait 0, coquille).")
json_set("notion-nc-3-gorille", pv=30, pvMax=30)
md_sub("nc-3-gorille", "Vigueur 0 (affichée à 0 sur l'image)",
       "Vigueur 30")
md_sub("nc-3-gorille", "- Vigueur affichée à 0 sur la capture (à vérifier en jeu).",
       "- Vigueur : 30 (DRS ; la capture VTT affichait 0, coquille).")
# Ours brun : VTT (NC 4) + DRS (NC 4) d'accord
json_set("notion-nc-2-ours-brun", niveau=4.0)
md_sub("nc-2-ours-brun", "- NC : 2 (titre Notion ; le profil image affiche NC 4)",
       "- NC : 4 (titre Notion : NC 2 ; image VTT et DRS : NC 4)")
md_sub("nc-2-ours-brun", "# NC 2 Ours Brun", "# NC 4 Ours Brun (titre Notion : NC 2)")

# ==================================================================== RD (md→JSON)
for mid, rd in [("notion-nc-2-demonet", 5),
                ("notion-nc-5-elementaire-d-eau-grand", 3),
                ("notion-nc-6-elephant", 3),
                ("notion-nc-9-geant-de-feu", 6),
                ("notion-nc-5-troll", 3),
                ("notion-nc-4-vampirien", 5),
                ("notion-nc-4-assassin", 15)]:
    json_set(mid, rd=rd)

# ==================================================== AFFICHAGES DM (moteur inchangé)
json_atk("notion-nc-7-chimere-draconique", "Morsure de serpent", affiche="1d4+3 + poison")
json_atk("notion-nc-2-goule", "Morsures et griffes", affiche="1d6+2 + paralysie")
json_atk("notion-nc-4-ghoule-abomination", "Morsures", affiche="1d6+4 + paralysie")
json_atk("notion-nc-5-momie", "Coup (2 attaques)", affiche="1d8+5 + putréfaction")
json_atk("notion-nc-10-momie-auguste", "Coup (2 attaques)", affiche="2d6+8 + putréfaction")
json_atk("notion-nc-3-serpent-constricteur", "Morsure", affiche="1d6+4 + étreinte")
json_atk("notion-nc-1-serpent-venimeux-crotale-vipere", "Morsure", affiche="1 + venin")
json_atk("notion-nc-2-demonet", "Queue fourchue", affiche="1 + venin")
json_atk("notion-nc-4-vampirien", "Morsure et griffes (2 attaques)", affiche="1d6+3 + absorption d'énergie")
json_atk("notion-nc-8-vampire", "Griffes et morsures (2 attaques)", affiche="1d8+5 + absorption d'énergie")
json_atk("notion-nc-8-vampire", "Épée longue (2 attaques)", affiche="1d8+7")
json_atk("notion-nc-13-vampire-ancien", "Griffes et morsures (2 attaques)", affiche="1d8+8 + 1d8 de froid + absorption d'énergie")
json_atk("notion-nc-13-vampire-ancien", "Épée longue (2 attaques)", affiche="1d8+8 + 1d8 de froid")
json_atk("notion-nc-1-zombie-humain", "Arme", affiche="1d6+3 (ou arme +3)")
json_atk("notion-nc-1-shaman-gobelin", "Morsure des Ancêtres", affiche="2d6 (30 m)")
json_atk("notion-nc-2-pretre-kobold", "Attaque magique (élémentaire)", affiche="3d6 (élémentaires)")
for mid in ["notion-nc-3-shaman-orc", "notion-nc-5-sorcier", "notion-nc-10-dragon-des-forets"]:
    json_atk(mid, "Attaque magique", affiche="spécial (voir pouvoirs)")
json_atk("notion-nc-5-sorcier", "Dague", affiche="1d4+2 +2d6 poison")

# ==================================================== POUVOIRS L -> ATTAQUES (app)
def json_add_atk(mid, atk):
    """Ajoute une attaque à la fiche si elle n'y figure pas déjà (idempotent)."""
    m = idx[mid]
    if any(a["nom"] == atk["nom"] for a in m["attaques"]):
        log.append(f"SKIP json atk +{atk['nom']} ({mid})")
        return
    m["attaques"].append(atk)
    log.append(f"json atk +{atk['nom']} ({mid})")


def vampirisation(mid, bonus):
    """Vampirisation (L) : attaque magique à vol de vie, cible vivante (30 m)."""
    return {"id": f"{mid}-a2", "nom": "Vampirisation (L)", "bonus": bonus,
            "degats": "2d8", "degatsAffiche": "2d8 (30 m)",
            "action": "limitee", "volDeVie": True, "exigeVivant": True}


json_add_atk("notion-nc-5-sorcier", vampirisation("notion-nc-5-sorcier", 10))
json_add_atk("notion-nc-3-shaman-orc", vampirisation("notion-nc-3-shaman-orc", 6))
# Capacités listées sans le suffixe « (Capacité) » (transcriptions conservées
# dans les capacités détaillées) : « Animer un cadavre » doit être reconnu par
# le panneau Capacités (CAPACITES_USABLES, action « animer »).
json_set("notion-nc-5-sorcier",
         capacites=["Injonction mortelle", "Soutenir", "Vampirisation",
                    "Animer un cadavre", "Pas de l'ombre"])
json_set("notion-nc-3-shaman-orc",
         capacites=["Soutenir", "Vampirisation", "Animer un cadavre"])
# Sergent orc : nom DRS
json_atk("notion-nc-3-sergent-orc", "Arme à deux mains", renommer="Épée à deux mains")
md_sub("nc-3-sergent-orc", "Attaques : Arme à deux mains +7, DM 2d6+6",
       "Attaques : Épée à deux mains +7, DM 2d6+6")

# ==================================================== AFFICHAGES MD (cohérence import)
md_sub("nc-5-sorcier", "DM 1d4+2+2d6 (Attaque +6, Dommages 1d4+2+2d6)",
       "DM 1d4+2 +2d6 poison (Attaque +6, Dommages 1d4+2 +2d6 poison)")
md_sub("nc-5-sorcier", "Attaque magique +10, DM (Attaque +10)",
       "Attaque magique +10, DM spécial (Attaque +10, spécial)")
md_sub("nc-1-shaman-gobelin", "Attaque magique 4, DM 2d6 (Attaque 4, Dommages 2d6)",
       "Attaque magique 4, DM 2d6 (30 m) (Attaque 4, Dommages 2d6 (30 m))")
md_sub("nc-2-pretre-kobold", "DM 3d6 (Attaque +6, Dommages 3d6)",
       "DM 3d6 (élémentaires) (Attaque +6, Dommages 3d6 (élémentaires))")
md_sub("nc-3-shaman-orc", "Attaque magique +6, DM (Attaque +6)",
       "Attaque magique +6, DM spécial (Attaque +6, spécial)")
md_sub("nc-10-dragon-des-forets", "Attaque magique +15 DM (Attaque +15)",
       "Attaque magique +15, DM spécial (Attaque +15, spécial)")
md_sub("nc-2-goule", "DM 1d6+2 (Attaque +5, Dommages 1d6+2)",
       "DM 1d6+2 + paralysie (Attaque +5, Dommages 1d6+2 + paralysie)")
md_sub("nc-4-ghoule-abomination",
       "Morsures +9, DM 1d6+4 (Attaque +9, Dommages 1d6+4)",
       "Morsures +9, DM 1d6+4 + paralysie (Attaque +9, Dommages 1d6+4 + paralysie)")
md_sub("nc-5-momie", "DM 1d8+5 (Attaque +10, Dommages 1d8+5)",
       "DM 1d8+5 + putréfaction (Attaque +10, Dommages 1d8+5 + putréfaction)")
md_sub("nc-10-momie-auguste", "DM 2d6+8 (Attaque +16, Dommages 2d6+8)",
       "DM 2d6+8 + putréfaction (Attaque +16, Dommages 2d6+8 + putréfaction)")
md_sub("nc-3-serpent-constricteur", "DM 1d6+4 (Attaque +4, Dommages 1d6+4)",
       "DM 1d6+4 + étreinte (Attaque +4, Dommages 1d6+4 + étreinte)")
md_sub("nc-1-serpent-venimeux-crotale-vipere", "DM 1 (Attaque +3, Dommages 1)",
       "DM 1 + venin (Attaque +3, Dommages 1 + venin)")
md_sub("nc-2-demonet", "Queue fourchue +4, DM 1 (Attaque +4, Dommages 1)",
       "Queue fourchue +4, DM 1 + venin (Attaque +4, Dommages 1 + venin)")
md_sub("nc-4-vampirien", "DM 1d6+3 (Attaque +6, Dommages 1d6+3)",
       "DM 1d6+3 + absorption (Attaque +6, Dommages 1d6+3 + absorption)")
md_sub("nc-8-vampire",
       "Griffes et morsures (2 attaques) +11, DM 1d8+5 (Attaque +11, Dommages 1d8+5)",
       "Griffes et morsures (2 attaques) +11, DM 1d8+5 + absorption (Attaque +11, Dommages 1d8+5 + absorption)")
md_sub("nc-13-vampire-ancien",
       "Griffes et morsures (2 attaques) +14, DM 1d8+8+1d8 (Attaque +14, Dommages 1d8+8+1d8)",
       "Griffes et morsures (2 attaques) +14, DM 1d8+8 + 1d8 de froid + absorption (Attaque +14, Dommages 1d8+8 + 1d8 de froid + absorption)")
md_sub("nc-13-vampire-ancien",
       "Épée longue (2 attaques) +14, DM 1d8+8+1d8 (Attaque +14, Dommages 1d8+8+1d8)",
       "Épée longue (2 attaques) +14, DM 1d8+8 + 1d8 de froid (Attaque +14, Dommages 1d8+8 + 1d8 de froid)")
md_sub("nc-1-zombie-humain", "Arme +4, DM 1d6+3 (Attaque +4, Dommages 1d6+3)",
       "Arme +4, DM 1d6+3 (ou arme +3) (Attaque +4, Dommages 1d6+3 (ou arme +3))")

# ==================================================== CAPACITÉS MANQUANTES (textes DRS)
CAPS = [
 # --- Animal minuscule
 ("notion-nc-0-animal-minuscule", "nc-0-animal-minuscule", "Attaques ridicules",
  "La créature n'inflige pas de DM sauf sur une réussite critique (1 DM). (DRS)", None, None),
 ("notion-nc-0-animal-minuscule", "nc-0-animal-minuscule", "Minuscule",
  "La créature obtient un bonus de +10 aux tests d'escalade et de discrétion. (DRS)", None, None),
 # --- Araignée (Vermine/Variantes déjà en Propriétés VTT)
 ("notion-nc-3-araignee-geante", "nc-3-araignee-geante", "Vermine",
  "Une araignée géante peut encore agir un round complet lorsqu'elle atteint 0 PV. Une araignée se déplace de 15 m par action de mouvement. (DRS)", None, "Vermine"),
 ("notion-nc-3-araignee-geante", "nc-3-araignee-geante", "Variantes",
  "Choisissez un type de poison et soit Toile (L), soit Araignée chasseuse. (DRS)", None, None),
 # --- Basilic
 ("notion-nc-3-basilic", "nc-3-basilic", "Détourner le regard",
  "Un personnage qui combat le basilic sans tactique particulière, si ce n'est éviter de croiser son regard, doit réussir un test de CON difficulté 10 au début de son tour ou être pétrifié. Il subit un dé malus en attaque. (DRS)", None, "Détourner le regard"),
 ("notion-nc-3-basilic", "nc-3-basilic", "Fermer les yeux",
  "Le personnage est aveuglé (-5 en DEF et en attaque, pas d'attaque à distance ni de sorts ciblés), mais il ne risque pas d'être pétrifié, sauf échec critique en attaque (dans ce cas test de CON difficulté 10). (DRS)", None, "Fermer les yeux"),
 # --- Capitaine
 ("notion-nc-4-capitaine", "nc-4-capitaine", "Riposte",
  "La créature peut effectuer une attaque en action gratuite contre chaque adversaire qui l'attaque à l'exception de celui qu'elle a elle-même choisi d'attaquer à son tour. (DRS, action gratuite)", None, "Riposte (G)"),
 # --- Chevaux
 ("notion-nc-1-cheval-de-guerre", "nc-1-cheval-de-guerre", "Monture",
  "La créature double sa FOR pour porter une charge. Un cheval de guerre est apte à porter une barde. Caparaçon de maille : +2 DEF (100 pa). Barde de plaques : +4 DEF (400 pa), malus en Init. égal au bonus. La DEF de la fidèle monture du chevalier tient déjà compte d'une éventuelle barde. En PNJ, un cheval lourd peut bénéficier de rangs de boss. (DRS)", None, "Monture"),
 ("notion-nc-1-cheval-de-selle", "nc-1-cheval-de-selle", "Monture",
  "La créature double sa FOR pour porter une charge. (DRS)", None, "Monture"),
 # --- Dragon
 ("notion-nc-10-dragon-des-forets", "nc-10-dragon-des-forets", "Immunités",
  "Un dragon des forêts est immunisé au sommeil et à la paralysie et ne subit aucun DM de poison. (DRS)", None, "Immunités"),
 # --- Élémentaire : Vision (texte DRS complet)
 # --- Éléphant
 ("notion-nc-6-elephant", "nc-6-elephant", "Grand mâle",
  "Les grands mâles ont généralement un NC augmenté de 1 et +2 en attaque, en DEF et aux DM ainsi que +20 PV. (DRS)", None, None),
 # --- Géant
 ("notion-nc-9-geant-de-feu", "nc-9-geant-de-feu", "Immunisé au feu",
  "Le géant du feu est immunisé aux DM de feu. (DRS)", None, "Immunisé au feu"),
 # --- Géoselachis
 ("notion-nc-7-geoselachis", "nc-7-geoselachis", "Déplacement sous terre",
  "Le geoselachis est capable de parcourir 5 m par action de mouvement en creusant dans un sol meuble (le tunnel s'effondre derrière lui). (DRS)", None, "Déplacement sous terre"),
 # --- Golem
 ("notion-nc-7-golem-de-chair", "nc-7-golem-de-chair", "Absorber l'électricité",
  "Non seulement le golem de chair est immunisé à l'électricité, mais en plus les DM de ce type lui permettent de guérir de ses blessures. Il régénère 1 PV pour 3 points de DM d'électricité qui lui sont infligés. (DRS)", None, "Absorber l'électricité"),
 # --- Hydre
 ("notion-nc-5-hydre-a-5-tetes", "nc-5-hydre-a-5-tetes", "Ajouter des têtes",
  "Pour chaque tête supplémentaire, ajoutez 20 PV, +1 en attaque et en DEF et une attaque supplémentaire. Le NC augmente de +1. (DRS)", None, None),
 ("notion-nc-5-hydre-a-5-tetes", "nc-5-hydre-a-5-tetes", "Attaques multiples",
  "L'hydre peut effectuer un total de 5 attaques, mais pas plus de 4 attaques sur la même cible chaque round. Utilisez la règle des attaques groupées pour gagner du temps (par exemple, +5 pour l'attaque de deux têtes à la fois). (DRS)", None, None),
 ("notion-nc-5-hydre-a-5-tetes", "nc-5-hydre-a-5-tetes", "Couper une tête",
  "Pour réduire le nombre de têtes, un personnage peut tenter de la décapiter. L'attaque souffre d'une pénalité de -5 et doit infliger au moins 10 DM en une seule fois. En cas de réussite, la tête est coupée et les PV du monstre baissent de 10. La guérison accélérée fait repousser la tête en 2 rounds (sauf DM de feu). En cas d'échec, l'hydre ne subit aucun DM. (DRS)", None, None),
 # --- Loup
 ("notion-nc-1-loup", "nc-1-loup", "Chien",
  "Vous pouvez aussi utiliser le profil du loup pour les gros chiens en retirant de 2 à 4 PV. (DRS)", None, None),
 # --- Momie auguste
 ("notion-nc-10-momie-auguste", "nc-10-momie-auguste", "Voie de la magie universelle rang 5",
  "La momie auguste peut lancer tous les sorts de cette voie à volonté. (DRS)", None, "Voie de la magie universelle rang 5"),
 # --- Goule / Abomination
 ("notion-nc-2-goule", "nc-2-goule", "Devenir une goule",
  "Une créature tuée par une goule en devient une à son tour au prochain crépuscule. (DRS)", None, None),
 ("notion-nc-4-ghoule-abomination", "nc-4-ghoule-abomination", "Devenir une goule",
  "Une créature tuée par une goule en devient une à son tour au prochain crépuscule. (DRS)", None, None),
 # --- Démonet (8 ; Téléportation : VTT 3/jour vs DRS 3/combat)
 ("notion-nc-2-demonet", "nc-2-demonet", "Démon",
  "Les démons ne sont pas considérés comme des créatures non vivantes. Toutefois, ils partagent avec celles-ci de nombreux traits. Ils ne respirent pas, ne dorment jamais, ne connaissent pas la fatigue et sont immunisés au poison et aux maladies non magiques. Ils n'ont pas besoin de se sustenter, du moins pas de nourritures terrestres. (DRS)", None, "Démon"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Tentation du mal",
  "Les démons aiment corrompre les mortels en leur offrant le pouvoir. Un démon peut donner un dé bonus à toutes les actions d'un mortel durant 24 h (niveau inférieur au NC du démon). Ensuite, le mortel est affaibli pendant une semaine (+1 semaine par période de 24 h), jusqu'à obtenir son âme. (DRS, résumé)", None, "Tentation du mal"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Télépathie",
  "Les démons peuvent communiquer avec toutes les créatures par télépathie à une distance de 50 m sans avoir besoin de partager une langue commune. Ils parlent l'abyssal. (DRS)", None, "Télépathie"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Téléportation",
  "Le démonet peut se téléporter à n'importe quel endroit qu'il voit ou qu'il connaît à une distance maximale de 200 m jusqu'à 3 fois par combat. (DRS, action limitée ; fiche VTT : 3 fois par jour)", None, "Téléportation (L)"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Ténèbres",
  "Tous les démons peuvent invoquer à volonté une zone fixe de ténèbres magiques de 10 m de diamètre, à une portée de 20 m pour une durée de 1 min. Même les créatures capables de voir dans le noir sont aveuglées. Une seule zone à la fois. (DRS, action limitée)", None, "Ténèbres (L)"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Venin",
  "La victime doit réussir un test de CON difficulté 10 ou être affaiblie pendant 1d6 min. (DRS)", None, "Venin"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Vision dans le noir",
  "Tous les démons voient dans le noir comme en plein jour à une distance de 30 m. (DRS)", "vision-noir", "Vision dans le noir"),
 ("notion-nc-2-demonet", "nc-2-demonet", "Vol",
  "Un démonet peut se déplacer en vol de 10 m par action de mouvement. (DRS)", None, "Vol"),
 # --- Squelettes
 ("notion-nc-1-squelette", "nc-1-squelette", "Sans esprit",
  "Aucune âme n'habite la carcasse morte, le squelette est immunisé à tous les sorts qui affectent l'esprit. (DRS)", "sans-esprit", "Sans esprit"),
 ("notion-nc-4-squelette-geant", "nc-4-squelette-geant", "Sans esprit",
  "Aucune âme n'habite la carcasse morte, le squelette est immunisé à tous les sorts qui affectent l'esprit. (DRS)", "sans-esprit", "Sans esprit"),
 # --- Ours polaire / Panthère : Dévorer
 ("notion-nc-6-ours-polaire", "nc-6-ours-polaire", "Dévorer",
  "Lorsque la créature réussit une attaque avec un résultat de 15-20 au d20, elle saisit sa proie entre ses crocs ou ses griffes et lui inflige immédiatement une attaque gratuite supplémentaire. (DRS)", "devorer", "Dévorer"),
 ("notion-nc-2-panthere", "nc-2-panthere", "Dévorer",
  "Lorsque la créature réussit une attaque avec un résultat de 15-20 au d20, elle saisit sa proie entre ses crocs ou ses griffes et lui inflige immédiatement une attaque gratuite supplémentaire. (DRS)", "devorer", "Dévorer"),
 ("notion-nc-2-panthere", "nc-2-panthere", "Ambuscade",
  "Au premier round de combat, si l'environnement permet à la créature de se dissimuler, la cible doit faire un test de PER difficulté 19 ou être surprise. Si elle attaque avec succès une cible surprise, la créature inflige +1d4 DM et toute créature dont la FOR est inférieure à la sienne est renversée. La créature obtient un bonus de +5 à tous les tests de discrétion. (DRS)", "embuscade", None),
 # --- Skrambler
 ("notion-nc-3-skrambler", "nc-3-skrambler", "Creuser",
  "Au prix d'une action limitée, le skrambler est capable de creuser sur une profondeur de 10 m par round. Le tunnel s'effondre derrière lui. Il peut utiliser sa capacité Embuscade pour surgir du sol et attaquer. (DRS, action limitée)", None, "Creuser (L)"),
 # --- Vampires : Pattes + versions DRS spécifiques
 ("notion-nc-8-vampire", "nc-8-vampire", "Pattes d'araignée",
  "Le vampire peut se déplacer de 10 m par action de mouvement sur les murs et les plafonds. (DRS)", None, "Pattes d'araignée"),
 ("notion-nc-13-vampire-ancien", "nc-13-vampire-ancien", "Pattes d'araignée",
  "Le vampire peut se déplacer de 10 m par action de mouvement sur les murs et les plafonds. (DRS)", None, "Pattes d'araignée"),
 ("notion-nc-13-vampire-ancien", "nc-13-vampire-ancien", "Regard envoûtant (ancien)",
  "Le regard du vampire sape la volonté de ses opposants. Il peut utiliser une action de mouvement pour tenter d'envoûter son adversaire. La cible doit réussir un test de VOL difficulté 20 ou être affaiblie pour 1d6 rounds ; les créatures de niveau 3 ou inférieur passent sous le contrôle du vampire. (DRS, vampire ancien ; la version commune (VOL 15) figure dans la fiche du vampire)", None, None),
 ("notion-nc-4-vampirien", "nc-4-vampirien", "Pattes d'araignée",
  "Le vampirien peut se déplacer de 10 m par action de mouvement sur les murs et les plafonds. (DRS)", None, "Pattes d'araignée"),
 ("notion-nc-4-vampirien", "nc-4-vampirien", "Regard envoûtant (vampirien)",
  "Le regard du vampirien sape la volonté de ses opposants. Une fois par combat, il peut utiliser une action d'attaque pour tenter d'envoûter son adversaire. La cible doit réussir un test de VOL difficulté 10 ou être affaiblie tant qu'elle est sous le regard du vampirien. (DRS ; la version commune du vampire (VOL 15) est partagée en image)", None, None),
 ("notion-nc-4-vampirien", "nc-4-vampirien", "Forme gazeuse (vampirien)",
  "Une fois par jour, le vampirien prend la consistance d'un gaz pendant 1 min. Il se déplace au ras du sol à 5 m par action de mouvement (M), passe par les interstices, mais ne peut utiliser aucune capacité ni subir de DM. (DRS, action d'attaque ; la version commune du vampire est partagée en image)", None, None),
 ("notion-nc-4-vampirien", "nc-4-vampirien", "Résistances (vampirien)",
  "Le vampirien retranche 5 à tous les DM, sauf s'ils sont infligés par des armes en argent ou par le feu. (DRS)", None, None),
 ("notion-nc-4-vampirien", "nc-4-vampirien", "Vulnérabilité au soleil (vampirien)",
  "Un vampirien exposé au soleil subit 2d6 DM par tour sur son maximum de PV (non régénérables à la lumière). À 0 : réduit en cendre, définitivement détruit. (DRS)", None, None),
 # --- Sanglier : Tape dur (CON 13, spécifique)
 ("notion-nc-3-sanglier", "nc-3-sanglier", "Tape dur",
  "Si la créature obtient 15 à 20 au dé du test d'attaque, l'attaque est automatiquement réussie. De surcroît, la victime doit réussir un test de CON difficulté 13 ou être étourdie pendant 1 round. (DRS)", None, "Tape dur"),
]

for mid, folder, nom, detail, shared, act in CAPS:
    json_add_cap(mid, nom, detail, shared)
    add_section(folder, f"{nom} (Capacité)", detail, act)

# ==================================================== TEXTES : Charge/Fauchage/etc.
CHARGE_STD = ("La créature parcourt une distance maximale de 20 m et réalise "
              "une attaque avec un dé bonus. Si l'attaque est réussie, en plus "
              "des DM normaux, une victime de taille inférieure ou égale à la "
              "créature doit faire un test de FOR difficulté {d} ou être "
              "renversée. Dans ce cas, la créature piétine (ou embroche) sa "
              "victime et les DM sont doublés.")
ENRAGE_STD = ("Lorsqu'elle reçoit un coup critique, la créature devient enragée. "
              "Elle ignore les pénalités de douleur ou la peur, augmente de +3 sa "
              "valeur d'attaque au contact et ses DM de +1d4. Elle peut encore agir "
              "un tour complet après avoir atteint 0 PV. (livre des règles)")


def md_replace_section(folder, titre, corps):
    t = read_md(folder)
    if corps in t:
        log.append(f"SKIP section remplacée (déjà) {titre} ({folder})")
        return
    pat = re.compile(r"^### " + re.escape(titre) + r" \(Capacité[^\)]*\)\n\n.*?(?=^### |^## |\Z)",
                     re.M | re.S)
    new_sec = f"### {titre} (Capacité)\n\n{corps}\n"
    t2, n = pat.subn(new_sec, t, count=1)
    if n == 0:
        log.append(f"!!! section {titre} introuvable ({folder})")
        return
    write_md(folder, t2)
    log.append(f"section remplacée {titre} ({folder})")


def json_detail(mid, nom, description):
    m = idx[mid]
    dets = m.setdefault("capacitesDetails", [])
    for d in dets:
        if d["nom"] == nom:
            if d["description"] != description:
                d["description"] = description[:600]
                log.append(f"json detail upd {nom} ({mid})")
            return
    dets.append({"nom": nom, "description": description[:600]})
    log.append(f"json detail +{nom} ({mid})")


# Ours brun : pas d'image Charge VTT -> DRS (FOR 16)
md_replace_section("nc-2-ours-brun", "Charge",
                   CHARGE_STD.format(d="16") + " (DRS ; la fiche reprenait le texte du bison, FOR 13).")
json_detail("notion-nc-2-ours-brun", "Charge (Capacité)",
            CHARGE_STD.format(d="16") + " (DRS)")
# Rhinocéros : image VTT FOR 13 conservée ; DRS FOR 18 noté
md_replace_section("nc-4-rhinoceros", "Charge, Enragé",
                   "### Charge (Capacité)\n\n" + CHARGE_STD.format(d="13") +
                   " (VTT ; DRS en ligne : FOR difficulté 18).\n\n### Enragé (Capacité)\n\n" + ENRAGE_STD)
json_detail("notion-nc-4-rhinoceros", "Charge (Capacité)",
            CHARGE_STD.format(d="13") + " (VTT ; DRS : FOR 18)")
# Ours polaire : image VTT FOR 13 conservée ; DRS FOR 16 noté
md_replace_section("nc-6-ours-polaire", "Charge, Enragé",
                   "### Charge (Capacité)\n\n" + CHARGE_STD.format(d="13") +
                   " (VTT ; DRS en ligne : FOR difficulté 16).\n\n### Enragé (Capacité)\n\n" + ENRAGE_STD)
json_detail("notion-nc-6-ours-polaire", "Charge (Capacité)",
            CHARGE_STD.format(d="13") + " (VTT ; DRS : FOR 16)")
# Éléphant : DRS FOR 20 (transcripteur : voir bison)
md_replace_section("nc-6-elephant", "Charge",
                   CHARGE_STD.format(d="20") + " (DRS).")
json_detail("notion-nc-6-elephant", "Charge (Capacité)",
            CHARGE_STD.format(d="20") + " (DRS)")
# Grand bison : même image que bison (FOR 13) ; DRS FOR 14 noté
md_replace_section("nc-3-grand-bison", "Charge",
                   CHARGE_STD.format(d="13") + " (VTT, même image que le bison ; DRS en ligne : FOR difficulté 14).")
json_detail("notion-nc-3-grand-bison", "Charge (Capacité)",
            CHARGE_STD.format(d="13") + " (VTT ; DRS : FOR 14)")
# Élémentaire : Fauchage FOR 16 (DRS), pas 20 + Vision DRS
md_replace_section("nc-5-elementaire-d-eau-grand", "Fauchage",
                   "Sur 17 à 20 au test d'attaque, si l'attaque est réussie, la victime doit réussir au choix un test de FOR ou d'AGI difficulté 16 ou être renversée. (DRS ; la fiche indiquait 20)")
json_detail("notion-nc-5-elementaire-d-eau-grand", "Fauchage (Capacité)",
            "Sur 17 à 20 au test d'attaque, si l'attaque est réussie, la victime doit réussir au choix un test de FOR ou d'AGI difficulté 16 ou être renversée. (DRS)")
md_replace_section("nc-5-elementaire-d-eau-grand", "Vision dans le noir",
                   "Ils voient dans le noir à 30 m et ils peuvent déterminer la localisation de toute créature en contact avec leur élément à moins de 30 m, même si celle-ci est invisible. (DRS)")
json_detail("notion-nc-5-elementaire-d-eau-grand", "Vision dans le noir (Capacité)",
            "Ils voient dans le noir à 30 m et ils peuvent déterminer la localisation de toute créature en contact avec leur élément à moins de 30 m, même si celle-ci est invisible. (DRS)")
# Skrambler : Embuscade + Init (DRS)
md_replace_section("nc-3-skrambler", "Embuscade",
                   "Au premier round de combat, si l'environnement permet à la créature de se dissimuler, la cible doit faire un test de PER difficulté 16 ou être surprise. Si elle attaque avec succès une cible surprise, la créature inflige +1d4 DM et toute créature dont la FOR est inférieure à la sienne est renversée. La créature obtient un bonus de +5 à tous les tests de discrétion et en Init. (DRS)")
json_detail("notion-nc-3-skrambler", "Embuscade (Capacité)",
            "Au premier round de combat, si l'environnement permet à la créature de se dissimuler, la cible doit faire un test de PER difficulté 16 ou être surprise. Si elle attaque avec succès une cible surprise, la créature inflige +1d4 DM et toute créature dont la FOR est inférieure à la sienne est renversée. La créature obtient un bonus de +5 à tous les tests de discrétion et en Init. (DRS)")
# Requin : Dévorer avec immobilisation (DRS)
md_replace_section("nc-4-requin", "Dévorer",
                   "Lorsque le requin réussit une attaque avec un résultat de 15-20 au d20, il saisit sa proie entre ses crocs et lui inflige immédiatement une attaque gratuite supplémentaire. Si la FOR de la cible est inférieure ou égale au prédateur, elle est de plus immobilisée. Pour se libérer, la victime doit réussir un test de FOR difficulté 15 lors de son tour et cela lui demande une action de mouvement. (DRS)")
json_detail("notion-nc-4-requin", "Dévorer (Capacité)",
            "Lorsque le requin réussit une attaque avec un résultat de 15-20 au d20, il saisit sa proie entre ses crocs et lui inflige immédiatement une attaque gratuite supplémentaire. Si la FOR de la cible est inférieure ou égale au prédateur, elle est de plus immobilisée. Pour se libérer, la victime doit réussir un test de FOR difficulté 15 lors de son tour et cela lui demande une action de mouvement. (DRS)")
# Momie auguste : Putréfaction 1d10 (DRS), pas 1d6
md_replace_section("nc-10-momie-auguste", "Putréfaction",
                   "Toute créature blessée par une momie doit réussir un test de CON difficulté 15 ou contracter une horrible maladie qui occasionne le pourrissement rapide de ses chairs, une sorte de lèpre fulgurante. La victime subit 1d10 DM par round pendant 5 rounds. Tant qu'elle est sous l'effet de la putréfaction, il n'est pas nécessaire de réaliser un nouveau test de CON lorsque la victime est la cible d'une attaque de la momie. (DRS, momie auguste ; la momie de base inflige 1d6.)")
json_detail("notion-nc-10-momie-auguste", "Putréfaction (Capacité)",
            "Toute créature blessée par une momie doit réussir un test de CON difficulté 15 ou contracter une horrible maladie qui occasionne le pourrissement rapide de ses chairs, une sorte de lèpre fulgurante. La victime subit 1d10 DM par round pendant 5 rounds. Tant qu'elle est sous l'effet de la putréfaction, il n'est pas nécessaire de réaliser un nouveau test de CON lorsque la victime est la cible d'une attaque de la momie. (DRS, momie auguste)")

# ==================================================== NOTES DE VÉRIFICATION
CONFORME = "conforme au livre des règles en ligne (NC/DEF/PV/INIT/attaques/capacités)."
VERIF = {
 # --- conformes sans réserve
 "nc-0-5-aigle": (CONFORME, []),
 "nc-0-animal-petit-chien": (CONFORME, []),
 "nc-0-animal-tres-petit-chat": (CONFORME, []),
 "nc-4-assassin": ("conforme (NC/DEF/PV/INIT/attaques + Assassinat/Attaque mortelle +4d6/Disparition 20 m).", ["RD 15 de la fiche VTT : DRS en ligne sans RD indiquée."]),
 "nc-0-5-bandit-de-base": (CONFORME, []),
 "nc-1-bandit-veteran": ("conforme (le DRS écrit « vétaran », coquille).", []),
 "nc-2-chef-bandit": (CONFORME, []),
 "nc-1-garde-de-la-ville": (CONFORME, []),
 "nc-3-garde-du-corps": (CONFORME, []),
 "nc-4-chef-gnoll": (CONFORME, []),
 "nc-1-gnoll": (CONFORME, []),
 "nc-2-sergent-gnoll": (CONFORME, []),
 "nc-0-gobelin-de-base": (CONFORME, []),
 "nc-0-5-gobelin-d-elite": (CONFORME, []),
 "nc-4-griffon": (CONFORME, []),
 "nc-1-chef-kobold": (CONFORME, []),
 "nc-0-kobold": (CONFORME, []),
 "nc-3-licorne": (CONFORME, []),
 "nc-3-lion": (CONFORME, []),
 "nc-4-grand-lion": (CONFORME, []),
 "nc-2-loup-alpha": (CONFORME, []),
 "nc-2-berserk-orc": (CONFORME, []),
 "nc-1-orc-noir": (CONFORME, []),
 "nc-5-ourhible": (CONFORME, []),
 "nc-2-ours-noir": (CONFORME, []),
 "nc-4-rhinoceros": ("conforme ; Charge : texte propre FOR 18.",
                     ["Charge : DRS FOR difficulté 18 (la fiche reprenait le texte du bison, FOR 13)."]),
 "nc-5-troll": ("conforme (Fauchage 17-20/FOR-AGI 16/RD 3 + Vitalité).",
                ["Attaque « ou » (VTT) contre « et » (DRS) : équivalent en jeu."]),
 "nc-2-chef-goblin": (CONFORME, []),
 "nc-1-shaman-gobelin": ("conforme (Arme + Attaque magique 2d6/30 m + Meute).", []),
 "nc-3-sergent-orc": ("conforme (attaque renommée « Épée à deux mains » comme le DRS).", []),
 "nc-3-shaman-orc": (CONFORME, []),
 "nc-6-chef-orc": ("conforme (Capitaine/Commandant/Imparable/Brise-genou).",
                   ["INIT 13 (VTT) conservée ; DRS en ligne : INIT 10."]),
 "nc-0-orc": ("conforme (Hache/masse + Sensible à la lumière).",
              ["NC 0 (VTT) conservé ; DRS en ligne : NC 1/2."]),
 "nc-7-golem-de-chair": ("conforme + Absorber l'électricité (DRS).",
                         ["Enragé : la fiche VTT inclut « ignore douleur/peur », absent du DRS en ligne."]),
 "nc-10-dragon-des-forets": ("conforme + Immunités (DRS).", []),
 "nc-5-elementaire-d-eau-grand": ("conforme ; Fauchage corrigé FOR-AGI 16 + Vision DRS.",
                                  ["Fauchage : la fiche indiquait FOR-AGI 20, DRS : 16."]),
 "nc-6-elephant": ("conforme + Grand mâle (DRS) ; Charge : texte propre FOR 20.",
                   ["Charge : DRS FOR difficulté 20 (la fiche reprenait le texte du bison)."]),
 "nc-9-geant-de-feu": ("conforme + Immunisé au feu (DRS).", []),
 "nc-7-geoselachis": ("conforme + Déplacement sous terre (DRS).", []),
 "nc-5-hydre-a-5-tetes": ("conforme + Ajouter/Attaques multiples/Couper (DRS).", []),
 "nc-1-loup": ("conforme + Chien (DRS).",
               ["DEF 13 (16 en surnombre, DRS) ; le DRS écrit « Interchangeable » (singulier)."]),
 "nc-10-momie-auguste": ("conforme + Voie de la magie universelle (DRS) ; Putréfaction corrigée 1d10.",
                         ["Putréfaction : la fiche indiquait 1d6 (momie de base), DRS auguste : 1d10."]),
 "nc-5-momie": (CONFORME, []),
 "nc-3-ogre": ("conforme (Hachoir + Imparable/Tape dur).",
               ["Au choix Tape dur ou Imparable (DRS) ; Imparable : +2d4 (VTT), DRS ogre : +1d6."]),
 "nc-6-chef-ogre": ("conforme (Hachoir(2) + Enragé/Imparable/Tape dur/Teigneuse).",
                    ["Au choix Tape dur ou Imparable (DRS) ; Imparable : +2d4 (VTT), DRS ogre : +1d6."]),
 "nc-2-goule": ("conforme + Devenir une goule (DRS).",
                ["Paralysie : CON 10 (VTT) conservée ; DRS en ligne : CON 15."]),
 "nc-4-ghoule-abomination": ("conforme (Griffe(2)/Morsure + Miasmes + Devenir).",
                             ["Paralysie : CON 10 (VTT) conservée ; DRS en ligne : CON 15 ; seule la morsure paralyse."]),
 "nc-2-pretre-kobold": ("conforme (Dague + Attaque magique 3d6).",
                        ["DEF 15 (VTT) conservée ; DRS en ligne : DEF 13."]),
 "nc-2-ours-brun": ("NC corrigé 4 (VTT + DRS) ; Charge : texte propre FOR 16 (DRS).",
                    ["NC 2 du titre Notion corrigé en NC 4 (image VTT + DRS)."]),
 "nc-6-ours-polaire": ("conforme + Dévorer (DRS) ; Charge : texte VTT (FOR 13).",
                       ["Charge : DRS en ligne FOR difficulté 16."]),
 "nc-2-panthere": ("conforme + Ambuscade (PER 19) + Dévorer (DRS).", []),
 "nc-0-5-rat-geant": ("conforme (Morsure + Maladie CON 10/15).",
                      ["INIT 15 (VTT) conservée ; DRS en ligne : INIT 5 (coquille probable)."]),
 "nc-4-requin": ("conforme ; Dévorer corrigé (immobilisation FOR 15, DRS).",
                 ["INIT 16 (VTT) conservée ; DRS en ligne : INIT 13."]),
 "nc-3-sanglier": ("conforme + Tape dur CON 13 (DRS) ; bonus +6 et Charge FOR 13 (VTT).",
                   ["Défenses +6 (VTT) ; DRS en ligne : +8."]),
 "nc-3-serpent-constricteur": (CONFORME, []),
 "nc-1-serpent-venimeux-crotale-vipere": (CONFORME, []),
 "nc-3-skrambler": ("conforme + Creuser (DRS) ; Embuscade complétée (+Init, DRS).", []),
 "nc-5-sorcier": ("conforme (Dague poison + Attaque magique + 4 pouvoirs L).", []),
 "nc-1-squelette": ("conforme + Sans esprit (DRS).", []),
 "nc-4-squelette-geant": ("conforme + Sans esprit (DRS).",
                          ["Attaque « Masse » (VTT) ; DRS : « Massue »."]),
 "nc-4-vampirien": ("conforme + versions DRS (Regard VOL 10, Forme 1/jour, RD -5, Vulnérabilité 2d6, Pattes).",
                    ["La fiche VTT partage les textes du vampire ; les versions DRS spécifiques sont ajoutées."]),
 "nc-8-vampire": ("conforme + Pattes d'araignée (DRS).", ["NC 8 (7 sans équipement, DRS)."]),
 "nc-13-vampire-ancien": ("conforme + Pattes + Regard ancien VOL 20 (DRS).",
                          ["NC 13 (12 sans équipement, DRS)."]),
 "nc-2-veteran": ("conforme (template : 1 capacité parmi Brise-genou/Imparable/Sergent).",
                  ["NC 2 (VTT) conservé ; DRS en ligne : NC 1 (variante « garde du palais »)."]),
 "nc-3-worg": ("conforme (Morsure + Embuscade PER 16 + Brise-genou).",
               ["Worg en meute (DRS, NC 8+) : meute de 8+, Attaque en traître (L), L'Hallali."]),
 "nc-1-zombie-humain": ("conforme (cycle zombie + gabarit).",
                        ["Variante DRS verrouillée (compte BBE) : non vérifiable."]),
 "nc-3-araignee-geante": ("conforme + Vermine/Variantes (DRS).",
                          ["Mandibules 2d4+4 (VTT, « Attaque » DRS) ; DRS en ligne : 2d6+4."]),
 "nc-3-basilic": ("conforme + Détourner/Fermer (DRS).",
                  ["Vision dans le noir : bonus Notion, hors DRS en ligne."]),
 "nc-3-grand-bison": ("conforme ; Charge : texte VTT (FOR 13).",
                      ["Cornes 2d6+6 (VTT) ; DRS en ligne : 2d6+8. Charge DRS : FOR 14."]),
 "nc-2-bison": ("conforme ; Charge : texte VTT (FOR 13).",
                ["Charge : DRS en ligne FOR difficulté 14."]),
 "nc-4-capitaine": ("conforme + Riposte (G, DRS).", []),
 "nc-1-cheval-de-guerre": ("conforme + Monture (DRS).", []),
 "nc-1-cheval-de-selle": ("conforme + Monture (DRS).", []),
 "nc-7-chimere": ("PV corrigés 100 (DRS ; la capture VTT affichait 0).", []),
 "nc-7-chimere-draconique": (CONFORME, []),
 "nc-2-crocodile": ("conforme (Morsure + Embuscade + Dévorer).",
                    ["Le DRS écrit « Ambuscade » ; Embuscade PER 16 (VTT), DRS : PER 15."]),
 "nc-2-demonet": ("conforme + 8 capacités DRS (Démon/Tentation/Télépathie/Téléportation/Ténèbres/Venin/Vision/Vol).",
                  ["Téléportation : 3/jour (VTT) ; DRS en ligne : 3/combat."]),
 "nc-3-gorille": ("PV corrigés 30 (DRS ; la capture VTT affichait 0) ; Charge : texte VTT (FOR 13).",
                  ["Charge : DRS en ligne FOR difficulté 15."]),
 # --- DRS-absents (annotations seules)
 "nc-11-cryohydre-a-10-tetes": ("créature distincte du « Cryohydre à dix têtes » du DRS (NC 5, DEF 23, PV 150).",
                                ["DRS : Morsure(10) +13 1d8+4+1d6 froid + Souffle 6d6+18 + têtes. Non repris (homebrew)."]),
 "nc-0-5-strige": ("absente du DRS en ligne (11/10/2026).", []),
 "nc-1-homme-lezard": ("absent du DRS en ligne (11/10/2026).", []),
 "nc-2-elfe-noir": ("absent du DRS en ligne (11/10/2026).", []),
 "nc-4-minotaure": ("absent du DRS en ligne (11/10/2026).", []),
 "nc-4-ombre": ("absente du DRS en ligne (11/10/2026).", []),
 "nc-6-geant-des-collines": ("absent du DRS en ligne (11/10/2026).", []),
 "nc-12-dragon-rouge": ("absent du DRS en ligne (11/10/2026, ancienne édition).", []),
 "sigmeus-le-necromant": ("PNJ maison, hors DRS.", []),
 "zombie-coriasse": ("variante maison, hors DRS en ligne.", []),
 "druid-arbre-anime": ("compagnon druidique, hors liste DRS en ligne.", []),
 "voir-elementaire-d-air-rang-8-forme-elementaire-d-air": ("forme de voie, hors liste DRS en ligne.", []),
 "nc-4-zombie-choursette": ("variante locale ; le DRS en ligne ne liste que le zombie humain (+ ourhible).", []),
 "compagnon-loup": ("compagnon du rôdeur (voie du compagnon animal, rang 1), DRS.", []),
 "compagnon-loup-alpha": ("compagnon du rôdeur (rang 4), DRS : DEF 12+rang, PV niv×4.", []),
}

for folder, (statut, divs) in VERIF.items():
    add_verif(folder, statut, divs)

# ==================================================== NOUVELLES CRÉATURES DRS
def new_md(folder, text):
    os.makedirs(os.path.join(BEST, folder), exist_ok=True)
    names = [fn for fn in os.listdir(os.path.join(BEST, folder)) if fn.endswith(".md")]
    if names:
        log.append(f"SKIP new md (existe) {folder}")
        return
    open(os.path.join(BEST, folder, folder + ".md"), "w", encoding="utf-8").write(text)
    log.append(f"new md {folder}")


new_md("chasseur-aile", """# Chasseur ailé (DRS)

- Catégorie : Monstres/Créatures
- NC : 5
- Source DRS : https://drs.chroniques-oubliees.fr/fantasy/creatures
- Vérification DRS (11/10/2026) : transcrite du livre des règles en ligne (pas de capture VTT).
- Description : serviteur ailé non-vivant.

## Profil — Chasseur ailé

- État : Non-Vivante — Taille : Grande — NC 5
- Caractéristiques : AGI +1 / CON +6 / FOR +6 / PER +0 / CHA +0 / INT +2 / VOL +6
- Initiative 12 — Défense 18 — RD 0
- Vigueur 50 — DM Temp. 0 — Déplacement 10 m — États : —
- Attaques : Serres +10, DM 2d6+6 (Attaque +10, Dommages 2d6+6)
- Actions : Enlèvement ; Soutenir (L) ; Vol rapide - En vol attaque cible au sol

## Capacités

### Enlèvement (Capacité)

Le chasseur ailé peut tenter d'agripper une cible de taille moyenne ou inférieure en action d'attaque. La cible peut faire un test de FOR opposé pour échapper à son étreinte à sa première attaque, en cas d'échec, elle est immobilisée et elle ne peut pas se libérer avant que le serviteur ne décide de la relâcher ou qu'il soit vaincu. (DRS)

### Vol rapide (Capacité)

Le chasseur ailé obtient une action de mouvement supplémentaire par round lorsqu'il est en vol. Au premier round de combat, la créature obtient un bonus de +5 en attaque et +1d6 aux DM si elle est en vol et attaque une créature au sol, elle peut tenter un enlèvement. (DRS ; variante +5/+1d6)

## Notes

- Capacités communes : Soutenir, Vol rapide, Enlèvement.
""")

new_md("zombie-ourhible", """# Zombie ourhible (DRS)

- Catégorie : Monstres/Créatures
- NC : 4
- Source DRS : https://drs.chroniques-oubliees.fr/fantasy/creatures
- Vérification DRS (11/10/2026) : transcrite du livre des règles en ligne (pas de capture VTT).
- Description : un ourhible mort-vivant.

## Profil — Zombie ourhible

- État : Non-Vivante — Taille : Grande — NC 4
- Caractéristiques : AGI +1 / CON +6 (*) / FOR +6 / PER -2 / CHA -2 / INT -4 / VOL +6
- Initiative 8 — Défense 13 — RD 0
- Vigueur 85 — DM Temp. 0 — Déplacement 5 m — États : —
- Attaques : Bec et griffes +12, DM 2d8+10 (Attaque +12, Dommages 2d8+10)
- Actions : Soutenir (L)

## Capacités

### Insensible à la douleur (Capacité)

Ajoutez 3 x NC aux PV et retranchez 5 à la DEF. La créature peut encore faire une action (attaque ou mouvement) après avoir été réduite à 0 PV. (DRS)

### Lenteur (Capacité)

Le zombie voit son AGI réduite à -1 et sa PER à -2, et il ne se déplace que de 5 m par action de mouvement. (DRS)

### Résistance aux DM (Capacité)

Divisez par deux tous les DM infligés au zombie par des armes, sauf s'il s'agit d'armes tranchantes. (DRS)

### Sans esprit (Capacité)

Aucune âme n'habite la carcasse morte, le zombie est immunisé à tous les sorts qui affectent l'esprit. L'INT et le CHA passent à -4, la VOL à +6. (DRS)

## Notes

- Capacités communes : Soutenir + cycle zombie.
""")


def new_json(entry):
    if entry["id"] in idx:
        log.append(f"SKIP new json (existe) {entry['id']}")
        return
    data.append(entry)
    idx[entry["id"]] = entry
    log.append(f"new json {entry['id']}")


new_json({
    "id": "notion-chasseur-aile", "kind": "monstre", "nom": "Chasseur ailé",
    "type": "Créature", "niveau": 5, "pv": 50, "pvMax": 50, "defense": 18,
    "initMod": 1,
    "attaques": [{"id": "notion-chasseur-aile-a0", "nom": "Serres",
                  "bonus": 10, "degats": "2d6+6", "degatsAffiche": "2d6+6"}],
    "capacites": ["Enlèvement", "Soutenir", "Vol rapide"],
    "capacitesPartagees": ["soutenir", "vol-rapide", "enlevement"],
    "capacitesDetails": [
        {"nom": "Enlèvement",
         "description": "Le chasseur ailé peut tenter d'agripper une cible de taille moyenne ou inférieure en action d'attaque. Test de FOR opposé à la première attaque, sinon immobilisée jusqu'à relâche ou destruction. (DRS)"},
        {"nom": "Vol rapide",
         "description": "Action de mouvement supplémentaire par round en vol. Au premier round : bonus de +5 en attaque et +1d6 aux DM contre une créature au sol, enlèvement possible. (DRS, variante)"}],
    "description": "Serviteur ailé non-vivant (DRS).",
    "comportement": "", "taille": "Grande", "categorie": "Monstres/Créatures",
    "rd": 0, "deplacement": 10, "initiativeFiche": 12,
    "sourceUrl": DRS_URL, "notes": "", "exemple": False,
})
new_json({
    "id": "notion-zombie-ourhible", "kind": "monstre", "nom": "Zombie ourhible",
    "type": "Créature", "niveau": 4, "pv": 85, "pvMax": 85, "defense": 13,
    "initMod": 1,
    "attaques": [{"id": "notion-zombie-ourhible-a0", "nom": "Bec et griffes",
                  "bonus": 12, "degats": "2d8+10", "degatsAffiche": "2d8+10"}],
    "capacites": ["Soutenir", "Insensible à la douleur", "Lenteur",
                  "Résistance aux DM", "Sans esprit"],
    "capacitesPartagees": ["soutenir", "sans-esprit", "lenteur",
                           "insensible-douleur", "resistance-zombie"],
    "capacitesDetails": [
        {"nom": "Insensible à la douleur",
         "description": "Ajoutez 3 x NC aux PV et retranchez 5 à la DEF. La créature peut encore faire une action (attaque ou mouvement) après avoir été réduite à 0 PV. (DRS)"},
        {"nom": "Lenteur",
         "description": "Le zombie voit son AGI réduite à -1 et sa PER à -2, et il ne se déplace que de 5 m par action de mouvement. (DRS)"},
        {"nom": "Résistance aux DM",
         "description": "Divisez par deux tous les DM infligés au zombie par des armes, sauf s'il s'agit d'armes tranchantes. (DRS)"},
        {"nom": "Sans esprit",
         "description": "Aucune âme n'habite la carcasse morte, le zombie est immunisé à tous les sorts qui affectent l'esprit. L'INT et le CHA passent à -4, la VOL à +6. (DRS)"}],
    "description": "Un ourhible mort-vivant (DRS).",
    "comportement": "", "taille": "Grande", "categorie": "Monstres/Créatures",
    "rd": 0, "deplacement": 5, "initiativeFiche": 8,
    "sourceUrl": DRS_URL, "notes": "", "exemple": False,
})

# ==================================================== DIVERS (import + index)
# import_notion.py : la RD s'écrit « Défense 15 — RD 5 » dans les fiches
imp = os.path.join(BEST, "import_notion.py")
t = open(imp, encoding="utf-8").read()
old_re = 'm = re.search(r"Initiative\\s*(\\d+)\\s*[—-]\\s*(?:Défense|DEF)\\s*(\\d+)(?:\\s*\\(RD\\s*(\\d+)\\))?", block)'
new_re = 'm = re.search(r"Initiative\\s*(\\d+)\\s*[—-]\\s*(?:Défense|DEF)\\s*(\\d+)(?:\\s*(?:\\(|—)\\s*RD\\s*(\\d+)\\s*\\)?)?", block)'
assert old_re in t, "regex import introuvable"
open(imp, "w", encoding="utf-8").write(t.replace(old_re, new_re, 1))
log.append("import_notion.py : regex RD élargie (— RD X)")

# bestiaire/index.md : +2 créatures DRS
ix = os.path.join(BEST, "index.md")
t = open(ix, encoding="utf-8").read()
t = t.replace("Fiches : 117 — Images : 313", "Fiches : 119 — Images : 313")
t = t.replace("## Monstres/Créatures (58)", "## Monstres/Créatures (60)")
anchor = "| Zombie Coriasse |"
assert anchor in t
row = ("| Chasseur ailé (DRS) | `chasseur-aile/` | 0 | "
       "[chasseur-aile.md](./chasseur-aile/chasseur-aile.md) |\n"
       "| Zombie ourhible (DRS) | `zombie-ourhible/` | 0 | "
       "[zombie-ourhible.md](./zombie-ourhible/zombie-ourhible.md) |\n")
t = t.replace(anchor, row + anchor)
open(ix, "w", encoding="utf-8").write(t)
log.append("index.md : +2 créatures")

print("PARTIE 1 OK")
with open(os.path.join(ROOT, "drs-fix.log"), "w", encoding="utf-8") as f:
    f.write("\n".join(log) + "\n")
json.dump(data, open(JSON_PATH, "w", encoding="utf-8"), ensure_ascii=False,
          indent=1)
print(len(log), "actions")
