import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Page } from '@core/models';

/**
 * Paiement tel que renvoyé par PaiementController (§13.7) : le contrôleur sérialise
 * désormais `PaiementResponse` (DTO record), plus l'entité JPA brute — `utilisateur`
 * est aplati en `utilisateurId`, pas d'objet imbriqué.
 */
export interface PaiementBrut {
  id: string;
  utilisateurId: string | null;
  typePaiement: 'INSCRIPTION' | 'VOTE' | 'BILLET';
  montant: number;
  statut: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  dateCreation: string;
  dateFinalisation: string | null;
  referenceExterne: string | null;
  manuel: boolean;
}

/**
 * Statut public d'un paiement, résolu SANS authentification via l'identifiant
 * (UUID non énumérable) reçu par l'utilisateur anonyme au retour LigdiCash.
 * Volontairement minimal — jamais d'email/téléphone/utilisateurId ici.
 *
 * Endpoint `GET /paiements/{id}/statut-public` implémenté côté backend le
 * 30/08/2026 (commit bd90d11, `PaiementController.statutPublic()`), public
 * (pas de `@PreAuthorize`) — `GET /paiements/{id}` existant est réservé aux
 * utilisateurs authentifiés et ne convenait pas ici (votant anonyme sans JWT).
 * `motif` reste toujours `null` pour l'instant côté backend
 * (`StatutPublicPaiementResponse.from(paiement, null)` — le paramètre motif
 * n'est jamais renseigné) : le champ existe dans la réponse mais n'est pas
 * encore alimenté.
 */
export interface StatutPaiementPublic {
  id: string;
  statut: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  montant: number;
  typePaiement: 'INSCRIPTION' | 'VOTE' | 'BILLET';
  motif: string | null;
}

/** PaiementController — endpoints admin (§13.7). Routes réelles vérifiées contre le code source backend le 30/08/2026. */
@Injectable({ providedIn: 'root' })
export class PaiementService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/paiements`;

  /** GET /paiements/{id}/statut-public — public, sans JWT. PaiementController.statutPublic(). */
  statutPublic(id: string): Observable<StatutPaiementPublic> {
    return this.http.get<StatutPaiementPublic>(`${this.base}/${id}/statut-public`);
  }

  /** GET /paiements (Pageable) — ADMIN/SUPER_ADMIN — PaiementController.lister(). */
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
