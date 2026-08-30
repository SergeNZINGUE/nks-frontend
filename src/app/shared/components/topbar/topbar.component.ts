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
<header class="topbar" [class.topbar--back-desktop]="showBackOnDesktop()">
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
    @if (logo()) {
      <img src="assets/logos/nks.png" alt="" class="topbar__logo" />
    } @else if (icon()) {
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
  /** Emoji ou glyphe décoratif, masqué aux lecteurs d'écran — ignoré si logo() est vrai */
  readonly icon = input<string | null>(null);
  /** Affiche le logo NKS (assets/logos/nks.png) à la place de icon() */
  readonly logo = input(false);
  /** Cible du bouton retour (routerLink) */
  readonly backLink = input<string | unknown[] | null>(null);
  /** Si vrai, le retour émet (back) au lieu de naviguer */
  readonly backEmit = input(false);
  /** Libellé accessible du bouton retour */
  readonly backLabel = input('Retour');
  /** Affiche le bouton de déconnexion */
  readonly logout = input(false);
  /**
   * Garde la flèche retour visible même à partir de 900px. Par défaut la flèche
   * disparaît sur desktop car app-site-header prend le relais (cf. topbar.component.scss)
   * — mais les espaces authentifiés (candidat, jury...) n'incluent pas ce header
   * public et n'ont sinon plus aucun moyen de revenir en arrière sur grand écran.
   */
  readonly showBackOnDesktop = input(false);

  readonly back = output<void>();
  readonly logoutClick = output<void>();
}
