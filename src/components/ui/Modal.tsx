"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  ouvert: boolean;
  onFermer: () => void;
  /** Libellé accessible du dialogue (titre visible ou résumé). */
  ariaLabel: string;
  children: ReactNode;
  /** Classes du panneau (fond, largeur, défilement) ; le positionnement est fourni. */
  classePanneau?: string;
  /** Fermer en cliquant sur le fond (désactivé par défaut : protège les saisies). */
  fermerSurFond?: boolean;
}

const SELECTEUR_FOCUS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialogue accessible : rôle dialog, focus piégé dans le panneau, fermeture
 * par Échap, verrou du défilement de la page et restitution du focus à
 * l'élément déclencheur. Le contenu (titre, bouton ✕, formulaire) reste fourni
 * par l'appelant.
 */
export function Modal({
  ouvert,
  onFermer,
  ariaLabel,
  children,
  classePanneau = "bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto",
  fermerSurFond = false,
}: ModalProps) {
  const panneau = useRef<HTMLDivElement>(null);
  const precedent = useRef<HTMLElement | null>(null);
  // Le callback est lu via une ref : un `onFermer` recréé à chaque rendu ne
  // doit pas réexécuter l'effet (et voler le focus pendant la saisie).
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);
  const titreID = useId();

  const elementsFocusables = useCallback(
    () => Array.from(panneau.current?.querySelectorAll<HTMLElement>(SELECTEUR_FOCUS) ?? []),
    []
  );

  useEffect(() => {
    if (!ouvert) return;
    precedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const premier = elementsFocusables()[0];
    premier?.focus();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fermer.current();
        return;
      }
      if (e.key !== "Tab") return;
      const liste = elementsFocusables();
      if (liste.length === 0) {
        e.preventDefault();
        return;
      }
      const index = liste.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        liste[liste.length - 1]?.focus();
      } else if (!e.shiftKey && index === liste.length - 1) {
        e.preventDefault();
        liste[0]?.focus();
      }
    };

    document.addEventListener("keydown", surTouche);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = debordement;
      precedent.current?.focus?.();
    };
  }, [ouvert, elementsFocusables]);

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (fermerSurFond && e.target === e.currentTarget) onFermer();
      }}
    >
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={titreID}
        className={classePanneau}
      >
        <span id={titreID} className="sr-only">
          {ariaLabel}
        </span>
        {children}
      </div>
    </div>
  );
}
