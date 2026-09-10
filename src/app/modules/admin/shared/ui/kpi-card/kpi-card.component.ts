import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type KpiVariant = 'gold' | 'success' | 'warning' | 'error' | 'info';

/**
 * Carte indicateur pour dashboards (admin, jury, super-admin). Remplace le
 * pattern répété `.kpi` dupliqué par écran : icône + libellé + valeur, dans un
 * seul composant pour garder l'apparence identique partout où un chiffre-clé
 * est affiché.
 *
 * Volontairement SANS tendance (+/-%) ou sparkline : DashboardResponse ne
 * renvoie aucun historique, afficher une flèche de tendance inventerait une
 * donnée qui n'existe pas côté backend.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
<div class="kpi" [class]="'kpi--' + variant">
  <div class="kpi__icon" aria-hidden="true">
    <ng-content select="[icon]" />
  </div>
  <div class="kpi__body">
    <div class="kpi__label">{{ label }}</div>
    <div class="kpi__val">
      {{ value ?? '—' }}@if (unit) {<span class="kpi__unit"> {{ unit }}</span>}
    </div>
  </div>
</div>
`,
  styleUrl: './kpi-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number | null;
  @Input() unit?: string;
  @Input() variant: KpiVariant = 'gold';
}
