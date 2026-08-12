import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { RouterModule } from '@angular/router';

/**
 * Barre de navigation haute, partagée par tous les écrans.
 * Remplace les duplications de `<header class="topbar">` (20 occurrences avant
 * mutualisation), chacune redéfinissant sa propre charte.
 *
 * Accessibilité : le retour est un vrai <button> ou un <a routerLink>, jamais un
 * <div (click)> — donc focusable au clavier et annoncé par les lecteurs d'écran.
 */
@Component({
  selector: 'app-topbar',
  imports: [RouterModule],
  template: `
<header class="topbar">
  @if (backLink() && !backEmit()) {
    <a
      [routerLink]="backLink()"
      class="topbar__back"
      [attr.aria-label]="backLabel()">
      <span aria-hidden="true">←</span>
    </a>
  }

  @if (backEmit()) {
    <button
      type="button"
      class="topbar__back"
      [attr.aria-label]="backLabel()"
      (click)="back.emit()">
      <span aria-hidden="true">←</span>
    </button>
  }

  @if (!backLink() && !backEmit()) {
    <span class="topbar__spacer"></span>
  }

  <h1 class="topbar__title">
    @if (icon()) {
      <span aria-hidden="true">{{ icon() }}&nbsp;</span>
      }{{ title() }}
    </h1>

    @if (logout()) {
      <button
        type="button"
        class="topbar__action"
        (click)="logoutClick.emit()">
        Déconnexion
      </button>
    }

    @if (!logout()) {
      <span class="topbar__spacer"></span>
    }
  </header>
`,
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TopbarComponent {
  /** Titre affiché au centre */
  readonly title = input.required<string>();
  /** Emoji ou glyphe décoratif, masqué aux lecteurs d'écran */
  readonly icon = input<string | null>(null);
  /** Cible du bouton retour (routerLink) */
  readonly backLink = input<string | unknown[] | null>(null);
  /** Si vrai, le retour émet (back) au lieu de naviguer */
  readonly backEmit = input(false);
  /** Libellé accessible du bouton retour */
  readonly backLabel = input('Retour');
  /** Affiche le bouton de déconnexion */
  readonly logout = input(false);

  readonly back = output<void>();
  readonly logoutClick = output<void>();
}
