import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthService } from '@core/services/auth.service';

/**
 * Refresh en vol partagé entre les requêtes concurrentes qui prennent un 401 en même temps.
 *
 * BUG CORRIGÉ (09/08/2026) : l'ancienne implémentation utilisait un BehaviorSubject<string|null>
 * où `null` signifiait à la fois "pas encore de nouveau jeton" ET "état initial" — en cas
 * d'échec du refresh, ce Subject n'émettait jamais de valeur non-null, donc les requêtes qui
 * attendaient derrière (`filter(t => t !== null), take(1)`) restaient bloquées indéfiniment :
 * spinner figé, aucune erreur remontée à l'appelant, jusqu'au rechargement de la page.
 *
 * Ici, `refreshEnCours$` est un Observable normal, recréé à chaque cycle de refresh :
 * - `shareReplay(1)` fait que toutes les requêtes qui arrivent PENDANT un refresh en cours
 *   partagent le même appel HTTP et reçoivent la même issue (succès OU erreur).
 * - `finalize()` remet `refreshEnCours$` à `null` dès que le refresh se termine (succès ou
 *   échec), pour que le PROCHAIN 401 déclenche un nouveau cycle plutôt que de rejouer un
 *   Observable déjà terminé.
 * - Un échec de refresh propage désormais une vraie erreur à tous les abonnés en attente
 *   (via le `catchError` interne, avant `shareReplay`), donc chaque requête en attente échoue
 *   proprement au lieu de rester suspendue.
 *
 * Un intercepteur fonctionnel est ré-exécuté à chaque requête : il ne peut pas porter d'état
 * d'instance comme le faisait l'ancienne classe. L'état vit donc au niveau du module.
 */
let refreshEnCours$: Observable<string> | null = null;

/** Les routes d'authentification et les CDN externes ne doivent jamais porter de jeton. */
function estRoutePublique(url: string): boolean {
  return url.includes('/auth/login')
    || url.includes('/auth/refresh')
    || url.includes('api.cloudinary.com');
}

function avecJeton<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (estRoutePublique(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken;

  return next(token ? avecJeton(req, token) : req).pipe(
    catchError(err => {
      // Un 401 sans jeton initial n'est pas rattrapable par un refresh
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !token) {
        return throwError(() => err);
      }

      if (!refreshEnCours$) {
        refreshEnCours$ = auth.refresh().pipe(
          map(res => res.accessToken),
          catchError(erreurRefresh => {
            auth.logout();
            return throwError(() => erreurRefresh);
          }),
          finalize(() => { refreshEnCours$ = null; }),
          shareReplay(1),
        );
      }

      return refreshEnCours$.pipe(
        switchMap(nouveauToken => next(avecJeton(req, nouveauToken))),
      );
    }),
  );
};
