import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * Marque étoile de la charte NKS — remplace tous les usages du glyphe texte
 * « ✦ » (rendu inconsistant selon les polices/plateformes) par un SVG net,
 * dégradé or, réutilisable. Purement décoratif : `aria-hidden` dans tous les
 * cas, le sens porté par le glyphe reste dans le texte environnant.
 */
@Component({
  selector: 'app-star-mark',
  template: `
<svg
  [attr.width]="size()"
  [attr.height]="size()"
  viewBox="0 0 24 24"
  class="star-mark"
  aria-hidden="true"
  focusable="false">
  <defs>
    <linearGradient [attr.id]="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E8C04A" />
      <stop offset="100%" stop-color="#C9A227" />
    </linearGradient>
  </defs>
  <path
    d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
    [attr.fill]="'url(#' + gradientId + ')'" />
</svg>
`,
  styleUrl: './star-mark.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StarMarkComponent {
  /** Taille (px, largeur = hauteur). Défaut : 16px, aligné sur un glyphe inline. */
  readonly size = input(16);

  /** Id de gradient unique par instance : plusieurs étoiles peuvent coexister sur une même page. */
  protected readonly gradientId = `star-mark-gradient-${nextId++}`;
}
