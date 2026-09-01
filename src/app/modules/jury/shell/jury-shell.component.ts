import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from '@core/services/auth.service';

/**
 * Coquille persistante du panel jury : sidebar de navigation (desktop) + barre basse
 * (mobile), même principe que app-candidat-shell / app-admin-shell. Avant cette coquille,
 * chaque écran jury (dashboard, notation) redéfinissait son propre <app-topbar>, sans lien
 * de retour vers le tableau de bord ni bouton de déconnexion accessible depuis l'écran de
 * notation — cf. audit panel jury. Un seul item de nav aujourd'hui (jury n'a que 2 écrans,
 * le second est contextuel) mais la structure suit celle des autres panels pour rester
 * cohérente si d'autres écrans jury sont ajoutés plus tard.
 */
@Component({
  selector: 'app-jury-shell',
  imports: [RouterModule],
  template: `
<div class="shell">

  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="assets/logos/nks.png" alt="" class="sidebar__brand-icon" />
      <div>
        <div class="sidebar__brand-text">NKS <span>Jury</span></div>
        <div class="sidebar__brand-sub">Espace de notation</div>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="Navigation de l'espace jury">
      <a routerLink="/jury" routerLinkActive="sidebar__item--active" [routerLinkActiveOptions]="{ exact: true }" class="sidebar__item">
        <svg class="sidebar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        <span class="sidebar__item-label">Tableau de bord</span>
      </a>
    </nav>

    <div class="sidebar__footer">
      <a routerLink="/" class="sidebar__footer-link">
        <svg class="sidebar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <span>Voir le site public</span>
      </a>
      <button type="button" class="sidebar__footer-link sidebar__footer-link--danger" (click)="deconnecter()">
        <svg class="sidebar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        <span>Déconnexion</span>
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
