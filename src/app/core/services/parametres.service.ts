import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ParametresPublics {
  prixInscriptionFcfa: number;
  prixVoteFcfa: number;
}

@Injectable({ providedIn: 'root' })
export class ParametresService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** GET /parametres/publics — public, sans authentification. */
  publics(): Observable<ParametresPublics> {
    return this.http.get<ParametresPublics>(`${this.api}/parametres/publics`);
  }
}
