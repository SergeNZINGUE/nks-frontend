import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

type NavItem = 'home' | 'galerie' | 'classement' | 'billetterie' | 'profil';

/**
 * Barre de navigation basse du site public (mobile).
 * `key` sert à la fois d'identifiant d'onglet actif et de clé d'icône : les SVG
 * inline (façon Lucide) sont résolus par le `@switch` du template, même vocabulaire
 * que les coquilles candidat/jury/admin.
 */
@Component({
    selector: 'app-bottom-nav',
    templateUrl: './bottom-nav.component.html',
    styleUrls: ['./bottom-nav.component.scss'],
    imports: [RouterLink, NgTemplateOutlet],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class BottomNavComponent {
  private authSvc = inject(AuthService);

  readonly active = input<NavItem>('home');

  /**
   * "Mon espace" pointait en dur sur `/mon-espace` (réservé au rôle CANDIDAT par roleGuard) —
   * un admin/hôtesse/jury connecté atterrissait sur /unauthorized (bug constaté le 14/09/2026).
   * Route calculée à chaque accès plutôt que figée dans le tableau, pour refléter le rôle
   * réel de l'utilisateur connecté (ou /login s'il ne l'est pas).
   */
  get items(): { key: NavItem; label: string; route: string }[] {
    return [
      { key: 'home',        label: 'Accueil',    route: '/' },
      { key: 'galerie',     label: 'Candidats',  route: '/galerie' },
      { key: 'classement',  label: 'Classement', route: '/classement' },
      { key: 'billetterie', label: 'Tickets',    route: '/billetterie' },
      { key: 'profil',      label: 'Mon espace', route: this.authSvc.isLoggedIn() ? this.authSvc.redirectByRole() : '/login' },
    ];
  }
}
