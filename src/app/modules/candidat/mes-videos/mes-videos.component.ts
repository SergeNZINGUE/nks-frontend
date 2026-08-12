import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription, switchMap, catchError, of } from 'rxjs';

import { VideoService } from '@core/services/video.service';
import { CandidatService } from '@core/services/candidat.service';
import { EditionService } from '@core/services/edition.service';
import { Video, StatutVideo } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

@Component({
  selector: 'app-mes-videos',
  imports: [DatePipe, RouterModule, TopbarComponent],
  templateUrl: './mes-videos.component.html',
  styleUrls: ['./mes-videos.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MesVideosComponent implements OnInit, OnDestroy {
  private videoSvc = inject(VideoService);
  private candidatSvc = inject(CandidatService);
  private editionSvc = inject(EditionService);

  isLoading = true;
  videos: Video[] = [];
  erreur: string | null = null;

  private sub = new Subscription();

  /**
   * Il n'existe pas de GET /videos/mes-videos. La chaîne est :
   *   édition EN_COURS → mon profil candidat (via ma-candidature + code)
   *   → GET /videos/candidat/{candidatId}
   */
  ngOnInit(): void {
    this.sub.add(
      this.editionSvc.lister().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0];
          if (!active) throw new Error('Aucune édition en cours');
          return this.candidatSvc.monProfil(active.id);
        }),
        switchMap(profil => this.videoSvc.videosCandidat(profil.id)),
        catchError(() => of(null)),
      ).subscribe(v => {
        this.isLoading = false;
        if (v === null) this.erreur = 'Impossible de charger les vidéos.';
        else this.videos = v;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  statutLabel(s: StatutVideo): string {
    const map: Record<StatutVideo, string> = {
      EN_COURS_UPLOAD: '⏳ En cours',
      DISPONIBLE:      '✅ Disponible',
      MASQUEE:         '🙈 Masquée',
    };
    return map[s] ?? s;
  }

  statutClass(s: StatutVideo): string {
    return { EN_COURS_UPLOAD: 'warning', DISPONIBLE: 'success', MASQUEE: 'default' }[s] ?? 'default';
  }

  dureeFormatee(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
