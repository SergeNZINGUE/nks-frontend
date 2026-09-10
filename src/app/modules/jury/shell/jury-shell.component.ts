import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Coquille persistante du panel jury — même langage visuel que app-admin-shell
 * (Panel 2026 : surface-1 + surface-sheen, bordures hairline, liseré doré actif).
 * Un seul item de nav aujourd'hui (jury n'a que 2 écrans, le second est contextuel)
 * mais la structure suit celle des autres panels pour rester cohérente si d'autres
 * écrans jury sont ajoutés plus tard.
 */
@Component({
  selector: 'app-jury-shell',
  imports: [RouterModule],
  template: `
<div class="shell">

  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="assets/logos/nks.png" alt="" class="sidebar__logo" />
      <span class="sidebar__brand-text">NKS <span>Jury</span></span>
    </div>

    <nav class="sidebar__nav" aria-label="Navigation de l'espace jury">
      <a routerLink="/jury" routerLinkActive="sidebar__item--active" [routerLinkActiveOptions]="{ exact: true }" class="sidebar__item">
        <span class="sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        </span>
        <span class="sidebar__item-label">Tableau de bord</span>
      </a>
      <a routerLink="/jury/historique" routerLinkActive="sidebar__item--active" class="sidebar__item">
        <span class="sidebar__item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </span>
        <span class="sidebar__item-label">Historique</span>
      </a>
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__account">
        <span class="sidebar__account-avatar" aria-hidden="true">J</span>
        <div class="sidebar__account-info">
          <span class="sidebar__account-role">Membre du jury</span>
          <span class="sidebar__account-sub">Espace de notation</span>
        </div>
      </div>
      <a routerLink="/" class="sidebar__site-link">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <span class="sidebar__item-label">Voir le site public</span>
      </a>
      <button type="button" class="sidebar__logout" (click)="deconnecter()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        <span class="sidebar__item-label">Déconnexion</span>
      </button>
    </div>
  </aside>

  <div class="shell__main">
    <header class="shell__topbar">
      <a routerLink="/jury" class="shell__brand-mobile">
        <img src="assets/logos/nks.png" alt="" class="shell__brand-icon" />
        <span>Espace Jury</span>
      </a>
      <span class="shell__topbar-spacer"></span>
      <button type="button" class="shell__logout-btn" aria-label="Déconnexion" (click)="deconnecter()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
      </button>
    </header>

    <main class="shell__content">
      <router-outlet />
    </main>
  </div>

  <nav class="bottom-nav" aria-label="Navigation de l'espace jury">
    <a routerLink="/jury" routerLinkActive="bottom-nav__item--active" [routerLinkActiveOptions]="{ exact: true }" class="bottom-nav__item">
      <svg class="bottom-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
      <span class="bottom-nav__label">Tableau de bord</span>
    </a>
    <a routerLink="/jury/historique" routerLinkActive="bottom-nav__item--active" class="bottom-nav__item">
      <svg class="bottom-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      <span class="bottom-nav__label">Historique</span>
    </a>
    <a routerLink="/" class="bottom-nav__item">
      <svg class="bottom-nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
      <span class="bottom-nav__label">Site public</span>
    </a>
  </nav>

</div>
`,
  styleUrls: ['./jury-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class JuryShellComponent {
  private authSvc = inject(AuthService);
  private router = inject(Router);

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }
}
