import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

/** Une étoile décorative du champ scintillant — purement visuelle, aucune donnée métier. */
interface Star {
  top: number; left: number; size: number; opacity: number;
  duration: number; delay: number; gold: boolean;
}

/**
 * Champ d'étoiles scintillantes réutilisable (extrait de home.component le
 * 10/09/2026 pour être aussi utilisé sur la page de connexion, sans l'étoile
 * filante — cf. `shootingStar`). CSS pur, aucun Canvas ; l'animation hérite
 * de la garde prefers-reduced-motion globale (global.scss).
 */
@Component({
  selector: 'app-star-field',
  template: `
<div class="star-field" aria-hidden="true">
  @for (s of stars; track $index) {
    <span
      class="star-field__star"
      [class.star-field__star--gold]="s.gold"
      [style.top.%]="s.top"
      [style.left.%]="s.left"
      [style.width.px]="s.size"
      [style.height.px]="s.size"
      [style.animation-duration.s]="s.duration"
      [style.animation-delay.s]="s.delay"
      [style.--star-opacity]="s.opacity"
    ></span>
  }
  @if (shootingStar) {
    <div class="star-field__shooting-star">
      <span class="star-field__shooting-star-trail"></span>
      <img src="assets/logos/nks.png" alt="" class="star-field__shooting-star-head" />
    </div>
  }
</div>
`,
  styleUrls: ['./star-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StarFieldComponent implements OnInit {
  @Input() count = 60;
  @Input() shootingStar = true;

  stars: Star[] = [];

  // Généré en ngOnInit, pas en initialiseur de champ : les @Input() ne sont
  // pas encore posés au moment où les initialiseurs de champ s'exécutent.
  ngOnInit(): void {
    this.stars = this.buildStarField(this.count);
  }

  /**
   * Délai d'animation négatif (`-Math.random() * duration`) : chaque étoile
   * démarre en plein milieu de son cycle plutôt que toutes en phase à 0,
   * pour un scintillement naturel dès le premier rendu.
   */
  private buildStarField(count: number): Star[] {
    return Array.from({ length: count }, () => {
      const duration = 3 + Math.random() * 4; // 3s à 7s : scintillement lent, jamais clignotant
      return {
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2,          // 1 à 3px
        opacity: 0.15 + Math.random() * 0.35, // base discrète, quelques-unes plus vives via l'animation
        duration,
        delay: -Math.random() * duration,
        gold: Math.random() < 0.22,           // ~1 étoile sur 5 en or, le reste en blanc
      };
    });
  }
}
