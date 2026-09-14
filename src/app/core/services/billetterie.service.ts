import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  SoireeEvent,
  CategorieTicket,
  ReservationRequest,
  ReservationResponse,
  Reservation,
  ScanResponse,
  DroitVoteResponse,
  TicketAvecQr,
  OtpDemandeResponse,
  OtpVerifierResponse,
  Page,
} from '@core/models';

/** En-tête exigé par les endpoints "mes-tickets" gatés (fix IDOR du 13/09/2026) —
 *  jamais en query string, toujours en header, jamais persisté en localStorage. */
function headerAccesTicket(token: string): { headers: HttpHeaders } {
  return { headers: new HttpHeaders({ 'X-Ticket-Access-Token': token }) };
}

/** Corps de POST /admin/billetterie/tickets-gratuits — Map<String,Object> lu champ par champ côté backend. */
export interface TicketsGratuitsRequest {
  soireeId: string;
  categorieId: string;
  nom: string;
  telephone: string;
  nbPlaces: number;
}

/**
 * Billetterie — CdC §3.6.
 * Endpoints alignés sur BilletterieController.java et ScanController.java.
 * Aucun de ces contrôleurs n'a de @RequestMapping de classe : les chemins sont absolus.
 */
@Injectable({ providedIn: 'root' })
export class BilletterieService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  /** GET /soirees?editionId= — SoireeController.lister() */
  soirees(editionId?: string): Observable<SoireeEvent[]> {
    const params = editionId ? new HttpParams().set('editionId', editionId) : undefined;
    return this.http.get<SoireeEvent[]>(`${this.base}/soirees`, { params });
  }

  /**
   * GET /soirees/{id}/disponibilite — BilletterieController.disponibilite()
   * Retourne les CategorieTicket avec places_restantes (CdC §3.6.1 : gestion de la jauge).
   */
  categoriesTicket(soireeId: string): Observable<CategorieTicket[]> {
    return this.http.get<CategorieTicket[]>(`${this.base}/soirees/${soireeId}/disponibilite`);
  }

  /**
   * POST /reservations/initier — BilletterieController.initier()
   * Crée une pré-réservation (expire après DELAI_PRERESA_MINUTES=15) + initie le paiement.
   */
  reserver(req: ReservationRequest): Observable<ReservationResponse> {
    return this.http.post<ReservationResponse>(`${this.base}/reservations/initier`, req);
  }

  /**
   * POST /reservations/mes-tickets/otp/demander — fix IDOR du 13/09/2026.
   * Toujours 200 (que le numéro existe ou non) — réponse générique, sauf 429 si rate-limit
   * atteint (3 demandes/10min par numéro ou 10/10min par IP).
   */
  demanderOtp(telephone: string): Observable<OtpDemandeResponse> {
    return this.http.post<OtpDemandeResponse>(`${this.base}/reservations/mes-tickets/otp/demander`, { telephone });
  }

  /**
   * POST /reservations/mes-tickets/otp/verifier — renvoie un jeton "phone-wide"
   * (scope=["read","cancel"]) valable pour toutes les réservations de ce numéro.
   * 400 OTP_INVALIDE si code faux/expiré/trop de tentatives/numéro inconnu — traité côté
   * appelant comme un message d'erreur uniforme.
   */
  verifierOtp(telephone: string, code: string): Observable<OtpVerifierResponse> {
    return this.http.post<OtpVerifierResponse>(`${this.base}/reservations/mes-tickets/otp/verifier`, { telephone, code });
  }

  /**
   * GET /reservations/mes-tickets?telephone= — BilletterieController.mesTickets()
   * CdC §3.6.2 : accès aux tickets sans création de compte, via le numéro de téléphone.
   * Fix IDOR du 13/09/2026 : exige désormais le jeton "phone-wide" issu de /otp/verifier,
   * transmis via le header X-Ticket-Access-Token (jamais en query string).
   */
  mesTickets(telephone: string, token: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.base}/reservations/mes-tickets`, {
      params: new HttpParams().set('telephone', telephone),
      ...headerAccesTicket(token),
    });
  }

  /**
   * GET /reservations/{id}/ticket?telephone= — BilletterieController.ticket()
   * Renvoie un TicketAvecQrResponse par billet physique de la réservation (nbPlaces=3 → 3
   * éléments, 3 qrUuid distincts) — vérifié via le même contrôle `telephone` que mesTickets().
   * C'est le seul endpoint qui expose réellement le qrUuid (mesTickets() ne l'expose jamais).
   * Accepte SOIT le jeton phone-wide (mes-tickets), SOIT le jeton post-achat scopé à CETTE
   * réservation (ReservationResponse.ticketAccessToken) — les deux via le même header.
   */
  ticketsAvecQr(reservationId: string, telephone: string, token: string): Observable<TicketAvecQr[]> {
    return this.http.get<TicketAvecQr[]>(`${this.base}/reservations/${reservationId}/ticket`, {
      params: new HttpParams().set('telephone', telephone),
      ...headerAccesTicket(token),
    });
  }

  /**
   * DELETE /reservations/{id} — annulation (remboursement manuel, décision client).
   * Exige le jeton phone-wide (seul jeton dont le scope contient "cancel").
   */
  annuler(reservationId: string, token: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reservations/${reservationId}`, headerAccesTicket(token));
  }

  /**
   * POST /scan — ScanController.scanner() — rôle AGENT_ACCUEIL requis.
   * ScanRequest impose { qrUuid, soireeId } : les deux sont @NotNull.
   */
  scannerQR(qrUuid: string, soireeId: string): Observable<ScanResponse> {
    return this.http.post<ScanResponse>(`${this.base}/scan`, { qrUuid, soireeId });
  }

  /**
   * GET /scan/soiree/{id}/compteur — CdC §3.6.3 : compteur d'entrées temps réel.
   * `| undefined` sur les valeurs : la forme exacte du Map<String,Long> renvoyé par le
   * backend n'est pas garantie clé par clé (ex. pas de clé 'total' si aucun scan encore) —
   * sans ce typage explicite, Angular signale `?? 0` côté template comme redondant (NG8102)
   * alors qu'il est nécessaire à l'exécution.
   */
  compteurEntrees(soireeId: string): Observable<Record<string, number | undefined>> {
    return this.http.get<Record<string, number | undefined>>(`${this.base}/scan/soiree/${soireeId}/compteur`);
  }

  /**
   * POST /caisse/consommations — CaisseController.validerConsommation() — rôle HOTESSE requis.
   * Scanne le billet (si pas déjà fait) et crée le droit de vote sur place pour ce billet en
   * une seule action, suite à une consommation réelle payée. 409 si un droit existe déjà pour
   * ce billet (1 billet + 1 consommation validée = au plus 1 vote sur place, à chaque service).
   */
  validerConsommation(qrUuid: string, soireeId: string): Observable<DroitVoteResponse> {
    return this.http.post<DroitVoteResponse>(`${this.base}/caisse/consommations`, { qrUuid, soireeId });
  }

  /**
   * GET /vote-sur-place/{soireeId}/{qrUuid} — VoteSurPlaceController.consulter() — public.
   * Retourne le statut du droit de vote (DISPONIBLE/UTILISE) et, si DISPONIBLE, la liste des
   * candidats de cette soirée.
   */
  consulterDroitVote(soireeId: string, qrUuid: string): Observable<DroitVoteResponse> {
    return this.http.get<DroitVoteResponse>(`${this.base}/vote-sur-place/${soireeId}/${qrUuid}`);
  }

  /**
   * POST /vote-sur-place/{soireeId}/{qrUuid}/voter — VoteSurPlaceController.voter() — public.
   * Vote définitif et unique pour ce billet sur cette soirée (verrou pessimiste côté backend).
   * `telephoneVotant`/`position*` sont facultatifs et purement déclaratifs — jamais requis ni
   * vérifiés côté backend, conservés uniquement pour audit a posteriori (cf. VoterSurPlaceRequest.java).
   */
  voterSurPlace(soireeId: string, qrUuid: string, candidatId: string, audit?: {
    telephoneVotant?: string;
    positionLatitude?: number;
    positionLongitude?: number;
    positionPrecisionM?: number;
  }): Observable<DroitVoteResponse> {
    return this.http.post<DroitVoteResponse>(`${this.base}/vote-sur-place/${soireeId}/${qrUuid}/voter`, {
      candidatId,
      telephoneVotant: audit?.telephoneVotant || null,
      positionLatitude: audit?.positionLatitude ?? null,
      positionLongitude: audit?.positionLongitude ?? null,
      positionPrecisionM: audit?.positionPrecisionM ?? null,
    });
  }

  /**
   * GET /admin/billetterie/reservations?soireeId=&page=&size= — ADMIN/SUPER_ADMIN —
   * BilletterieController.reservationsAdmin().
   * ⚠️ Bug backend confirmé (15/08/2026) : `Reservation.soiree`/`.paiement` LAZY sans
   * @JsonIgnore → 500 dès qu'il y a des réservations en base pour la soirée.
   */
  reservationsAdmin(soireeId: string, page = 0, size = 20): Observable<Page<Reservation>> {
    const params = new HttpParams().set('soireeId', soireeId).set('page', page).set('size', size);
    return this.http.get<Page<Reservation>>(`${this.base}/admin/billetterie/reservations`, { params });
  }

  /**
   * POST /admin/billetterie/tickets-gratuits — ADMIN/SUPER_ADMIN —
   * BilletterieController.ticketsGratuits(). Émission manuelle (partenaires/VIP), sans paiement.
   */
  ticketsGratuits(req: TicketsGratuitsRequest): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/admin/billetterie/tickets-gratuits`, req);
  }

  /**
   * POST /admin/billetterie/categories — ADMIN/SUPER_ADMIN — BilletterieController.creerCategorie().
   * Le backend attend l'entité JPA brute : la relation `soiree` doit être envoyée comme
   * référence `{ id: soireeId }`, pas l'objet complet (Jackson + Hibernate résolvent la FK sur l'id seul).
   */
  creerCategorie(soireeId: string, categorie: Omit<CategorieTicket, 'id'>): Observable<CategorieTicket> {
    return this.http.post<CategorieTicket>(`${this.base}/admin/billetterie/categories`, {
      ...categorie,
      soiree: { id: soireeId },
    });
  }

  /**
   * GET /admin/billetterie/soiree/{id}/export-csv — ADMIN/SUPER_ADMIN —
   * AdminController.exportTicketsCsv(). Renvoie le CSV brut (Content-Disposition: attachment) :
   * à consommer en `Blob` (responseType: 'blob') pour déclencher le téléchargement, pas en JSON.
   */
  exporterTicketsCsv(soireeId: string): Observable<Blob> {
    return this.http.get(`${this.base}/admin/billetterie/soiree/${soireeId}/export-csv`, {
      responseType: 'blob',
    });
  }
}
