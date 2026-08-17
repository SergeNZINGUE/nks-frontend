import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subscription, switchMap, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { ClassementService } from '@core/services/classement.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Phase, Edition, Classement, ResultatPhase } from '@core/models';

const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

/**
 * Message affiché à chaque appel cassé — cf. rapport LazyInitializationException du
 * 15/08/2026 : Classement.candidat / ResultatPhase.candidat (LAZY, sans @JsonIgnore) plantent
 * dès qu'il y a des données en base. Bug backend confirmé en live, pas une hypothèse.
 */
const MSG_BACKEND_CASSE =
  "Backend indisponible : LazyInitializationException connue sur cet endpoint (Candidat.utilisateur/.edition LAZY sans protection). Correction en attente côté backend.";

@Component({
  selector: 'app-resultats',
  imports: [DecimalPipe, TopbarComponent, ConfirmDialogComponent],
  template: `
<div class="page">
  <app-topbar title="Résultats & classement" icon="📈" backLink="/admin" backLabel="Retour à l'administration" />

  <div class="gap-banner" role="note">
    ⚠️ Écran câblé sur les 4 endpoints réels de <code>ClassementController</code>. 3 sur 4 sont
    aujourd'hui cassés côté backend (500 confirmé en test live) : seule la publication fonctionne.
    Les sections ci-dessous resteront en erreur tant que le correctif n'est pas déployé.
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
        </div>

        @if (erreurPhase) {
          <div class="field-error" role="alert" style="margin-top: 12px;">⚠️ {{ erreurPhase }}</div>
        }

        @if (resultatsPhase.length > 0) {
          <div class="table-wrap">
            <table class="tbl" aria-label="Résultats de la phase">
              <thead>
                <tr><th scope="col">Rang</th><th scope="col">Candidat</th><th scope="col">Votes</th><th scope="col">Jury</th><th scope="col">Public</th><th scope="col">Total</th><th scope="col">Statut</th></tr>
              </thead>
              <tbody>
                @for (r of resultatsPhase; track r) {
                  <tr>
                    <td>{{ r.rang }}</td>
                    <td>{{ nomCandidat(r.candidat) }}</td>
                    <td>{{ r.pointsVotes | number:'1.0-1' }}</td>
                    <td>{{ r.pointsJury | number:'1.0-1' }}</td>
                    <td>{{ r.pointsPublic | number:'1.0-1' }}</td>
                    <td><strong>{{ r.totalPoints | number:'1.0-1' }}</strong></td>
                    <td><span class="badge-tbl" [class]="'badge-tbl--' + r.statut">{{ r.statut }}</span></td>
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
                  <tr>
                    <td>{{ c.rangGlobal }}</td>
                    <td>{{ nomCandidat(c.candidat) }}</td>
                    <td><strong>{{ c.totalPoints | number:'1.0-1' }}</strong></td>
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
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', './resultats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ResultatsComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private classementSvc = inject(ClassementService);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  phases: Phase[] = [];

  phaseSelectionneeId = '';
  calculEnCours = false;
  erreurPhase: string | null = null;
  resultatsPhase: ResultatPhase[] = [];

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
   * `Candidat` n'a pas de champ prenom/nom en propre côté backend — uniquement via
   * `candidat.utilisateur` (LAZY, souvent absent tant que le bug LazyInit n'est pas corrigé).
   * Repli sur le code candidat, toujours présent, plutôt qu'un champ vide silencieux.
   */
  nomCandidat(c: { codeCandidat?: string; prenom?: string; nom?: string } | null | undefined): string {
    if (!c) return '—';
    if (c.prenom || c.nom) return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim();
    return c.codeCandidat ?? '—';
  }

  selectionnerPhase(phaseId: string): void {
    this.phaseSelectionneeId = phaseId;
    this.resultatsPhase = [];
    this.erreurPhase = null;
  }

  calculerClassement(): void {
    if (!this.phaseSelectionneeId) return;
    this.calculEnCours = true;
    this.erreurPhase = null;
    this.sub.add(
      this.classementSvc.calculerPhase(this.phaseSelectionneeId).pipe(
        catchError(() => { this.erreurPhase = MSG_BACKEND_CASSE; return of(null); }),
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
        catchError(() => { this.erreurGlobal = MSG_BACKEND_CASSE; return of(null); }),
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
}
