import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PouleResponse, AffectationPouleResponse, DuoResponse } from '@core/models';

/**
 * Client HTTP pour bf.laterrasse.nks.controller.PouleDuoController (§13.10, §13.9 — US-25/26/27).
 *
 * Gap backend important : aucun GET de listing des poules par phase (ni /poules?phaseId=,
 * ni /phases/{id}/poules). Une poule n'est récupérable qu'à sa création (retour du POST) ou
 * via son id déjà connu. Documenté aussi sur PouleResponse dans core/models/index.ts.
 * Les duos, eux, sont listables via GET /duos/phase/{phaseId} — pas de cette limitation.
 */
@Injectable({ providedIn: 'root' })
export class PouleDuoService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /**
   * POST /poules — body libre (Map<String,Object> côté contrôleur, pas de DTO validé).
   * `nom` est NOT NULL en base (Poule.java) : à fournir obligatoirement.
   */
  creerPoule(phaseId: string, nom: string): Observable<PouleResponse> {
    return this.http.post<PouleResponse>(`${this.api}/poules`, { phaseId, nom });
  }

  /**
   * POST /poules/{id}/affecter — { candidatIds: string[] }.
   * Le backend renvoie 409 (ConflitEtatException) si un candidat est déjà affecté
   * à une poule de cette même phase (RM-41) — un candidat ne peut être que dans une poule par phase.
   */
  affecter(pouleId: string, candidatIds: string[]): Observable<AffectationPouleResponse[]> {
    return this.http.post<AffectationPouleResponse[]>(`${this.api}/poules/${pouleId}/affecter`, { candidatIds });
  }

  /** GET /poules/{id}/candidats — seule façon de relire le contenu d'une poule dont on connaît déjà l'id. */
  candidatsPoule(pouleId: string): Observable<AffectationPouleResponse[]> {
    return this.http.get<AffectationPouleResponse[]>(`${this.api}/poules/${pouleId}/candidats`);
  }

  /**
   * POST /duos — body libre. candidat1Id/candidat2Id/phaseId requis (NOT NULL en base),
   * chansonCommune et soireeId optionnels.
   * Le backend renvoie 409 si un des deux candidats est déjà en duo pour cette phase,
   * ou 400 (ValidationMetierException) si candidat1Id === candidat2Id.
   */
  creerDuo(phaseId: string, candidat1Id: string, candidat2Id: string, chansonCommune?: string, soireeId?: string): Observable<DuoResponse> {
    const body: Record<string, unknown> = { phaseId, candidat1Id, candidat2Id };
    if (chansonCommune) body['chansonCommune'] = chansonCommune;
    if (soireeId) body['soireeId'] = soireeId;
    return this.http.post<DuoResponse>(`${this.api}/duos`, body);
  }

  /** GET /duos/phase/{phaseId} — endpoint public (cf. SecurityConfig `/duos/phase/**`), pas besoin d'un rôle admin. */
  duosPhase(phaseId: string): Observable<DuoResponse[]> {
    return this.http.get<DuoResponse[]>(`${this.api}/duos/phase/${phaseId}`);
  }
}
