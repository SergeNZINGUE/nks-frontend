import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pied de page public — léger par conception : pas de logique, pas d'appel
 * réseau, juste la marque et le copyright (la navigation vit déjà dans le
 * header et la bottom-nav, pas besoin de la dupliquer ici). Visible sur
 * toutes les largeurs ; sur mobile il précède la barre du bas fixe
 * (`app-bottom-nav`), dans l'espace déjà réservé par
 * `.page { padding-bottom: $bottom-nav-height + ... }`.
 */
@Component({
  selector: 'app-site-footer',
  imports: [],
  templateUrl: './site-footer.component.html',
  styleUrls: ['./site-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SiteFooterComponent {
  readonly anneeCourante = new Date().getFullYear();
}
