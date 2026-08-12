import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Video } from '@core/models';

/** Corps de POST /videos — UploaderVideoRequest.java */
export interface UploaderVideoRequest {
  phaseId: string;
  urlVideo: string;
  dureeSecondes: number;   // @Positive — obligatoire
  tailleOctets: number;    // @Positive — obligatoire
  titreChanson: string | null;
}

@Injectable({ providedIn: 'root' })
export class VideoService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/videos`;

  /**
   * GET /videos/candidat/{candidatId} — VideoController.videosCandidat()
   * Il n'existe pas de GET /videos/mes-videos : le candidat doit passer son propre id,
   * obtenu via CandidatService.monProfil().
   */
  videosCandidat(candidatId: string): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.base}/candidat/${candidatId}`);
  }

  /** POST /videos — rôle CANDIDAT. Déclare une vidéo déjà uploadée sur le CDN. */
  uploader(req: UploaderVideoRequest): Observable<Video> {
    return this.http.post<Video>(this.base, req);
  }
}
