import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { CandidatService } from '@core/services/candidat.service';
import { EditionService } from '@core/services/edition.service';
import { MediaService } from '@core/services/media.service';
import { CandidatPublicResponse, StatutProfilCandidat } from '@core/models';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';

import { RouterLink } from '@angular/router';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';

@Component({
    selector: 'app-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    BottomNavComponent
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class GalleryComponent implements OnInit {
  private candidatSvc = inject(CandidatService);
  private editionSvc = inject(EditionService);
  private mediaSvc = inject(MediaService);

  candidats: CandidatPublicResponse[] = [];
  loading = true;
  loadingMore = false;
  erreur: string | null = null;
  editionId: string | null = null;
  /** null tant qu'aucune phase n'a voteActif=true — masque le CTA "Voter" (même garde que candidate-profile.component). */
  phaseActiveId: string | null = null;

  page = 0;
  pageSize = 12;
  totalElements = 0;
  hasMore = false;

  filtreStatut: StatutProfilCandidat = 'ACTIF';

  readonly statutOptions: { label: string; value: StatutProfilCandidat }[] = [
    { label: 'Actifs',     value: 'ACTIF' },
    { label: 'Finalistes', value: 'FINALISTE' },
    { label: 'Tous',       value: 'EN_ATTENTE' },
  ];

  ngOnInit(): void {
    this.editionSvc.enCours().subscribe(edition => {
      this.editionId = edition?.id ?? null;
      if (this.editionId) {
        this.charger();
        this.editionSvc.phaseActive(this.editionId).subscribe(phase => {
          this.phaseActiveId = phase?.id ?? null;
        });
      } else {
        this.loading = false;
      }
    });
  }

  charger(): void {
    if (!this.editionId) return;
    this.loading = true;
    this.erreur = null;
    this.candidatSvc.galerie(this.editionId, 0, this.pageSize, this.filtreStatut).subscribe({
      next: res => {
        this.candidats     = res.content;
        this.totalElements = res.totalElements;
        this.page          = 0;
        this.hasMore       = res.totalPages > 1;
        this.loading       = false;
        this.chargerPhotos(this.candidats);
      },
      // Une erreur serveur ne doit pas être présentée comme une liste vide :
      // l'utilisateur croirait qu'aucun candidat n'est inscrit.
      error: err => {
        this.loading  = false;
        this.candidats = [];
        this.totalElements = 0;
        this.erreur = err?.status === 0
          ? 'Serveur injoignable. Vérifie que l\'API est démarrée.'
          : `Impossible de charger les candidats (erreur ${err?.status ?? 'inconnue'}).`;
      },
    });
  }

  chargerPlus(): void {
    if (!this.editionId || this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    this.page++;
    this.candidatSvc.galerie(this.editionId, this.page, this.pageSize, this.filtreStatut).subscribe({
      next: res => {
        this.candidats.push(...res.content);
        this.hasMore     = this.page < res.totalPages - 1;
        this.loadingMore = false;
        this.chargerPhotos(res.content);
      },
      error: () => { this.loadingMore = false; },
    });
  }

  /**
   * Résout la photo de profil de chaque candidat en parallèle (GET /medias/candidat/{id} par candidat —
   * acceptable pour une page de 12 candidats, à revoir si le backend expose un jour un endpoint batch).
   * Échec individuel silencieux : fallback avatar-initiales déjà géré par le template.
   */
  private chargerPhotos(candidats: CandidatPublicResponse[]): void {
    if (candidats.length === 0) return;
    forkJoin(
      candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
    ).subscribe(resultats => {
      resultats.forEach((medias, i) => {
        candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias);
      });
    });
  }

  onFiltreChange(statut: StatutProfilCandidat): void {
    this.filtreStatut = statut;
    this.charger();
  }

  initiales(c: CandidatPublicResponse): string {
    return this.candidatSvc.initiales(c);
  }
}
