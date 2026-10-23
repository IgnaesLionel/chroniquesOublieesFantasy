# Générateur de rencontres COF2 — méthode, sources et limites

Ce document décrit **ce que le logiciel calcule, ce qu'il suppose et ce qu'il ne
peut pas savoir**. Toute valeur qui n'est pas lue sur une fiche du bestiaire est
signalée comme telle.

> **Règle de conduite du module** : aucune statistique de créature n'est inventée.
> Tout part de `src/lib/data/monstres-notion.json`. Ce qui n'est pas dans une fiche
> est une **hypothèse du logiciel**, documentée, configurable et testée ici.

---

## 1. Architecture

| Module | Rôle |
|---|---|
| `src/lib/encounters/types.ts` | Types et champs de configuration |
| `src/lib/encounters/rules.ts` | Table NC → Pm, touche, difficultés, terrain, config |
| `src/lib/encounters/roles.ts` | Dérivation du profil tactique depuis la fiche |
| `src/lib/encounters/party.ts` | Profil de groupe (fiches réelles ou mode simplifié) |
| `src/lib/encounters/evaluate.ts` | Évaluation analytique du danger |
| `src/lib/encounters/generate.ts` | Recherche de compositions, score, verrous du MJ |
| `src/lib/encounters/calibration.ts` | Simulation Monte-Carlo simplifiée |
| `src/components/encounters/EncounterGenerator.tsx` | Interface |

Le calcul (`evaluate.ts`, `generate.ts`) est **indépendant de l'interface** : les
tests le pilotent directement, sans navigateur.

---

## 2. Ce qui vient du DRS (règles officielles)

Sources : <https://www.co-drs.org/fr/jeu/regles/rencontres/les-creatures/creer-une-rencontre/nombre-de-creatures>
et les pages voisines (« Attaques », « Attaques multiples »,
« Créer un personnage / Attaque », « Progression et niveaux »).

### 2.1 Budget de points (Pm)

Table **NC → Pm** publiée dans le DRS :

| NC | 0 | 0,5 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pm | 3 | 5 | 10 | 20 | 40 | 70 | 100 | 150 | 200 | 250 | 320 | 400 | 500 | 600 |

(13 → 700, 14 → 850, 15 → 1000, 16 → 1200 … 20 → 2000.)

Budget ajusté à la taille du groupe (règle DRS) :

```
budget Pm ajusté = Pm total des créatures × (nombre de PJ / 4)
nrBudget        = inverse de la table Pm → NC
```

Le DRS approuve explicitement la **découpe** du budget en nombre de créatures
différentes (« 6 tigres », « 2 géants et 2 tigres pour le même nombre de points »)
et affirme « 20 créatures NC 2 semblent à peu près équivalentes à une créature
NC 10 ». **Le modèle logiciel diverge volontairement de cet énoncé** — voir §4.3.

### 2.2 Attaque et dégâts

- **Toucher** : `1d20 + bonus ≥ DEF` ; un 20 naturel est un critique. Le logiciel
  utilise la probabilité analytique et borne les taux entre 5 % et 100 %.
- **Bonus d'attaque** = niveau + Mod. de caractéristique.
  - Le DRS **ne fixe aucun plafond** (« Ses scores d'attaque augmentent également
    de +1 » à chaque niveau).
  - L'application utilise `niveauAttaque()` qui plafonne à `min(niveau, 10)` —
    **divergence connue**, hors périmètre de ce module. Elle ne coûte que +1 au
    niveau 11 et est sans effet au-delà.
- **Dégâts** = dé de l'arme + Mod. de FOR, **pour les armes de contact seulement** :
  « Le Mod. de FOR s'ajoute aux DM des armes de contact. Aucun Mod. n'est ajouté
  aux armes à distance. » Aucun bonus de dégâts par niveau n'existe en COF2.
- **Attaques multiples** : la notation « (2 attaques) » sur une fiche désigne des
  attaques **indépendantes dans le même tour** (jet de touche et de dégâts
  séparés). Le logiciel applique cette multiplicité **par attaque** (champ
  `multiplicite` de `AttaqueEvaluee`), jamais globalement.
- **Exclusivité contact / distance** : « Ces deux attaques ne peuvent pas être
  réalisées dans le même tour ». Le mode de contact et le mode à distance d'une
  créature sont donc **exclusifs** : `dprDepuisAttaques()` et
  `dprAvecMalusEtRd()` retiennent `max(contact, distance)`. Seules les actions
  **limitées** (sort par jour, souffle, recharge) s'ajoutent.

### 2.3 Progression des personnages

- « Le personnage reçoit **2 points de capacité** » par niveau — base de
  l'hypothèse de progression de DEF (§3.3).
- Un archétype atteint un niveau supérieur et gagne des capacités de voie, dont
  des **dés évolutifs** — base de l'hypothèse de progression de dégâts (§3.3).

### 2.4 Surprise et terrain

Les malus de terrain (`−2` en montagne/neige, `−5` dans l'obscurité ou sous
l'eau) et le `NC +1/+2` associés viennent des **conditions hostiles du DRS**. Les
facteurs de surprise (`×0,85` / `×1,18`) sont en revanche une **approximation du
logiciel**, pas une règle.

---

## 3. Ce que le logiciel suppose (hypothèses)

Chacune de ces hypothèses est un **champ de configuration** sauf mention
contraire ; on peut donc la modifier sans toucher au moteur.

### 3.1 Deux niveaux de difficulté distincts

| Grandeur | Origine |
|---|---|
| `nrBudget` | **Règle DRS** — table NC → Pm, ajustée au nombre de PJ |
| `nrEstime` | `nrBudget` **+ correction tactique du logiciel** |

```
nrEstime  = nrBudget + correctionTactique + terrain
deltaDanger = nrEstime − niveauEffectif du groupe
```

Ces deux grandeurs sont **affichées séparément** dans les résultats : le budget
officiel et l'estimation du logiciel ne doivent jamais être confondus.

### 3.2 Difficultés demandées et bandes de classement

| Difficulté | Budget demandé | Tolérance |
|---|---|---|
| Facile | `niveauEffectif − 2` | ± 0,6 NR |
| Normal | `niveauEffectif` | ± 0,6 NR |
| Boss | `niveauEffectif + 1,5` | ± 0,75 NR |

Classement final par **bande** (indépendant du budget demandé) :

```
facile : delta ≤ −1,25
normal : −1,25 < delta < +0,6
boss   : delta ≥ +0,6
```

> Le boss est calibré à **+1,5 NR** et non +1. Avec +1, la simulation donnait des
> boss **plus faciles** que les rencontres normales de même niveau (75 % de
> victoires contre 67 % au niveau 8). C'est un choix du logiciel, pas une règle.

### 3.3 Progression des archétypes (mode simplifié)

En COF2 les dégâts ne progressent **pas** par niveau : ils sont `dé de l'arme +
Mod. de FOR` (contact). La progression vient des capacités de voie (dés
évolutifs) et de l'équipement magique. Le mode simplifié l'approxime par :

| Hypothèse | Défaut | Fondement |
|---|---|---|
| `progressionDegatsParNiveau` | **0,5** dégâts/niveau | Capacités de voie (dés évolutifs) |
| `progressionDefParNiveau` | **0,3** DEF/niveau | « 2 points de capacité par niveau » + capacités DEF réelles |

Les capacités DEF citées à l'appui : Armure de mana (+3/+4), Peau d'écorce,
Vêtements sacrés, Runes de défense, Armure de vent, Peau de pierre, Vitesse du
félin, Armure d'os.

### 3.4 Économie d'actions

La comparaison PV × DPR agrégés **ignore** la cascade des PJ KO : un camp qui perd
son mage au round 2 perd aussi ses dégâts et ses soins pour le reste du combat.
Le modèle en tient compte par un facteur multiplicatif :

```
ratioPuissance = ratioBrut × (actionsEnnemis / actionsParti) ^ exposantEconomieActions
```

avec `exposantEconomieActions = 0,4` par défaut (borné à [0,4 ; 4]). Ce facteur
apparaît dans les résultats sous le nom de facteur **« Économie d'actions »**
(champ `facteurActions`).

> **Limite assumée.** Le DRS affirme que « 20 créatures NC 2 semblent à peu près
> équivalentes à une créature NC 10 ». Le modèle logiciel **surestime** l'avantage
> des bandes nombreuses : à budget égal, il traite un grand nombre de créatures
> comme nettement plus dangereux. Cette prudence est assumée (elle évite les
> rencontres ingagnables) mais diverge de l'énoncé du DRS.

### 3.5 Régénération et vol de vie

- **Régénération** : détectée **uniquement** sur les capacités de soin réelles de
  la fiche (`SOIN_DIRECT_MOTIF` : soin, guérison, régénération, vitalité). Le
  « soutien » générique — **commandement** (« Capitaine », « Chef »),
  **invocation**, **protection** — **ne soigne pas** et ne gonfle pas les PV
  effectifs. Un ancien comportement accordait aux soutiens ennemis 10 % des PV
  max d'un allié par action, **sans aucune ressource** : un mécanisme absent de
  toute fiche, qui rendait les bandes invincibles en simulation.
- La régénération est convertie en PV effectifs avec `ROUNDS_SOUTIEN = 6` rounds
  supposés (la durée réelle dépend des PV effectifs eux-mêmes : calcul circulaire,
  donc on borne).
- **Vol de vie** : les attaques à vol de vie rapportent 50 % des dégâts infligés.
  Côté analytique, la durabilité apportée est approchée par
  `0,5 × DPR de la créature × part de ses attaques à vol de vie`.

### 3.6 Résistances et RD

Les dégâts sont appliqués **créature par créature** : le DPR du groupe est calculé
contre chacune puis moyenné pondéré par sa part des PV ennemis. Cela évite de
faire disparaître la RD des créatures résistantes en moyennant d'abord les
statistiques — un défaut qui, corrigé, a fait passer un cas de calibration de
**1 % à 92 % de victoires**.

### 3.7 Soin des PJ

Le soin par action des PJ est **borné** par leur réserve (mana + points de soin).
Les ennemis ne soignent jamais par action ; seule la régénération passive s'applique.

---

## 4. Limites connues

1. **Bonus d'attaque plafonné à 10 dans l'application** alors que le DRS n'en fixe
   aucun (§2.2). Hors périmètre : un changement est global et systémique.
2. **Surestimation de l'avantage des bandes nombreuses** (§3.4) — diverge de
   l'énoncé du DRS.
3. **Le modèle analytique estime un combat moyen**, pas un tirage. La simulation
   Monte-Carlo sert de contrepoint : les deux peuvent diverger sur une composition
   particulière (focus-fire, concentration du pouvoir dans une créature fragile).
4. **La progression des archétypes est une approximation linéaire** (§3.3). La
   progression réelle est discrète et dépend des voies choisies par le joueur.
5. **Au-delà du NC 12, la simulation dérive** — c'est la limite affichée par le
   DRS lui-même.
6. **Calibration** : vérifiée sur les niveaux 1, 3, 5, 8 et 11, moyennée sur
   plusieurs graines. Les taux de victoire « normal » obtenus sont de l'ordre de
   77 / 58 / 50 / 41 % aux niveaux 3 / 5 / 8 / 11. La variance entre graines reste
   élevée : deux compositions de même score peuvent avoir des issues très
   différentes. Le module expose plusieurs **variantes** pour que le MJ choisisse.
7. **Éditions** : le bestiaire contient des entrées COF1/V1 et hors DRS. Elles
   sont **exclues par défaut** ; les inclure demande une option explicite et
   affiche un avertissement de compatibilité.
8. **Budget inférieur au prix plancher d'un thème** : la table Pm est grossière
   aux bas niveaux (NC 1 = 10 Pm, NC 2 = 20 Pm). Un groupe de niveau effectif 0,5
   a une cible de 5 Pm : aucun mort-vivant (10 Pm) ni démon (20 Pm) n'entre dans
   le budget. Le générateur ne rend jamais une composition vide dans ce cas : il
   propose la créature la moins chère du filtre et ajoute l'avertissement
   « Budget trop serré pour ce thème ». La difficulté réelle est alors supérieure
   à celle demandée — c'est assumé, et visible dans l'écart de NR affiché.

---

## 5. Formules configurables (récapitulatif)

Toutes ces valeurs sont dans `CONFIGURATION_PAR_DEFAUT` (`rules.ts`) et
acceptent un surcharge partielle via `configuration`.

| Clé | Défaut | Rôle |
|---|---|---|
| `tablePm` | Table DRS | NC → Pm (règle officielle) |
| `decalageNr` | facile −2 / normal 0 / boss +1,5 | Budget demandé par difficulté |
| `toleranceNr` | 0,6 / 0,6 / 0,75 | Tolérance sur le budget |
| `poidsTactique` | 0,65 | Part de la correction tactique dans `nrEstime` |
| `baseLogPuissance` | 1,35 | Un camp 35 % plus puissant ≈ +1 NR |
| `correctionTactiqueMin/Max` | −2,5 / 2,5 | Bornes de la correction |
| `exposantEconomieActions` | 0,4 | Poids du rapport d'actions |
| `poidsCoherenceNr` | 4 | Pénalité des candidats hors bande demandée |
| `progressionDegatsParNiveau` | 0,5 | Hypothèse archétype (§3.3) |
| `progressionDefParNiveau` | 0,3 | Hypothèse archétype (§3.3) |
| `maxCreatures` | 12 | Plafond de composition |
| `essaisGeneration` | 400 | Étendue de la recherche |
| `variantes` | 3 | Compositions retournées au MJ |
| `iterationsSimulation` | 250 | Itérations Monte-Carlo |

Le score de sélection d'une composition est
`budget × 3,2 + cohérence × poidsCoherenceNr + qualité × 1`.

---

## 6. Vérification

```bash
npx vitest run tests/encounters   # unitaires + calibration
```

`tests/encounters/calibration.test.ts` reproduit la table de calibration
(niveaux × difficultés) et vérifie la monotonie du danger. Pour ajuster un
coefficient, le protocole est : modifier la clé de configuration, rejouer la
table sur **plusieurs graines**, et ne retenir un changement que s'il améliore
l'ensemble des niveaux — pas un seul tirage.
