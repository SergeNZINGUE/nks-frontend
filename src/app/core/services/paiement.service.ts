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
 * ⚠️ Endpoint `GET /paiements/{id}/statut-public` NON ENCORE IMPLÉMENTÉ côté
 * backend au 27/08/2026 — nécessaire pour que la page de retour de paiement
 * (`/paiement/retour`) fonctionne pour un votant/candidat non connecté, cf.
 * doc LigdiCash transmise à Serge. `GET /paiements/{id}` existant est
 * `@PreAuthorize("isAuthenticated()")` et ne convient donc pas ici : un
 * votant qui vient de payer via LigdiCash n'a pas de JWT.
 */
export interface StatutPaiementPublic {
  statut: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  montant: number;
  /** Motif lisible en cas d'échec (ex. "Solde insuffisant") — absent tant que le backend n'expose pas code_reponse/motif_rejet (cf. écarts schéma BDD, doc LigdiCash). */
  motif?: string | null;
}

/** PaiementController — endpoints admin (§13.7). Routes réelles vérifiées contre le code source backend le 15/08/2026. */
@Injectable({ providedIn: 'root' })
export class PaiementService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/paiements`;

  /** GET /paiements/{id}/statut-public — public, sans JWT. Voir doc `StatutPaiementPublic` : endpoint à créer côté backend. */
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
