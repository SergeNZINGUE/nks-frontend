import { HttpErrorResponse } from '@angular/common/http';

/**
 * Message d'erreur à afficher à l'utilisateur suite à un appel HTTP échoué.
 *
 * Sur 5xx, le backend a déjà renvoyé au moins une fois des détails techniques
 * bruts en clair dans `error.message` (ex. stack trace LazyInitializationException,
 * cf. rapports du 15/08/2026) — rien ne garantit aujourd'hui un message "propre"
 * pour l'utilisateur final sur une erreur serveur. On ignore donc délibérément
 * `err.error.message` dans ce cas et on retombe sur le message générique fourni
 * par l'appelant.
 *
 * Sur 4xx (validation métier, ex. "pondérations invalides", "candidat déjà
 * affecté"), le message backend est une information de validation fiable et
 * utile à l'utilisateur : il est affiché tel quel s'il est présent.
 */
export function messageErreur(err: unknown, repli: string): string {
  if (err instanceof HttpErrorResponse && err.status < 500) {
    const msg = (err.error as { message?: string } | null | undefined)?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return repli;
}
