import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Bloque l'accès aux pages de l'espace candidat (hors page de consentement elle-même) tant
 * que le candidat n'a pas accepté le Recueil de consentement (cf. LoginResponse.consentementRequis,
 * mis à jour à chaque login/refresh). Ne s'applique qu'aux candidats — les autres rôles ne
 * sont jamais concernés (isCandidat() false ailleurs).
 *
 * Usage : canActivate: [authGuard, roleGuard, consentGuard] sur chaque route candidat SAUF
 * la route 'consentement' elle-même (pour éviter une boucle de redirection infinie).
 */
export const consentGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isCandidat() && auth.consentementRequis()) {
    router.navigate(['/mon-espace/consentement']);
    return false;
  }
  return true;
};
