import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Classement, ResultatPhase } from '@core/models';

@Injectable({ providedIn: 'root' })
export class ClassementService {
  private http = inject(HttpClient);

  private readonly api = environment.apiUrl;

  /**
   * GET /classement — édition EN_COURS.
   * ClassementController.classementEditionEnCours() renvoie désormais `ClassementResponse`
   * (DTO record) : plus de `candidat` imbriqué, juste `candidatId`/`codeCandidat`.
   */
  global(): Observable<Classement[]> {
    return this.http.get<Classement[]>(`${this.api}/classement`);
  }

  /** GET /classement/phase/{phaseId} — renvoie `ResultatPhaseResponse[]` (candidatId/codeCandidat, plus de `candidat` imbriqué). */
  parPhase(phaseId: string): Observable<ResultatPhase[]> {
    return this.http.get<ResultatPhase[]>(`${this.api}/classement/phase/${phaseId}`);
  }

  /**
   * POST /phases/{id}/calculer-classement — ADMIN/SUPER_ADMIN — ClassementController.calculer().
   * Recalcule et renvoie le classement de la phase (même forme que parPhase() : `ResultatPhaseResponse[]`).
   */
  calculerPhase(phaseId: string): Observable<ResultatPhase[]> {
    return this.http.post<ResultatPhase[]>(`${this.api}/phases/${phaseId}/calculer-classement`, {});
  }

  /**
   * POST /classement/publier?editionId= — ADMIN/SUPER_ADMIN — ClassementController.publier().
   * Seul endpoint du contrôleur qui fonctionne aujourd'hui (renvoie 204 Void, pas de
   * sérialisation d'entité donc pas de LazyInitializationException possible).
   */
  publier(editionId: string): Observable<void> {
    const params = new HttpParams().set('editionId', editionId);
    return this.http.post<void>(`${this.api}/classement/publier`, {}, { params });
  }
}
