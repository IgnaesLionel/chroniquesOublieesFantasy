# Proposals — Capacités et sorts en combat · passe 1 : Guerrier

Fait suite à l'analyse du moteur (sans position ni distance) et du fil officiel
BBE « COF2 Corrections de règles » (topic 80411, page 1 tenue par Laurent
Kegron Bernasconi). Cible : réduire le travail MJ, rendre explicite ce qui
exige son avis, et automatiser ce qui ne dépend que de la fiche.

---

## 1. État des lieux Guerrier (5 voies)

### Déjà fiables côté moteur (à ne pas retoucher)
- **Voie du bouclier** : Protéger un allié (bonus consommé à la 1re attaque),
  Parer un coup + Absorber + Renvoi de sort (test opposé complet, stockage du
  sort), passif +1/+2 DEF (rang), −rang aux DM de zone/souffles.
- **Passifs** : Robustesse (+rang+2 PV), Vivacité (+3 Init), Dur à cuire et
  Rempart (+1 DEF), Armure d'os / Exsangue (sorcier).
- **Cases déjà branchées au panneau Attaque** : Puissante, Parfaite, Dans le
  mille, Flèche de mort, Attaque éclair + tactiques Assurée/Précise/Violente.

### Les vrais trous (ce que le joueur tape à la main ou oublie)
1. **Maître d'armes** : prédilection (+1 att.), Science du critique (19-20) et
   Spécialisation (+1 DM/perso, max +6) sont des bonus *saisis manuellement à
   chaque coup* — oubliés la moitié du temps. La catégorie d'arme de
   prédilection n'est stockée nulle part.
2. **Double attaque / Attaque circulaire** : −2 à retaper et 2 lancers
   séparés ; tourbillon multi-cibles manuel.
3. **Attaques gratuites** : Riposte (quand l'ennemi rate), Teigneux (fuyard),
   Piqûre de rappel (l'ennemi attaque un autre), Enchaînement (Barbare) —
   toutes « MJ : attaque manuelle », donc jamais lancées ou lancées sans
   distinction d'action consommée.
4. **Dur à cuire** à 0 PV (« agit encore 1 round ») : aucun indicateur, le
   perso passe KO sans que le MJ garde la main.
5. **Distance/conditions** : Protéger (au contact), Charge (5-10/10-20 m en
   ligne droite), Tourbillon (5 m), Vivacité tests anti-immobilisé… : la fiche
   donne la portée, l'app ne pose jamais la question.
6. **Prouesse / Tour de force** : tests FOR/CON hors moteur (narratif, OK) mais
   sans aide au jet de test.

---

## 2. Proposition A — Pop-up de validation MJ (l'idée demandée)

**Principe.** Une modale générique « Validation du MJ » interpose entre le clic
et la résolution pour toute action à condition (portée, contact, taille,
fréquence, jugement). Elle ne modélise pas la distance — elle la *fait
constater* par le MJ et la trace au journal.

**Flux UI**
1. Le joueur clique « Lancer / Utiliser » sur une capacité/sort marqué.
2. Une modale apparaît : titre (nom de l'action), question posée par la fiche
   (ex. « Charge : 5-10 m en ligne droite, dégagée ? »), rappel de la règle,
   boutons **[Valider → résoudre]** / **[Annuler]**.
3. Option « ne plus demander cette session » pour les validations banales.
4. Le journal note la validation : `MJ a validé (portée/contact) : …` — le PDF
   de fin de partie reste auditable.

**Implémentation minimaliste**
- Nouveau champ opt-in dans les données : `questionMJ?: string` sur
  `CapaciteUsable` (src/lib/data/capacites-usables.ts) et sur `Sort`
  (types.ts). Pas de champ → comportement actuel.
- Un seul composant `PopupValidationMJ` utilisé par CapacitésPanel et
  AttackPanel : le `onRoll/onUtiliser` passe par un état temporaire
  `enAttente` au lieu d'appeler directement le store.
- Aucun changement du moteur pur : c'est 100 % interface.

**Première vague Guerrier (questions stockées dans les data)**
| Capacité | Question posée au MJ |
|---|---|
| Protéger un allié | « L'allié protégé est-il au contact de la créature visée ? » |
| Parer un coup | « Le bouclier est-il en posture (action M prise avant l'attaque) ? » |
| Attaque circulaire | « Chaque adversaire visé est-il au contact (≤ 5 m) ? » |
| Charge (Barbare/Chev.) | « Distance 5-10 m (10-20 m monté), ligne droite dégagée, pas déjà au contact ? » |
| Attaque tourbillon | « Toutes les cibles sont-elles dans 5 m ? » (1/combat) |
| Attaque parfaite | « Arme de prédilection ? (sinon cocher refusé) » |
| Dur à cuire | « 1/combat : agit encore 1 round à 0 PV ? » |

La même mécanique servira ensuite aux sorts (zone : « rayon 10 m sur le
mobilier ? », espèce cible, portée, concentration), c'est l'infrastructure
commune qui manque.

---

## 3. Proposition B — Buffs du maître d'armes attachés à la fiche

> **✅ Implémenté** (levière : `famillePredilection`/`bonusSpecialisation` sur
> la fiche, copiés en combat ; +1 attaque / critique 19-20 / +N DM appliqués
> dans `resolveAttack` quand l'attaque est une arme de la famille et que le
> talent correspondant est connu ; badge auto au panneau Attaque ;
> Science du critique gardée en CAPACITES_USABLES comme secours MJ pour
> arme non posée).

**Problème** : trois talents génèrent des bonus que le joueur doit re-saisir
par coup. Ils doivent vivre dans la fiche, pas dans la mémoire du joueur.

**Modifications**
1. `Character` reçoit `famillePredilection?: string` (categories de
   ARME_FAMILLES, ex. "haches", "épées"…) + `bonusSpecialisation?: number`
   (0-6). L'éditeur de personnage ajoute deux listes déroulantes/champs au
   niveau du talent (rang 1 = catégorie, rang 3 = bonus).
2. Dans le panneau Attaque, quand l'arme sélectionnée matche la famille :
   - afficher un badge readonly « ◈ Prédilection +1 · Spécialisation +N ·
     Critique 19-20 » sur la ligne de l'attaque ;
   - ajouter automatiquement l'attaque +1 et le bonus DM +N au lancer (le
     champ manuel reste disponible au-dessus, additionné).
3. `resolveAttack` : si le talent Science du critique est connu ET que l'arme
   matche la prédilection → seuil de critique 19-20 (sinon 20), sans effet à
   activer. Le talent quitte CAPACITES_USABLES (plus de clic rituel).
4. Correction officielle à intégrer : **la prédilection inclut désormais la
   catégorie « mains nues »** (corrections p88) → famille à ajouter dans les
   données d'armes.

**Gain** : plus de +1 oublié, les fiches Guerrier jouent du premier round
avec tous leurs bonus affichés.

---

## 4. Proposition C — File d'attaques gratuites

> **✅ Implémenté (v1 automatique)** — Signaux `attaquesGratuites` sur le
> participant (Riposte au raté d'arme, Piqûre de rappel quand un autre est
> visé, Enchaînement à la chute au contact = auto ; Teigneux posé par le
> MJ via bouton ⚔+). Chips sur la grille avec lancer (⚔, cible = fauteur ou
> premier ennemi actif, mêmes règles moteur via `resolveAttack`) et écart (✕).
> Quota 1/round par type noté dans l'état (Enchaînement : cascade non
> plafonnée ; Rempart : Teigneux × AGI+2). Aucune posture/action consommée :
> le MJ garde la main (conditions de contact à valider).

**Problème** : Riposte, Teigneux, Piqûre de rappel, Enchaînement déclenchent
des attaques qui ne consomment pas l'action du personnage, mais rien dans
l'app ne les rend possibles autrement qu'en « MJ fait l'attaque à la main ».

**Modifications**
- Nouveau concept moteur léger : une *file d'attaques libres* par participant
  (pas de tour consommé). Déclenchée automatiquement par le moteur :
  - **Riposte** (maître d'armes R5) : l'attaquant rate une attaque au contact
    contre le porteur → chip « ⚔ Riposte (G) sur X » sur la ligne du
    guerrier ; déjà journalisé, il suffit de passer du log au bouton ;
  - **Teigneux / Piqûre de rappel / Rempart** (soldat R1/R3/R5) : chip
    « attaque gratuite » activable par le MJ lors des événements correspondants ;
    Teigneux/Piqûre s'activent aussi hors tour du guerrier ;
  - **Enchaînement** (Barbare R3) : réduit à 0 PV → chip automatique.
- Un chip = un bouton qui résout `resolveAttack` immédiatement (cible choisie
  en 2e modal compacte), consommé au premier round d'usage (1/round
  Riposte/Teigneux ; gratuits plusieurs fois/jour-limites restantes aux
  usagesJournaliers).
- Correction officielle appliquée : **posture de riposte = on ne fait QUE
  riposter** (p216) → badge sur l'effet riposte-posture, l'app doit
  empêcher les autres actions de la justification (déjà partiellement :
  empecheAgir ? sinon à ajouter dans le catalogue d'effets).

---

## 5. Proposition D — Double attaque / Attaque circulaire auto-résolues

- **Double attaque** (R4) : case « Double » au panneau Attaque quand la
  capacité est connue → le lancer lance 2 résolutions successives à −2 (le
  moteur re-s'utilise ; RNG séquentiels, les deux touches journalisées).
- **Attaque circulaire** (R5) : case « Circulaire » → réutilise le
  multi-cibles existant (onMulti) forcé à `modAttaque −2` avec tous les
  ennemis pré-cochés après la validation du pop-up « tous au contact ? ».
  C'est le même chemin que les sorts de zone, à étendre aux armes.

---

## 6. Petites retouches Guerrier (seconde vague)

- **Dur à cuire** : au KO, le moteur propose (pop-up) de garder le perso actif
  1 round (1/combat, effet `Agit à 0 PV`, purge au tour suivant) — même
  principe que le Phénix, déjà automatique à 0 PV.
- **Vivacité (+3 pour éviter immobilisé/renversé)** : quand une créature
  inflige un renversement ou une immobilisation (test FOR opposé / FOR
  exigé), ajouter +3 au test de la victime PJ si Vivacité est connue. Les
  monstres de l'app lancent leurs tests avec leurs caracs connues : un +3 au
  côté de la victime suffit, sans refonte du moteur.
- **Manœuvre (R2)** : dé bonus aux tests de manœuvre → la case « dé bonus »
  existante du panneau Attaque suffit ; juste enrichir la note affichée
  (« Manœuvre : cocher dé bonus »).
- **Prouesse / Tour de force** : rester narratifs mais ajouter un mini-jet
  « Test FOR/CON +5 » (1d20 + car + 5) journalisé — option.

---

## 7. Corrections officielles à intégrer (source : topic 80411 page 1)

1. **Armes de prédilection = + mains nues** (p88) → famille ajoutée côté
   categories pour le Guerrier (et Moine reste spécifique).
2. **Riposte (p216)** : en posture de riposte, aucune autre action ; si
   personne n'attaque, le tour est perdu → prévoir un badge « posture de
   riposte : seules les ripostes sont possibles » dans l'interface (le
   catalogue d'effets n'a pas d'état "bloque tout sauf riposte" ; à ajouter
   comme modificateur dédié).
3. **Concentration accrue (p228)** : rangs 1-2 → coût 0. Le moteur est déjà
   conforme (`max(0, base-2)`), juste le libellé « possible → 0 PM ».
4. **Effets 17-20 avec 2 attaques (p292)** : la probabilité de déclencher
   diminue si la créature a plusieurs attaques — le bestiaire de l'app est
   déjà aligné (Imparable « 17-20 si 2 attaques »). Rien à faire, à garder en
   mémoire pour les voies PJ.
5. **Récupération complète (+1 DR, résultat max)** : hors combat, à vérifier
   côté HorsCombatPanel — pas Guerrier immédiat.
6. **Potion (p247)** : prise (M) puis boire (M) — la formulation « action
   limitée » de la première version a été corrigée ; vérifier le panneau
   potions et fixer la règle retenue.

---

## 8. Après Guerrier : Mage / Mystique et le général

- Le même champ `questionMJ` à porter sur les **sorts** : zone (Ex. « Arcane
  rayon 10 m : alliés dans la zone ? »), espèce cible, taille max
  (Ensevelissement), portée/rang, concentration-accrue, « hors combat
  possible ? » → unifier l'expérience.
- Distance : à défaut de grille, ajouter sur chaque ligne de la table un
  mini-menu MJ « contact / portée X / hors portée » (3 positions relatives)
  qui filtre visuellement les cibles — le pop-up de validation reste le
  garde-fou principal.

## 9. Ordre de départ suggéré

1. Pop-up de validation MJ (infra commune + 1re vague Guerrier) — petit, gros
   gain, pose la fondation pour les sorts.
2. Buffs maître d'armes sur la fiche (B) — des fiches qui jouent avec tous
   leurs bonus dès le premier coup.
3. File d'attaques gratuites (C) + Riposte corrigée.
4. Double/Circulaire auto (D).
5. Dur à cuire et Vivacité (6).
