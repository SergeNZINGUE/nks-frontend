import { HttpInterceptorFn } from '@angular/common/http';
import { ApplicationRef, inject } from '@angular/core';
import { tap } from 'rxjs';

/**
 * Filet de sécurité post-migration Angular 22.
 *
 * Angular 21+ est zoneless au niveau du scheduler par défaut, et Angular 22
 * fait d'OnPush le défaut par composant. Cette appli a été migrée 17→22 à la
 * main (pas via `ng update`, qui aurait stampé ChangeDetectionStrategy.Eager
 * automatiquement) : ses ~26 composants mutent encore des champs simples dans
 * .subscribe() sans signaux ni markForCheck() explicite.
 *
 * `provideZoneChangeDetection()` (main.ts) ne suffit pas à lui seul dans cette
 * configuration : confirmé empiriquement (DevTools) que NgZone ne forke jamais
 * de zone enfant malgré le provider — `Zone.current.name` reste `<root>`.
 * ChangeDetectionStrategy.Eager (posé sur chaque composant) évite le saut
 * OnPush une fois qu'un cycle est déclenché, mais rien ne déclenche ce cycle.
 *
 * Plutôt que d'auditer et corriger individuellement chaque .subscribe() de
 * l'app, on force un tick applicatif juste après CHAQUE réponse HTTP : c'est
 * le point de passage unique de toutes les mutations d'état de cette
 * architecture (chargement de données comme soumissions de formulaires).
 *
 * queueMicrotask() est nécessaire : le tap ci-dessous s'exécute AVANT le
 * .subscribe() du composant (il est plus haut dans le pipe RxJS, donc son
 * callback next() s'exécute avant que la valeur ne soit transmise en aval).
 * Un tick() synchrone ici verrait donc l'état du composant AVANT sa mutation.
 * En repoussant le tick() à la microtask suivante, on laisse le temps au
 * .subscribe() du composant (même pile d'appel synchrone) de muter ses champs
 * avant que la détection de changements ne s'exécute.
 *
 * À retirer lors d'une bascule ultérieure vers les signaux / resource().
 */
export const changeDetectionInterceptor: HttpInterceptorFn = (req, next) => {
  const appRef = inject(ApplicationRef);
  const forcerTick = () => queueMicrotask(() => appRef.tick());
  return next(req).pipe(tap({ next: forcerTick, error: forcerTick }));
};
