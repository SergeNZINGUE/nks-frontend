import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit, inject,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { PaiementService, PaiementBrut, StatutPaiementFiltre } from '@core/services/paiement.service';
import { Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

type TypeOnglet = 'INSCRIPTION' | 'VOTE' | 'BILLET';

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

const ONGLETS: { val: TypeOnglet; lbl: string; soustitre: string }[] = [
  { val: 'INSCRIPTION', lbl: 'Frais d\'inscription', soustitre: 'Paiements des frais d\'inscription (LigdiCash et espèces).' },
  { val: 'VOTE',        lbl: 'Votes payants',         soustitre: 'Achats de votes en ligne via LigdiCash.' },
  { val: 'BILLET',      lbl: 'Billets',               soustitre: 'Achats de billets pour les soirées.' },
];

@Component({
  selector: 'app-payments',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Paiements</h1>
      <p class="page-header__subtitle">{{ ongletActif().soustitre }}</p>
    </div>
  </div>

  <!-- Onglets type de paiement -->
  <div class="tabs" role="tablist" aria-label="Type de paiement">
    @for (o of onglets; track o.val) {
      <button type="button" role="tab" class="tab" [class.tab--active]="typeOnglet === o.val"
        [attr.aria-selected]="typeOnglet === o.val" (click)="setOnglet(o.val)">
        {{ o.lbl }}
      </button>
    }
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
      <div class="empty-state">Aucun paiement trouvé.</div>
    } @else {

      <div class="card">
        <p class="card__count">{{ page.totalElements }} paiement{{ page.totalElements > 1 ? 's' : '' }}</p>

        <div role="table" class="table" aria-label="Liste des paiements">
          <div role="rowgroup">
            <div role="row" class="row row--head">
              <span role="columnheader">Date</span>
              <span role="columnheader">{{ typeOnglet === 'INSCRIPTION' ? 'Candidat' : 'Payeur' }}</span>
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
                <span role="cell" class="col-right montant">{{ p.montant | number:'1.0-0' }} FCFA</span>
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
                    <button type="button" class="btn btn--sm btn--primary" (click)="ouvrirConfirmation(p)">
                      Confirmer
                    </button>
                  } @else if (p.statut === 'COMPLETED') {
                    <span class="action-done">✓ Payé</span>
                  } @else {
                    <span class="text-muted">—</span>
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
  @if (paiementAConfirmer) {
    <div class="modal-bg" (click)="fermerConfirmation()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titre" (click)="$event.stopPropagation()">
        <h2 id="modal-titre">Confirmer le paiement manuellement</h2>
        @if (paiementAConfirmer.prenomCandidat || paiementAConfirmer.nomCandidat) {
          <p class="modal__candidat">{{ paiementAConfirmer.prenomCandidat }} {{ paiementAConfirmer.nomCandidat }}</p>
        }
        <p class="modal__montant">{{ paiementAConfirmer.montant | number:'1.0-0' }} FCFA</p>
        <div class="field">
          <label for="reference">Référence (reçu, numéro de transaction…)</label>
          <textarea id="reference" class="field__input" maxlength="255" rows="3"
            [value]="referenceSaisie"
            (input)="referenceSaisie = $any($event.target).value"></textarea>
        </div>
        @if (erreurConfirmation) {
          <div class="banner banner--err" role="alert" style="margin-top:12px">{{ erreurConfirmation }}</div>
        }
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="fermerConfirmation()">Annuler</button>
          <button type="button" class="btn btn--primary"
            [disabled]="!referenceSaisie.trim() || confirmationEnCours"
            (click)="confirmer()">
            {{ confirmationEnCours ? 'Confirmation…' : 'Confirmer le paiement' }}
          </button>
        </div>
      </div>
    </div>
  }

</div>
`,
  styles: [`
    .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 20px; gap: 0; }
    .tab { padding: 10px 20px; border: none; border-bottom: 2px solid transparent; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-muted); margin-bottom: -2px; transition: color .15s, border-color .15s; }
    .tab:hover { color: var(--text); }
    .tab--active { color: var(--primary); border-bottom-color: var(--primary); }

    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .chip { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: background .15s, color .15s; }
    .chip:hover { background: var(--surface-hover, #f1f5f9); }
    .chip--active { background: var(--primary); color: #fff; border-color: var(--primary); }
    .chip__count { background: rgba(255,255,255,.3); border-radius: 10px; padding: 1px 7px; font-size: 11px; }

    .card__count { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

    .row { display: grid; grid-template-columns: 120px 1fr 110px 110px 160px 90px 110px; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .row--head { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; background: var(--surface); }
    .row--data { font-size: 14px; }
    .row--data:last-child { border-bottom: none; }
    .row--data:hover { background: var(--surface-hover, #f8f9fa); }

    .col-right { text-align: right; }
    .date-primary { display: block; font-weight: 500; }
    .date-secondary { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .candidat-nom { display: block; font-weight: 500; }
    .candidat-email { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .montant { font-weight: 600; font-variant-numeric: tabular-nums; }
    .reference { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .text-muted { color: var(--text-muted); }
    .action-done { font-size: 12px; color: #065f46; font-weight: 500; }

    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .badge--success { background: #d1fae5; color: #065f46; }
    .badge--warning { background: #fef3c7; color: #92400e; }
    .badge--danger  { background: #fee2e2; color: #991b1b; }
    .badge--neutral { background: #f3f4f6; color: #374151; }
    .badge--info    { background: #dbeafe; color: #1e40af; }
    .badge--ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }

    .btn--primary { background: var(--primary); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn--sm { padding: 4px 10px; font-size: 12px; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
    .pagination__info { font-size: 13px; color: var(--text-muted); }

    .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--surface, #fff); border-radius: 12px; padding: 28px 32px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal h2 { margin: 0 0 12px; font-size: 18px; }
    .modal__candidat { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
    .modal__montant { font-size: 22px; font-weight: 700; color: var(--primary); margin-bottom: 20px; }
    .modal__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
    .field__input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box; }
    .field__input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), .15); }
  `],
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private paiementSvc = inject(PaiementService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  erreur: string | null = null;
  page: Page<PaiementBrut> | null = null;
  pageCourante = 0;
  filtre: StatutPaiementFiltre = 'TOUS';
  typeOnglet: TypeOnglet = 'INSCRIPTION';

  paiementAConfirmer: PaiementBrut | null = null;
  referenceSaisie = '';
  erreurConfirmation: string | null = null;
  confirmationEnCours = false;

  readonly filtres = FILTRES;
  readonly onglets = ONGLETS;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerPage(0); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  ongletActif() { return ONGLETS.find(o => o.val === this.typeOnglet)!; }

  setOnglet(type: TypeOnglet): void {
    this.typeOnglet = type;
    this.filtre = 'TOUS';
    this.chargerPage(0);
  }

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
      this.paiementSvc.lister(page, 20, this.typeOnglet, statut).pipe(
        catchError(err => { this.erreur = messageErreur(err, 'Erreur de chargement.'); return of(null); }),
        finalize(() => { this.isLoading = false; this.cdr.markForCheck(); })
      ).subscribe(res => { if (res) this.page = res; })
    );
  }

  labelStatut(s: string): string { return LABEL_STATUT[s] ?? s; }

  badgeStatut(s: string): string {
    return ({ COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', EXPIRED: 'neutral', REFUNDED: 'info' } as Record<string, string>)[s] ?? 'neutral';
  }

  ouvrirConfirmation(p: PaiementBrut): void {
    this.paiementAConfirmer = p;
    this.referenceSaisie = '';
    this.erreurConfirmation = null;
    this.cdr.markForCheck();
  }

  fermerConfirmation(): void {
    this.paiementAConfirmer = null;
    this.cdr.markForCheck();
  }

  confirmer(): void {
    if (!this.paiementAConfirmer || !this.referenceSaisie.trim()) return;
    this.confirmationEnCours = true;
    this.erreurConfirmation = null;
    const id = this.paiementAConfirmer.id;
    this.sub.add(
      this.paiementSvc.confirmerManuellement(id, this.referenceSaisie.trim()).pipe(
        catchError(err => {
          this.erreurConfirmation = messageErreur(err, 'Échec de la confirmation.');
          return of(null);
        }),
        finalize(() => { this.confirmationEnCours = false; this.cdr.markForCheck(); })
      ).subscribe(paiement => {
        if (!paiement || !this.page) return;
        this.page = {
          ...this.page,
          content: this.page.content.map(p => p.id === id ? paiement : p),
        };
        this.fermerConfirmation();
      })
    );
  }
}
