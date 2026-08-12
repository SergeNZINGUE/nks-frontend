import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';

import { AdminService, CommunicationRequest } from '@core/services/admin.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { Edition } from '@core/models';

/** Valeurs de StatutProfilCandidat utilisables comme filtre */
const FILTRES_STATUT = [
  { val: null,        lbl: '👥 Tous les candidats' },
  { val: 'EN_ATTENTE',lbl: '⏳ En attente' },
  { val: 'ACTIF',     lbl: '✅ Actifs' },
  { val: 'SUSPENDU',  lbl: '⛔ Suspendus' },
  { val: 'ELIMINE',   lbl: '❌ Éliminés' },
  { val: 'FINALISTE', lbl: '🏆 Finalistes' },
  { val: 'GAGNANT',   lbl: '👑 Gagnants' },
] as const;

@Component({
  selector: 'app-communication',
  imports: [RouterModule, ReactiveFormsModule, TopbarComponent],
  template: `
<div class="page">

  <app-topbar title="Communication" icon="📢" backLink="/admin" backLabel="Retour à l'administration" />

  <div class="content">

    @if (chargementEdition) {
      <div class="loading">Chargement de l'édition…</div>
    }
    @if (!chargementEdition && !edition) {
      <div class="banner banner--err" role="alert">
        ⚠️ Aucune édition EN_COURS — impossible d'envoyer une communication.
      </div>
    }

    @if (edition) {
      <div class="edition-tag">Édition : <strong>{{ edition.nom }}</strong></div>
      @if (succes) {
        <div class="banner banner--ok" role="status">✅ Communication envoyée avec succès.</div>
      }
      @if (erreur) {
        <div class="banner banner--err" role="alert">⚠️ {{ erreur }}</div>
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
          <input formControlName="sujetEmail" placeholder="Ex: Résultats de la présélection NKS 2026" />
        </div>
        <!-- Canaux -->
        <div class="form-group">
          <label>Canaux d'envoi *</label>
          <div class="canal-group" role="group" aria-label="Canaux d'envoi">
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalSms')?.value">
              <input type="checkbox" formControlName="canalSms" hidden />
              📱 SMS
            </label>
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalEmail')?.value">
              <input type="checkbox" formControlName="canalEmail" hidden />
              📧 E-mail
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
            <span>📤 Envoyer</span>
          }
          @if (isSending) {
            <span>⏳ Envoi…</span>
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
      sujetEmail:   [''],
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
          this.erreur = err?.error?.message ?? 'Erreur lors de l\'envoi.';
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
