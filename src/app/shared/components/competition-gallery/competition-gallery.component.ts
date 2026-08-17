import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';

import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { CandidatPublicResponse } from '@core/models';

/**
 * Section « photos de la compétition » — bandeau défilant après les partenaires
 * sur l'accueil (demande client, cf. vocal 15/08/2026).
 *
 * ⚠️ STOPGAP — À REMPLACER : ce composant n'a rien à voir fonctionnellement
 * avec l'onglet « Galerie » (annuaire public des candidats). Il n'existe
 * aujourd'hui aucun endpoint backend dédié à des photos d'ambiance/de soirée
 * (ni dans MediaController ni dans AdminController — cf. audit backend).
 * En attendant, on réutilise les photos de profil candidats déjà exposées
 * pour ne pas laisser la section vide.
 * TODO backend : exposer un vrai endpoint « médias événementiels »
 * (ex. GET /medias/edition/{id}?type=PHOTO_COMPETITION), avec upload dédié
 * côté admin (soirées, ambiance, scène — pas des portraits candidats), puis
 * remplacer `charger()` ci-dessous pour consommer ce nouvel endpoint au lieu
 * de CandidatService.galerie() + MediaService.mediasCandidat().
 *
 * Choix de conception (en attendant) :
 * - Même mécanique de défilement sans couture que app-partners-strip (piste
 *   dupliquée, pause au survol/focus, désactivée si prefers-reduced-motion).
 * - Le composant se masque silencieusement si l'édition n'a aucun candidat
 *   avec photo : jamais de cadre vide ou d'icône cassée.
 */
@Component({
  selector: 'app-competition-gallery',
  imports: [RouterModule],
  templateUrl: './competition-gallery.component.html',
  styleUrls: ['./competition-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CompetitionGalleryComponent {
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);

  readonly editionId = input<string | null>(null);

  photos: CandidatPublicResponse[] = [];
  piste: CandidatPublicResponse[] = [];
  dureeAnimation = '35s';
  chargement = true;

  private derniereEditionChargee: string | null = null;

  constructor() {
    // effect() plutôt que ngOnChanges : réagit proprement au signal d'entrée,
    // y compris si l'édition passe de null (chargement initial du parent) à
    // sa valeur réelle une fois EditionService.courante() résolu.
    effect(() => {
      const id = this.editionId();
      if (!id || id === this.derniereEditionChargee) return;
      this.derniereEditionChargee = id;
      this.charger(id);
    });
  }

  private charger(editionId: string): void {
    this.chargement = true;
    this.candidatSvc.galerie(editionId, 0, 16)
      .pipe(catchError(() => of(null)))
      .subscribe(page => {
        const candidats = page?.content ?? [];
        if (!candidats.length) { this.chargement = false; return; }

        forkJoin(
          candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
        ).subscribe(resultats => {
          resultats.forEach((medias, i) => {
            candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias);
          });
          this.photos = candidats.filter(c => !!c.photoUrl);
          this.piste = this.photos.length ? [...this.photos, ...this.photos] : [];
          this.dureeAnimation = `${Math.max(20, this.photos.length * 5)}s`;
          this.chargement = false;
        });
      });
  }

  suivrePiste(index: number, c: CandidatPublicResponse): string {
    return `${c.id}-${index}`;
  }
}
