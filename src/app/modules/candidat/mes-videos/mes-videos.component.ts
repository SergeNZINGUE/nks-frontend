import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, switchMap, catchError, of } from 'rxjs';

import { VideoService } from '@core/services/video.service';
import { MediaService } from '@core/services/media.service';
import { CandidatService } from '@core/services/candidat.service';
import { EditionService } from '@core/services/edition.service';
import { Video, StatutVideo, Phase } from '@core/models';

// Même contrainte qu'à l'inscription (CdC §3.1.1) — appliquée ici uniquement côté client :
// POST /videos (VideoService.uploaderPourPhase()) ne valide pas la durée côté backend,
// contrairement à POST /candidatures (CandidatureService.validerVideo()).
const VIDEO_MAX_OCTETS = 100 * 1024 * 1024; // 100 Mo — même limite qu'à l'inscription
const VIDEO_DUREE_MIN_S = 45;
const VIDEO_DUREE_MAX_S = 60;

@Component({
  selector: 'app-mes-videos',
  imports: [DatePipe, RouterModule, FormsModule],
  templateUrl: './mes-videos.component.html',
  styleUrls: ['./mes-videos.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MesVideosComponent implements OnInit, OnDestroy {
  private videoSvc = inject(VideoService);
  private mediaSvc = inject(MediaService);
  private candidatSvc = inject(CandidatService);
  private editionSvc = inject(EditionService);

  isLoading = true;
  videos: Video[] = [];
  erreur: string | null = null;

  /** Phase EN_COURS hors Présélection (candidature initiale, pas de nouvel upload ici) — null si aucune. */
  phaseCible: Phase | null = null;

  titreChanson = '';
  isUploading = false;
  uploadErreur: string | null = null;

  readonly VIDEO_DUREE_MIN_S = VIDEO_DUREE_MIN_S;
  readonly VIDEO_DUREE_MAX_S = VIDEO_DUREE_MAX_S;

  private sub = new Subscription();

  /**
   * Il n'existe pas de GET /videos/mes-videos. La chaîne est :
   *   édition EN_COURS → mon profil candidat (via ma-candidature + code)
   *   → GET /videos/candidat/{candidatId} + GET /editions/{id}/phases en parallèle
   */
  ngOnInit(): void {
    this.sub.add(
      this.editionSvc.lister().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0];
          if (!active) throw new Error('Aucune édition en cours');
          return this.candidatSvc.monProfil(active.id).pipe(
            switchMap(profil => forkJoin({
              videos: this.videoSvc.videosCandidat(profil.id),
              phases: this.editionSvc.phases(active.id),
            }).pipe(
              switchMap(({ videos, phases }) => of({ profil, videos, phases }))
            ))
          );
        }),
        catchError(() => of(null)),
      ).subscribe(res => {
        this.isLoading = false;
        if (res === null) { this.erreur = 'Impossible de charger tes vidéos.'; return; }
        this.videos = res.videos;
        this.phaseCible = res.phases.find(p => p.statut === 'EN_COURS' && p.nom !== 'PRESELECTION') ?? null;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  statutLabel(s: StatutVideo): string {
    const map: Record<StatutVideo, string> = {
      EN_COURS_UPLOAD: 'En cours',
      DISPONIBLE:      'Disponible',
      MASQUEE:         'Masquée',
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

  /** true si une vidéo existe déjà pour la phase cible — le nouvel envoi la remplacera (upsert backend). */
  get videoExistantePourPhase(): boolean {
    if (!this.phaseCible) return false;
    return this.videos.some(v => v.phaseId === this.phaseCible!.id);
  }

  onFichierChoisi(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.phaseCible) return;

    this.uploadErreur = null;

    if (file.size > VIDEO_MAX_OCTETS) {
      this.uploadErreur = `Vidéo trop lourde — maximum 100 Mo (fichier : ${(file.size / 1024 / 1024).toFixed(1)} Mo).`;
      input.value = '';
      return;
    }
    if (file.type !== 'video/mp4') {
      this.uploadErreur = 'Format invalide — MP4 uniquement.';
      input.value = '';
      return;
    }

    this.mesurerDuree(file).then(
      duree => {
        const dureeSecondes = Math.round(duree);
        if (dureeSecondes < VIDEO_DUREE_MIN_S || dureeSecondes > VIDEO_DUREE_MAX_S) {
          this.uploadErreur =
            `Durée non conforme : ${dureeSecondes} s. ` +
            `La vidéo doit durer entre ${VIDEO_DUREE_MIN_S} et ${VIDEO_DUREE_MAX_S} secondes.`;
          input.value = '';
          return;
        }
        this.lancerUpload(file, dureeSecondes);
      },
      () => {
        this.uploadErreur = 'Impossible de lire la durée de cette vidéo. Vérifie que le fichier est un MP4 valide.';
        input.value = '';
      }
    );
  }

  /** Lit la durée via un élément <video> hors DOM — même technique qu'à l'inscription. */
  private mesurerDuree(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';

      const nettoyer = () => { URL.revokeObjectURL(url); video.removeAttribute('src'); };

      video.onloadedmetadata = () => {
        const duree = video.duration;
        nettoyer();
        if (!isFinite(duree) || duree <= 0) reject(new Error('Durée illisible'));
        else resolve(duree);
      };
      video.onerror = () => { nettoyer(); reject(new Error('Lecture impossible')); };
      video.src = url;
    });
  }

  private lancerUpload(file: File, dureeSecondes: number): void {
    if (!this.phaseCible) return;
    this.isUploading = true;
    this.uploadErreur = null;

    this.sub.add(
      this.mediaSvc.uploadVideo(file).pipe(
        switchMap(result => this.videoSvc.uploader({
          phaseId: this.phaseCible!.id,
          urlVideo: result.url,
          dureeSecondes,
          tailleOctets: result.tailleOctets,
          titreChanson: this.titreChanson.trim() || null,
        })),
        catchError(() => {
          this.uploadErreur = "Échec de l'envoi. Réessaie.";
          return of(null);
        })
      ).subscribe(video => {
        this.isUploading = false;
        if (!video) return;
        this.videos = [...this.videos.filter(v => v.phaseId !== this.phaseCible!.id), video];
        this.titreChanson = '';
      })
    );
  }
}
