import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Page } from '@core/models';

/**
 * AuditLog tel que sérialisé brut par AdminController (entité JPA, journal append-only —
 * REVOKE DELETE/UPDATE en base, cf. V1__init_schema.sql). `utilisateur` est LAZY sans
 * @JsonIgnore → même bug que Classement/Jury/Paiements (cf. rapport 15/08/2026).
 */
export interface AuditLogBrut {
  id: number;
  utilisateur?: { id: string; email: string } | null;
  action: string;
  entiteConcernee: string;
  entiteId: string | null;
  donneesAvant: string | null;
  donneesApres: string | null;
  ipSource: string | null;
  userAgent: string | null;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  /**
   * GET /admin/audit-logs (Pageable) — ADMIN/SUPER_ADMIN — AdminController.auditLogs().
   * ⚠️ Bug backend confirmé (15/08/2026) : 500 dès qu'il y a des lignes d'audit en base.
   */
  lister(page = 0, size = 25): Observable<Page<AuditLogBrut>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditLogBrut>>(`${this.base}/admin/audit-logs`, { params });
  }
}
