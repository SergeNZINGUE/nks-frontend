import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { RouterLink } from '@angular/router';

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
  readonly active = input<NavItem>('home');

  items: { key: NavItem; label: string; route: string }[] = [
    { key: 'home',        label: 'Accueil',    route: '/' },
    { key: 'galerie',     label: 'Candidats',  route: '/galerie' },
    { key: 'classement',  label: 'Classement', route: '/classement' },
    { key: 'billetterie', label: 'Tickets',    route: '/billetterie' },
    { key: 'profil',      label: 'Mon espace', route: '/mon-espace' },
  ];
}
