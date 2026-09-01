import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { AuditService, AuditLogBrut } from '@core/services/audit.service';
import { Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-audit',
  imports: [DatePipe],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Audit &amp; sécurité</h1>
      <p class="page-header__subtitle">Journal append-only des actions sensibles effectuées sur la plateforme.</p>
    </div>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreur) {
    <div class="banner banner--err" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreur }}
    </div>
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
          <span role="cell">{{ l.utilisateurId ?? 'système' }}</span>
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
        catchError(err => { this.erreur = messageErreur(err, "Erreur de chargement du journal d'audit."); return of(null); }),
        finalize(() => { this.isLoading = false; })
      ).subscribe(res => { if (res) this.page = res; })
    );
  }
}
