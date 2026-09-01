import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';

import { AdminService, CommunicationRequest } from '@core/services/admin.service';
import { Edition } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

/** Valeurs de StatutProfilCandidat utilisables comme filtre */
const FILTRES_STATUT = [
  { val: null,        lbl: 'Tous les candidats' },
  { val: 'EN_ATTENTE',lbl: 'En attente' },
  { val: 'ACTIF',     lbl: 'Actifs' },
  { val: 'SUSPENDU',  lbl: 'Suspendus' },
  { val: 'ELIMINE',   lbl: 'Éliminés' },
  { val: 'FINALISTE', lbl: 'Finalistes' },
  { val: 'GAGNANT',   lbl: 'Gagnants' },
] as const;

@Component({
  selector: 'app-communication',
  imports: [RouterModule, ReactiveFormsModule],
  template: `
<div class="page">

  <div class="content">

    <div class="page-header">
      <div>
        <h1 class="page-header__title">Communication</h1>
        <p class="page-header__subtitle">Envoyer un SMS et/ou un e-mail aux candidats de l'édition en cours, filtrés par statut.</p>
      </div>
    </div>


    @if (chargementEdition) {
      <div class="loading">Chargement de l'édition…</div>
    }
    @if (!chargementEdition && !edition) {
      <div class="banner banner--err" role="alert">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        Aucune édition EN_COURS — impossible d'envoyer une communication.
      </div>
    }

    @if (edition) {
      <div class="edition-tag">Édition : <strong>{{ edition.nom }}</strong></div>
      @if (succes) {
        <div class="banner banner--ok" role="status">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Communication envoyée avec succès.
        </div>
      }
      @if (erreur) {
        <div class="banner banner--err" role="alert">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreur }}
        </div>
      }
      <form [formGroup]="form" (ngSubmit)="envoyer()" class="notif-form">
        <!-- Filtre destinataires -->
        <div class="form-group">
          <label>Destinataires</label>
          <select formControlName="filtreStatut" class="select">
            @for (f of filtresStatut; track f) {
              <option [value]="f.val ?? ''">{{ f.lbl }}</option>
            }
          </select>
        </div>
        <!-- Message (SMS ≤ 160 chars) -->
        <div class="form-group">
          <label>Message SMS / corps e-mail *</label>
          <textarea formControlName="message" rows="5"
            placeholder="Contenu du message (160 caractères max pour SMS)…"
          [class.input--err]="form.get('message')?.invalid && form.get('message')?.touched"></textarea>
          <div class="field-hint">
            @if (form.get('message')?.invalid && form.get('message')?.touched) {
              <span class="hint-err">
                Message requis (min 5, max 160 caractères).
              </span>
            }
            <span class="char-count" [class.char-over]="(form.get('message')?.value?.length ?? 0) > 160">
              {{ form.get('message')?.value?.length ?? 0 }}/160
            </span>
          </div>
        </div>
        <!-- Sujet e-mail (optionnel) -->
        <div class="form-group">
          <label>Sujet e-mail <small>(optionnel, ignoré si SMS uniquement)</small></label>
          <input formControlName="sujetEmail" placeholder="Ex: Résultats de la présélection NKS 2026" maxlength="150" />
        </div>
        <!-- Canaux -->
        <div class="form-group">
          <label>Canaux d'envoi *</label>
          <div class="canal-group" role="group" aria-label="Canaux d'envoi">
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalSms')?.value">
              <input type="checkbox" formControlName="canalSms" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              SMS
            </label>
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalEmail')?.value">
              <input type="checkbox" formControlName="canalEmail" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              E-mail
            </label>
          </div>
          @if (canauxVides && form.touched) {
            <span class="hint-err">
              Sélectionner au moins un canal.
            </span>
          }
        </div>
        <button type="submit" class="btn btn--primary" [disabled]="isSending || canauxVides">
          @if (!isSending) {
            <span>
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
              Envoyer
            </span>
          }
          @if (isSending) {
            <span><span class="spinner spinner--inline"></span> Envoi…</span>
          }
        </button>
      </form>
    }
  </div>
</div>
`,
  styleUrls: ['./communication.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CommunicationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private adminSvc = inject(AdminService);

  form!: FormGroup;
  isSending = false;
  succes = false;
  erreur: string | null = null;
  edition: Edition | null = null;
  chargementEdition = true;
  filtresStatut = FILTRES_STATUT;

  private sub = new Subscription();

  ngOnInit(): void {
    this.form = this.fb.group({
      filtreStatut: [''],              // '' = null (tous)
      message:      ['', [Validators.required, Validators.minLength(5), Validators.maxLength(160)]],
      sujetEmail:   ['', Validators.maxLength(150)],
      canalSms:     [true],
      canalEmail:   [true],
    });

    // Charger l'édition EN_COURS pour récupérer l'editionId
    this.sub.add(
      this.adminSvc.editions().pipe(catchError(() => of([]))).subscribe(editions => {
        this.chargementEdition = false;
        this.edition = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get canauxVides(): boolean {
    return !this.form.get('canalSms')?.value && !this.form.get('canalEmail')?.value;
  }

  envoyer(): void {
    this.succes = false;
    this.erreur = null;
    this.form.markAllAsTouched();

    if (this.form.invalid || this.canauxVides || !this.edition) return;

    const val = this.form.value;
    const req: CommunicationRequest = {
      editionId:    this.edition.id,
      filtreStatut: val.filtreStatut || null,   // '' → null = tous
      canalSms:     val.canalSms,
      canalEmail:   val.canalEmail,
      message:      val.message,
      sujetEmail:   val.sujetEmail || null,
    };

    this.isSending = true;
    this.sub.add(
      this.adminSvc.envoyerCommunication(req).pipe(
        catchError(err => {
          this.erreur = messageErreur(err, 'Erreur lors de l\'envoi.');
          return of(null);
        })
      ).subscribe(res => {
        this.isSending = false;
        if (res !== null) {
          this.succes = true;
          this.form.reset({
            filtreStatut: '',
            message:      '',
            sujetEmail:   '',
            canalSms:     true,
            canalEmail:   true,
          });
        }
      })
    );
  }
}
