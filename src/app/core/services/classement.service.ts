import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Classement, ResultatPhase } from '@core/models';

@Injectable({ providedIn: 'root' })
export class ClassementService {
  private http = inject(HttpClient);

  private readonly api = environment.apiUrl;

  /** GET /classement — édition EN_COURS */
  global(): Observable<Classement[]> {
    return this.http.get<Classement[]>(`${this.api}/classement`);
  }

  /** GET /classement/phase/{phaseId} */
  parPhase(phaseId: string): Observable<ResultatPhase[]> {
    return this.http.get<ResultatPhase[]>(`${this.api}/classement/phase/${phaseId}`);
  }
}
