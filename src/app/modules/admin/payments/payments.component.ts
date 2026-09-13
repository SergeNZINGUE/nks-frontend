import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { PaiementService, PaiementBrut, StatutPaiementFiltre } from '@core/services/paiement.service';
import { Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const LABEL_STATUT: Record<string, string> = {
  PENDING:   'En attente',
  COMPLETED: 'Confirmé',
  FAILED:    'Échoué',
  EXPIRED:   'Expiré',
  REFUNDED:  'Remboursé',
};

const FILTRES: { val: StatutPaiementFiltre; lbl: string }[] = [
  { val: 'TOUS',      lbl: 'Tous' },
  { val: 'PENDING',   lbl: 'En attente' },
  { val: 'COMPLETED', lbl: 'Confirmés' },
  { val: 'FAILED',    lbl: 'Échoués' },
  { val: 'EXPIRED',   lbl: 'Expirés' },
];

@Component({
  selector: 'app-payments',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Frais d'inscription</h1>
      <p class="page-header__subtitle">Récapitulatif des paiements de frais d'inscription — LigdiCash et espèces.</p>
    </div>
  </div>

  <!-- Filtres statut -->
  <div class="chips" role="group" aria-label="Filtrer par statut">
    @for (f of filtres; track f.val) {
      <button type="button" class="chip" [class.chip--active]="filtre === f.val" (click)="setFiltre(f.val)">
        {{ f.lbl }}
        @if (f.val !== 'TOUS' && page && filtre === f.val) {
          <span class="chip__count">{{ page.totalElements }}</span>
        }
      </button>
    }
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement">
      <div class="sk" aria-hidden="true"></div>
      <div class="sk" aria-hidden="true"></div>
      <div class="sk" aria-hidden="true"></div>
    </div>
  }

  @if (!isLoading && erreur) {
    <div class="banner banner--err" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreur }}
    </div>
  }

  @if (!isLoading && !erreur && page) {

    @if (page.totalElements === 0) {
      <div class="empty-state">Aucun paiement d'inscription trouvé.</div>
    } @else {

      <div class="card">
        <p class="card__count">{{ page.totalElements }} paiement{{ page.totalElements > 1 ? 's' : '' }}</p>

        <div role="table" class="table" aria-label="Frais d'inscription">
          <div role="rowgroup">
            <div role="row" class="row row--head">
              <span role="columnheader">Date</span>
              <span role="columnheader">Candidat</span>
              <span role="columnheader" class="col-right">Montant</span>
              <span role="columnheader">Statut</span>
              <span role="columnheader">Référence</span>
              <span role="columnheader">Mode</span>
              <span role="columnheader">Actions</span>
            </div>
          </div>
          <div role="rowgroup">
            @for (p of page.content; track p.id) {
              <div role="row" class="row row--data">
                <span role="cell">
                  <span class="date-primary">{{ p.dateCreation | date:'dd/MM/yyyy' }}</span>
                  @if (p.dateFinalisation) {
                    <small class="date-secondary">✓ {{ p.dateFinalisation | date:'dd/MM HH:mm' }}</small>
                  }
                </span>
                <span role="cell">
                  @if (p.prenomCandidat || p.nomCandidat) {
                    <span class="candidat-nom">{{ p.prenomCandidat }} {{ p.nomCandidat }}</span>
                    @if (p.emailCandidat) {
                      <small class="candidat-email">{{ p.emailCandidat }}</small>
                    }
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </span>
                <span role="cell" class="col-right montant">
                  {{ p.montant | number:'1.0-0' }} FCFA
                </span>
                <span role="cell">
                  <span class="badge" [class]="'badge--' + badgeStatut(p.statut)">{{ labelStatut(p.statut) }}</span>
                </span>
                <span role="cell" class="reference">{{ p.referenceExterne || '—' }}</span>
                <span role="cell">
                  @if (p.manuel) {
                    <span class="badge badge--info">Espèces</span>
                  } @else {
                    <span class="badge badge--ghost">LigdiCash</span>
                  }
                </span>
                <span role="cell" class="row__actions">
                  @if (p.statut === 'PENDING') {
                    <button type="button" class="btn btn--ok btn--sm" (click)="ouvrirConfirmation(p)">
                      Confirmer
                    </button>
                  }
                </span>
              </div>
            }
          </div>
        </div>

        @if (page.totalPages > 1) {
          <nav class="pagination" aria-label="Pagination">
            <button type="button" class="btn btn--ghost btn--sm" [disabled]="pageCourante === 0" (click)="chargerPage(pageCourante - 1)">‹ Précédent</button>
            <span class="pagination__info">Page {{ pageCourante + 1 }} / {{ page.totalPages }}</span>
            <button type="button" class="btn btn--ghost btn--sm" [disabled]="pageCourante >= page.totalPages - 1" (click)="chargerPage(pageCourante + 1)">Suivant ›</button>
          </nav>
        }
      </div>
    }
  }

  <!-- Modale confirmation manuelle -->
  @if (paiementAConfirmer; as p) {
    <div class="modal-bg" (click)="fermerConfirmation()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <h2>Confirmer le paiement manuellement</h2>
        @if (p.prenomCandidat || p.nomCandidat) {
          <p class="modal__candidat">{{ p.prenomCandidat }} {{ p.nomCandidat }}</p>
        }
        <p>{{ p.montant | number:'1.0-0' }} FCFA</p>
        <label for="reference">Référence (reçu, numéro de transaction…)</label>
        <textarea id="reference" class="modal__textarea" maxlength="255" [value]="referenceSaisie"
          (input)="referenceSaisie = $any($event.target).value" rows="3"></textarea>
        @if (erreurConfirmation) {
          <p class="modal__err" role="alert">{{ erreurConfirmation }}</p>
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
  styles: [`
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .chip { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: background .15s, color .15s; }
    .chip:hover { background: var(--surface-hover, #f1f5f9); }
    .chip--active { background: var(--primary); color: #fff; border-color: var(--primary); }
    .chip__count { background: rgba(255,255,255,.3); border-radius: 10px; padding: 1px 7px; font-size: 11px; }

    .card__count { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

    .row { display: grid; grid-template-columns: 120px 1fr 110px 110px 160px 90px 90px; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .row--head { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
    .row--data { font-size: 14px; }
    .row--data:last-child { border-bottom: none; }
    .row--data:hover { background: var(--surface-hover, #f8f9fa); }

    .col-right { text-align: right; }
    .date-primary { display: block; font-weight: 500; }
    .date-secondary { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .candidat-nom { display: block; font-weight: 500; }
    .candidat-email { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .montant { font-weight: 600; font-variant-numeric: tabular-nums; }
    .reference { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
    .text-muted { color: var(--text-muted); }

    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .badge--success { background: #d1fae5; color: #065f46; }
    .badge--warning { background: #fef3c7; color: #92400e; }
    .badge--danger  { background: #fee2e2; color: #991b1b; }
    .badge--neutral { background: #f3f4f6; color: #374151; }
    .badge--info    { background: #dbeafe; color: #1e40af; }
    .badge--ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
    .pagination__info { font-size: 13px; color: var(--text-muted); }

    .modal__candidat { font-weight: 600; margin-bottom: 4px; }
  `],
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private paiementSvc = inject(PaiementService);

  isLoading = true;
  erreur: string | null = null;
  page: Page<PaiementBrut> | null = null;
  pageCourante = 0;
  filtre: StatutPaiementFiltre = 'TOUS';

  paiementAConfirmer: PaiementBrut | null = null;
  referenceSaisie = '';
  erreurConfirmation: string | null = null;
  confirmationEnCours = false;

  readonly filtres = FILTRES;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerPage(0); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  setFiltre(f: StatutPaiementFiltre): void {
    this.filtre = f;
    this.chargerPage(0);
  }

  chargerPage(page: number): void {
    this.isLoading = true;
    this.erreur = null;
    this.pageCourante = page;
    const statut = this.filtre === 'TOUS' ? undefined : this.filtre;
    this.sub.add(
      this.paiementSvc.lister(page, 20, 'INSCRIPTION', statut).pipe(
        catchError(err => { this.erreur = messageErreur(err, 'Erreur de chargement.'); return of(null); }),
        finalize(() => { this.isLoading = false; })
      ).subscribe(res => { if (res) this.page = res; })
    );
  }

  labelStatut(s: string): string { return LABEL_STATUT[s] ?? s; }

  badgeStatut(s: string): string {
    return ({ COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', EXPIRED: 'neutral', REFUNDED: 'info' } as Record<string,string>)[s] ?? 'neutral';
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
