import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

/** dto/admin/CritereNotationAdminResponse.java — GET/POST/PUT /admin/criteres-notation. */
export interface CritereNotationAdminResponse {
  id: string;
  editionId: string;
  nom: string;
  noteMin: number;
  noteMax: number;
  ordre: number;
  actif: boolean;
}

/** Corps de POST /admin/criteres-notation (CreerCritereNotationRequest.java). */
export interface CreerCritereNotationRequest {
  editionId: string;
  nom: string;
  noteMin?: number;
  noteMax: number;
  ordre: number;
}

/** Corps de PUT /admin/criteres-notation/{id} (MettreAJourCritereNotationRequest.java). */
export interface MettreAJourCritereNotationRequest {
  nom: string;
  noteMin?: number;
  noteMax: number;
  ordre: number;
  actif: boolean;
}

/**
 * Client HTTP pour la gestion admin de la grille de critères de notation jury
 * (AdminController — ADMIN/SUPER_ADMIN). Pas de suppression : `actif` désactive un critère
 * sans casser l'historique des notes déjà saisies (notes_jury.critere_id sans cascade).
 */
@Injectable({ providedIn: 'root' })
export class CritereNotationService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/criteres-notation`;

  lister(editionId: string): Observable<CritereNotationAdminResponse[]> {
    const params = new HttpParams().set('editionId', editionId);
    return this.http.get<CritereNotationAdminResponse[]>(this.base, { params });
  }

  creer(req: CreerCritereNotationRequest): Observable<CritereNotationAdminResponse> {
    return this.http.post<CritereNotationAdminResponse>(this.base, req);
  }

  mettreAJour(id: string, req: MettreAJourCritereNotationRequest): Observable<CritereNotationAdminResponse> {
    return this.http.put<CritereNotationAdminResponse>(`${this.base}/${id}`, req);
  }
}
