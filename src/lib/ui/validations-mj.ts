/**
 * Validation MJ : mémoire de session des conditions déjà constatées.
 *
 * Le moteur ne suit pas les positions ni les distances : les actions à
 * condition (portée, contact, taille, jugement) passent par une pop-up
 * « Validation du MJ » (PopupValidationMJ) qui s'interpose entre le clic
 * et la résolution. La validation est journalisée par le panneau appelant ;
 * cette mémoire évite de re-poser la même question dans la même session
 * quand les cases sont à peine variables (option « Ne plus redemander »).
 *
 * Les clés sont stables et lisibles (« cap:parade », « att:parfaite »,
 * « sort:explosion-feu »...) : un rechargement d'onglet repose la question.
 */

const valider: Set<string> = new Set();

/** Cette condition a-t-elle déjà été validée par le MJ cette session ? */
export function mjDejaValide(cle: string): boolean {
  return valider.has(cle);
}

/** Enregistre une validation de session (option « ne plus redemander »). */
export function mjValider(cle: string): void {
  valider.add(cle);
}

/** Filtre une liste de questions : ne garde que celles à poser. */
export function mjFiltrerAValider(questions: { cle: string; question: string }[]): { cle: string; question: string }[] {
  return questions.filter((q) => !valider.has(q.cle));
}

/** Réinitialise la mémoire (tests ; sujet à usage futur « nouvelle session »). */
export function mjReinitialiser(): void {
  valider.clear();
}
