import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import {
  CandidatPublicResponse,
  Page,
  ResultatPhase,
  StatutProfilCandidat,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class CandidatService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/candidats`;

  /** GET /candidats — galerie publique paginée */
  galerie(editionId: string, page = 0, size = 12, statutProfil: StatutProfilCandidat = 'ACTIF'): Observable<Page<CandidatPublicResponse>> {
    const params = new HttpParams()
      .set('editionId', editionId)
      .set('statutProfil', statutProfil)
      .set('page', page)
      .set('size', size);
    return this.http.get<Page<CandidatPublicResponse>>(this.base, { params });
  }

  /** GET /candidats/{id} */
  profil(id: string): Observable<CandidatPublicResponse> {
    return this.http.get<CandidatPublicResponse>(`${this.base}/${id}`);
  }

  /** GET /candidats/code/{code}?editionId= */
  parCode(code: string, editionId: string): Observable<CandidatPublicResponse> {
    const params = new HttpParams().set('editionId', editionId);
    return this.http.get<CandidatPublicResponse>(`${this.base}/code/${code}`, { params });
  }

  /** GET /candidats/{id}/scores */
  scores(id: string): Observable<ResultatPhase[]> {
    return this.http.get<ResultatPhase[]>(`${this.base}/${id}/scores`);
  }

  /**
   * Profil du candidat connecté.
   *
   * Le backend n'expose PAS de GET /candidats/mon-profil (seul le PUT existe —
   * CandidatController.java). Contournement sans modification du backend :
   *   1. GET /candidatures/ma-candidature → fournit le codeCandidat du candidat connecté
   *   2. GET /candidats/code/{code}?editionId= → CandidatPublicResponse complet
   */
  monProfil(editionId: string): Observable<CandidatPublicResponse> {
    return this.http
      .get<{ codeCandidat: string }>(`${environment.apiUrl}/candidatures/ma-candidature`)
      .pipe(switchMap(c => this.parCode(c.codeCandidat, editionId)));
  }

  /**
   * PUT /candidats/mon-profil — CANDIDAT seulement.
   * MettreAJourProfilRequest ne contient QUE la biographie (max 2000 car.) :
   * la photo passe par le flux médias dédié (POST /medias/url-upload).
   */
  mettreAJourMonProfil(biographie: string): Observable<CandidatPublicResponse> {
    return this.http.put<CandidatPublicResponse>(`${this.base}/mon-profil`, { biographie });
  }

  /** Initiales pour placeholder photo (GAP-01) */
  initiales(candidat: CandidatPublicResponse): string {
    return `${candidat.prenom[0] ?? ''}${candidat.nom[0] ?? ''}`.toUpperCase();
  }
}
