"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { codeInterne } from "@/src/lib/store/surveillance";
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

// Numérotation des instances du hook : la chronologie doit nommer l'écran
// (« characters#3 combat ») car plusieurs composants tiennent la même clé.
let compteurInstances = 0;

// Collection avec seed initial.
// persist (défaut true) : lue/écrite en localStorage.
// persist: false : mémoire seule, toujours depuis les graines du code
// (aucune lecture/écriture locale ; la clé périmée est nettoyée au montage).
// Retourne [items, setItems] ; toute écriture persistée est sauvegardée.
export function useLocalCollection<T extends { id: string }>(
  key: string,
  seed: T[],
  opts: {
    persist?: boolean;
    migrer?: (items: T[]) => T[];
    libelle?: string;
    protegerPv?: boolean;
    /** false : les graines ne sont écrites qu'à la première visite (pas de fusion à chaque lecture). */
    fusionner?: boolean;
  } = {}
) {
  const persist = opts.persist ?? true;
  const [items, setItemsRaw] = useState<T[]>(seed);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const numero = useRef(0);
  if (numero.current === 0) numero.current = ++compteurInstances;
  const libelle = `${libelleCle(key)}#${numero.current}${opts.libelle ? ` ${opts.libelle}` : ""}`;

  // Instances vivantes : visibles dans la chrono pour repérer un montage
  // tardif (modale, panneau) qui tiendrait la même clé que l'écran principal.
  useEffect(() => {
    marquerInstanceActive(libelle);
    return () => retirerInstanceActive(libelle);
  }, [libelle]);

  useEffect(() => {
    if (!persist) {
      try {
        // Nettoyage de la clé mémoire seule : notre propre écriture, pas une
        // mutation étrangère (d'où codeInterne).
        codeInterne(() => window.localStorage.removeItem(key));
      } catch {
        // Stockage indisponible : rien à nettoyer.
      }
      loadedRef.current = true;
      setLoaded(true);
      return;
    }
    if (!reconciliationDemarree) {
      reconciliationDemarree = true;
      demarrerReconciliation({ [STORAGE_KEYS.characters]: SEED_CHARACTERS });
    }
    const persister = (valeur: T[], retourAuxGraines = false) =>
      avecInstance(libelle, () =>
        localStorageAdapter.save(key, valeur, { retourAuxGraines, protegerPv: opts.protegerPv })
      );
    const accepter = (stockes: T[]) => {
      const prepares = preparerStock(stockes, seed, opts.migrer, opts.fusionner);
      setItemsRaw(prepares);
      loadedRef.current = true;
      setLoaded(true);
      // N'écrire QUE si la préparation a réellement changé quelque chose
      // (graines manquantes ajoutées, migration de fiche). Réécrire à
      // l'identique ce qui vient d'être lu était inutile — et c'était la
      // porte ouverte au bug « fiche écrasée par un autre onglet » : les
      // écrans restent montés (état conservé pendant la navigation), et un
      // écran périmé réécrivait son ancien tampon juste après avoir relu le
      // stockage frais. Seul le mutateur `setItems` écrit désormais un état
      // modifié ; le chargement ne fait que lire.
      if (prepares !== stockes) persister(prepares);
    };
    const chargement = avecInstance(libelle, () => localStorageAdapter.load<T[]>(key));
    // Stock existant : on ajoute les graines manquantes (nouveau contenu
    // livré par une mise à jour, ex : scénario ajouté après coup) sans
    // toucher aux données de l’utilisateur, puis on applique la migration
    // éventuelle (ex : renommage de fiches graines).
    if (chargement) {
      accepter(chargement);
      return;
    }
    // Clé vide : première visite — ou effacement si récent que la
    // réconciliation (IndexedDB, asynchrone) n'a pas encore rejoué la
    // sauvegarde. On attend la fin de la fenêtre avant d'accepter les graines,
    // et surtout avant de les ÉCRIRE : une écriture de graines à cet instant
    // remplacerait une sauvegarde sur le point d'être restaurée.
    const minuteur = window.setTimeout(() => {
      const relecture = avecInstance(libelle, () => localStorageAdapter.load<T[]>(key));
      if (relecture) {
        accepter(relecture);
        return;
      }
      loadedRef.current = true;
      setLoaded(true);
      // Première visite (stock vide après la fenêtre de réconciliation) :
      // les graines doivent être persistées pour la prochaine ouverture.
      persister(seed, true);
    }, FENETRE_RECONCILIATION);
    return () => window.clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, persist]);

  // Plus d'écriture automatique à chaque changement de `items` : `setItems`
  // persiste déjà de façon synchrone (voir ci-dessous), et le chargement
  // n'écrit que si les graines/migrations ont réellement modifié le stock.
  // L'ancien effet réécrivait le tampon d'un écran resté monté après une
  // relecture — un écran périmé écrasait alors la fiche qu'un autre venait de
  // sauvegarder (ex. « Tout sauvegarder » puis passage sur Combat).

  // Écriture synchrone : chaque mise à jour est persistée aussitôt, pas
  // seulement après ré-affichage. Sans ça, quitter la page (ex. Combat →
  // Personnages juste après "Terminer") avant que l'effet ne s'exécute
  // perdait la mise à jour : la page suivante rechargeait l'ancien stock.
  // La sauvegarde a lieu dans le mutateur (idempotente) pour survivre
  // à un démontage immédiat.
  const setItems = useCallback(
    (update: React.SetStateAction<T[]>) => {
      if (!persist || !loadedRef.current) {
        setItemsRaw(update);
        return;
      }
      setItemsRaw((prev) => {
        const next = typeof update === "function" ? (update as (p: T[]) => T[])(prev) : update;
        try {
          avecInstance(libelle, () =>
            localStorageAdapter.save(key, next, { retourAuxGraines: next === seed })
          );
        } catch {
          // Stockage indisponible : l'état mémoire reste la source de vérité.
        }
        return next;
      });
    },
    [key, persist, libelle]
  );

  // Resynchronisation : un autre onglet peut modifier le stockage (événement
  // storage), et un retour arrière / changement d'onglet peut restaurer une
  // page montée avant (visibilité, focus). Toute écriture étant persistée
  // aussitôt, relire converge vers des données à jour sans rien écraser
  // d'utile (les brouillons d'édition vivent dans des états séparés).
  // Relire NE DOIT PAS écrire : c'est un chargement, pas une modification.
  // Une relecture suivie d'une écriture du tampon local est exactement ce qui
  // permettait à un écran périmé de recouvrir une sauvegarde fraîche.
  useEffect(() => {
    if (!persist) return;
    const relire = (cause?: string) => {
      // Repère dans la chronologie : cette lecture vient d'une resynchronisation
      // (et non du montage) ; `cause` notée seulement pour les cas rares et
      // porteurs d'information (bfcache/historique), pour ne pas noyer la chrono.
      if (cause) noterResync(key, cause);
      const stocke = avecInstance(libelle, () => localStorageAdapter.load<T[]>(key));
      if (stocke) setItemsRaw(preparerStock(stocke, seed, opts.migrer, opts.fusionner));
    };
    const surStockage = (e: StorageEvent) => {
      if (e.key === key) {
        // Un autre onglet vient d'écrire (ou de supprimer) : trace du contenu
        // reçu — c'est la seule écriture qu'ici on ne verrait jamais autrement.
        noterEvenementStockage(key, e.newValue);
        relire();
      }
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") relire();
    };
    // Restoration bfcache (←/→ ou retour après une navigation « document ») :
    // le gel du document ne redéclenche ni visibilitychange ni focus selon les
    // navigateurs (cas typique iPad/Safari) — pageshow est LE signal fiable de
    // sortie de bfcache, et popstate couvre les traversées d'historique dans le
    // même document (App Router). Sans eux, un écran restauré affiche d'anciens
    // PV jusqu'au prochain rechargement complet.
    const surPageshow = () => relire("pageshow");
    const surPopstate = () => relire("popstate");
    const surFocus = () => relire();
    window.addEventListener("storage", surStockage);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("focus", surFocus);
    window.addEventListener("pageshow", surPageshow);
    window.addEventListener("popstate", surPopstate);
    return () => {
      window.removeEventListener("storage", surStockage);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("focus", surFocus);
      window.removeEventListener("pageshow", surPageshow);
      window.removeEventListener("popstate", surPopstate);
    };
    // seed / migrer : constantes de module côté appelants (mêmes valeurs à
    // chaque rendu) ; les relire ne doit pas réabonner les écouteurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, persist]);

  return { items, setItems, loaded };
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
