import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { ADMIN_NAV } from './admin-nav.config';

/**
 * Coquille persistante du back-office : sidebar de navigation + topbar.
 * Remplace le pattern précédent (chaque écran redéfinissait son propre `<app-topbar
 * backLink="/admin">`, sans navigation transversale — équivalent à un site sans menu).
 * Tous les écrans /admin/* sont désormais rendus dans <router-outlet> à l'intérieur
 * de cette coquille (cf. admin.routes.ts).
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterModule],
  template: `
<div class="shell" [class.shell--sidebar-ouverte]="sidebarOuverte">

  <!-- Overlay mobile -->
  @if (sidebarOuverte) {
    <div class="shell__overlay" (click)="fermerSidebar()"></div>
  }

  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__logo" aria-hidden="true">✦</span>
      <span class="sidebar__brand-text">NKS <span>Admin</span></span>
    </div>

    <nav class="sidebar__nav" aria-label="Navigation administration">
      @for (groupe of nav; track groupe.titre) {
        <div class="sidebar__groupe">
          <div class="sidebar__groupe-titre">{{ groupe.titre }}</div>
          @for (item of groupe.items; track item.route) {
            <a
              class="sidebar__item"
              [class.sidebar__item--soon]="item.statut === 'soon'"
              [routerLink]="item.route"
              routerLinkActive="sidebar__item--active"
              [routerLinkActiveOptions]="{ exact: item.route === '/admin' }"
              (click)="fermerSidebar()">
              <span class="sidebar__item-icon" aria-hidden="true">{{ item.icon }}</span>
              <span class="sidebar__item-label">{{ item.label }}</span>
              @if (item.statut === 'soon') {
                <span class="sidebar__item-tag">bientôt</span>
              }
            </a>
          }
        </div>
      }
    </nav>

    <div class="sidebar__footer">
      <a routerLink="/" class="sidebar__site-link">🌐 Voir le site public</a>
      <button type="button" class="sidebar__logout" (click)="logout()">⏻ Déconnexion</button>
    </div>
  </aside>

  <div class="shell__main">
    <header class="shell__topbar">
      <button type="button" class="shell__burger" aria-label="Ouvrir le menu" (click)="toggleSidebar()">
        <span></span><span></span><span></span>
      </button>
      <div class="shell__topbar-spacer"></div>
      <div class="shell__account" title="Administrateur NKS">
        <span class="shell__account-avatar" aria-hidden="true">A</span>
        <span class="shell__account-label">Administrateur</span>
      </div>
      <button type="button" class="shell__logout-btn" title="Déconnexion" aria-label="Déconnexion" (click)="logout()">
        ⏻
      </button>
    </header>

    <main class="shell__content">
      <router-outlet></router-outlet>
    </main>
  </div>
</div>
`,
  styleUrls: ['./admin-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminShellComponent {
  private authSvc = inject(AuthService);
  private router = inject(Router);

  nav = ADMIN_NAV;
  sidebarOuverte = false;

  toggleSidebar(): void { this.sidebarOuverte = !this.sidebarOuverte; }
  fermerSidebar(): void { this.sidebarOuverte = false; }

  logout(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }
}
