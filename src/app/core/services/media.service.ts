import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, catchError, of } from 'rxjs';
import { environment } from '@env/environment';
import { UploadUrlResponse, MediaPublicResponse } from '@core/models';

export interface MediaUploadResult {
  publicId: string;
  url: string;
  tailleOctets: number;
}

export interface UploadUrlRequest {
  format: string;
  tailleOctets: number;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private http = inject(HttpClient);

  private readonly api = environment.apiUrl;

  /** POST /medias/url-upload — URL pré-signée Cloudinary pour photo */
  getPhotoUploadUrl(req: UploadUrlRequest): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(`${this.api}/medias/url-upload`, req);
  }

  /** POST /videos/url-upload — URL pré-signée Cloudinary pour vidéo */
  getVideoUploadUrl(req: UploadUrlRequest): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(`${this.api}/videos/url-upload`, req);
  }

  /**
   * GET /medias/candidat/{candidatId} — MediaController.mediasCandidat() (ajouté 09/08/2026).
   * Public, filtré statut=VALIDE côté backend. Renvoie typiquement 2 entrées : PHOTO_PROFIL + CAPTURE_SOCIAL.
   */
  mediasCandidat(candidatId: string): Observable<MediaPublicResponse[]> {
    return this.http.get<MediaPublicResponse[]>(`${this.api}/medias/candidat/${candidatId}`);
  }

  /** Résout l'URL de la photo de profil parmi les médias d'un candidat, ou null si absente. */
  photoProfilUrl(medias: MediaPublicResponse[]): string | null {
    return medias.find(m => m.type === 'PHOTO_PROFIL')?.urlStockage ?? null;
  }

  /**
   * Upload direct vers Cloudinary avec l'URL pré-signée.
   * Le backend n'est pas impliqué — upload direct CDN.
   */
  uploadToCloudinary(uploadUrl: string, fields: Record<string, string>, file: File): Observable<any> {
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
    formData.append('file', file);
    return this.http.post(uploadUrl, formData);
  }

  /**
   * Flux complet : get URL signée → upload → retourne le publicId Cloudinary.
   * Usage : inscription candidat, upload vidéo phase.
   */
  uploadPhoto(file: File, type = 'PHOTO_PROFIL'): Observable<MediaUploadResult> {
    const req: UploadUrlRequest = {
      format: file.name.split('.').pop()?.toUpperCase() ?? 'JPG',
      tailleOctets: file.size,
      type,
    };
    return this.getPhotoUploadUrl(req).pipe(
      switchMap(res =>
        this.uploadToCloudinary(res.uploadUrl, res.fields, file).pipe(
          map((cloud: any) => ({
            publicId: res.publicId,
            url: (cloud.secure_url as string) ?? `https://res.cloudinary.com/upload/${res.publicId}`,
            tailleOctets: file.size,
          }))
        )
      ),
      // DEV FALLBACK — Cloudinary non configuré (CLOUDINARY_* env vars vides).
      // En production ce catchError ne se déclenche jamais.
      catchError(err => {
        if (environment.production) throw err;
        console.warn('[MediaService] Upload photo échoué — mode dev, fallback blob URL', err);
        const fakePublicId = `dev-photo-${Date.now()}`;
        return of<MediaUploadResult>({
          publicId: fakePublicId,
          url: URL.createObjectURL(file),   // blob:// — valide le temps de la session
          tailleOctets: file.size,
        });
      })
    );
  }

  uploadVideo(file: File, type = 'VIDEO_PRESELECTION'): Observable<MediaUploadResult> {
    const req: UploadUrlRequest = {
      format: file.name.split('.').pop()?.toUpperCase() ?? 'MP4',
      tailleOctets: file.size,
      type,
    };
    return this.getVideoUploadUrl(req).pipe(
      switchMap(res =>
        this.uploadToCloudinary(res.uploadUrl, res.fields, file).pipe(
          map((cloud: any) => ({
            publicId: res.publicId,
            url: (cloud.secure_url as string) ?? `https://res.cloudinary.com/upload/${res.publicId}`,
            tailleOctets: file.size,
          }))
        )
      ),
      // DEV FALLBACK — même logique que photo
      catchError(err => {
        if (environment.production) throw err;
        console.warn('[MediaService] Upload vidéo échoué — mode dev, fallback blob URL', err);
        const fakePublicId = `dev-video-${Date.now()}`;
        return of<MediaUploadResult>({
          publicId: fakePublicId,
          url: URL.createObjectURL(file),
          tailleOctets: file.size,
        });
      })
    );
  }
}
