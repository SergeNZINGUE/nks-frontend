import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * État vide soigné — remplace les `<p>Aucune candidature pour ce filtre.</p>`
 * en texte brut disséminés dans les écrans admin. Icône + titre + description,
 * avec un CTA routerLink optionnel (ex. "Créer une édition").
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterModule],
  template: `
<div class="empty">
  <div class="empty__icon" aria-hidden="true"><ng-content select="[icon]" /></div>
  <p class="empty__title">{{ title }}</p>
  @if (description) { <p class="empty__desc">{{ description }}</p> }
  @if (ctaLabel && ctaLink) {
    <a [routerLink]="ctaLink" class="empty__cta">{{ ctaLabel }}</a>
  }
</div>
`,
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() ctaLabel?: string;
  @Input() ctaLink?: string;
}
