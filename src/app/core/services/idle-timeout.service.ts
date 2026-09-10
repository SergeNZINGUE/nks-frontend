import { Injectable, NgZone, inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Timeout de session par inactivité — palliatif frontend.
 *
 * Le refresh token backend est valide 7 jours (application.yml,
 * refresh-token-expiration-days: 7) et se renouvelle silencieusement à chaque
 * 401 (auth.interceptor.ts) : sans ce service, une session authentifiée ne se
 * termine JAMAIS d'elle-même, seulement sur clic explicite de déconnexion —
 * signalé le 10/09/2026. On ne peut pas raccourcir le refresh token
 * (nks-backend, hors périmètre) : on force donc la déconnexion côté client
 * après une période d'inactivité, indépendamment de ce que les jetons
 * permettraient encore.
 *
 * Délai variable selon le rôle (demandé le 10/09/2026) : plus l'accès est
 * sensible (finances, gestion utilisateurs), plus la fenêtre d'exposition en
 * cas de poste laissé sans surveillance doit être courte. Un jury en pleine
 * notation ou un agent d'accueil en plein scan ne doivent pas être coupés
 * aussi agressivement qu'un super-admin sur l'écran Paiements.
 */
const DELAI_PAR_ROLE_MS: Record<string, number> = {
  SUPER_ADMIN:    15 * 60 * 1000, // 15 min — gestion utilisateurs, audit, accès total
  ADMIN:          15 * 60 * 1000, // 15 min — même surface de risque que SUPER_ADMIN
  ORGANISATEUR:   20 * 60 * 1000, // 20 min — back-office restreint, pas de données financières
  AGENT_ACCUEIL:  20 * 60 * 1000, // 20 min — scan billets en continu pendant un événement
  JURY:           30 * 60 * 1000, // 30 min — notation en direct, pauses entre passages
  CANDIDAT:       20 * 60 * 1000, // 20 min
};
/** Rôle non listé (VISITEUR, VOTANT_PUBLIC, PARTENAIRE…) ou session sans rôle reconnu. */
const DELAI_DEFAUT_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private auth = inject(AuthService);
  private ngZone = inject(NgZone);
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  /**
   * Délai effectif = le plus court parmi les rôles portés par la session (rare
   * qu'un compte cumule plusieurs rôles, mais si c'est le cas, on retient le
   * plus prudent plutôt que le plus permissif).
   */
  private delaiCourant(): number {
    const roles = this.auth.roles;
    if (!roles.length) return DELAI_DEFAUT_MS;
    const delais = roles.map(r => DELAI_PAR_ROLE_MS[r] ?? DELAI_DEFAUT_MS);
    return Math.min(...delais);
  }

  /** Appelé à chaque interaction utilisateur détectée (cf. AppComponent). */
  reinitialiser(): void {
    if (!this.auth.isLoggedIn()) {
      this.arreter();
      return;
    }
    if (this.minuteur) clearTimeout(this.minuteur);
    // Hors zone Angular : ce minuteur se réarme en permanence sans jamais
    // déclencher de rendu tant qu'il n'expire pas — inutile de forcer un tick.
    this.ngZone.runOutsideAngular(() => {
      this.minuteur = setTimeout(() => this.expirer(), this.delaiCourant());
    });
  }

  arreter(): void {
    if (this.minuteur) { clearTimeout(this.minuteur); this.minuteur = null; }
  }

  private expirer(): void {
    this.ngZone.run(() => {
      if (!this.auth.isLoggedIn()) return;
      this.auth.logout('inactivite');
    });
  }
}
