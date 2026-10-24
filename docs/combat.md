# Combat assisté — chance de toucher

Le panneau d'attaque affiche, pour chaque option tactique, le pourcentage de
chance de toucher la cible sélectionnée. Ce chiffre est **calculé par le
logiciel** à partir des fiches et des effets en cours : ce n'est pas une règle
imprimée dans le livre, mais l'application exacte du test d'attaque de COF2.

## Formule

```
touche  si  1d20 + bonus ≥ DEF de la cible
```

avec les exceptions du moteur :

| Cas | Effet sur le calcul |
|---|---|
| 1 naturel | échec automatique, quel que soit le bonus |
| 20 naturel | touche automatique (et critique) |
| seuil de critique 19-20 (Science du critique) | le 19 naturel touche aussi |
| dé bonus (garde le meilleur de 2d20) | `P = 1 − p²` où `p` est la probabilité d'échec simple |
| dé malus (garde le pire de 2d20) | `P = (1 − p)²` |
| cible paralysée | touche automatique (100 %) |
| attaque sans jet (`toucheAuto`) | 100 % |
| DEF modifiée par un effet (Défense partielle, sorts…) | DEF + modificateurs d'effets |
| Aveuglé | −5 supplémentaire sur les attaques à distance |

Le bonus affiché est celui réellement utilisé par le moteur :

```
bonus = bonus de la fiche (ou Attaque éclair : niveau + AGI)
      + modificateurs d'effets (attaque, attaque à distance)
      + modificateur manuel saisi
      + option tactique (Assurée +5, Précise −3, Violente −7)
      + Double attaque / Attaque circulaire (−2)
      + prédilection du maître d'armes (+1)
```

Les options tactiques n'existent que sur les **attaques d'arme** : sur une
attaque magique, elles sont désactivées et seul le pourcentage de l'attaque
normale est affiché.

## Ce qui n'est pas affiché

Le pourcentage est masqué quand la notion n'a pas de sens ou dépend d'une
information que l'écran ne peut pas trancher :

- **attaque de zone ou multi-cibles** : plusieurs cibles, plusieurs DEF ;
- **test opposé magique** (ex. Pied, Ensevelissement) : ce n'est pas un seuil
  de DEF mais un d20 contre d20 ;
- **difficulté fixe de sort** (`difficulteAttaque`) : la formule n'est pas
  résolue dans l'interface.

## Code et tests

| Fichier | Rôle |
|---|---|
| `src/lib/rules/combat/touche.ts` | `composantesAttaque`, `seuilDefense`, `probabiliteToucher` |
| `src/lib/rules/combat/attack.ts` | `resolveAttack` utilise les mêmes fonctions (aucune divergence possible) |
| `src/components/combat/AttackPanel.tsx` | Affichage sur les quatre options et sur le bouton d'attaque |
| `tests/rules/touche.test.ts` | Bornes 1/20, dé bonus/malus, seuil de critique, DEF avec effets |

Le pourcentage ne modifie **aucun jet** : il informe le MJ avant qu'il clique.

## Fiche de créature en combat

Chaque monstre de la table porte un bouton `🧠` (aperçu des deux premières
capacités, `+N` au-delà) qui ouvre sa fiche : NC, PV/DEF/Init, attaques et
**capacités du bestiaire** avec leur texte.

- Les capacités sont **copiées dans le participant** à l'instanciation
  (`capacitesDetails`, `capacitesPartagees`) : la fiche reste lisible même si
  le bestiaire change en cours de partie.
- Priorité des textes : catalogue partagé (`CAPACITES_PARTAGEES`) → texte de la
  fiche → nom seul (mention « Texte non fourni »).
- Doublons fusionnés : `Vol rapide` et `Vol rapide (Capacité)` n'apparaissent
  qu'une fois ; les références d'images importées de Notion sont retirées.
- **Informatif** : le moteur n'automatise pas ces capacités, le MJ les joue
  (journal de combat pour la trace).

| Fichier | Rôle |
|---|---|
| `src/lib/rules/combat/fiche-creature.ts` | `capacitesCreature` (dédoublonnage, nettoyage) |
| `src/components/combat/FicheCreature.tsx` | Modale de fiche |
| `tests/rules/fiche-creature.test.ts` | Aigle commun, doublons, images Notion |
