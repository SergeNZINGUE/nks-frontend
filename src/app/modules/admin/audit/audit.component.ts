import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { AuditService, AuditLogBrut } from '@core/services/audit.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { Page } from '@core/models';

const MSG_BACKEND_CASSE =
  "Backend indisponible : LazyInitializationException connue sur AuditLog.utilisateur (LAZY sans @JsonIgnore). Correction en attente côté backend.";

@Component({
  selector: 'app-audit',
  imports: [DatePipe, TopbarComponent],
  template: `
<div class="page">
  <app-topbar title="Audit & sécurité" icon="🛡️" backLink="/admin" backLabel="Retour à l'administration" />

  <div class="gap-banner" role="note">
    ⚠️ Écran câblé sur <code>GET /admin/audit-logs</code> (journal append-only, aucune suppression
    possible en base). Cassé côté backend aujourd'hui (500 confirmé en test live, dès qu'il y a des
    lignes d'audit).
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreur) {
    <div class="banner banner--err" role="alert">⚠️ {{ erreur }}</div>
  }

  @if (!isLoading && !erreur) {
    <div class="table" role="table" aria-label="Journal d'audit">
      @if (page && page.content.length === 0) {
        <div class="empty">Aucune entrée d'audit.</div>
      }
      @if (page && page.content.length > 0) {
        <div class="row row--head" role="row">
          <span role="columnheader">Action</span>
          <span role="columnheader">Entité</span>
          <span role="columnheader">Utilisateur</span>
          <span role="columnheader">Date</span>
        </div>
      }
      @for (l of page?.content; track l.id) {
        <div class="row row--audit" role="row">
          <span role="cell" class="row__code">{{ l.action }}</span>
          <span role="cell" class="row__nom">
            {{ l.entiteConcernee }}
            <small>{{ l.entiteId ?? '—' }}</small>
          </span>
          <span role="cell">{{ l.utilisateur?.email ?? 'système' }}</span>
          <span role="cell" class="row__date">{{ l.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</span>
        </div>
      }

      @if (page && page.totalPages > 1) {
        <nav class="pagination" aria-label="Pagination">
          <button type="button" [disabled]="pageCourante === 0" aria-label="Page précédente" (click)="chargerPage(pageCourante - 1)">‹</button>
          <span aria-live="polite">{{ pageCourante + 1 }} / {{ page.totalPages }}</span>
          <button type="button" [disabled]="pageCourante >= page.totalPages - 1" aria-label="Page suivante" (click)="chargerPage(pageCourante + 1)">›</button>
        </nav>
      }
    </div>
  }
</div>
`,
  styleUrls: ['../candidatures/candidatures.component.scss', './audit.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AuditComponent implements OnInit, OnDestroy {
  private auditSvc = inject(AuditService);

  isLoading = true;
  erreur: string | null = null;
  page: Page<AuditLogBrut> | null = null;
  pageCourante = 0;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerPage(0); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  chargerPage(page: number): void {
    this.isLoading = true;
    this.erreur = null;
    this.pageCourante = page;
    this.sub.add(
      this.auditSvc.lister(page, 25).pipe(
        catchError(() => { this.erreur = MSG_BACKEND_CASSE; return of(null); }),
        finalize(() => { this.isLoading = false; })
      ).subscribe(res => { if (res) this.page = res; })
    );
  }
}
