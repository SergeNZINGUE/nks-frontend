import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PouleResponse, AffectationPouleResponse, DuoResponse, ResultatPhase } from '@core/models';

/** Client HTTP pour bf.laterrasse.nks.controller.PouleDuoController (§13.10, §13.9 — US-25/26/27). */
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

  /** GET /poules/phase/{phaseId} — liste toutes les poules d'une phase avec JOIN FETCH (pas de LazyInit). */
  poulesPhase(phaseId: string): Observable<PouleResponse[]> {
    return this.http.get<PouleResponse[]>(`${this.api}/poules/phase/${phaseId}`);
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

  /** PUT /poules/{id} — renommer une poule. */
  mettreAJourPoule(id: string, nom: string): Observable<PouleResponse> {
    return this.http.put<PouleResponse>(`${this.api}/poules/${id}`, { nom });
  }

  /** PUT /affectations/{id} — mettre à jour ordrePassage et/ou chansonImposee. */
  mettreAJourAffectation(id: string, ordrePassage: number | null, chansonImposee: string | null): Observable<AffectationPouleResponse> {
    const body: Record<string, unknown> = { chansonImposee };
    if (ordrePassage !== null) body['ordrePassage'] = ordrePassage;
    return this.http.put<AffectationPouleResponse>(`${this.api}/affectations/${id}`, body);
  }

  /** DELETE /affectations/{id} — retirer un candidat d'une poule. */
  retirerAffectation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/affectations/${id}`);
  }

  /**
   * POST /candidats/{id}/repechage?phaseId= — PouleDuoController.repecher() — ADMIN/SUPER_ADMIN.
   * Repêchage manuel d'un candidat éliminé (CdC §3.4 : "avec validation de motif"). Le backend
   * exige un `motif` NotBlank d'au moins 50 caractères (RepechageRequest.java, RM-43) : ce n'est
   * pas une validation front cosmétique, une requête plus courte est rejetée en 400.
   * Passe ResultatPhase.statutQualification à REPECHAGE et notifie le candidat (SMS + e-mail).
   */
  repecher(candidatId: string, phaseId: string, motif: string): Observable<ResultatPhase> {
    return this.http.post<ResultatPhase>(`${this.api}/candidats/${candidatId}/repechage`, { motif }, {
      params: { phaseId },
    });
  }
}
