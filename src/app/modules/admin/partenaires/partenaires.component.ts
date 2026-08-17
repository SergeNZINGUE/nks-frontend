import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { PartenaireService } from '@core/services/partenaire.service';
import { MediaService } from '@core/services/media.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Partenaire, NiveauPartenariat } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const REGEX_TELEPHONE = /^\+?[0-9]{8,15}$/;

const NIVEAUX: { val: NiveauPartenariat; label: string }[] = [
  { val: 'TITRE',      label: 'Titre (principal)' },
  { val: 'OR',         label: 'Or' },
  { val: 'ARGENT',     label: 'Argent' },
  { val: 'PARTENAIRE', label: 'Partenaire' },
];

type EtatUpload = 'idle' | 'uploading' | 'done' | 'error';

@Component({
  selector: 'app-partenaires',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Partenaires</h1>
      <p class="page-header__subtitle">Créer, modifier et désactiver les partenaires/sponsors affichés publiquement.</p>
    </div>
    @if (!form) {
      <button type="button" class="btn btn--primary" (click)="ouvrirCreation()">+ Nouveau partenaire</button>
    }
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement des partenaires">
      <div class="sk" aria-hidden="true"></div>
    </div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="banner banner--err" role="alert">⚠️ {{ erreurChargement }}</div>
  }

  @if (!isLoading && !erreurChargement) {

    <!-- ── Formulaire création / édition ─────────────────────────────────── -->
    @if (form) {
      <div class="card card--form">
        <h2 class="card__title">{{ partenaireEnEdition ? 'Modifier « ' + partenaireEnEdition.nom + ' »' : 'Nouveau partenaire' }}</h2>

        <form [formGroup]="form" (ngSubmit)="enregistrer()" class="form">
          <div class="form__row">
            <div class="field">
              <label for="nom">Nom</label>
              <input id="nom" type="text" formControlName="nom" placeholder="Orange Burkina" maxlength="150" />
            </div>
            <div class="field field--sm">
              <label for="niveau">Niveau</label>
              <select id="niveau" formControlName="niveauPartenariat">
                <option [value]="null">—</option>
                @for (n of niveaux; track n.val) {
                  <option [value]="n.val">{{ n.label }}</option>
                }
              </select>
            </div>
          </div>

          <div class="field">
            <label for="logo">Logo</label>
            <div class="logo-upload">
              @if (form.value.logoUrl) {
                <img [src]="form.value.logoUrl" alt="" class="logo-upload__preview" />
              }
              <input id="logo" type="file" accept="image/png,image/jpeg" (change)="onLogoChange($event)" />
            </div>
            @if (etatUpload === 'uploading') { <div class="field-hint">Envoi en cours…</div> }
            @if (etatUpload === 'error') { <div class="field-error">Échec de l'envoi du logo. Réessaie.</div> }
            <input type="text" formControlName="logoUrl" placeholder="…ou colle directement une URL de logo" class="logo-url-fallback" />
          </div>

          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" formControlName="description" rows="2" maxlength="500"></textarea>
          </div>

          <div class="field">
            <label for="siteWebUrl">Site web</label>
            <input id="siteWebUrl" type="text" formControlName="siteWebUrl" placeholder="https://…" maxlength="255" />
          </div>

          <fieldset class="fieldset">
            <legend>Contact</legend>
            <div class="form__row">
              <div class="field">
                <label for="contactNom">Nom du contact</label>
                <input id="contactNom" type="text" formControlName="contactNom" maxlength="150" />
              </div>
              <div class="field">
                <label for="contactEmail">E-mail</label>
                <input id="contactEmail" type="email" formControlName="contactEmail" maxlength="255" />
              </div>
              <div class="field">
                <label for="contactTelephone">Téléphone</label>
                <input id="contactTelephone" type="tel" formControlName="contactTelephone" maxlength="15" />
                @if (form!.controls.contactTelephone.invalid && form!.controls.contactTelephone.touched) {
                  <div class="field-error">Format invalide (8 à 15 chiffres, + optionnel).</div>
                }
              </div>
            </div>
          </fieldset>

          @if (erreurEnvoi) {
            <div class="field-error" role="alert">⚠️ {{ erreurEnvoi }}</div>
          }
          @if (succes) {
            <div class="field-success" role="status">✔ Partenaire enregistré.</div>
          }

          <div class="form__actions">
            <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving">
              {{ saving ? 'Enregistrement…' : (partenaireEnEdition ? 'Enregistrer' : 'Créer') }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="fermerFormulaire()">Annuler</button>
          </div>
        </form>
      </div>
    }

    <!-- ── Liste des partenaires actifs ──────────────────────────────────── -->
    <div class="card">
      <h2 class="card__title">Partenaires actifs</h2>
      <p class="card__hint">
        Les partenaires désactivés n'apparaissent plus ici (le backend ne liste que les partenaires actifs) —
        aucun endpoint ne permet à ce jour de les réactiver depuis l'admin.
      </p>

      @if (partenaires.length === 0) {
        <div class="empty">Aucun partenaire actif.</div>
      }

      @if (partenaires.length > 0) {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th></th>
                <th>Nom</th>
                <th>Niveau</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of partenaires; track p.id) {
                <tr>
                  <td>
                    @if (p.logoUrl) { <img [src]="p.logoUrl" alt="" class="table__logo" /> }
                  </td>
                  <td class="table__strong">{{ p.nom }}</td>
                  <td>
                    @if (p.niveauPartenariat) {
                      <span class="badge" [class]="'badge--' + p.niveauPartenariat">{{ p.niveauPartenariat }}</span>
                    }
                  </td>
                  <td class="table__muted">{{ p.contactNom || '—' }}</td>
                  <td>
                    <button type="button" class="btn btn--sm" (click)="ouvrirEdition(p)">Éditer</button>
                    <button type="button" class="btn btn--sm btn--err" [disabled]="desactivationEnCours === p.id" (click)="partenaireADesactiver = p">
                      {{ desactivationEnCours === p.id ? '…' : 'Désactiver' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  }

  @if (partenaireADesactiver; as p) {
    <app-confirm-dialog
      titre="Désactiver le partenaire"
      [message]="'Désactiver « ' + p.nom + ' » ? Il disparaîtra de la page publique Partenaires (aucune réactivation possible depuis l\\'admin à ce jour).'"
      libelleConfirmer="Désactiver"
      [danger]="true"
      [enCours]="desactivationEnCours === p.id"
      [erreur]="erreurDesactivation"
      (confirmed)="desactiver(p)"
      (cancelled)="partenaireADesactiver = null; erreurDesactivation = null" />
  }
</div>
`,
  styleUrls: ['./partenaires.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PartenairesComponent implements OnInit, OnDestroy {
  private partenaireSvc = inject(PartenaireService);
  private mediaSvc = inject(MediaService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  partenaires: Partenaire[] = [];
  niveaux = NIVEAUX;

  partenaireEnEdition: Partenaire | null = null;
  form: ReturnType<typeof this.creerForm> | null = null;

  etatUpload: EtatUpload = 'idle';
  saving = false;
  erreurEnvoi: string | null = null;
  succes = false;
  desactivationEnCours: string | null = null;
  partenaireADesactiver: Partenaire | null = null;
  erreurDesactivation: string | null = null;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerPartenaires(); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  private chargerPartenaires(): void {
    this.isLoading = true;
    this.sub.add(
      this.partenaireSvc.lister().pipe(catchError(() => of(null))).subscribe(partenaires => {
        this.isLoading = false;
        if (!partenaires) {
          this.erreurChargement = 'Erreur de chargement (backend hors ligne ?)';
          return;
        }
        this.partenaires = partenaires;
      })
    );
  }

  private creerForm(valeurs?: Partial<Partenaire>) {
    return this.fb.nonNullable.group({
      nom: [valeurs?.nom ?? '', [Validators.required, Validators.maxLength(150)]],
      niveauPartenariat: [(valeurs?.niveauPartenariat ?? null) as NiveauPartenariat | null],
      logoUrl: [valeurs?.logoUrl ?? ''],
      description: [valeurs?.description ?? '', Validators.maxLength(500)],
      siteWebUrl: [valeurs?.siteWebUrl ?? '', Validators.maxLength(255)],
      contactNom: [valeurs?.contactNom ?? '', Validators.maxLength(150)],
      contactEmail: [valeurs?.contactEmail ?? '', [Validators.email, Validators.maxLength(255)]],
      contactTelephone: [valeurs?.contactTelephone ?? '', Validators.pattern(REGEX_TELEPHONE)],
    });
  }

  ouvrirCreation(): void {
    this.partenaireEnEdition = null;
    this.form = this.creerForm();
    this.etatUpload = 'idle';
    this.erreurEnvoi = null;
    this.succes = false;
  }

  ouvrirEdition(p: Partenaire): void {
    this.partenaireEnEdition = p;
    this.form = this.creerForm(p);
    this.etatUpload = 'idle';
    this.erreurEnvoi = null;
    this.succes = false;
  }

  fermerFormulaire(): void {
    this.form = null;
    this.partenaireEnEdition = null;
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.form) return;

    this.etatUpload = 'uploading';
    this.sub.add(
      this.mediaSvc.uploadPhoto(file, 'LOGO_PARTENAIRE').subscribe({
        next: res => {
          this.etatUpload = 'done';
          this.form!.controls.logoUrl.setValue(res.url);
        },
        error: () => { this.etatUpload = 'error'; },
      })
    );
  }

  enregistrer(): void {
    if (!this.form || this.form.invalid) {
      this.form?.markAllAsTouched();
      return;
    }
    this.erreurEnvoi = null;
    this.succes = false;
    this.saving = true;
    const valeurs = this.form.getRawValue();
    const payload = {
      ...valeurs,
      logoUrl: valeurs.logoUrl || null,
      description: valeurs.description || null,
      siteWebUrl: valeurs.siteWebUrl || null,
      contactNom: valeurs.contactNom || null,
      contactEmail: valeurs.contactEmail || null,
      contactTelephone: valeurs.contactTelephone || null,
    };

    const requete$ = this.partenaireEnEdition
      ? this.partenaireSvc.mettreAJour(this.partenaireEnEdition.id, payload)
      : this.partenaireSvc.creer(payload);

    this.sub.add(
      requete$.pipe(
        catchError(() => of(null)),
        finalize(() => { this.saving = false; })
      ).subscribe(resultat => {
        if (!resultat) {
          this.erreurEnvoi = "Échec de l'enregistrement. Vérifie les champs et réessaie.";
          return;
        }
        this.succes = true;
        this.chargerPartenaires();
        this.fermerFormulaire();
      })
    );
  }

  desactiver(p: Partenaire): void {
    this.erreurDesactivation = null;
    this.desactivationEnCours = p.id;
    this.sub.add(
      this.partenaireSvc.desactiver(p.id).subscribe({
        next: () => {
          this.desactivationEnCours = null;
          this.partenaireADesactiver = null;
          this.chargerPartenaires();
        },
        error: err => {
          this.desactivationEnCours = null;
          this.erreurDesactivation = messageErreur(err, 'Échec de la désactivation.');
        },
      })
    );
  }
}
