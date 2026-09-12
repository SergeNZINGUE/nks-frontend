import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  DashboardResponse,
  DashboardOrganisateurResponse,
  CandidatureDetailResponse,
  Phase,
  Edition,
  Page,
} from '@core/models';

export type RoleAdmin = 'ADMIN' | 'SUPER_ADMIN' | 'AGENT_ACCUEIL' | 'ORGANISATEUR';

export interface CreerUtilisateurAdminRequest {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  role: RoleAdmin;
}

export interface UtilisateurAdminResponse {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  roles: string[];
  statut: string;
}

/** SmsController.SmsBulkResponse — réponse de POST /sms/candidatures-validees. */
export interface SmsBulkResponse {
  nbEnvoyes: number;
  nbEchecs: number;
  echecs: { telephone: string; erreur: string }[];
}

/**
 * Construit le SMS de confirmation de candidature avec le montant des frais lu depuis
 * `environment.inscriptionPriceFcfa` — aligné sur la var d'env backend INSCRIPTION_FRAIS_FCFA.
 * Utilisé uniquement pour le renvoi unitaire (POST /sms/envoyer) ; le renvoi en masse
 * (POST /sms/candidatures-validees) utilise la constante du backend directement.
 */
export const SMS_CANDIDATURE_VALIDEE =
  `Felicitations candidature acceptee! Reglez vos frais d'inscription ${environment.inscriptionPriceFcfa} FCFA https://laterrasse.bf/login ou via OM:+22606071717.BIENVENUE DANS LA COMPETITION!`;

/**
 * Normalise un numéro burkinabè vers E.164 (+226XXXXXXXX) — même logique que
 * `SmsGateway.normaliserTelephone()` (backend). Nécessaire côté client pour l'envoi unitaire :
 * `SmsRequest.to` exige déjà le format E.164 (`@Pattern`), sans normalisation serveur à cette
 * entrée (contrairement au renvoi en masse, qui envoie le téléphone brut au gateway).
 */
export function normaliserTelephone(telephone: string): string {
  const t = telephone.trim();
  if (t.startsWith('+')) return t;
  if (t.startsWith('00226')) return '+' + t.substring(2);
  if (t.startsWith('226')) return '+' + t;
  return '+226' + t;
}

/** Structure réelle de CommunicationRequest (bf.laterrasse.nks.dto.admin.CommunicationRequest) */
export interface CommunicationRequest {
  editionId: string;
  filtreStatut: string | null;
  ciblePartenaires: boolean;
  canalSms: boolean;
  canalEmail: boolean;
  canalWhatsapp: boolean;
  message: string;
  sujetEmail: string | null;
  templateWhatsapp: string | null;
  variablesWhatsapp: string[] | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  private readonly api = environment.apiUrl;

  /** GET /admin/dashboard */
  dashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.api}/admin/dashboard`);
  }

  /** GET /admin/dashboard/organisateur — sans données financières */
  dashboardOrganisateur(): Observable<DashboardOrganisateurResponse> {
    return this.http.get<DashboardOrganisateurResponse>(`${this.api}/admin/dashboard/organisateur`);
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

  /** PUT /phases/{id}/activer — transitionne la phase de EN_ATTENTE à EN_COURS. */
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
   * PUT /candidatures/{id}/activer-manuellement — activation après règlement en espèces ou autre.
   * Les deux champs sont optionnels : referenceReglement (reçu, référence) et montant
   * (défaut backend : 15 000 FCFA si absent).
   */
  activerManuellement(id: string, referenceReglement?: string | null, montant?: number | null): Observable<CandidatureDetailResponse> {
    return this.http.put<CandidatureDetailResponse>(
      `${this.api}/candidatures/${id}/activer-manuellement`,
      { referenceReglement: referenceReglement ?? null, montant: montant ?? null }
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

  /**
   * POST /sms/candidatures-validees — SmsController.envoyerAuxCandidaturesValidees().
   * Renvoie le SMS de confirmation (frais d'inscription) à toutes les candidatures
   * EN_ATTENTE_PAIEMENT de l'édition — utile en rattrapage après un incident du
   * fournisseur SMS (ex. bascule Twilio → HDR Stream le 28/08/2026).
   */
  renvoyerSmsConfirmation(): Observable<SmsBulkResponse> {
    return this.http.post<SmsBulkResponse>(`${this.api}/sms/candidatures-validees`, {});
  }

  /** POST /sms/envoyer — SmsController.envoyer(). Envoi unitaire admin — `to` doit déjà être en E.164. */
  envoyerSmsUnitaire(to: string, message: string): Observable<{ success: boolean; sid: string }> {
    return this.http.post<{ success: boolean; sid: string }>(`${this.api}/sms/envoyer`, { to, message });
  }

  /**
   * POST /whatsapp/envoyer — N'EXISTE PAS ENCORE côté backend au 01/09/2026.
   * `application.yml` définit `nks.sms.whatsapp-url` mais aucune classe Java ne le lit — aucun
   * gateway, aucun contrôleur. Contrat calqué sur `SmsRequest`/`SmsController.envoyer()` (même
   * forme que `envoyerSmsUnitaire`) en attendant l'implémentation de Serge. Tant que l'endpoint
   * n'existe pas, l'appel échoue en 404 — le bouton affiche alors « Échec », comportement voulu.
   */
  envoyerWhatsappUnitaire(to: string, message: string): Observable<{ success: boolean; sid: string }> {
    return this.http.post<{ success: boolean; sid: string }>(`${this.api}/whatsapp/envoyer`, { to, message });
  }

  /** POST /admin/utilisateurs — SUPER_ADMIN uniquement */
  creerUtilisateur(req: CreerUtilisateurAdminRequest): Observable<UtilisateurAdminResponse> {
    return this.http.post<UtilisateurAdminResponse>(`${this.api}/admin/utilisateurs`, req);
  }

  /** GET /admin/utilisateurs — SUPER_ADMIN uniquement */
  listerUtilisateurs(): Observable<UtilisateurAdminResponse[]> {
    return this.http.get<UtilisateurAdminResponse[]>(`${this.api}/admin/utilisateurs`);
  }

  /** POST /admin/utilisateurs/{id}/reinitialiser-mot-de-passe */
  reinitialiserMotDePasse(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/admin/utilisateurs/${id}/reinitialiser-mot-de-passe`, {});
  }

  /**
   * GET /admin/rapports/votes/export-csv?phaseId= — AdminController.exportVotesCsv() —
   * ADMIN/SUPER_ADMIN. Renvoie le CSV brut (Content-Disposition: attachment) : à consommer en
   * `Blob` (responseType: 'blob') pour déclencher le téléchargement côté navigateur, pas en JSON.
   */
  exportVotesCsv(phaseId: string): Observable<Blob> {
    return this.http.get(`${this.api}/admin/rapports/votes/export-csv`, {
      params: { phaseId },
      responseType: 'blob',
    });
  }
}
