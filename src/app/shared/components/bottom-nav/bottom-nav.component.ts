import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

type NavItem = 'home' | 'galerie' | 'classement' | 'billetterie' | 'profil';

@Component({
    selector: 'app-bottom-nav',
    templateUrl: './bottom-nav.component.html',
    styleUrls: ['./bottom-nav.component.scss'],
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class BottomNavComponent {
  readonly active = input<NavItem>('home');

  items = [
    { key: 'home',        label: 'Accueil',    icon: '🏠', route: '/' },
    { key: 'galerie',     label: 'Candidats',  icon: '🎤', route: '/galerie' },
    { key: 'classement',  label: 'Classement', icon: '🏆', route: '/classement' },
    { key: 'billetterie', label: 'Tickets',    icon: '🎟️', route: '/billetterie' },
    { key: 'profil',      label: 'Mon espace', icon: '👤', route: '/mon-espace' },
  ];
}
