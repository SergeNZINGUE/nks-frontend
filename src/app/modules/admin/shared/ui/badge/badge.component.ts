import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BadgeVariant = 'gold' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Pastille de statut réutilisable — remplace les badges texte-seul ou les
 * classes ad hoc dupliquées par écran (candidatures, paiements, poules…).
 * Jamais de couleur seule pour porter l'information : le libellé texte reste
 * toujours visible à côté/dans le badge (cf. frontend-design § Accessibilité).
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  // "ui-badge" et non "badge" : global.scss définit déjà un .badge avec des variants
  // différents (--actif/--gray…) — un nom distinct évite de dépendre de la
  // spécificité d'encapsulation Angular pour trancher le conflit.
  template: `<span class="ui-badge" [class]="'ui-badge--' + variant"><ng-content /></span>`,
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'neutral';
}
