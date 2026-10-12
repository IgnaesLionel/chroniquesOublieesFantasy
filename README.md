# Assistant MJ — Chroniques Oubliées Fantasy V2

Copilote du MJ : personnages, monstres, dés, combat, scénarios à embranchements, PNJ, objets et trésors.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:3000
npm run typecheck
npm run test     # vitest : 309 tests règles
npm run build
```

## Architecture

```
app/                 # routes App Router (fines, "use client")
  characters/ combat/ play/ scenarios/ monsters/ sorts/ ...
src/components/      # UI par domaine (combat/, characters/, scenario/...)
src/lib/rules/       # moteur pur, sans React, 100% testé
  combat/ initiative.ts factory.ts staging.ts attack.ts types.ts
  personnage.ts creation.ts dice/ effects/ bourse.ts ...
src/lib/data/        # seeds + validation zod (validation.ts)
src/lib/store/       # persistance
  repository.ts      # StorageAdapter (localStorage aujourd'hui, SQL demain)
  collections.ts     # hooks typés : useCharacters/useMonsters/useNpcs/...
  backup.ts          # export/import JSON validé (STORAGE_KEYS)
  useLocalCollection.ts / useCatalogueObjets.ts
src/lib/ui/          # helpers UI partagés (pv.ts)
tests/rules/         # 30 fichiers vitest
```

Règles d'or :
- l'UI ne parle qu'aux hooks `collections.ts`, jamais aux clés `"cof.*"` en dur ;
- les règles sont pures et testées (`tests/rules/`) ;
- `exportJson` (`repository.ts`) est la seule fonction d'export ;
- couleurs PV centralisées dans `src/lib/ui/pv.ts`.

## Stockage

localStorage via `STORAGE_KEYS` (`backup.ts`). Combat et jets de dés = volatils.
Sauvegarde globale dans Paramètres : export/import JSON validé par zod, migration `stats` legacy -> `caracteristiques`.

## Prochaines étapes

- Splitter `combat/attack.ts` (1547l) en `degats.ts/couts.ts/soutien.ts/capacites.ts` avec barrel pour compat ;
- Splitter `personnage.ts` (843l) en `profil.ts/derivation.ts/recuperation.ts` ;
- Déplacer `*.py`, `drs-*.json`, `bestiaire/` brut vers `tools/` ;
- Store global + Route API quand passage à SQLite/Postgres.
