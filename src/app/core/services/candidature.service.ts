import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CandidatureDetailResponse,
  CandidatureSubmitRequest,
  CandidatureSubmitResponse,
} from '@core/models';

/**
 * Corps de POST /paiements/initier — InitierPaiementRequest.java
 * ATTENTION : le backend ne prend NI candidatureId NI operateur. Le paiement est
 * rattaché à l'utilisateur authentifié via le JWT (PaiementController.initier()
 * est @PreAuthorize("isAuthenticated()")).
 */
export interface InitierPaiementRequest {
  typePaiement: 'INSCRIPTION' | 'VOTE' | 'BILLET';
  montant: number;
  telephone: string;
}

/** Réponse de POST /paiements/initier — InitierPaiementResponse.java */
export interface InitierPaiementResponse {
  paiementId: string;
  urlPaiement: string;
  montant: number;
  statut: string;
}

@Injectable({ providedIn: 'root' })
export class CandidatureService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/candidatures`;
  private readonly paiements = `${environment.apiUrl}/paiements`;

  /**
   * POST /candidatures — soumission publique (CdC §3.1).
   * Retourne CandidatureSubmitResponse { id, codeCandidat, statut } — PAS le détail complet.
   */
  soumettre(req: CandidatureSubmitRequest): Observable<CandidatureSubmitResponse> {
    return this.http.post<CandidatureSubmitResponse>(this.base, req);
  }

  /** GET /candidatures/ma-candidature — rôle CANDIDAT */
  maCandidature(): Observable<CandidatureDetailResponse> {
    return this.http.get<CandidatureDetailResponse>(`${this.base}/ma-candidature`);
  }

  /**
   * POST /paiements/initier — frais d'inscription via Mobile Money (CdC §3.1.2, §3.2).
   * Requiert un JWT valide : le candidat doit d'abord se connecter avec le mot de passe
   * temporaire reçu par SMS/e-mail après validation de sa candidature.
   *
   * Le montant provient du paramètre plateforme PRIX_INSCRIPTION_FCFA (seed à 0,
   * à configurer par l'admin avant ouverture des inscriptions — décision client).
   */
  initierPaiementInscription(montant: number, telephone: string): Observable<InitierPaiementResponse> {
    const req: InitierPaiementRequest = { typePaiement: 'INSCRIPTION', montant, telephone };
    return this.http.post<InitierPaiementResponse>(`${this.paiements}/initier`, req);
  }
}
