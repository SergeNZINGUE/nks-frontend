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
  Page,
} from '@core/models';

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
}
