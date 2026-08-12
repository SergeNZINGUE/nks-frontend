import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize, forkJoin } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { CandidatService } from '@core/services/candidat.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { Phase, Edition, CandidatPublicResponse, PouleResponse, AffectationPouleResponse, DuoResponse } from '@core/models';

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
    <div class="empty-state" role="alert">⚠️ {{ erreurChargement }}</div>
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
              <option [value]="p.id">{{ labelPhase(p.nom) }} — {{ p.typePhase === 'DUO' ? '👥 Duo' : '👤 Individuel' }}</option>
            }
          </select>
        </div>
      </div>

      @if (phaseSelectionnee) {

        <div class="gap-banner" role="note">
          ⚠️ Limitation backend connue : il n'existe aucun endpoint pour <strong>relister les poules déjà créées</strong> après un rechargement de page
          (seuls les duos sont relistables via <code>GET /duos/phase/{{ '{' }}id{{ '}' }}</code>). Les poules créées dans cette session restent visibles ci-dessous
          tant que tu ne rafraîchis pas la page — elles existent toujours en base au rechargement, mais cet écran ne peut plus les retrouver.
        </div>

        @if (chargementCandidats) {
          <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
        }

        @if (!chargementCandidats && candidatsDisponibles.length === 0) {
          <div class="empty-state">Aucun candidat actif sur cette édition pour l'instant.</div>
        }

        @if (!chargementCandidats && candidatsDisponibles.length > 0) {

          <!-- ══════════════ MODE INDIVIDUEL → POULES ══════════════ -->
          @if (phaseSelectionnee.typePhase !== 'DUO') {

            <div class="card">
              <h2 class="card__title">Créer une poule</h2>
              <form [formGroup]="formPoule" (ngSubmit)="creerPoule()" class="form">
                <div class="field">
                  <label for="nomPoule">Nom de la poule</label>
                  <input id="nomPoule" type="text" formControlName="nom" placeholder="Poule A" maxlength="50" />
                </div>
                @if (erreurPoule) {
                  <div class="field-error" role="alert">⚠️ {{ erreurPoule }}</div>
                }
                <div class="form__actions">
                  <button type="submit" class="btn btn--primary" [disabled]="formPoule.invalid || creationPouleEnCours">
                    {{ creationPouleEnCours ? 'Création…' : 'Créer la poule' }}
                  </button>
                </div>
              </form>
            </div>

            <div class="list">
              @if (poulesSession.length === 0) {
                <div class="empty-state">Aucune poule créée dans cette session pour cette phase.</div>
              }
              @for (poule of poulesSession; track poule.id) {
                <div class="phase-card">
                  <div class="phase-card__header">
                    <div>
                      <div class="phase-card__nom">{{ poule.nom }}</div>
                      <div class="phase-card__dates">{{ poule.candidats.length }} candidat(s) affecté(s)</div>
                    </div>
                  </div>
                  <div class="phase-card__body">
                    @if (poule.candidats.length > 0) {
                      <ul class="candidat-list">
                        @for (a of poule.candidats; track a.id) {
                          <li>{{ a.candidat.codeCandidat }} — {{ a.candidat.prenom }} {{ a.candidat.nom }}</li>
                        }
                      </ul>
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
                          <div class="field-error" role="alert">⚠️ {{ erreurAffectation }}</div>
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
                  <div class="field-error" role="alert">⚠️ {{ erreurDuo }}</div>
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
                        <div class="phase-card__dates">🎵 {{ d.chansonCommune }}</div>
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

  formPoule = this.fb.nonNullable.group({ nom: ['', [Validators.required, Validators.maxLength(50)]] });
  erreurPoule: string | null = null;
  creationPouleEnCours = false;

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

  candidatsDisponiblesPour(poule: PouleSession): CandidatPublicResponse[] {
    // Toutes affectations connues, tous poules confondues de la session (le backend ne permet pas
    // de vérifier autrement les affectations déjà faites hors session — cf. bannière d'avertissement).
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

    this.sub.add(
      forkJoin([candidats$, duos$]).pipe(
        catchError(() => of(null)),
        finalize(() => { this.chargementCandidats = false; })
      ).subscribe(res => {
        if (!res) { this.erreurChargement = 'Erreur de chargement des candidats.'; return; }
        const [pageCandidats, duos] = res;
        this.candidatsDisponibles = pageCandidats.content;
        this.duos = duos;
      })
    );
  }

  // ── Poules (mode individuel) ────────────────────────────────────────────
  creerPoule(): void {
    if (this.formPoule.invalid || !this.phaseSelectionnee) { this.formPoule.markAllAsTouched(); return; }
    this.erreurPoule = null;
    this.creationPouleEnCours = true;
    const nom = this.formPoule.getRawValue().nom;
    this.sub.add(
      this.pouleDuoSvc.creerPoule(this.phaseSelectionnee.id, nom).pipe(
        catchError(err => { this.erreurPoule = err?.error?.message ?? 'Échec de la création de la poule.'; return of(null); }),
        finalize(() => { this.creationPouleEnCours = false; })
      ).subscribe(poule => {
        if (!poule) return;
        this.poulesSession = [...this.poulesSession, { ...poule, candidats: [] }];
        this.formPoule.reset({ nom: '' });
      })
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
        catchError(err => { this.erreurAffectation = err?.error?.message ?? 'Échec de l\'affectation (un candidat est peut-être déjà dans une poule de cette phase).'; return of(null); }),
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

  // ── Duos (mode duo) ─────────────────────────────────────────────────────
  creerDuo(): void {
    if (this.formDuo.invalid || !this.phaseSelectionnee) { this.formDuo.markAllAsTouched(); return; }
    const v = this.formDuo.getRawValue();
    if (v.candidat1Id === v.candidat2Id) { this.erreurDuo = 'Les deux candidats doivent être distincts.'; return; }
    this.erreurDuo = null;
    this.creationDuoEnCours = true;
    this.sub.add(
      this.pouleDuoSvc.creerDuo(this.phaseSelectionnee.id, v.candidat1Id, v.candidat2Id, v.chansonCommune || undefined).pipe(
        catchError(err => { this.erreurDuo = err?.error?.message ?? 'Échec de la création du duo.'; return of(null); }),
        finalize(() => { this.creationDuoEnCours = false; })
      ).subscribe(duo => {
        if (!duo) return;
        this.duos = [...this.duos, duo];
        this.formDuo.reset({ candidat1Id: '', candidat2Id: '', chansonCommune: '' });
      })
    );
  }
}
