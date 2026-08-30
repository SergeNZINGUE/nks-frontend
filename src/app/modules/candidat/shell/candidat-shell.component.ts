import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { CandidatureService } from '@core/services/candidature.service';
import { CANDIDAT_NAV } from './candidat-nav.config';

/**
 * Coquille persistante du panel candidat : sidebar de navigation (desktop) + barre
 * basse (mobile), même principe que app-admin-shell. Remplace le pattern précédent
 * (chaque écran redéfinissait son propre <app-topbar backLink="/mon-espace">, sans
 * navigation transversale ni adaptation desktop réelle — cf. audit panel candidat).
 * Les 4 écrans /mon-espace/* sont rendus dans <router-outlet> à l'intérieur de cette
 * coquille (cf. candidat.routes.ts) ; chaque écran porte désormais son propre titre
 * de contenu (`.page-header`) plutôt qu'un titre de topbar.
 */
@Component({
  selector: 'app-candidat-shell',
  imports: [RouterModule, NgTemplateOutlet],
  template: `
<div class="shell">

  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="assets/logos/nks.png" alt="" class="sidebar__brand-icon" />
      <div>
        <div class="sidebar__brand-text">NKS <span>Candidat</span></div>
        <div class="sidebar__brand-sub">Espace personnel</div>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="Navigation de l'espace candidat">
      @for (item of nav; track item.key) {
        <a class="sidebar__item" [routerLink]="item.route" routerLinkActive="sidebar__item--active">
          <span class="sidebar__item-icon" aria-hidden="true">
            <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ key: item.key }" />
          </span>
          <span class="sidebar__item-label">{{ item.label }}</span>
        </a>
      }
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
      <span class="shell__topbar-spacer"></span>
      <div class="shell__account">
        <span class="shell__account-avatar" aria-hidden="true">{{ initiales() }}</span>
        <span class="shell__account-label">{{ nomComplet() }}</span>
      </div>
    </header>

    <main class="shell__content">
      <router-outlet />
    </main>
  </div>

  <nav class="bottom-nav" aria-label="Navigation de l'espace candidat">
    @for (item of nav; track item.key) {
      <a class="bottom-nav__item" [routerLink]="item.route" routerLinkActive="bottom-nav__item--active">
        <span class="bottom-nav__icon" aria-hidden="true">
          <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ key: item.key }" />
        </span>
        <span class="bottom-nav__label">{{ item.label }}</span>
      </a>
    }
  </nav>

</div>

<ng-template #navIcon let-key="key">
  @switch (key) {
    @case ('dashboard') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
    }
    @case ('profil') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
    }
    @case ('videos') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
    }
    @case ('paiements') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
    }
  }
</ng-template>
`,
  styleUrls: ['./candidat-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidatShellComponent implements OnInit, OnDestroy {
  private authSvc = inject(AuthService);
  private router = inject(Router);
  private candidatureSvc = inject(CandidatureService);

  nav = CANDIDAT_NAV;

  private prenom = '';
  private nom = '';
  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.candidatureSvc.maCandidature().pipe(catchError(() => of(null))).subscribe(c => {
        this.prenom = c?.prenom ?? '';
        this.nom = c?.nom ?? '';
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  nomComplet(): string {
    return this.prenom || this.nom ? `${this.prenom} ${this.nom}`.trim() : 'Candidat';
  }

  initiales(): string {
    if (!this.prenom && !this.nom) return '?';
    return `${this.prenom[0] ?? ''}${this.nom[0] ?? ''}`.toUpperCase();
  }

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }
}
