import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Page } from '@core/models';

/**
 * Paiement tel que sérialisé brut par PaiementController (entité JPA, §13.7).
 * `utilisateur` est LAZY sans @JsonIgnore → même bug que Classement/Jury
 * (cf. rapport LazyInitializationException 15/08/2026) dès qu'il y a des paiements en base.
 */
export interface PaiementBrut {
  id: string;
  utilisateur?: { id: string; email: string; telephone: string };
  typePaiement: 'INSCRIPTION' | 'VOTE' | 'BILLET';
  montant: number;
  statut: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  idempotencyKey: string;
  dateCreation: string;
  dateFinalisation: string | null;
  referenceExterne: string | null;
  manuel: boolean;
}

/** PaiementController — endpoints admin (§13.7). Routes réelles vérifiées contre le code source backend le 15/08/2026. */
@Injectable({ providedIn: 'root' })
export class PaiementService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/paiements`;

  /**
   * GET /paiements (Pageable) — ADMIN/SUPER_ADMIN — PaiementController.lister().
   * ⚠️ Bug backend confirmé (15/08/2026) : 500 dès qu'il y a des paiements en base.
   */
  lister(page = 0, size = 20): Observable<Page<PaiementBrut>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<PaiementBrut>>(this.base, { params });
  }

  /** GET /paiements/{id} — authentifié (pas ADMIN-only côté backend) — PaiementController.detail(). */
  detail(id: string): Observable<PaiementBrut> {
    return this.http.get<PaiementBrut>(`${this.base}/${id}`);
  }

  /**
   * PUT /paiements/{id}/confirmer-manuellement — ADMIN/SUPER_ADMIN — PaiementController.confirmerManuellement().
   * Corps réel : `Map<String,String>` avec une seule clé lue côté backend : `reference`.
   */
  confirmerManuellement(id: string, reference: string): Observable<PaiementBrut> {
    return this.http.put<PaiementBrut>(`${this.base}/${id}/confirmer-manuellement`, { reference });
  }
}
