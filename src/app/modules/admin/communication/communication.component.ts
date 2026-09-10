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
        <p class="page-header__subtitle">Envoyer un message aux candidats de l'édition en cours, filtrés par statut. WhatsApp et e-mail sont prioritaires — le SMS reste disponible mais doit être sélectionné explicitement (coût par message).</p>
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
        <!-- Message : libre pour WhatsApp/e-mail, plafonné à 160 caractères uniquement si SMS est coché
             (même règle que CommunicationService.envoyerGroupe côté backend : la limite ne s'applique
             que si canalSms est vrai — on ne bride donc plus un message e-mail seul à 160 caractères). -->
        <div class="form-group">
          <label>Message *</label>
          <textarea formControlName="message" rows="5"
            placeholder="Contenu du message…"
          [class.input--err]="(form.get('message')?.invalid || smsTropLong) && form.get('message')?.touched"></textarea>
          <div class="field-hint">
            @if (form.get('message')?.hasError('required') && form.get('message')?.touched) {
              <span class="hint-err">Message requis (5 caractères minimum).</span>
            } @else if (smsTropLong) {
              <span class="hint-err">Le SMS est limité à 160 caractères — décoche SMS ou raccourcis le message.</span>
            }
            @if (form.get('canalSms')?.value) {
              <span class="char-count" [class.char-over]="smsTropLong">
                {{ form.get('message')?.value?.length ?? 0 }}/160 (SMS)
              </span>
            }
          </div>
        </div>
        <!-- Sujet e-mail (optionnel) -->
        <div class="form-group">
          <label>Sujet e-mail <small>(optionnel, ignoré si SMS uniquement)</small></label>
          <input formControlName="sujetEmail" placeholder="Ex: Résultats de la présélection NKS 2026" maxlength="150" />
        </div>
        <!-- Canaux — WhatsApp et e-mail en priorité, SMS en dernier (coût, opt-in explicite).
             WhatsApp désactivé : CommunicationRequest/CommunicationService (backend) n'exposent pas
             encore canalWhatsapp — l'infra existe (WhatsappGateway, POST /whatsapp/envoyer) mais pas
             en envoi groupé. Cf. NKS_WHATSAPP_TEMPLATES.md / NKS_SMS_PROXY_INTEGRATION.md (racine du
             projet) pour l'intégration côté backend — hors périmètre frontend, à la charge du dev backend. -->
        <div class="form-group">
          <label>Canaux d'envoi *</label>
          <div class="canal-group" role="group" aria-label="Canaux d'envoi">
            <label class="canal-btn canal-btn--disabled" title="Bientôt disponible — nécessite une mise à jour backend (canalWhatsapp)">
              <input type="checkbox" formControlName="canalWhatsapp" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0zm0 0c0 2 1.5 4.5 5 5.5m0 0h1a.5.5 0 0 0 0-1h-.5a.5.5 0 0 0-.5.5"/></svg>
              WhatsApp
              <span class="canal-btn__tag">Bientôt</span>
            </label>
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalEmail')?.value">
              <input type="checkbox" formControlName="canalEmail" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              E-mail
            </label>
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalSms')?.value">
              <input type="checkbox" formControlName="canalSms" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              SMS
            </label>
          </div>
          @if (canauxVides && form.touched) {
            <span class="hint-err">
              Sélectionner au moins un canal.
            </span>
          }
        </div>
        <button type="submit" class="btn btn--primary" [disabled]="isSending || canauxVides || smsTropLong">
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
      filtreStatut:  [''],              // '' = null (tous)
      // Max 160 retiré : cette limite ne s'applique qu'au SMS (cf. smsTropLong),
      // pas à un message WhatsApp/e-mail — même règle que le backend (CommunicationService).
      message:       ['', [Validators.required, Validators.minLength(5)]],
      sujetEmail:    ['', Validators.maxLength(150)],
      // WhatsApp prioritaire mais désactivé (pas encore supporté par l'envoi groupé
      // backend) — Email coché par défaut, SMS décoché (opt-in explicite, coût par message).
      canalWhatsapp: [{ value: false, disabled: true }],
      canalEmail:    [true],
      canalSms:      [false],
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

  get smsTropLong(): boolean {
    return !!this.form.get('canalSms')?.value && (this.form.get('message')?.value?.length ?? 0) > 160;
  }

  envoyer(): void {
    this.succes = false;
    this.erreur = null;
    this.form.markAllAsTouched();

    if (this.form.invalid || this.canauxVides || this.smsTropLong || !this.edition) return;

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
            canalEmail:   true,
            canalSms:     false,
          });
        }
      })
    );
  }
}
