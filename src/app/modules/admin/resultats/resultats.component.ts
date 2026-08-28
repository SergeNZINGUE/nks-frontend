import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { ClassementService } from '@core/services/classement.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Phase, Edition, Classement, ResultatPhase } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { telechargerBlob } from '@core/utils/download.util';

const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

@Component({
  selector: 'app-resultats',
  imports: [DecimalPipe, ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Résultats &amp; classement</h1>
      <p class="page-header__subtitle">Calculer les classements par phase, publier les résultats officiels et gérer les repêchages.</p>
    </div>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="banner banner--err" role="alert">⚠️ {{ erreurChargement }}</div>
  }

  @if (!isLoading && !erreurChargement) {

    @if (phases.length === 0) {
      <div class="empty-state">Aucune phase sur l'édition en cours.</div>
    } @else {

      <div class="card">
        <h2 class="card__title">Classement par phase</h2>
        <div class="field field--sm">
          <label for="phaseSelect">Phase</label>
          <select id="phaseSelect" [value]="phaseSelectionneeId" (change)="selectionnerPhase($any($event.target).value)">
            @for (p of phases; track p.id) {
              <option [value]="p.id">{{ labelPhase(p.nom) }}</option>
            }
          </select>
        </div>

        <div class="form__actions" style="margin-top: 12px;">
          <button type="button" class="btn btn--primary" [disabled]="calculEnCours" (click)="calculerClassement()">
            {{ calculEnCours ? 'Calcul…' : '🔄 Calculer le classement de cette phase' }}
          </button>
          <button type="button" class="btn btn--ghost" [disabled]="!phaseSelectionneeId || exportVotesEnCours" (click)="exporterVotesCsv()">
            {{ exportVotesEnCours ? 'Export…' : '⬇ Exporter les votes (CSV)' }}
          </button>
        </div>

        @if (erreurPhase) {
          <div class="field-error" role="alert" style="margin-top: 12px;">⚠️ {{ erreurPhase }}</div>
        }
        @if (erreurExportVotes) {
          <div class="field-error" role="alert" style="margin-top: 12px;">⚠️ {{ erreurExportVotes }}</div>
        }

        @if (resultatsPhase.length > 0) {
          <div class="table-wrap">
            <table class="tbl" aria-label="Résultats de la phase">
              <thead>
                <tr><th scope="col">Rang</th><th scope="col">Candidat</th><th scope="col">Votes</th><th scope="col">Jury</th><th scope="col">Public</th><th scope="col">Total</th><th scope="col">Statut</th><th scope="col">Actions</th></tr>
              </thead>
              <tbody>
                @for (r of resultatsPhase; track r) {
                  <tr [class.tbl__row--rang1]="r.rang === 1">
                    <td>{{ r.rang }}</td>
                    <td>{{ nomCandidat(r) }}</td>
                    <td>{{ r.pointsVotesEnLigne | number:'1.0-1' }}</td>
                    <td>{{ r.pointsJury | number:'1.0-1' }}</td>
                    <td>{{ r.pointsPublicSurPlace | number:'1.0-1' }}</td>
                    <td><strong>{{ r.totalPoints | number:'1.0-1' }}</strong></td>
                    <td><span class="badge-tbl" [class]="'badge-tbl--' + r.statutQualification">{{ r.statutQualification }}</span></td>
                    <td>
                      @if (r.statutQualification === 'ELIMINE') {
                        <button type="button" class="btn btn--sm" [disabled]="repechageEnCoursId === r.id" (click)="ouvrirRepechage(r)">
                          {{ repechageEnCoursId === r.id ? '…' : '↩ Repêcher' }}
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

      <div class="card">
        <h2 class="card__title">Classement global (édition en cours)</h2>

        @if (chargementGlobal) {
          <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
        }

        @if (!chargementGlobal && erreurGlobal) {
          <div class="field-error" role="alert">⚠️ {{ erreurGlobal }}</div>
        }

        @if (!chargementGlobal && !erreurGlobal && classementGlobal.length === 0) {
          <div class="empty-state">Aucun classement publié pour l'instant.</div>
        }

        @if (!chargementGlobal && classementGlobal.length > 0) {
          <div class="table-wrap">
            <table class="tbl" aria-label="Classement global de l'édition">
              <thead><tr><th scope="col">Rang</th><th scope="col">Candidat</th><th scope="col">Total</th><th scope="col">Officiel</th></tr></thead>
              <tbody>
                @for (c of classementGlobal; track c) {
                  <tr [class.tbl__row--rang1]="c.rangGlobal === 1">
                    <td>{{ c.rangGlobal }}</td>
                    <td>{{ nomCandidat(c) }}</td>
                    <td><strong>{{ c.totalPointsCumules | number:'1.0-1' }}</strong></td>
                    <td>
                      @if (c.officiel) {
                        <span class="badge-tbl badge-tbl--officiel">✓ Officiel</span>
                      } @else {
                        <span class="badge-tbl badge-tbl--EN_ATTENTE">Provisoire</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="form__actions" style="margin-top: 16px;">
          <button type="button" class="btn btn--ok" [disabled]="publicationEnCours" (click)="demandePublication = true">
            {{ publicationEnCours ? 'Publication…' : '📣 Publier les résultats officiels de l\\'édition' }}
          </button>
        </div>
        @if (messagePublication) {
          <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messagePublication }}</div>
        }
      </div>
    }
  }

  @if (demandePublication && edition; as ed) {
    <app-confirm-dialog
      titre="Publier les résultats"
      [message]="'Publier officiellement le classement de l\\'édition « ' + ed.nom + ' » ? Cette action rend le classement visible publiquement.'"
      libelleConfirmer="Publier"
      [enCours]="publicationEnCours"
      (confirmed)="publier()"
      (cancelled)="demandePublication = false" />
  }

  <!-- Modal repêchage -->
  @if (resultatARepecher; as r) {
    <div class="modal-bg" (click)="fermerRepechage()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-repechage" (click)="$event.stopPropagation()">
        <h2 id="titre-repechage">Repêcher {{ nomCandidat(r) }}</h2>
        <label for="motifRepechage" class="sr-only">Motif du repêchage</label>
        <textarea id="motifRepechage"
          class="modal__textarea"
          [formControl]="motifRepechageCtrl"
          placeholder="Motif du repêchage (minimum 50 caractères, obligatoire — RM-43)"
          rows="4"></textarea>
        @if (motifRepechageCtrl.invalid && motifRepechageCtrl.touched) {
          <div class="modal__err" role="alert">
            Motif obligatoire (minimum 50 caractères).
          </div>
        }
        @if (erreurRepechage) {
          <div class="modal__err" role="alert">⚠️ {{ erreurRepechage }}</div>
        }
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="fermerRepechage()">Annuler</button>
          <button type="button" class="btn btn--ok"
            [disabled]="motifRepechageCtrl.invalid || repechageEnCoursId === r.id"
            (click)="confirmerRepechage()">
            {{ repechageEnCoursId === r.id ? '…' : 'Confirmer le repêchage' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', './resultats.component.scss', '../candidatures/candidatures.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ResultatsComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private classementSvc = inject(ClassementService);
  private pouleDuoSvc = inject(PouleDuoService);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  phases: Phase[] = [];

  phaseSelectionneeId = '';
  calculEnCours = false;
  erreurPhase: string | null = null;
  resultatsPhase: ResultatPhase[] = [];

  exportVotesEnCours = false;
  erreurExportVotes: string | null = null;

  resultatARepecher: ResultatPhase | null = null;
  motifRepechageCtrl = new FormControl('', [Validators.required, Validators.minLength(50)]);
  repechageEnCoursId: string | null = null;
  erreurRepechage: string | null = null;

  chargementGlobal = false;
  erreurGlobal: string | null = null;
  classementGlobal: Classement[] = [];

  publicationEnCours = false;
  messagePublication: string | null = null;
  demandePublication = false;

  private sub = new Subscription();

  ngOnInit(): void {
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
        if (phases === null) { this.erreurChargement = 'Erreur de chargement (backend hors ligne ou aucune édition ?)'; return; }
        this.phases = phases;
        if (phases.length > 0) this.selectionnerPhase(phases[0].id);
        this.chargerGlobal();
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  labelPhase(n: string): string { return LABEL_PHASE[n] ?? n; }

  /**
   * `ClassementResponse`/`ResultatPhaseResponse` n'exposent que `codeCandidat` (pas de
   * prénom/nom : ces DTOs n'ont jamais renvoyé cette info, même avant l'alignement de contrat).
   */
  nomCandidat(c: { codeCandidat?: string } | null | undefined): string {
    return c?.codeCandidat ?? '—';
  }

  selectionnerPhase(phaseId: string): void {
    this.phaseSelectionneeId = phaseId;
    this.resultatsPhase = [];
    this.erreurPhase = null;
    this.erreurExportVotes = null;
  }

  calculerClassement(): void {
    if (!this.phaseSelectionneeId) return;
    this.calculEnCours = true;
    this.erreurPhase = null;
    this.sub.add(
      this.classementSvc.calculerPhase(this.phaseSelectionneeId).pipe(
        catchError(err => { this.erreurPhase = messageErreur(err, 'Échec du calcul du classement.'); return of(null); }),
        finalize(() => { this.calculEnCours = false; })
      ).subscribe(resultats => {
        if (resultats) this.resultatsPhase = resultats;
      })
    );
  }

  private chargerGlobal(): void {
    this.chargementGlobal = true;
    this.erreurGlobal = null;
    this.sub.add(
      this.classementSvc.global().pipe(
        catchError(err => { this.erreurGlobal = messageErreur(err, 'Erreur de chargement du classement global.'); return of(null); }),
        finalize(() => { this.chargementGlobal = false; })
      ).subscribe(classement => {
        if (classement) this.classementGlobal = classement;
      })
    );
  }

  publier(): void {
    if (!this.edition) return;
    this.publicationEnCours = true;
    this.messagePublication = null;
    let echec = false;
    this.sub.add(
      this.classementSvc.publier(this.edition.id).pipe(
        catchError(() => { echec = true; this.messagePublication = '⚠️ Échec de la publication.'; return of(undefined); }),
        finalize(() => { this.publicationEnCours = false; this.demandePublication = false; })
      ).subscribe(() => {
        if (!echec) {
          this.messagePublication = '✓ Résultats publiés.';
          this.chargerGlobal();
        }
      })
    );
  }

  /**
   * GET /admin/rapports/votes/export-csv?phaseId= — déclenche le téléchargement du CSV des
   * votes de la phase sélectionnée (blob, pas de rendu JSON).
   */
  exporterVotesCsv(): void {
    if (!this.phaseSelectionneeId) return;
    this.exportVotesEnCours = true;
    this.erreurExportVotes = null;
    this.sub.add(
      this.adminSvc.exportVotesCsv(this.phaseSelectionneeId).pipe(
        catchError(err => { this.erreurExportVotes = messageErreur(err, "Échec de l'export CSV des votes."); return of(null); }),
        finalize(() => { this.exportVotesEnCours = false; })
      ).subscribe(blob => {
        if (!blob) return;
        telechargerBlob(blob, `votes-phase-${this.phaseSelectionneeId}.csv`);
      })
    );
  }

  ouvrirRepechage(r: ResultatPhase): void {
    this.resultatARepecher = r;
    this.erreurRepechage = null;
    this.motifRepechageCtrl.reset('');
  }

  fermerRepechage(): void {
    this.resultatARepecher = null;
    this.erreurRepechage = null;
    this.motifRepechageCtrl.reset('');
  }

  /**
   * POST /candidats/{id}/repechage?phaseId= — RM-43 : motif obligatoire (>= 50 caractères,
   * validé aussi côté backend). Met à jour localement le statut de la ligne concernée en
   * REPECHAGE sans recharger toute la liste.
   */
  confirmerRepechage(): void {
    if (!this.resultatARepecher || this.motifRepechageCtrl.invalid || !this.phaseSelectionneeId) return;
    const r = this.resultatARepecher;
    const motif = this.motifRepechageCtrl.value as string;
    this.repechageEnCoursId = r.id;
    this.erreurRepechage = null;
    this.sub.add(
      this.pouleDuoSvc.repecher(r.candidatId, this.phaseSelectionneeId, motif).pipe(
        catchError(err => { this.erreurRepechage = messageErreur(err, 'Échec du repêchage.'); return of(null); }),
        finalize(() => { this.repechageEnCoursId = null; })
      ).subscribe(resultat => {
        if (!resultat) return;
        const idx = this.resultatsPhase.findIndex(x => x.id === r.id);
        if (idx !== -1) {
          this.resultatsPhase[idx] = { ...this.resultatsPhase[idx], statutQualification: 'REPECHAGE' };
        }
        this.fermerRepechage();
      })
    );
  }
}
