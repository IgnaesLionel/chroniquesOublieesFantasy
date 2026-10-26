"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  avecInstance,
  libelleCle,
  localStorageAdapter,
  marquerInstanceActive,
  noterEvenementStockage,
  noterResync,
  retirerInstanceActive,
} from "@/src/lib/store/repository";
import { demarrerReconciliation } from "@/src/lib/store/miroir";
import { STORAGE_KEYS } from "@/src/lib/store/backup";
import { SEED_CHARACTERS } from "@/src/lib/data/seeds";

// Réconciliation IndexedDB : démarrée une fois par document (si localStorage a
// été vidé par une autre application de l'origine, la sauvegarde miroir le
// ramène ; les écrans montés sont resynchronisés par l'événement storage
// synthétique de la réconciliation).
let reconciliationDemarree = false;

// Fenêtre laissée à la réconciliation IndexedDB (asynchrone) quand la clé est
// vide : sans elle, un montage pendant un effacement récent écrit les graines
// (PV plein vie) par-dessus une sauvegarde qui allait être restaurée.
const FENETRE_RECONCILIATION = 250;

/** Options d'une collection (communes à toutes ses instances). */
export interface OptionsCollection<T> {
  migrer?: (items: T[]) => T[];
  libelle?: string;
  protegerPv?: boolean;
  /** false : les graines ne sont écrites qu'à la première visite (pas de fusion à chaque lecture). */
  fusionner?: boolean;
}

interface Entree<T> {
  key: string;
  seed: T[];
  options: OptionsCollection<T>;
  items: T[];
  loaded: boolean;
  demarrage: boolean;
  ecouteursInstalles: boolean;
  libelleChargement: string;
  abonnes: Set<() => void>;
}

// Store par collection : toutes les instances d'une même clé partagent le même
// tableau. Avant, chaque composant (jusqu'à 15 pour les personnages) tenait son
// propre état et relisait le stockage : deux écrans pouvaient afficher des
// données différentes et les écritures s'écrasaient.
const entrees = new Map<string, Entree<unknown>>();
let compteurInstances = 0;

function obtenirEntree<T extends { id: string }>(
  key: string,
  seed: T[],
  options: OptionsCollection<T>
): Entree<T> {
  const existante = entrees.get(key) as Entree<T> | undefined;
  if (existante) return existante;
  const creee: Entree<T> = {
    key,
    seed,
    options,
    items: seed,
    loaded: false,
    demarrage: false,
    ecouteursInstalles: false,
    libelleChargement: `${libelleCle(key)}${options.libelle ? ` ${options.libelle}` : ""}`,
    abonnes: new Set(),
  };
  entrees.set(key, creee as Entree<unknown>);
  return creee;
}

function notifier(entree: { abonnes: Set<() => void> }): void {
  entree.abonnes.forEach((cb) => cb());
}

/** Publie un nouvel état partagé (mutation confinée au store, hors composant). */
function definirItems<T>(entree: Entree<T>, items: T[]): void {
  entree.items = items;
  notifier(entree);
}

function persister<T>(entree: Entree<T>, valeur: T[], libelle: string, retourAuxGraines = false): void {
  try {
    avecInstance(libelle, () =>
      localStorageAdapter.save(entree.key, valeur, {
        retourAuxGraines,
        protegerPv: entree.options.protegerPv,
      })
    );
  } catch {
    // Stockage indisponible : l'état mémoire reste la source de vérité.
  }
}

function installerEcouteurs<T extends { id: string }>(entree: Entree<T>): void {
  if (entree.ecouteursInstalles) return;
  entree.ecouteursInstalles = true;
  const relire = (cause?: string, lire = true) => {
    if (cause) noterResync(entree.key, cause);
    if (!lire) return;
    const stocke = avecInstance(entree.libelleChargement, () => localStorageAdapter.load<T[]>(entree.key));
    if (!stocke) return;
    const prepares = preparerStock(stocke, entree.seed, entree.options.migrer, entree.options.fusionner);
    if (prepares === entree.items) return;
    entree.items = prepares;
    notifier(entree);
  };
  // Un autre onglet peut modifier le stockage (événement storage), et un
  // retour arrière / changement d'onglet peut restaurer une page montée avant
  // (visibilité, focus). Toute écriture étant persistée aussitôt, relire
  // converge vers des données à jour sans rien écraser d'utile.
  window.addEventListener("storage", (e) => {
    if (e.key !== entree.key) return;
    noterEvenementStockage(entree.key, e.newValue);
    relire();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") relire();
  });
  // pageshow : sortie de bfcache ; popstate : traversées d'historique dans le
  // même document. Sans eux, un écran restauré affiche d'anciennes valeurs.
  window.addEventListener("pageshow", () => relire("pageshow"));
  window.addEventListener("popstate", () => relire("popstate"));
  window.addEventListener("focus", () => relire());
}

function demarrer<T extends { id: string }>(entree: Entree<T>): void {
  if (entree.demarrage) return;
  entree.demarrage = true;
  if (!reconciliationDemarree) {
    reconciliationDemarree = true;
    demarrerReconciliation({ [STORAGE_KEYS.characters]: SEED_CHARACTERS });
  }
  installerEcouteurs(entree);

  const accepter = (stockes: T[]) => {
    const prepares = preparerStock(stockes, entree.seed, entree.options.migrer, entree.options.fusionner);
    entree.items = prepares;
    entree.loaded = true;
    notifier(entree);
    // N'écrire QUE si la préparation a réellement changé quelque chose.
    if (prepares !== stockes) persister(entree, prepares, entree.libelleChargement);
  };

  const chargement = avecInstance(entree.libelleChargement, () =>
    localStorageAdapter.load<T[]>(entree.key)
  );
  if (chargement) {
    accepter(chargement);
    return;
  }
  // Clé vide : première visite — ou effacement si récent que la réconciliation
  // (asynchrone) n'a pas encore rejoué la sauvegarde. On attend la fin de la
  // fenêtre avant d'écrire les graines par-dessus une sauvegarde en cours de
  // restauration.
  window.setTimeout(() => {
    const relecture = avecInstance(entree.libelleChargement, () =>
      localStorageAdapter.load<T[]>(entree.key)
    );
    if (relecture) {
      accepter(relecture);
      return;
    }
    entree.loaded = true;
    notifier(entree);
    persister(entree, entree.seed, entree.libelleChargement, true);
  }, FENETRE_RECONCILIATION);
}

/**
 * Collection avec graines initiales, partagée par tous les composants qui
 * utilisent la même clé. Persistée en localStorage : un ajout ou une
 * modification du MJ survit au rechargement.
 */
export function useLocalCollection<T extends { id: string }>(
  key: string,
  seed: T[],
  opts: OptionsCollection<T> = {}
) {
  // Entrée créée une seule fois ; toutes les instances de la clé la partagent.
  const entree = obtenirEntree<T>(key, seed, opts);
  const [numero] = useState(() => ++compteurInstances);
  const libelle = `${libelleCle(key)}#${numero}${opts.libelle ? ` ${opts.libelle}` : ""}`;

  // Instances vivantes : visibles dans la chronologie de diagnostic pour
  // repérer un montage tardif (modale, panneau) qui tient la même clé.
  useEffect(() => {
    marquerInstanceActive(libelle);
    return () => retirerInstanceActive(libelle);
  }, [libelle]);

  const abonner = useCallback(
    (cb: () => void) => {
      entree.abonnes.add(cb);
      return () => {
        entree.abonnes.delete(cb);
      };
    },
    [entree]
  );
  const lire = useCallback(() => entree.items, [entree]);
  const lireServeur = useCallback(() => entree.seed, [entree]);

  // Chargement après montage (le premier rendu reste identique serveur/client).
  useEffect(() => {
    demarrer(entree);
  }, [entree]);

  const items = useSyncExternalStore(abonner, lire, lireServeur);

  const setItems = useCallback(
    (update: React.SetStateAction<T[]>) => {
      const next =
        typeof update === "function" ? (update as (p: T[]) => T[])(entree.items) : update;
      if (next === entree.items) return;
      definirItems(entree, next);
      // Avant le chargement, on met à jour la mémoire sans écraser le stock :
      // le chargement en cours reste la référence.
      if (entree.loaded) persister(entree, next, libelle, next === entree.seed);
    },
    [entree, libelle]
  );

  return { items, setItems };
}

/**
 * Ajoute les graines absentes du stock (nouveau contenu après une mise à
 * jour) sans toucher aux données existantes : ni réécriture, ni réordre,
 * ni doublon. Pur et testable (le hook React ne l’est pas ici).
 */
export function fusionnerSeedsManquants<T extends { id: string }>(stockes: T[], graines: T[]): T[] {
  if (graines.length === 0) return stockes;
  const ids = new Set(stockes.map((x) => x.id));
  const manquants = graines.filter((g) => !ids.has(g.id));
  return manquants.length === 0 ? stockes : [...stockes, ...manquants];
}

/**
 * Stock local -> état affiché : graines manquantes ajoutées, puis migration
 * éventuelle de collection (ex. renommage des fiches graines, qui ne touche
 * que les fiches encore au nom d'origine). Pure et testable.
 */
export function preparerStock<T extends { id: string }>(
  stockes: T[],
  graines: T[],
  migrer?: (items: T[]) => T[],
  fusionner = true
): T[] {
  const fusion = fusionner ? fusionnerSeedsManquants(stockes, graines) : stockes;
  return migrer ? migrer(fusion) : fusion;
}
