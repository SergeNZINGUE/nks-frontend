import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';

import { AdminService, CommunicationRequest } from '@core/services/admin.service';
import { Edition } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const FILTRES_STATUT = [
  { val: null,           lbl: 'Tous les candidats' },
  { val: 'EN_ATTENTE',   lbl: 'En attente' },
  { val: 'ACTIF',        lbl: 'Actifs' },
  { val: 'SUSPENDU',     lbl: 'Suspendus' },
  { val: 'ELIMINE',      lbl: 'Éliminés' },
  { val: 'FINALISTE',    lbl: 'Finalistes' },
  { val: 'GAGNANT',      lbl: 'Gagnants' },
  { val: 'PARTENAIRES',  lbl: 'Partenaires (contacts actifs)' },
] as const;

interface TemplateVar { label: string; placeholder: string; multiline?: boolean; }
interface WhatsappTemplate { key: string; label: string; desc: string; vars: TemplateVar[]; }

const WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    key: 'karaoke_info',
    label: 'Communication libre ⭐',
    desc: 'Votre texte est encadré dans un message NKS standard. À utiliser pour toute communication courante.',
    vars: [
      { label: 'Message WhatsApp', placeholder: 'Ex: La demi-finale se tiendra le samedi 14 septembre à 20h00 à La Terrasse. Présentez-vous 30 minutes avant.', multiline: true },
    ],
  },
  {
    key: 'karaoke_accepted',
    label: 'Candidature retenue',
    desc: 'Message entièrement fixe — annonce l\'acceptation et les frais d\'inscription (15 000 FCFA). Aucune variable à remplir.',
    vars: [],
  },
  {
    key: 'karaoke_rejected',
    label: 'Candidature non retenue',
    desc: 'Annonce le refus avec un motif personnalisé.',
    vars: [
      { label: 'Motif du refus', placeholder: 'Ex: Votre vidéo ne respecte pas les règles — vous devez chanter vous-même.', multiline: true },
    ],
  },
  {
    key: 'karaoke_results',
    label: 'Résultats — N candidats',
    desc: 'Résultats d\'une manche pour tout nombre de candidats. Le classement tient sur une seule ligne.',
    vars: [
      { label: 'La manche',                          placeholder: 'Ex: 6e manche' },
      { label: 'La phase',                           placeholder: 'Ex: éliminatoires' },
      { label: 'Nombre de candidats',                placeholder: 'Ex: 04' },
      { label: 'Liste des candidats',                placeholder: 'Ex: k05 , k65 et k135' },
      { label: 'Classement complet (séparés par ·)', placeholder: 'Ex: K135 est 1er avec 250 points · K65 est 2ème avec 246 points · K05 est 3ème avec 181 points.', multiline: true },
      { label: 'Les qualifiés',                      placeholder: 'Ex: k135 et k65' },
    ],
  },
  {
    key: 'karaoke_results_3c',
    label: 'Résultats — exactement 3 candidats',
    desc: 'Podium sur 3 lignes distinctes. Uniquement pour les manches à 3 candidats.',
    vars: [
      { label: 'La manche',            placeholder: 'Ex: 6e manche' },
      { label: 'La phase',             placeholder: 'Ex: éliminatoires' },
      { label: 'Nombre de candidats',  placeholder: '03' },
      { label: 'Liste des candidats',  placeholder: 'Ex: k05 , k65 et k135' },
      { label: '1er — code candidat',  placeholder: 'Ex: K135' },
      { label: '1er — points',         placeholder: 'Ex: 250' },
      { label: '2ème — code candidat', placeholder: 'Ex: K65' },
      { label: '2ème — points',        placeholder: 'Ex: 246' },
      { label: '3ème — code candidat', placeholder: 'Ex: K05' },
      { label: '3ème — points',        placeholder: 'Ex: 181' },
      { label: 'Les qualifiés',        placeholder: 'Ex: k135 et k65' },
    ],
  },
];

@Component({
  selector: 'app-communication',
  imports: [RouterModule, ReactiveFormsModule],
  template: `
<div class="page">

  <div class="content">

    <div class="page-header">
      <div>
        <h1 class="page-header__title">Communication</h1>
        <p class="page-header__subtitle">Envoyer un message aux candidats de l'édition en cours, filtrés par statut. WhatsApp utilise des templates Meta pré-approuvés — SMS et e-mail acceptent du texte libre.</p>
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

        <!-- Canaux -->
        <div class="form-group">
          <label>Canaux d'envoi *</label>
          <div class="canal-group" role="group" aria-label="Canaux d'envoi">
            <label class="canal-btn" [class.canal-btn--on]="form.get('canalWhatsapp')?.value">
              <input type="checkbox" formControlName="canalWhatsapp" hidden />
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0zm0 0c0 2 1.5 4.5 5 5.5m0 0h1a.5.5 0 0 0 0-1h-.5a.5.5 0 0 0-.5.5"/></svg>
              WhatsApp
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
            <span class="hint-err">Sélectionner au moins un canal.</span>
          }
        </div>

        <!-- Section WhatsApp — template + variables -->
        @if (form.get('canalWhatsapp')?.value) {
          <div class="form-group">
            <label>Template WhatsApp *</label>
            <select formControlName="templateWhatsapp" class="select" (change)="onTemplateChange()">
              @for (tpl of whatsappTemplates; track tpl.key) {
                <option [value]="tpl.key">{{ tpl.label }}</option>
              }
            </select>
            <span class="field-hint">{{ templateActuel.desc }}</span>
          </div>
          @if (templateActuel.vars.length > 0) {
            <div formArrayName="variablesWhatsapp">
              @for (v of templateActuel.vars; track $index) {
                <div class="form-group">
                  <label>{{ v.label }} *</label>
                  @if (v.multiline) {
                    <textarea [formControlName]="$index" [placeholder]="v.placeholder" rows="3"
                      [class.input--err]="variablesWA.at($index)?.invalid && variablesWA.at($index)?.touched">
                    </textarea>
                  } @else {
                    <input [formControlName]="$index" [placeholder]="v.placeholder"
                      [class.input--err]="variablesWA.at($index)?.invalid && variablesWA.at($index)?.touched" />
                  }
                  @if (variablesWA.at($index)?.hasError('required') && variablesWA.at($index)?.touched) {
                    <span class="hint-err">Ce champ est requis.</span>
                  }
                </div>
              }
            </div>
          }
        }

        <!-- Message SMS / e-mail -->
        @if (form.get('canalSms')?.value || form.get('canalEmail')?.value) {
          <div class="form-group">
            <label>Message SMS / e-mail *</label>
            <textarea formControlName="message" rows="5"
              placeholder="Contenu du message…"
              [class.input--err]="(form.get('message')?.invalid || smsTropLong) && form.get('message')?.touched">
            </textarea>
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
          <!-- Sujet e-mail -->
          @if (form.get('canalEmail')?.value) {
            <div class="form-group">
              <label>Sujet e-mail <small>(optionnel)</small></label>
              <input formControlName="sujetEmail" placeholder="Ex: Résultats de la présélection NKS 2026" maxlength="150" />
            </div>
          }
        }

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
  whatsappTemplates = WHATSAPP_TEMPLATES;

  private sub = new Subscription();

  get variablesWA(): FormArray {
    return this.form.get('variablesWhatsapp') as FormArray;
  }

  get templateActuel(): WhatsappTemplate {
    const key = this.form.get('templateWhatsapp')?.value ?? 'karaoke_info';
    return WHATSAPP_TEMPLATES.find(t => t.key === key) ?? WHATSAPP_TEMPLATES[0];
  }

  get canauxVides(): boolean {
    return !this.form.get('canalSms')?.value
        && !this.form.get('canalEmail')?.value
        && !this.form.get('canalWhatsapp')?.value;
  }

  get smsTropLong(): boolean {
    return !!this.form.get('canalSms')?.value && (this.form.get('message')?.value?.length ?? 0) > 160;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      filtreStatut:      [''],
      message:           ['', [Validators.required, Validators.minLength(5)]],
      sujetEmail:        ['', Validators.maxLength(150)],
      canalWhatsapp:     [false],
      canalEmail:        [true],
      canalSms:          [false],
      templateWhatsapp:  ['karaoke_info'],
      variablesWhatsapp: this.fb.array([this.fb.control('', Validators.required)]),
    });

    // Disable FormArray quand WhatsApp n'est pas sélectionné (exclu de form.invalid)
    this.variablesWA.disable();

    this.sub.add(
      this.form.get('canalWhatsapp')!.valueChanges.subscribe((checked: boolean) => {
        if (checked) {
          this.variablesWA.enable();
          this.onTemplateChange();
        } else {
          this.variablesWA.disable();
        }
      })
    );

    this.sub.add(
      this.adminSvc.editions().pipe(catchError(() => of([]))).subscribe(editions => {
        this.chargementEdition = false;
        this.edition = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  onTemplateChange(): void {
    const fa = this.variablesWA;
    fa.clear();
    this.templateActuel.vars.forEach(() =>
      fa.push(this.fb.control('', Validators.required))
    );
  }

  envoyer(): void {
    this.succes = false;
    this.erreur = null;
    this.form.markAllAsTouched();
    this.variablesWA.markAllAsTouched();

    const canalWhatsapp = !!this.form.get('canalWhatsapp')?.value;
    const canalSmsOuEmail = !!this.form.get('canalSms')?.value || !!this.form.get('canalEmail')?.value;

    // Message requis seulement si SMS ou e-mail est coché
    if (canalSmsOuEmail && this.form.get('message')?.invalid) return;
    if (this.canauxVides || this.smsTropLong || !this.edition) return;
    if (canalWhatsapp && this.variablesWA.invalid) return;

    const val = this.form.value;
    const ciblePartenaires = val.filtreStatut === 'PARTENAIRES';
    const waVars = canalWhatsapp && this.templateActuel.vars.length > 0
      ? this.variablesWA.controls.map(c => (c.value ?? '').trim())
      : null;

    const req: CommunicationRequest = {
      editionId:          this.edition.id,
      filtreStatut:       ciblePartenaires ? null : (val.filtreStatut || null),
      ciblePartenaires,
      canalSms:           val.canalSms,
      canalEmail:         val.canalEmail,
      canalWhatsapp:      val.canalWhatsapp,
      message:            val.message || '',
      sujetEmail:         val.sujetEmail || null,
      templateWhatsapp:   canalWhatsapp ? (val.templateWhatsapp || 'karaoke_info') : null,
      variablesWhatsapp:  waVars,
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
          const fa = this.variablesWA;
          fa.clear();
          fa.push(this.fb.control('', Validators.required));
          fa.disable();
          this.form.reset({
            filtreStatut:     '',
            message:          '',
            sujetEmail:       '',
            canalEmail:       true,
            canalSms:         false,
            canalWhatsapp:    false,
            templateWhatsapp: 'karaoke_info',
          });
        }
      })
    );
  }
}