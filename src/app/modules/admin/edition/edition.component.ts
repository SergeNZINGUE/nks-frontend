import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Subscription, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Edition, StatutEdition } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

/** dateFin doit être >= dateDebut (comparaison lexicographique valide sur yyyy-MM-dd). */
function periodeValide(cleDebut: string, cleFin: string) {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const debut = groupe.get(cleDebut)?.value;
    const fin = groupe.get(cleFin)?.value;
    if (!debut || !fin) return null;
    return fin >= debut ? null : { periodeInvalide: true };
  };
}

const STATUTS: { val: StatutEdition; label: string }[] = [
  { val: 'EN_PREPARATION', label: 'En préparation' },
  { val: 'EN_COURS',       label: 'En cours' },
  { val: 'TERMINEE',       label: 'Terminée' },
  { val: 'ARCHIVEE',       label: 'Archivée' },
];

@Component({
  selector: 'app-edition',
  imports: [DatePipe, ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Éditions</h1>
      <p class="page-header__subtitle">Créer, modifier et clôturer les éditions de la compétition.</p>
    </div>
    <button type="button" class="btn btn--primary" (click)="ouvrirCreation()">+ Nouvelle édition</button>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement des éditions">
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
        <h2 class="card__title">{{ editionEnEdition ? 'Modifier « ' + editionEnEdition.nom + ' »' : 'Nouvelle édition' }}</h2>

        <form [formGroup]="form" (ngSubmit)="enregistrer()" class="form">
          <div class="form__row">
            <div class="field">
              <label for="nom">Nom</label>
              <input id="nom" type="text" formControlName="nom" placeholder="NKS 2027" maxlength="100" />
            </div>
            <div class="field field--sm">
              <label for="annee">Année</label>
              <input id="annee" type="number" formControlName="annee" />
            </div>
            <div class="field field--sm">
              <label for="statut">Statut</label>
              <select id="statut" formControlName="statut">
                @for (s of statuts; track s.val) {
                  <option [value]="s.val">{{ s.label }}</option>
                }
              </select>
            </div>
          </div>

          <fieldset class="fieldset">
            <legend>Fenêtre d'inscription</legend>
            <div class="form__row">
              <div class="field">
                <label for="dateDebutInscriptions">Début</label>
                <input id="dateDebutInscriptions" type="date" formControlName="dateDebutInscriptions" />
              </div>
              <div class="field">
                <label for="dateFinInscriptions">Fin</label>
                <input id="dateFinInscriptions" type="date" formControlName="dateFinInscriptions" />
              </div>
            </div>
            @if (form.hasError('periodeInscriptionInvalide')) {
              <div class="field-error">La date de fin d'inscription doit être postérieure ou égale à la date de début.</div>
            }
          </fieldset>

          <fieldset class="fieldset">
            <legend>Fenêtre de compétition</legend>
            <div class="form__row">
              <div class="field">
                <label for="dateDebutCompetition">Début</label>
                <input id="dateDebutCompetition" type="date" formControlName="dateDebutCompetition" />
              </div>
              <div class="field">
                <label for="dateFinCompetition">Fin</label>
                <input id="dateFinCompetition" type="date" formControlName="dateFinCompetition" />
              </div>
            </div>
            @if (form.hasError('periodeCompetitionInvalide')) {
              <div class="field-error">La date de fin de compétition doit être postérieure ou égale à la date de début.</div>
            }
          </fieldset>

          <div class="field">
            <label for="description">Description (optionnel)</label>
            <textarea id="description" formControlName="description" rows="2" maxlength="500"></textarea>
          </div>

          @if (erreurEnvoi) {
            <div class="field-error" role="alert">⚠️ {{ erreurEnvoi }}</div>
          }
          @if (succes) {
            <div class="field-success" role="status">✔ Édition enregistrée.</div>
          }

          <div class="form__actions">
            <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving">
              {{ saving ? 'Enregistrement…' : (editionEnEdition ? 'Enregistrer' : 'Créer') }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="fermerFormulaire()">Annuler</button>
          </div>
        </form>
      </div>
    }

    <!-- ── Liste des éditions ─────────────────────────────────────────────── -->
    <div class="card">
      <h2 class="card__title">Toutes les éditions</h2>

      @if (editions.length === 0) {
        <div class="empty">Aucune édition créée.</div>
      }

      @if (editions.length > 0) {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Année</th>
                <th>Statut</th>
                <th>Inscriptions</th>
                <th>Compétition</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (e of editions; track e.id) {
                <tr>
                  <td class="table__strong">{{ e.nom }}</td>
                  <td>{{ e.annee }}</td>
                  <td><span class="badge" [class]="'badge--' + e.statut">{{ labelStatut(e.statut) }}</span></td>
                  <td class="table__muted">{{ e.dateDebutInscriptions | date:'dd/MM/yy' }} → {{ e.dateFinInscriptions | date:'dd/MM/yy' }}</td>
                  <td class="table__muted">{{ e.dateDebutCompetition | date:'dd/MM/yy' }} → {{ e.dateFinCompetition | date:'dd/MM/yy' }}</td>
                  <td>
                    <button type="button" class="btn btn--sm" (click)="ouvrirEdition(e)">Éditer</button>
                    @if (e.statut !== 'TERMINEE' && e.statut !== 'ARCHIVEE') {
                      <button type="button" class="btn btn--sm btn--err" [disabled]="clotureEnCours === e.id" (click)="editionACloturer = e">
                        {{ clotureEnCours === e.id ? '…' : 'Clôturer' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  }

  @if (editionACloturer; as e) {
    <app-confirm-dialog
      titre="Clôturer l'édition"
      [message]="'Clôturer l\\'édition « ' + e.nom + ' » ? Cette action passe son statut à TERMINEE.'"
      libelleConfirmer="Clôturer"
      [danger]="true"
      [enCours]="clotureEnCours === e.id"
      [erreur]="erreurCloture"
      (confirmed)="cloturer(e)"
      (cancelled)="editionACloturer = null; erreurCloture = null" />
  }
</div>
`,
  styleUrls: ['./edition.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class EditionComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  editions: Edition[] = [];
  statuts = STATUTS;

  editionEnEdition: Edition | null = null;
  form: ReturnType<typeof this.creerForm> | null = null;

  saving = false;
  erreurEnvoi: string | null = null;
  succes = false;
  clotureEnCours: string | null = null;
  editionACloturer: Edition | null = null;
  erreurCloture: string | null = null;

  private sub = new Subscription();

  ngOnInit(): void { this.chargerEditions(); }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  private chargerEditions(): void {
    this.isLoading = true;
    this.sub.add(
      this.adminSvc.editions().pipe(catchError(() => of(null))).subscribe(editions => {
        this.isLoading = false;
        if (!editions) {
          this.erreurChargement = 'Erreur de chargement (backend hors ligne ?)';
          return;
        }
        this.editions = editions.sort((a, b) => b.annee - a.annee);
      })
    );
  }

  private creerForm(valeurs?: Partial<Edition>) {
    return this.fb.nonNullable.group(
      {
        nom: [valeurs?.nom ?? '', [Validators.required, Validators.maxLength(100)]],
        annee: [valeurs?.annee ?? new Date().getFullYear(), [Validators.required, Validators.min(2020)]],
        statut: [(valeurs?.statut ?? 'EN_PREPARATION') as StatutEdition, Validators.required],
        dateDebutInscriptions: [valeurs?.dateDebutInscriptions ?? '', Validators.required],
        dateFinInscriptions: [valeurs?.dateFinInscriptions ?? '', Validators.required],
        dateDebutCompetition: [valeurs?.dateDebutCompetition ?? '', Validators.required],
        dateFinCompetition: [valeurs?.dateFinCompetition ?? '', Validators.required],
        description: [valeurs?.description ?? '', Validators.maxLength(500)],
      },
      {
        validators: [
          periodeValide('dateDebutInscriptions', 'dateFinInscriptions'),
          periodeValide('dateDebutCompetition', 'dateFinCompetition'),
        ],
      }
    );
  }

  ouvrirCreation(): void {
    this.editionEnEdition = null;
    this.form = this.creerForm();
    this.erreurEnvoi = null;
    this.succes = false;
  }

  ouvrirEdition(e: Edition): void {
    this.editionEnEdition = e;
    this.form = this.creerForm(e);
    this.erreurEnvoi = null;
    this.succes = false;
  }

  fermerFormulaire(): void {
    this.form = null;
    this.editionEnEdition = null;
  }

  labelStatut(s: StatutEdition): string {
    return this.statuts.find(x => x.val === s)?.label ?? s;
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

    const requete$ = this.editionEnEdition
      ? this.adminSvc.mettreAJourEdition(this.editionEnEdition.id, { ...this.editionEnEdition, ...valeurs })
      : this.adminSvc.creerEdition(valeurs);

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
        this.chargerEditions();
        this.fermerFormulaire();
      })
    );
  }

  /** Raccourci liste : clôture rapide (statut → TERMINEE) sans ouvrir le formulaire complet. */
  cloturer(e: Edition): void {
    this.erreurCloture = null;
    this.clotureEnCours = e.id;
    this.sub.add(
      this.adminSvc.mettreAJourEdition(e.id, { ...e, statut: 'TERMINEE' })
        .pipe(catchError(err => { this.erreurCloture = messageErreur(err, 'Échec de la clôture.'); return of(null); }))
        .subscribe(resultat => {
          this.clotureEnCours = null;
          if (!resultat) return;
          this.editionACloturer = null;
          this.chargerEditions();
        })
    );
  }
}
