import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { PaiementService, PaiementBrut } from '@core/services/paiement.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const MSG_BACKEND_CASSE =
  "Backend indisponible : LazyInitializationException connue sur Paiement.utilisateur (LAZY sans @JsonIgnore). Correction en attente côté backend.";

@Component({
  selector: 'app-payments',
  imports: [DatePipe, DecimalPipe, TopbarComponent],
  template: `
<div class="page">
  <app-topbar title="Paiements" icon="💳" backLink="/admin" backLabel="Retour à l'administration" />

  <div class="gap-banner" role="note">
    ⚠️ Écran câblé sur les endpoints réels de <code>PaiementController</code>. La liste et le détail
    sont aujourd'hui cassés côté backend (500 confirmé en test live, dès qu'il y a des paiements en
    base) : seule la confirmation manuelle n'a pas été testée mais ne sérialise pas la liste complète.
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreur) {
    <div class="banner banner--err" role="alert">⚠️ {{ erreur }}</div>
  }

  @if (!isLoading && !erreur) {
    <div class="table" role="table" aria-label="Historique des paiements">
      @if (page && page.content.length === 0) {
        <div class="empty">Aucun paiement.</div>
      }
      @if (page && page.content.length > 0) {
        <div class="row row--head" role="row">
          <span role="columnheader">Type</span>
          <span role="columnheader">Montant</span>
          <span role="columnheader">Statut</span>
          <span role="columnheader">Date</span>
          <span role="columnheader">Actions</span>
        </div>
      }
      @for (p of page?.content; track p.id) {
        <div class="row" role="row">
          <span role="cell" class="row__code">{{ p.typePaiement }}</span>
          <span role="cell" class="row__nom">
            {{ p.montant | number:'1.0-0' }} FCFA
            <small>{{ p.referenceExterne ?? 'sans référence' }}{{ p.manuel ? ' · manuel' : '' }}</small>
          </span>
          <span role="cell"><span class="badge" [class]="badgeClass(p.statut)">{{ p.statut }}</span></span>
          <span role="cell" class="row__date">{{ p.dateCreation | date:'dd/MM/yyyy HH:mm' }}</span>
          <span role="cell" class="row__actions">
            @if (p.statut === 'PENDING') {
              <button type="button" class="btn btn--ok btn--sm" (click)="ouvrirConfirmation(p)">Confirmer manuellement</button>
            }
          </span>
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

  @if (paiementAConfirmer; as p) {
    <div class="modal-bg" (click)="fermerConfirmation()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <h2>Confirmer le paiement manuellement</h2>
        <p class="dossier__champ">{{ p.montant | number:'1.0-0' }} FCFA — {{ p.typePaiement }}</p>
        <label for="reference">Référence (justificatif)</label>
        <textarea id="reference" class="modal__textarea" maxlength="255" [value]="referenceSaisie" (input)="referenceSaisie = $any($event.target).value" rows="3"></textarea>
        @if (erreurConfirmation) {
          <p class="modal__err" role="alert">⚠️ {{ erreurConfirmation }}</p>
        }
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="fermerConfirmation()">Annuler</button>
          <button type="button" class="btn btn--ok" [disabled]="!referenceSaisie.trim() || confirmationEnCours" (click)="confirmer()">
            {{ confirmationEnCours ? 'Confirmation…' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>
`,
  styleUrls: ['../candidatures/candidatures.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private paiementSvc = inject(PaiementService);

  isLoading = true;
  erreur: string | null = null;
  page: Page<PaiementBrut> | null = null;
  pageCourante = 0;

  paiementAConfirmer: PaiementBrut | null = null;
  referenceSaisie = '';
  erreurConfirmation: string | null = null;
  confirmationEnCours = false;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerPage(0); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  badgeClass(statut: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'badge-active',
      PENDING: 'badge-en_attente',
      FAILED: 'badge-rejetee',
      EXPIRED: 'badge-rejetee',
      REFUNDED: 'badge-validee',
    };
    return map[statut] ?? 'badge-en_attente';
  }

  chargerPage(page: number): void {
    this.isLoading = true;
    this.erreur = null;
    this.pageCourante = page;
    this.sub.add(
      this.paiementSvc.lister(page, 20).pipe(
        catchError(() => { this.erreur = MSG_BACKEND_CASSE; return of(null); }),
        finalize(() => { this.isLoading = false; })
      ).subscribe(res => { if (res) this.page = res; })
    );
  }

  ouvrirConfirmation(p: PaiementBrut): void {
    this.paiementAConfirmer = p;
    this.referenceSaisie = '';
    this.erreurConfirmation = null;
  }

  fermerConfirmation(): void { this.paiementAConfirmer = null; }

  confirmer(): void {
    if (!this.paiementAConfirmer || !this.referenceSaisie.trim()) return;
    this.confirmationEnCours = true;
    this.erreurConfirmation = null;
    const id = this.paiementAConfirmer.id;
    this.sub.add(
      this.paiementSvc.confirmerManuellement(id, this.referenceSaisie.trim()).pipe(
        catchError(err => { this.erreurConfirmation = messageErreur(err, 'Échec de la confirmation.'); return of(null); }),
        finalize(() => { this.confirmationEnCours = false; })
      ).subscribe(paiement => {
        if (!paiement || !this.page) return;
        this.page = { ...this.page, content: this.page.content.map(p => p.id === id ? paiement : p) };
        this.fermerConfirmation();
      })
    );
  }
}
