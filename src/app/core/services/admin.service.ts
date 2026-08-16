import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  DashboardResponse,
  CandidatureDetailResponse,
  Phase,
  Edition,
  Page,
} from '@core/models';

/** Structure réelle de CommunicationRequest (bf.laterrasse.nks.dto.admin.CommunicationRequest) */
export interface CommunicationRequest {
  editionId: string;
  filtreStatut: string | null; // StatutProfilCandidat | null = tous
  canalSms: boolean;
  canalEmail: boolean;
  message: string;         // max 160 chars pour SMS
  sujetEmail: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  private readonly api = environment.apiUrl;

  /** GET /admin/dashboard */
  dashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.api}/admin/dashboard`);
  }

  /** GET /editions — pour retrouver l'édition EN_COURS */
  editions(): Observable<Edition[]> {
    return this.http.get<Edition[]>(`${this.api}/editions`);
  }

  /**
   * PUT /editions/{id}  (EditionController.mettreAJour)
   * Remplacement complet de l'entité — le backend n'accepte pas de patch partiel,
   * l'appelant doit renvoyer tous les champs (y compris ceux non modifiés).
   */
  mettreAJourEdition(id: string, edition: Edition): Observable<Edition> {
    return this.http.put<Edition>(`${this.api}/editions/${id}`, edition);
  }

  /** POST /editions — création d'une nouvelle édition (EditionController.creer) */
  creerEdition(edition: Omit<Edition, 'id'>): Observable<Edition> {
    return this.http.post<Edition>(`${this.api}/editions`, edition);
  }

  /**
   * POST /editions/{editionId}/phases  (EditionController.creerPhase)
   * Contrainte backend : poidsVotesEnLigne + poidsPublicSurPlace + poidsJury === 100
   */
  creerPhase(editionId: string, phase: Partial<Phase>): Observable<Phase> {
    return this.http.post<Phase>(`${this.api}/editions/${editionId}/phases`, phase);
  }

  /** PUT /phases/{id}  (PhaseController.mettreAJour) — dates + pondérations */
  mettreAJourPhase(id: string, phase: Partial<Phase>): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/phases/${id}`, phase);
  }

  /** PUT /phases/{id}/cloturer — passe la phase en TERMINEE et coupe les votes */
  cloturerPhase(id: string): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/phases/${id}/cloturer`, {});
  }

  /**
   * PUT /phases/{id}/activer — passe la phase de EN_ATTENTE à EN_COURS.
   * ⚠️ Endpoint NON IMPLÉMENTÉ côté backend au 16/08/2026 (vérifié : `StatutPhase.EN_COURS`
   * n'apparaît nulle part dans PhaseController.java). Contrat proposé côté backend,
   * en attente de développement. 404 attendu tant que non déployé — écran câblé en avance
   * (cf. décision explicite utilisateur : concevoir le frontend avant complétion backend).
   */
  activerPhase(id: string): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/phases/${id}/activer`, {});
  }

  /**
   * GET /candidatures?statut=&page=&size=
   * Endpoint réel : CandidatureController (pas /admin/candidatures)
   * Défaut backend : filtre sur EN_ATTENTE si statut absent
   */
  candidatures(statut: string | null, page = 0, size = 20): Observable<Page<CandidatureDetailResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    return this.http.get<Page<CandidatureDetailResponse>>(`${this.api}/candidatures`, { params });
  }

  /**
   * PUT /candidatures/{id}/valider  (PAS POST — méthode réelle : @PutMapping)
   * Retourne CandidatureDetailResponse (pas void)
   */
  valider(id: string): Observable<CandidatureDetailResponse> {
    return this.http.put<CandidatureDetailResponse>(`${this.api}/candidatures/${id}/valider`, {});
  }

  /**
   * PUT /candidatures/{id}/rejeter  (PAS POST — méthode réelle : @PutMapping)
   * Corps : { motifRejet } — field name exact du DTO RejeterCandidatureRequest
   * Contrainte backend : motifRejet >= 10 caractères
   */
  rejeter(id: string, motifRejet: string): Observable<CandidatureDetailResponse> {
    return this.http.put<CandidatureDetailResponse>(
      `${this.api}/candidatures/${id}/rejeter`,
      { motifRejet }
    );
  }

  /**
   * GET /editions/{id}/phases  (EditionController)
   * Pas de GET /phases indépendant pour l'admin
   */
  phases(editionId: string): Observable<Phase[]> {
    return this.http.get<Phase[]>(`${this.api}/editions/${editionId}/phases`);
  }

  /** PUT /phases/{id}/vote/activer — active vote_actif + set date_ouverture_vote */
  activerVote(phaseId: string): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/phases/${phaseId}/vote/activer`, {});
  }

  /** PUT /phases/{id}/vote/desactiver — désactive vote_actif + set date_fermeture_vote */
  desactiverVote(phaseId: string): Observable<Phase> {
    return this.http.put<Phase>(`${this.api}/phases/${phaseId}/vote/desactiver`, {});
  }

  /**
   * POST /admin/communication/envoyer  (AdminController)
   * Retourne Map<String, Object> → Record<string, unknown>
   */
  envoyerCommunication(req: CommunicationRequest): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.api}/admin/communication/envoyer`, req);
  }
}
