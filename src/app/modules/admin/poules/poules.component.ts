import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize, forkJoin, map } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { CandidatService } from '@core/services/candidat.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { Phase, Edition, CandidatPublicResponse, PouleResponse, AffectationPouleResponse, DuoResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

interface PouleSession extends PouleResponse {
  candidats: AffectationPouleResponse[];
}

@Component({
  selector: 'app-poules',
  imports: [ReactiveFormsModule],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Poules &amp; Duos</h1>
      <p class="page-header__subtitle">Répartition des candidats en poules (phases individuelles) ou en duos (phases duo), hors présélection.</p>
    </div>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement">
      <div class="sk" aria-hidden="true"></div>
      <div class="sk" aria-hidden="true"></div>
    </div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="empty-state" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreurChargement }}
    </div>
  }

  @if (!isLoading && !erreurChargement) {

    @if (phasesEligibles.length === 0) {
      <div class="empty-state">
        Aucune phase éligible (hors Présélection) pour l'édition en cours. Crée d'abord une phase Éliminatoires/Demi-finale/Finale.
      </div>
    } @else {

      <div class="card">
        <div class="field field--sm">
          <label for="phaseSelect">Phase</label>
          <select id="phaseSelect" [value]="phaseSelectionneeId" (change)="selectionnerPhase($any($event.target).value)">
            @for (p of phasesEligibles; track p.id) {
              <option [value]="p.id">{{ labelPhase(p.nom) }} — {{ p.typePhase === 'DUO' ? 'Duo' : 'Individuel' }}</option>
            }
          </select>
        </div>
      </div>

      @if (phaseSelectionnee) {

        @if (chargementCandidats) {
          <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
        }

        @if (!chargementCandidats && candidatsDisponibles.length === 0) {
          <div class="empty-state">Aucun candidat actif sur cette édition pour l'instant.</div>
        }

        @if (!chargementCandidats && candidatsDisponibles.length > 0) {

          <!-- ══════════════ MODE INDIVIDUEL → POULES ══════════════ -->
          @if (phaseSelectionnee.typePhase !== 'DUO') {

            <div class="actions-row">
              <button type="button" class="btn btn--primary" (click)="ouvrirModalCreation()">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Créer une poule
              </button>
              <button type="button" class="btn btn--ghost" [disabled]="candidatsNonAffectes.length === 0" (click)="ouvrirModalAleatoire()">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.973a4 4 0 0 1 3.3 1.7l5.454 8.6a4 4 0 0 0 3.3 1.7H22"/></svg>
                Affecter au hasard
              </button>
            </div>

            @if (modalCreationOuverte) {
              <div class="modal-bg" (click)="fermerModalCreation()">
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-creation"
                  (click)="$event.stopPropagation()" style="max-width:420px">
                  <h2 id="titre-creation">Créer une poule</h2>
                  <form [formGroup]="formPoule" (ngSubmit)="creerPoule()" class="form">
                    <div class="field">
                      <label for="nomPoule">Nom de la poule</label>
                      <input id="nomPoule" type="text" formControlName="nom" placeholder="Poule A" maxlength="50" autofocus />
                    </div>
                    @if (erreurPoule) {
                      <div class="field-error" role="alert">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        {{ erreurPoule }}
                      </div>
                    }
                    <div class="modal__actions">
                      <button type="button" class="btn btn--ghost" (click)="fermerModalCreation()">Annuler</button>
                      <button type="submit" class="btn btn--primary" [disabled]="formPoule.invalid || creationPouleEnCours">
                        {{ creationPouleEnCours ? 'Création…' : 'Créer la poule' }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            }

            <div class="list">
              @if (poulesSession.length === 0) {
                <div class="empty-state">Aucune poule créée pour cette phase.</div>
              }
              @for (poule of poulesSession; track poule.id) {
                <div class="phase-card">
                  <div class="phase-card__header">
                    <div>
                      <div class="phase-card__nom">{{ poule.nom }}</div>
                      <div class="phase-card__dates">{{ poule.candidats.length }} candidat(s) affecté(s)</div>
                    </div>
                    <button type="button" class="btn btn--sm btn--ghost" (click)="ouvrirRenommage(poule)">✏ Renommer</button>
                  </div>
                  <div class="phase-card__body">
                    @if (poule.candidats.length > 0) {
                      <ul class="candidat-list">
                        @for (a of poule.candidats; track a.id) {
                          <li style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                            <span>
                              {{ a.candidat.codeCandidat }} — {{ a.candidat.prenom }} {{ a.candidat.nom }}
                              @if (a.ordrePassage) { <small> · Ordre {{ a.ordrePassage }}</small> }
                              @if (a.chansonImposee) { <small> · {{ a.chansonImposee }}</small> }
                            </span>
                            <span style="display:flex;gap:6px;flex-shrink:0">
                              @if (retraitConfirmId === a.id) {
                                <button type="button" class="btn btn--sm btn--err" [disabled]="retraitEnCours" (click)="confirmerRetrait(poule, a)">{{ retraitEnCours ? '…' : 'Confirmer' }}</button>
                                <button type="button" class="btn btn--sm btn--ghost" (click)="retraitConfirmId = null">Annuler</button>
                              } @else {
                                <button type="button" class="btn btn--sm btn--ghost" (click)="ouvrirEditionAffectation(a)">✏ Chanson / ordre</button>
                                <button type="button" class="btn btn--sm btn--err" (click)="retraitConfirmId = a.id">Retirer</button>
                              }
                            </span>
                          </li>
                        }
                      </ul>
                      @if (erreurRetrait) { <div class="field-error" role="alert" style="margin-top:6px">{{ erreurRetrait }}</div> }
                    }

                    @if (affectationEnCoursPouleId === poule.id) {
                      <div class="candidat-picker">
                        @for (c of candidatsDisponiblesPour(poule); track c.id) {
                          <label class="checkbox">
                            <input type="checkbox" [checked]="selectionAffectation.has(c.id)" (change)="toggleSelection(c.id)" />
                            {{ c.codeCandidat }} — {{ c.prenom }} {{ c.nom }}
                          </label>
                        }
                        @if (candidatsDisponiblesPour(poule).length === 0) {
                          <p class="field-hint">Tous les candidats actifs sont déjà affectés à une poule de cette phase.</p>
                        }
                        @if (erreurAffectation) {
                          <div class="field-error" role="alert">
                          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          {{ erreurAffectation }}
                        </div>
                        }
                        <div class="form__actions">
                          <button type="button" class="btn btn--sm btn--primary" [disabled]="selectionAffectation.size === 0 || affectationEnCours"
                            (click)="confirmerAffectation(poule)">
                            {{ affectationEnCours ? '…' : 'Affecter (' + selectionAffectation.size + ')' }}
                          </button>
                          <button type="button" class="btn btn--sm btn--ghost" (click)="annulerAffectation()">Annuler</button>
                        </div>
                      </div>
                    } @else {
                      <div class="phase-card__footer">
                        <button type="button" class="btn btn--sm" (click)="ouvrirAffectation(poule)">+ Affecter des candidats</button>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Modal renommage poule -->
          @if (pouleARenommer) {
            <div class="modal-bg" (click)="annulerRenommage()">
              <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-rename"
                (click)="$event.stopPropagation()" style="max-width:400px">
                <h2 id="titre-rename">Renommer « {{ pouleARenommer.nom }} »</h2>
                <div class="field">
                  <label for="nvNom">Nouveau nom</label>
                  <input id="nvNom" type="text" [formControl]="formRenommage" maxlength="50"
                    placeholder="Poule A" (keydown.enter)="confirmerRenommage()" />
                </div>
                @if (erreurRenommage) { <div class="field-error" role="alert">{{ erreurRenommage }}</div> }
                <div class="modal__actions">
                  <button type="button" class="btn btn--ghost" (click)="annulerRenommage()">Annuler</button>
                  <button type="button" class="btn btn--primary" [disabled]="formRenommage.invalid || renommageEnCours"
                    (click)="confirmerRenommage()">
                    {{ renommageEnCours ? 'Enregistrement…' : 'Renommer' }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Modal affectation aléatoire -->
          @if (modalAleatoireOuvert) {
            <div class="modal-bg" (click)="fermerModalAleatoire()">
              <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-aleatoire"
                (click)="$event.stopPropagation()" style="max-width:440px">
                <h2 id="titre-aleatoire">Affectation aléatoire</h2>
                <form [formGroup]="formAleatoire" (ngSubmit)="lancerAffectationAleatoire()" class="form">
                  <div class="field">
                    <label for="nbPoules">Nombre de poules (total souhaité)</label>
                    <input id="nbPoules" type="number" min="1" formControlName="nombrePoules" />
                    <p class="field-hint">
                      @if (poulesSession.length > 0) {
                        {{ candidatsNonAffectes.length }} candidat(s) à répartir sur {{ poulesSession.length }} poule(s) déjà créée(s) —
                        seules les poules manquantes seront créées, les candidats déjà en place ne bougent pas.
                      } @else {
                        {{ candidatsNonAffectes.length }} candidat(s) à répartir dans les poules créées.
                      }
                    </p>
                  </div>
                  @if (erreurAleatoire) { <div class="field-error" role="alert">{{ erreurAleatoire }}</div> }
                  <div class="modal__actions">
                    <button type="button" class="btn btn--ghost" (click)="fermerModalAleatoire()">Annuler</button>
                    <button type="submit" class="btn btn--primary" [disabled]="formAleatoire.invalid || aleatoireEnCours">
                      {{ aleatoireEnCours ? 'Répartition…' : 'Lancer le tirage' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          }

          <!-- Modal édition affectation (ordrePassage, chansonImposee) -->
          @if (affectationEnEdition) {
            <div class="modal-bg" (click)="fermerEditionAffectation()">
              <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-edit-aff"
                (click)="$event.stopPropagation()" style="max-width:480px">
                <h2 id="titre-edit-aff">{{ affectationEnEdition.candidat.codeCandidat }} — {{ affectationEnEdition.candidat.prenom }} {{ affectationEnEdition.candidat.nom }}</h2>
                <form [formGroup]="formAffectation" (ngSubmit)="enregistrerAffectation()" class="form">
                  <div class="field">
                    <label for="editOrdre">Ordre de passage <small>(optionnel)</small></label>
                    <input id="editOrdre" type="number" min="1" formControlName="ordrePassage" />
                  </div>
                  <div class="field">
                    <label for="editChanson">Chanson imposée <small>(optionnel)</small></label>
                    <input id="editChanson" type="text" formControlName="chansonImposee" maxlength="255" />
                  </div>
                  @if (erreurEditionAffectation) {
                    <div class="field-error" role="alert">{{ erreurEditionAffectation }}</div>
                  }
                  <div class="modal__actions">
                    <button type="button" class="btn btn--ghost" (click)="fermerEditionAffectation()">Annuler</button>
                    <button type="submit" class="btn btn--primary" [disabled]="formAffectation.invalid || editionAffectationEnCours">
                      {{ editionAffectationEnCours ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          }

          <!-- ══════════════ MODE DUO ══════════════ -->
          @if (phaseSelectionnee.typePhase === 'DUO') {

            <div class="card">
              <h2 class="card__title">Créer un duo</h2>
              <form [formGroup]="formDuo" (ngSubmit)="creerDuo()" class="form">
                <div class="form__row">
                  <div class="field">
                    <label for="candidat1">Candidat 1</label>
                    <select id="candidat1" formControlName="candidat1Id">
                      <option value="" disabled>— choisir —</option>
                      @for (c of candidatsLibresPourDuo; track c.id) {
                        <option [value]="c.id">{{ c.codeCandidat }} — {{ c.prenom }} {{ c.nom }}</option>
                      }
                    </select>
                  </div>
                  <div class="field">
                    <label for="candidat2">Candidat 2</label>
                    <select id="candidat2" formControlName="candidat2Id">
                      <option value="" disabled>— choisir —</option>
                      @for (c of candidatsLibresPourDuo; track c.id) {
                        <option [value]="c.id" [disabled]="c.id === formDuo.value.candidat1Id">{{ c.codeCandidat }} — {{ c.prenom }} {{ c.nom }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="field">
                  <label for="chansonCommune">Chanson commune (optionnel)</label>
                  <input id="chansonCommune" type="text" formControlName="chansonCommune" maxlength="255" />
                </div>
                @if (erreurDuo) {
                  <div class="field-error" role="alert">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    {{ erreurDuo }}
                  </div>
                }
                <div class="form__actions">
                  <button type="submit" class="btn btn--primary" [disabled]="formDuo.invalid || creationDuoEnCours">
                    {{ creationDuoEnCours ? 'Création…' : 'Créer le duo' }}
                  </button>
                </div>
              </form>
            </div>

            <div class="list">
              @if (duos.length === 0) {
                <div class="empty-state">Aucun duo créé pour cette phase.</div>
              }
              @for (d of duos; track d.id) {
                <div class="phase-card">
                  <div class="phase-card__header">
                    <div>
                      <div class="phase-card__nom">{{ d.candidat1.prenom }} {{ d.candidat1.nom }} &amp; {{ d.candidat2.prenom }} {{ d.candidat2.nom }}</div>
                      @if (d.chansonCommune) {
                        <div class="phase-card__dates">
                          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                          {{ d.chansonCommune }}
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }
      }
    }
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', './poules.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PoulesComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private candidatSvc = inject(CandidatService);
  private pouleDuoSvc = inject(PouleDuoService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  phasesEligibles: Phase[] = [];

  phaseSelectionneeId = '';
  chargementCandidats = false;
  candidatsDisponibles: CandidatPublicResponse[] = [];

  poulesSession: PouleSession[] = [];
  duos: DuoResponse[] = [];

  modalCreationOuverte = false;
  formPoule = this.fb.nonNullable.group({ nom: ['', [Validators.required, Validators.maxLength(50)]] });
  erreurPoule: string | null = null;
  creationPouleEnCours = false;

  modalAleatoireOuvert = false;
  formAleatoire = this.fb.nonNullable.group({ nombrePoules: [2, [Validators.required, Validators.min(1)]] });
  erreurAleatoire: string | null = null;
  aleatoireEnCours = false;

  affectationEnCoursPouleId: string | null = null;
  selectionAffectation = new Set<string>();
  erreurAffectation: string | null = null;
  affectationEnCours = false;

  formDuo = this.fb.nonNullable.group({
    candidat1Id: ['', Validators.required],
    candidat2Id: ['', Validators.required],
    chansonCommune: [''],
  });
  erreurDuo: string | null = null;
  creationDuoEnCours = false;

  pouleARenommer: PouleSession | null = null;
  formRenommage = new FormControl('', [Validators.required, Validators.maxLength(50)]);
  erreurRenommage: string | null = null;
  renommageEnCours = false;

  retraitConfirmId: string | null = null;
  retraitEnCours = false;
  erreurRetrait: string | null = null;

  affectationEnEdition: AffectationPouleResponse | null = null;
  formAffectation = this.fb.nonNullable.group({
    ordrePassage: [null as number | null],
    chansonImposee: ['', Validators.maxLength(255)],
  });
  erreurEditionAffectation: string | null = null;
  editionAffectationEnCours = false;

  private sub = new Subscription();

  ngOnInit(): void {
    // Phases hors PRESELECTION uniquement : candidature simple, pas de notion individuel/duo.
    this.sub.add(
      this.adminSvc.editions().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
          if (!active) return of(null);
          this.edition = active;
          return this.adminSvc.phases(active.id);
        }),
        catchError(() => of(null)),
      ).subscribe(phases => {
        this.isLoading = false;
        if (phases === null) {
          this.erreurChargement = 'Erreur de chargement (backend hors ligne ou aucune édition ?)';
          return;
        }
        this.phasesEligibles = phases.filter(p => p.nom !== 'PRESELECTION');
        if (this.phasesEligibles.length > 0) {
          this.selectionnerPhase(this.phasesEligibles[0].id);
        }
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  labelPhase(n: string): string { return LABEL_PHASE[n] ?? n; }

  get phaseSelectionnee(): Phase | null {
    return this.phasesEligibles.find(p => p.id === this.phaseSelectionneeId) ?? null;
  }

  get candidatsLibresPourDuo(): CandidatPublicResponse[] {
    const enDuo = new Set(this.duos.flatMap(d => [d.candidat1.id, d.candidat2.id]));
    return this.candidatsDisponibles.filter(c => !enDuo.has(c.id));
  }

  candidatsDisponiblesPour(_poule: PouleSession): CandidatPublicResponse[] {
    return this.candidatsNonAffectes;
  }

  /** Candidats actifs de l'édition pas encore affectés à une poule de cette phase, toutes poules confondues. */
  get candidatsNonAffectes(): CandidatPublicResponse[] {
    const dejaAffectes = new Set(this.poulesSession.flatMap(p => p.candidats.map(a => a.candidat.id)));
    return this.candidatsDisponibles.filter(c => !dejaAffectes.has(c.id));
  }

  selectionnerPhase(phaseId: string): void {
    this.phaseSelectionneeId = phaseId;
    this.poulesSession = [];
    this.duos = [];
    this.erreurPoule = null;
    this.erreurDuo = null;
    this.annulerAffectation();
    const phase = this.phaseSelectionnee;
    if (!phase || !this.edition) return;

    this.chargementCandidats = true;
    const candidats$ = this.candidatSvc.galerie(this.edition.id, 0, 200, 'ACTIF');
    const duos$ = phase.typePhase === 'DUO' ? this.pouleDuoSvc.duosPhase(phase.id) : of([] as DuoResponse[]);
    const poules$ = phase.typePhase !== 'DUO' ? this.pouleDuoSvc.poulesPhase(phase.id) : of([] as PouleResponse[]);

    this.sub.add(
      forkJoin([candidats$, duos$, poules$]).pipe(
        switchMap(([pageCandidats, duos, poules]) => {
          const poulesAvecCandidats$ = poules.length > 0
            ? forkJoin(poules.map(p =>
                this.pouleDuoSvc.candidatsPoule(p.id).pipe(
                  map(candidats => ({ ...p, candidats } as PouleSession)),
                  catchError(() => of({ ...p, candidats: [] } as PouleSession))
                )
              ))
            : of([] as PouleSession[]);
          return forkJoin([of(pageCandidats), of(duos), poulesAvecCandidats$]);
        }),
        catchError(() => of(null)),
        finalize(() => { this.chargementCandidats = false; })
      ).subscribe(res => {
        if (!res) { this.erreurChargement = 'Erreur de chargement des candidats.'; return; }
        const [pageCandidats, duos, poulesAvecCandidats] = res;
        this.candidatsDisponibles = pageCandidats.content;
        this.duos = duos;
        this.poulesSession = poulesAvecCandidats;
      })
    );
  }

  // ── Poules (mode individuel) ────────────────────────────────────────────
  ouvrirModalCreation(): void {
    this.formPoule.reset({ nom: '' });
    this.erreurPoule = null;
    this.modalCreationOuverte = true;
  }

  fermerModalCreation(): void {
    this.modalCreationOuverte = false;
  }

  creerPoule(): void {
    if (this.formPoule.invalid || !this.phaseSelectionnee) { this.formPoule.markAllAsTouched(); return; }
    this.erreurPoule = null;
    this.creationPouleEnCours = true;
    const nom = this.formPoule.getRawValue().nom;
    this.sub.add(
      this.pouleDuoSvc.creerPoule(this.phaseSelectionnee.id, nom).pipe(
        catchError(err => { this.erreurPoule = messageErreur(err, 'Échec de la création de la poule.'); return of(null); }),
        finalize(() => { this.creationPouleEnCours = false; })
      ).subscribe(poule => {
        if (!poule) return;
        this.poulesSession = [...this.poulesSession, { ...poule, candidats: [] }];
        this.formPoule.reset({ nom: '' });
        this.modalCreationOuverte = false;
      })
    );
  }

  // ── Affectation aléatoire (poules + ordre de passage) ───────────────────
  ouvrirModalAleatoire(): void {
    // Par défaut : les poules déjà là, ou une estimation raisonnable (~4 candidats/poule) s'il n'y en a aucune.
    const n = this.poulesSession.length > 0
      ? this.poulesSession.length
      : Math.max(1, Math.ceil(this.candidatsNonAffectes.length / 4));
    this.formAleatoire.setValue({ nombrePoules: n });
    this.erreurAleatoire = null;
    this.modalAleatoireOuvert = true;
  }

  fermerModalAleatoire(): void {
    this.modalAleatoireOuvert = false;
  }

  /** Fisher-Yates — mélange sans biais, ne modifie pas le tableau d'origine. */
  private melanger<T>(items: T[]): T[] {
    const copie = [...items];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  /**
   * Prend en compte les poules déjà créées pour cette phase : ne crée que les poules
   * manquantes pour atteindre le nombre cible, puis répartit les candidats non affectés
   * au hasard sur TOUTES les poules (existantes + nouvelles), sans jamais toucher aux
   * candidats déjà en place.
   */
  lancerAffectationAleatoire(): void {
    if (this.formAleatoire.invalid || !this.phaseSelectionnee || this.aleatoireEnCours) return;
    const nombreCible = this.formAleatoire.getRawValue().nombrePoules;
    const disponibles = this.candidatsNonAffectes;
    if (disponibles.length === 0) { this.erreurAleatoire = 'Aucun candidat disponible à affecter.'; return; }

    this.erreurAleatoire = null;
    this.aleatoireEnCours = true;

    const poulesExistantes = this.poulesSession;
    const nbManquantes = Math.max(0, nombreCible - poulesExistantes.length);
    const numeroDepart = poulesExistantes.length + 1;

    const creationManquantes$ = nbManquantes > 0
      ? forkJoin(
          Array.from({ length: nbManquantes }, (_, i) =>
            this.pouleDuoSvc.creerPoule(this.phaseSelectionnee!.id, `Poule ${numeroDepart + i}`).pipe(
              map(p => ({ ...p, candidats: [] } as PouleSession))
            )
          )
        )
      : of([] as PouleSession[]);

    this.sub.add(
      creationManquantes$.pipe(
        switchMap(nouvelles => {
          const toutesLesPoules = [...poulesExistantes, ...nouvelles];
          // Distribution round-robin sur des candidats déjà mélangés : répartition équilibrée
          // (écart d'au plus 1 par poule) tout en gardant la composition aléatoire.
          const melanges = this.melanger(disponibles);
          const groupes: CandidatPublicResponse[][] = toutesLesPoules.map(() => []);
          melanges.forEach((c, i) => groupes[i % toutesLesPoules.length].push(c));

          return forkJoin(
            toutesLesPoules.map((poule, i) =>
              groupes[i].length > 0 ? this.affecterGroupeAleatoire(poule, groupes[i]) : of(poule)
            )
          );
        }),
        catchError(err => { this.erreurAleatoire = messageErreur(err, 'Échec de l\'affectation aléatoire.'); return of(null); }),
        finalize(() => { this.aleatoireEnCours = false; })
      ).subscribe(poulesMaj => {
        if (!poulesMaj) return;
        this.poulesSession = poulesMaj;
        this.fermerModalAleatoire();
      })
    );
  }

  /**
   * Affecte un lot de candidats à une poule (existante ou nouvelle), puis tire un ordre de
   * passage aléatoire pour ce lot — décalé après les ordres déjà utilisés dans la poule pour
   * ne jamais entrer en collision avec des affectations manuelles préexistantes.
   */
  private affecterGroupeAleatoire(poule: PouleSession, candidats: CandidatPublicResponse[]) {
    return this.pouleDuoSvc.affecter(poule.id, candidats.map(c => c.id)).pipe(
      switchMap(affectations => {
        const ordresExistants = poule.candidats.map(a => a.ordrePassage ?? 0);
        const depart = ordresExistants.length ? Math.max(...ordresExistants) + 1 : 1;
        const ordres = this.melanger(affectations.map((_, i) => depart + i));
        return forkJoin(
          affectations.map((a, i) =>
            this.pouleDuoSvc.mettreAJourAffectation(a.id, ordres[i], a.chansonImposee).pipe(
              catchError(() => of(a)),
            )
          )
        );
      }),
      map(nouveauxCandidats => ({ ...poule, candidats: [...poule.candidats, ...nouveauxCandidats] } as PouleSession)),
    );
  }

  ouvrirAffectation(poule: PouleSession): void {
    this.affectationEnCoursPouleId = poule.id;
    this.selectionAffectation = new Set();
    this.erreurAffectation = null;
  }

  annulerAffectation(): void {
    this.affectationEnCoursPouleId = null;
    this.selectionAffectation = new Set();
    this.erreurAffectation = null;
  }

  toggleSelection(candidatId: string): void {
    if (this.selectionAffectation.has(candidatId)) this.selectionAffectation.delete(candidatId);
    else this.selectionAffectation.add(candidatId);
  }

  confirmerAffectation(poule: PouleSession): void {
    if (this.selectionAffectation.size === 0) return;
    this.affectationEnCours = true;
    this.erreurAffectation = null;
    const ids = Array.from(this.selectionAffectation);
    this.sub.add(
      this.pouleDuoSvc.affecter(poule.id, ids).pipe(
        // Appel @Transactional côté backend : en cas d'échec (ex. candidat déjà affecté ailleurs, RM-41),
        // TOUT le lot est rejeté (pas d'affectation partielle) — le message reflète cet état binaire.
        catchError(err => { this.erreurAffectation = messageErreur(err, 'Échec de l\'affectation (un candidat est peut-être déjà dans une poule de cette phase).'); return of(null); }),
        finalize(() => { this.affectationEnCours = false; })
      ).subscribe(affectations => {
        if (!affectations) return;
        const idx = this.poulesSession.findIndex(p => p.id === poule.id);
        if (idx !== -1) {
          this.poulesSession[idx] = { ...this.poulesSession[idx], candidats: [...this.poulesSession[idx].candidats, ...affectations] };
        }
        this.annulerAffectation();
      })
    );
  }

  // ── Renommage poule ──────────────────────────────────────────────────────
  ouvrirRenommage(poule: PouleSession): void {
    this.pouleARenommer = poule;
    this.formRenommage.setValue(poule.nom);
    this.erreurRenommage = null;
  }

  annulerRenommage(): void {
    this.pouleARenommer = null;
    this.erreurRenommage = null;
  }

  confirmerRenommage(): void {
    if (this.formRenommage.invalid || !this.pouleARenommer) return;
    this.erreurRenommage = null;
    this.renommageEnCours = true;
    const poule = this.pouleARenommer;
    const nom = this.formRenommage.value!;
    this.sub.add(
      this.pouleDuoSvc.mettreAJourPoule(poule.id, nom).pipe(
        catchError(err => { this.erreurRenommage = messageErreur(err, 'Échec du renommage.'); return of(null); }),
        finalize(() => { this.renommageEnCours = false; })
      ).subscribe(res => {
        if (!res) return;
        this.poulesSession = this.poulesSession.map(p =>
          p.id === poule.id ? { ...p, nom: res.nom } : p);
        this.annulerRenommage();
      })
    );
  }

  // ── Retrait affectation ───────────────────────────────────────────────────
  confirmerRetrait(poule: PouleSession, a: AffectationPouleResponse): void {
    this.retraitEnCours = true;
    this.erreurRetrait = null;
    this.sub.add(
      this.pouleDuoSvc.retirerAffectation(a.id).pipe(
        catchError(err => { this.erreurRetrait = messageErreur(err, 'Échec du retrait.'); return of(null as void | null); }),
        finalize(() => { this.retraitEnCours = false; this.retraitConfirmId = null; })
      ).subscribe(res => {
        if (res !== undefined && res !== null) return; // erreur
        if (this.erreurRetrait) return;
        this.poulesSession = this.poulesSession.map(p =>
          p.id === poule.id ? { ...p, candidats: p.candidats.filter(c => c.id !== a.id) } : p);
      })
    );
  }

  // ── Édition affectation ──────────────────────────────────────────────────
  ouvrirEditionAffectation(a: AffectationPouleResponse): void {
    this.affectationEnEdition = a;
    this.erreurEditionAffectation = null;
    this.formAffectation.setValue({ ordrePassage: a.ordrePassage ?? null, chansonImposee: a.chansonImposee ?? '' });
  }

  fermerEditionAffectation(): void { this.affectationEnEdition = null; }

  enregistrerAffectation(): void {
    if (!this.affectationEnEdition || this.formAffectation.invalid) return;
    this.erreurEditionAffectation = null;
    this.editionAffectationEnCours = true;
    const { ordrePassage, chansonImposee } = this.formAffectation.getRawValue();
    const id = this.affectationEnEdition.id;
    this.sub.add(
      this.pouleDuoSvc.mettreAJourAffectation(id, ordrePassage, chansonImposee || null).pipe(
        catchError(err => { this.erreurEditionAffectation = messageErreur(err, 'Échec de la mise à jour.'); return of(null); }),
        finalize(() => { this.editionAffectationEnCours = false; })
      ).subscribe(res => {
        if (!res) return;
        this.poulesSession = this.poulesSession.map(p => ({
          ...p,
          candidats: p.candidats.map(a => a.id === id ? res : a),
        }));
        this.fermerEditionAffectation();
      })
    );
  }

  // ── Duos (mode duo) ─────────────────────────────────────────────────────
  creerDuo(): void {
    if (this.formDuo.invalid || !this.phaseSelectionnee) { this.formDuo.markAllAsTouched(); return; }
    const v = this.formDuo.getRawValue();
    if (v.candidat1Id === v.candidat2Id) { this.erreurDuo = 'Les deux candidats doivent être distincts.'; return; }
    this.erreurDuo = null;
    this.creationDuoEnCours = true;
    this.sub.add(
      this.pouleDuoSvc.creerDuo(this.phaseSelectionnee.id, v.candidat1Id, v.candidat2Id, v.chansonCommune || undefined).pipe(
        catchError(err => { this.erreurDuo = messageErreur(err, 'Échec de la création du duo.'); return of(null); }),
        finalize(() => { this.creationDuoEnCours = false; })
      ).subscribe(duo => {
        if (!duo) return;
        this.duos = [...this.duos, duo];
        this.formDuo.reset({ candidat1Id: '', candidat2Id: '', chansonCommune: '' });
      })
    );
  }
}
