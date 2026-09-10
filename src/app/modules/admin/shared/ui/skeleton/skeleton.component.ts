import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type SkeletonVariant = 'text' | 'card' | 'circle' | 'row';

/**
 * Bloc de chargement animé — remplace les spinners nus et les `.sk` inline
 * dupliqués par écran. Un seul composant pour toute la surface panel, largeur/
 * hauteur pilotables via inputs pour coller à la forme du contenu réel
 * (évite le saut de mise en page une fois les données arrivées).
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<span class="sk" [class]="'sk--' + variant" [style.width]="width" [style.height]="height" aria-hidden="true"></span>`,
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  @Input() variant: SkeletonVariant = 'text';
  @Input() width?: string;
  @Input() height?: string;
}
