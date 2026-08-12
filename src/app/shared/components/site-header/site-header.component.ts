import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';

import { EditionService } from '@core/services/edition.service';

/**
 * En-tête public — conforme au cadre « DESKTOP HOME HI-FI » du prototype :
 * logo à gauche, menu horizontal au centre, Connexion + S'inscrire à droite.
 *
 * Ne s'affiche qu'à partir de 900 px : en dessous, la navigation reste assurée
 * par la barre du bas (app-bottom-nav), conformément au prototype téléphone.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterModule],
  templateUrl: './site-header.component.html',
  styleUrls: ['./site-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SiteHeaderComponent implements OnInit {
  private editionSvc = inject(EditionService);

  readonly liens = [
    { libelle: 'Accueil',     route: '/',            exact: true  },
    { libelle: 'Galerie',     route: '/galerie',     exact: false },
    { libelle: 'Classement',  route: '/classement',  exact: false },
    { libelle: 'Soirées',     route: '/billetterie', exact: false },
    { libelle: 'Partenaires', route: '/partenaires', exact: false },
  ];

  /** Faux par défaut : le bouton « S'inscrire » n'apparaît qu'une fois la fenêtre d'inscription confirmée ouverte. */
  inscriptionsOuvertes = false;

  ngOnInit(): void {
    this.editionSvc.enCours().pipe(
      catchError(() => of(null))
    ).subscribe(edition => {
      this.inscriptionsOuvertes = this.editionSvc.inscriptionsOuvertes(edition);
    });
  }
}
