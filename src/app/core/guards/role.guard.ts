import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Usage dans le routing :
 * canActivate: [authGuard, roleGuard],
 * data: { roles: ['ADMIN', 'SUPER_ADMIN'] }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required: string[] = route.data['roles'] ?? [];
  if (!required.length || auth.hasRole(...required)) return true;
  router.navigate(['/unauthorized']);
  return false;
};
