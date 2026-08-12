import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CategorieTicket, SoireeEvent } from '@core/models';

@Injectable({ providedIn: 'root' })
export class SoireeService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/soirees`;

  lister(editionId?: string): Observable<SoireeEvent[]> {
    let params = new HttpParams();
    if (editionId) params = params.set('editionId', editionId);
    return this.http.get<SoireeEvent[]>(this.base, { params });
  }

  detail(id: string): Observable<SoireeEvent> {
    return this.http.get<SoireeEvent>(`${this.base}/${id}`);
  }

  /** GET /soirees/{id}/disponibilite — catégories tickets avec places restantes */
  disponibilite(soireeId: string): Observable<CategorieTicket[]> {
    return this.http.get<CategorieTicket[]>(`${this.base}/${soireeId}/disponibilite`);
  }
}
