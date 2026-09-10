import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Phase, StatutPhase, NomPhase, Edition, StatutEdition } from '@core/models';

const NOMS_PHASE: { val: NomPhase; label: string }[] = [
  { val: 'PRESELECTION',  label: 'Présélection' },
  { val: 'ELIMINATOIRES', label: 'Éliminatoires' },
  { val: 'DEMI_FINALE',   label: 'Demi-finale' },
  { val: 'FINALE',        label: 'Finale' },
];

const STATUTS_EDITION: { val: StatutEdition; label: string }[] = [
  { val: 'EN_PREPARATION', label: 'En préparation' },
  { val: 'EN_COURS',       label: 'En cours' },
  { val: 'TERMINEE',       label: 'Terminée' },
  { val: 'ARCHIVEE',       label: 'Archivée' },
];

/** input[type=datetime-local] (yyyy-MM-ddTHH:mm, heure locale) ↔ Instant ISO (backend) */
function versDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function versInstant(local: string): string {
  return new Date(local).toISOString();
}

/** La somme des 3 pondérations doit faire exactement 100 (contrainte backend). */
function ponderationValide(groupe: AbstractControl): ValidationErrors | null {
  const v = groupe.value;
  const total = Number(v.poidsVotesEnLigne) + Number(v.poidsPublicSurPlace) + Number(v.poidsJury);
  return total === 100 ? null : { ponderationInvalide: true };
}

@Component({
  selector: 'app-phases',
  imports: [DatePipe, ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Phases</h1>
      <p class="page-header__subtitle">Créer, éditer, ouvrir/fermer les votes et clôturer les phases de l'édition en cours.</p>
    </div>
    @if (nomsDisponibles.length > 0 && !formCreation) {
      <button type="button" class="btn btn--primary" (click)="ouvrirCreation()">+ Nouvelle phase</button>
    }
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement des phases">
      @for (i of [1,2,3,4]; track i) {
        <div class="sk" aria-hidden="true"></div>
      }
    </div>
  }

  @if (!isLoading && erreur) {
    <div class="empty-state" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreur }}
    </div>
  }

  @if (!isLoading && !erreur) {

    @if (edition) {
      <div class="edition-info">
        Édition : <strong>{{ edition.nom }}</strong>
        <span class="badge" [class]="'badge--edition-' + edition.statut">{{ labelStatutEdition(edition.statut) }}</span>
      </div>
    }

    <!-- ── Création d'une phase ──────────────────────────────────────────── -->
    @if (formCreation) {
      <div class="card">
        <h2 class="card__title">Nouvelle phase</h2>
        <form [formGroup]="formCreation" (ngSubmit)="creer()" class="form">
          <div class="form__row">
            <div class="field">
              <label for="nomCreation">Phase</label>
              <select id="nomCreation" formControlName="nom">
                @for (n of nomsDisponibles; track n.val) {
                  <option [value]="n.val">{{ n.label }}</option>
                }
              </select>
            </div>
            @if (formCreation.get('nom')?.value !== 'PRESELECTION') {
              <div class="field field--sm">
                <label for="typePhaseCreation">Format</label>
                <select id="typePhaseCreation" formControlName="typePhase">
                  <option value="INDIVIDUEL">Individuel</option>
                  <option value="DUO">Duo</option>
                </select>
              </div>
            }
          </div>
          @if (formCreation.get('nom')?.value !== 'PRESELECTION') {
            <p class="field-hint">Le format n'est plus modifiable une fois la phase créée.</p>
          } @else {
            <p class="field-hint">La présélection est une phase de candidature (pas de vote jury, pas de notion individuel/duo).</p>
          }
          <div class="form__row">
            <div class="field">
              <label for="dateDebutCreation">Début</label>
              <input id="dateDebutCreation" type="datetime-local" formControlName="dateDebut" />
            </div>
            <div class="field">
              <label for="dateFinCreation">Fin</label>
              <input id="dateFinCreation" type="datetime-local" formControlName="dateFin" />
            </div>
          </div>
          <div class="form__row">
            <div class="field field--sm">
              <label for="poidsVotesCreation">% Votes en ligne</label>
              <input id="poidsVotesCreation" type="number" formControlName="poidsVotesEnLigne" />
            </div>
            <div class="field field--sm">
              <label for="poidsPublicCreation">% Public sur place</label>
              <input id="poidsPublicCreation" type="number" formControlName="poidsPublicSurPlace" />
            </div>
            <div class="field field--sm">
              <label for="poidsJuryCreation">% Jury</label>
              <input id="poidsJuryCreation" type="number" formControlName="poidsJury" />
            </div>
          </div>
          @if (formCreation.hasError('ponderationInvalide')) {
            <div class="field-error">Les 3 pondérations doivent totaliser exactement 100%.</div>
          }
          <label class="checkbox">
            <input type="checkbox" formControlName="juryObligatoire" />
            Jury obligatoire pour cette phase
          </label>

          @if (erreurCreation) {
            <div class="field-error" role="alert">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              {{ erreurCreation }}
            </div>
          }

          <div class="form__actions">
            <button type="submit" class="btn btn--primary" [disabled]="formCreation.invalid || creationEnCours">
              {{ creationEnCours ? 'Création…' : 'Créer la phase' }}
            </button>
            <button type="button" class="btn btn--ghost" (click)="formCreation = null">Annuler</button>
          </div>
        </form>
      </div>
    }

    <div class="list">
      @if (phases.length === 0) {
        <div class="empty-state">
          Aucune phase configurée pour cette édition.
        </div>
      }
      @for (p of phases; track p.id) {
        <div class="phase-card">
          <div class="phase-card__header">
            <div>
              <div class="phase-card__nom">
                {{ labelPhase(p.nom) }}
                @if (p.typePhase && p.nom !== 'PRESELECTION') {
                  <span class="format-tag">{{ p.typePhase === 'DUO' ? 'Duo' : 'Individuel' }}</span>
                }
              </div>
              <div class="phase-card__dates">{{ p.dateDebut | date:'dd/MM/yy HH:mm' }} → {{ p.dateFin | date:'dd/MM/yy HH:mm' }}</div>
            </div>
            <span class="badge" [class]="'badge--' + p.statut">{{ labelStatut(p.statut) }}</span>
          </div>
          <div class="phase-card__body">
            <!-- Présélection = candidatures, pas de vote (jury ni public) : la pondération
                 votes/jury/public n'a aucun sens pour cette phase, on ne l'affiche pas. -->
            @if (p.nom !== 'PRESELECTION') {
              <div class="ponderation">
                <span class="pond-item">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                  Votes <strong>{{ p.poidsVotesEnLigne }}%</strong>
                </span>
                <span class="pond-item">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  Jury <strong>{{ p.poidsJury }}%</strong>
                </span>
                <span class="pond-item">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Public <strong>{{ p.poidsPublicSurPlace }}%</strong>
                </span>
              </div>
            }

            @if (editionEnCoursId === p.id) {
              <form [formGroup]="formEdition!" (ngSubmit)="enregistrerEdition(p)" class="form form--inline">
                <div class="form__row">
                  <div class="field">
                    <label [for]="'dateDebutEdit' + p.id">Début</label>
                    <input [id]="'dateDebutEdit' + p.id" type="datetime-local" formControlName="dateDebut" />
                  </div>
                  <div class="field">
                    <label [for]="'dateFinEdit' + p.id">Fin</label>
                    <input [id]="'dateFinEdit' + p.id" type="datetime-local" formControlName="dateFin" />
                  </div>
                </div>
                @if (p.nom !== 'PRESELECTION') {
                  <div class="form__row">
                    <div class="field field--sm">
                      <label>% Votes</label>
                      <input type="number" formControlName="poidsVotesEnLigne" />
                    </div>
                    <div class="field field--sm">
                      <label>% Public</label>
                      <input type="number" formControlName="poidsPublicSurPlace" />
                    </div>
                    <div class="field field--sm">
                      <label>% Jury</label>
                      <input type="number" formControlName="poidsJury" />
                    </div>
                  </div>
                  @if (formEdition!.hasError('ponderationInvalide')) {
                    <div class="field-error">Les 3 pondérations doivent totaliser exactement 100%.</div>
                  }
                }
                <div class="form__actions">
                  <button type="submit" class="btn btn--sm btn--primary" [disabled]="formEdition!.invalid || editionSauvegardeEnCours">
                    {{ editionSauvegardeEnCours ? '…' : 'Enregistrer' }}
                  </button>
                  <button type="button" class="btn btn--sm btn--ghost" (click)="annulerEdition()">Annuler</button>
                </div>
              </form>
            }

            <div class="phase-card__footer">
              @if (p.nom !== 'PRESELECTION') {
                <div class="vote-status" [class.vote-status--on]="p.voteActif">
                  <span class="dot" aria-hidden="true"></span>
                  {{ p.voteActif ? 'Votes ouverts' : 'Votes fermés' }}
                </div>
              } @else {
                <div class="vote-status">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                  Phase de candidatures — pas de vote
                </div>
              }
              <div class="phase-card__actions">
                <button type="button" class="btn btn--sm" (click)="ouvrirEdition(p)" [disabled]="p.statut === 'TERMINEE'">
                  Éditer
                </button>
                @if (p.statut === 'EN_ATTENTE') {
                  <button type="button" class="btn btn--sm btn--ok"
                    [disabled]="activationEnCours === p.id || !!phaseActiveExistante"
                    [title]="titreBoutonActiver"
                    (click)="phaseAActiver = p">
                    @if (activationEnCours !== p.id) {
                      <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="m7 4 15 8-15 8V4z"/></svg>
                    }
                    {{ activationEnCours === p.id ? '…' : 'Activer' }}
                  </button>
                }
                @if (p.nom !== 'PRESELECTION') {
                  <button type="button" class="btn btn--sm" [class.btn--ok]="!p.voteActif" [class.btn--err]="p.voteActif"
                    [disabled]="toggling === p.id || p.statut === 'TERMINEE' || (!p.voteActif && p.statut !== 'EN_COURS')"
                    [title]="!p.voteActif && p.statut === 'EN_ATTENTE' ? 'Active d’abord la phase avant d’ouvrir ses votes' : ''"
                    (click)="toggleVote(p)">
                    {{ toggling === p.id ? '…' : (p.voteActif ? 'Fermer les votes' : 'Ouvrir les votes') }}
                  </button>
                }
                @if (p.statut !== 'TERMINEE') {
                  <button type="button" class="btn btn--sm btn--err" [disabled]="clotureEnCours === p.id" (click)="phaseACloturer = p">
                    {{ clotureEnCours === p.id ? '…' : 'Clôturer' }}
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  }

  @if (phaseAActiver; as p) {
    <app-confirm-dialog
      titre="Activer la phase"
      [message]="'Activer la phase « ' + labelPhase(p.nom) + ' » ? Elle passera en EN_COURS.'"
      libelleConfirmer="Activer"
      [enCours]="activationEnCours === p.id"
      [erreur]="erreurAction"
      (confirmed)="activer(p)"
      (cancelled)="phaseAActiver = null; erreurAction = null" />
  }

  @if (phaseACloturer; as p) {
    <app-confirm-dialog
      titre="Clôturer la phase"
      [message]="'Clôturer la phase « ' + labelPhase(p.nom) + ' » ? Les votes seront coupés définitivement, action irréversible.'"
      libelleConfirmer="Clôturer"
      [danger]="true"
      [enCours]="clotureEnCours === p.id"
      [erreur]="erreurAction"
      (confirmed)="cloturer(p)"
      (cancelled)="phaseACloturer = null; erreurAction = null" />
  }
</div>
`,
  styleUrls: ['../poules/poules.component.scss', './phases.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PhasesComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreur: string | null = null;
  edition: Edition | null = null;
  phases: Phase[] = [];
  toggling: string | null = null;
  clotureEnCours: string | null = null;
  activationEnCours: string | null = null;
  phaseAActiver: Phase | null = null;
  phaseACloturer: Phase | null = null;

  /** Une seule phase EN_COURS autorisée à la fois (contrainte frontend, non posée par le backend). */
  get phaseActiveExistante(): Phase | null {
    return this.phases.find(p => p.statut === 'EN_COURS') ?? null;
  }

  get titreBoutonActiver(): string {
    const active = this.phaseActiveExistante;
    return active ? `Clôture la phase « ${this.labelPhase(active.nom)} » avant d’en activer une autre` : '';
  }
  erreurAction: string | null = null;

  formCreation: ReturnType<typeof this.creerFormCreation> | null = null;
  erreurCreation: string | null = null;
  creationEnCours = false;

  editionEnCoursId: string | null = null;
  formEdition: ReturnType<typeof this.creerFormPonderation> | null = null;
  editionSauvegardeEnCours = false;

  private sub = new Subscription();

  ngOnInit(): void {
    // GET /editions → trouver EN_COURS → GET /editions/{id}/phases
    this.sub.add(
      this.adminSvc.editions().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
          if (!active) return of(null as null);
          this.edition = active;
          return this.adminSvc.phases(active.id);
        }),
        catchError(() => of(null)),
      ).subscribe(ps => {
        this.isLoading = false;
        if (ps === null) {
          this.erreur = 'Erreur de chargement (backend hors ligne ou aucune édition ?)';
          return;
        }
        this.phases = ps;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get nomsDisponibles(): { val: NomPhase; label: string }[] {
    const existants = new Set(this.phases.map(p => p.nom));
    return NOMS_PHASE.filter(n => !existants.has(n.val));
  }

  labelPhase(n: NomPhase): string {
    return NOMS_PHASE.find(x => x.val === n)?.label ?? n;
  }

  labelStatutEdition(s: StatutEdition): string {
    return STATUTS_EDITION.find(x => x.val === s)?.label ?? s;
  }

  labelStatut(s: StatutPhase): string {
    const map: Record<StatutPhase, string> = {
      EN_ATTENTE: 'En attente',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminée',
    };
    return map[s] ?? s;
  }

  private creerFormPonderation(valeurs?: Partial<Phase>) {
    return this.fb.nonNullable.group(
      {
        dateDebut: [versDatetimeLocal(valeurs?.dateDebut), Validators.required],
        dateFin: [versDatetimeLocal(valeurs?.dateFin), Validators.required],
        poidsVotesEnLigne: [valeurs?.poidsVotesEnLigne ?? 40, [Validators.required, Validators.min(0), Validators.max(100)]],
        poidsPublicSurPlace: [valeurs?.poidsPublicSurPlace ?? 20, [Validators.required, Validators.min(0), Validators.max(100)]],
        poidsJury: [valeurs?.poidsJury ?? 40, [Validators.required, Validators.min(0), Validators.max(100)]],
      },
      { validators: ponderationValide }
    );
  }

  private creerFormCreation() {
    return this.fb.nonNullable.group(
      {
        nom: [(this.nomsDisponibles[0]?.val ?? 'PRESELECTION') as NomPhase, Validators.required],
        typePhase: ['INDIVIDUEL' as 'INDIVIDUEL' | 'DUO', Validators.required],
        dateDebut: ['', Validators.required],
        dateFin: ['', Validators.required],
        poidsVotesEnLigne: [40, [Validators.required, Validators.min(0), Validators.max(100)]],
        poidsPublicSurPlace: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
        poidsJury: [40, [Validators.required, Validators.min(0), Validators.max(100)]],
        juryObligatoire: [true],
      },
      { validators: ponderationValide }
    );
  }

  // ── Création ─────────────────────────────────────────────────────────────
  ouvrirCreation(): void {
    this.erreurCreation = null;
    this.formCreation = this.creerFormCreation();
  }

  creer(): void {
    if (!this.formCreation || this.formCreation.invalid || !this.edition) {
      this.formCreation?.markAllAsTouched();
      return;
    }
    this.erreurCreation = null;
    this.creationEnCours = true;
    const v = this.formCreation.getRawValue();
    // Phase.typePhase est NOT NULL côté backend (Phase.java) : même masqué en Présélection
    // (pas de notion individuel/duo à ce stade — candidature simple), une valeur doit partir.
    const payload: Partial<Phase> & { nom: NomPhase; ordre: number; juryObligatoire: boolean } = {
      nom: v.nom,
      typePhase: v.nom === 'PRESELECTION' ? 'INDIVIDUEL' : v.typePhase,
      ordre: this.phases.length + 1,
      dateDebut: versInstant(v.dateDebut),
      dateFin: versInstant(v.dateFin),
      poidsVotesEnLigne: v.poidsVotesEnLigne,
      poidsPublicSurPlace: v.poidsPublicSurPlace,
      poidsJury: v.poidsJury,
      juryObligatoire: v.juryObligatoire,
    };
    this.sub.add(
      this.adminSvc.creerPhase(this.edition.id, payload).pipe(
        catchError(() => of(null)),
        finalize(() => { this.creationEnCours = false; })
      ).subscribe(nouvelle => {
        if (!nouvelle) {
          this.erreurCreation = "Échec de la création. Vérifie que les pondérations totalisent 100%.";
          return;
        }
        this.phases = [...this.phases, nouvelle];
        this.formCreation = null;
      })
    );
  }

  // ── Édition dates/pondérations ──────────────────────────────────────────
  ouvrirEdition(p: Phase): void {
    this.editionEnCoursId = p.id;
    this.formEdition = this.creerFormPonderation(p);
  }

  annulerEdition(): void {
    this.editionEnCoursId = null;
    this.formEdition = null;
  }

  enregistrerEdition(p: Phase): void {
    if (!this.formEdition || this.formEdition.invalid) {
      this.formEdition?.markAllAsTouched();
      return;
    }
    const v = this.formEdition.getRawValue();
    this.editionSauvegardeEnCours = true;
    const payload: Partial<Phase> = {
      dateDebut: versInstant(v.dateDebut),
      dateFin: versInstant(v.dateFin),
      poidsVotesEnLigne: v.poidsVotesEnLigne,
      poidsPublicSurPlace: v.poidsPublicSurPlace,
      poidsJury: v.poidsJury,
      pointsMaxVotesEnLigne: p.pointsMaxVotesEnLigne,
      pointsMaxPublic: p.pointsMaxPublic,
      pointsMaxJury: p.pointsMaxJury,
      juryObligatoire: p.juryObligatoire ?? true,
    };
    this.sub.add(
      this.adminSvc.mettreAJourPhase(p.id, payload).pipe(
        catchError(() => of(null)),
        finalize(() => { this.editionSauvegardeEnCours = false; })
      ).subscribe(updated => {
        if (!updated) { this.erreur = 'Échec de la mise à jour de la phase.'; return; }
        const idx = this.phases.findIndex(x => x.id === p.id);
        if (idx !== -1) this.phases[idx] = updated;
        this.annulerEdition();
      })
    );
  }

  /**
   * Selon p.voteActif :
   *   true  → PUT /phases/{id}/vote/desactiver
   *   false → PUT /phases/{id}/vote/activer
   */
  /**
   * Le backend ne vérifie pas non plus le statut avant d'ouvrir les votes (activerVote()
   * se contente de poser voteActif=true, quel que soit le statut de la phase) — même
   * contrainte posée ici que pour activer() : on ne peut ouvrir les votes que d'une phase
   * EN_COURS. Fermer reste toujours permis (filet de sécurité si un état incohérent existe).
   */
  toggleVote(p: Phase): void {
    if (!p.voteActif && p.statut !== 'EN_COURS') return;
    this.toggling = p.id;
    const req$ = p.voteActif
      ? this.adminSvc.desactiverVote(p.id)
      : this.adminSvc.activerVote(p.id);

    this.sub.add(
      req$.pipe(catchError(() => of(null))).subscribe(updated => {
        this.toggling = null;
        if (updated) {
          const idx = this.phases.findIndex(x => x.id === p.id);
          if (idx !== -1) this.phases[idx] = updated;
        }
      })
    );
  }

  cloturer(p: Phase): void {
    this.erreurAction = null;
    this.clotureEnCours = p.id;
    this.sub.add(
      this.adminSvc.cloturerPhase(p.id).pipe(catchError(() => of(null))).subscribe(updated => {
        this.clotureEnCours = null;
        if (!updated) { this.erreurAction = 'Échec de la clôture de la phase.'; return; }
        const idx = this.phases.findIndex(x => x.id === p.id);
        if (idx !== -1) this.phases[idx] = updated;
        this.phaseACloturer = null;
      })
    );
  }

  /**
   * PUT /phases/{id}/activer — cf. AdminService.activerPhase() : transitionne EN_ATTENTE → EN_COURS.
   * Le backend n'empêche pas deux phases EN_COURS simultanées (activer() écrase juste le statut
   * de la phase ciblée sans vérifier les autres) — contrainte imposée ici côté frontend : une
   * seule phase active à la fois, la précédente doit être clôturée avant d'en activer une autre.
   */
  activer(p: Phase): void {
    const dejaActive = this.phaseActiveExistante;
    if (dejaActive && dejaActive.id !== p.id) {
      this.erreurAction = `La phase « ${this.labelPhase(dejaActive.nom)} » est déjà en cours — clôture-la avant d'en activer une autre.`;
      return;
    }
    this.erreurAction = null;
    this.activationEnCours = p.id;
    this.sub.add(
      this.adminSvc.activerPhase(p.id).pipe(catchError(() => of(null))).subscribe(updated => {
        this.activationEnCours = null;
        if (!updated) {
          this.erreurAction = "Échec de l'activation de la phase.";
          return;
        }
        const idx = this.phases.findIndex(x => x.id === p.id);
        if (idx !== -1) this.phases[idx] = updated;
        this.phaseAActiver = null;
      })
    );
  }
}
