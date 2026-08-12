import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  SoireeEvent,
  CategorieTicket,
  ReservationRequest,
  ReservationResponse,
  Reservation,
  ScanResponse,
} from '@core/models';

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
   * GET /reservations/mes-tickets?telephone= — BilletterieController.mesTickets()
   * CdC §3.6.2 : accès aux tickets sans création de compte, via le numéro de téléphone.
   */
  mesTickets(telephone: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.base}/reservations/mes-tickets`, {
      params: new HttpParams().set('telephone', telephone),
    });
  }

  /** DELETE /reservations/{id} — annulation (remboursement manuel, décision client) */
  annuler(reservationId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reservations/${reservationId}`);
  }

  /**
   * POST /scan — ScanController.scanner() — rôle AGENT_ACCUEIL requis.
   * ScanRequest impose { qrUuid, soireeId } : les deux sont @NotNull.
   */
  scannerQR(qrUuid: string, soireeId: string): Observable<ScanResponse> {
    return this.http.post<ScanResponse>(`${this.base}/scan`, { qrUuid, soireeId });
  }

  /** GET /scan/soiree/{id}/compteur — CdC §3.6.3 : compteur d'entrées temps réel */
  compteurEntrees(soireeId: string): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/scan/soiree/${soireeId}/compteur`);
  }
}
