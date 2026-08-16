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
   * ⚠️ BUG BACKEND CONFIRMÉ EN LIVE (15/08/2026) : ClassementController.classementEditionEnCours()
   * sérialise l'entité JPA Classement brute. `Classement.candidat` (LAZY) déclenche
   * LazyInitializationException dès qu'il y a des lignes en base (open-in-view=false,
   * pas de @JsonIgnore sur Candidat.utilisateur/.edition) → 500 systématique.
   * De plus `Candidat` n'a pas de champ `prenom`/`nom` en propre : ces champs n'existent
   * QUE via `Candidat.utilisateur`, lui-même LAZY. Même corrigé pour le 500, tant que le
   * contrat de réponse n'expose pas prenom/nom à plat, `candidat.prenom` restera vide ici.
   */
  global(): Observable<Classement[]> {
    return this.http.get<Classement[]>(`${this.api}/classement`);
  }

  /** GET /classement/phase/{phaseId} — même bug que global() (ResultatPhase.candidat/.phase LAZY). */
  parPhase(phaseId: string): Observable<ResultatPhase[]> {
    return this.http.get<ResultatPhase[]>(`${this.api}/classement/phase/${phaseId}`);
  }

  /**
   * POST /phases/{id}/calculer-classement — ADMIN/SUPER_ADMIN — ClassementController.calculer().
   * Recalcule et renvoie le classement de la phase (même forme/bug que parPhase()).
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
