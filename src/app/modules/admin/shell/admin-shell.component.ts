import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
  imports: [RouterModule, NgTemplateOutlet],
  template: `
<div class="shell" [class.shell--sidebar-ouverte]="sidebarOuverte">

  <!-- Overlay mobile -->
  @if (sidebarOuverte) {
    <div class="shell__overlay" (click)="fermerSidebar()"></div>
  }

  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="assets/logos/nks.png" alt="" class="sidebar__logo" />
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
              <span class="sidebar__item-icon" aria-hidden="true">
                <ng-container [ngTemplateOutlet]="adminIcon" [ngTemplateOutletContext]="{ key: item.icon }" />
              </span>
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
      <a routerLink="/" class="sidebar__site-link">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        Voir le site public
      </a>
      <button type="button" class="sidebar__logout" (click)="logout()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        Déconnexion
      </button>
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
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
      </button>
    </header>

    <main class="shell__content">
      <router-outlet></router-outlet>
    </main>
  </div>
</div>

<ng-template #adminIcon let-key="key">
  @switch (key) {
    @case ('dashboard') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
    }
    @case ('calendar') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
    }
    @case ('trophy') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
    }
    @case ('users') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    }
    @case ('trending-up') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    }
    @case ('clipboard') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
    }
    @case ('mic') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    }
    @case ('vote') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
    }
    @case ('music') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    }
    @case ('ticket') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
    }
    @case ('briefcase') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
    }
    @case ('megaphone') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
    }
    @case ('credit-card') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
    }
    @case ('user') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
    }
    @case ('shield') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
    }
    @case ('settings') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    }
  }
</ng-template>
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
