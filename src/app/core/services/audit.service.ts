import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Page } from '@core/models';

/**
 * AuditLog tel que renvoyé par AdminController (journal append-only — REVOKE DELETE/UPDATE
 * en base, cf. V1__init_schema.sql). Le contrôleur sérialise désormais `AuditLogResponse`
 * (DTO record) : `utilisateur` est aplati en `utilisateurId`, pas d'objet imbriqué.
 */
export interface AuditLogBrut {
  id: number;
  utilisateurId: string | null;
  action: string;
  entiteConcernee: string;
  entiteId: string | null;
  ipSource: string | null;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  /** GET /admin/audit-logs (Pageable) — ADMIN/SUPER_ADMIN — AdminController.auditLogs(). */
  lister(page = 0, size = 25): Observable<Page<AuditLogBrut>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditLogBrut>>(`${this.base}/admin/audit-logs`, { params });
  }
}
