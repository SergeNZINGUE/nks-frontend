import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subscription, forkJoin, of, switchMap, catchError, finalize, map } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
import { Phase, Edition, CandidatPublicResponse, VoteCompteur } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

interface LigneVote {
  candidat: CandidatPublicResponse;
  compteur: VoteCompteur;
}

/**
 * Écran de suivi des votes — composé côté client à partir de deux endpoints déjà
 * exposés (GET /candidats galerie ACTIF + GET /votes/candidat/{id}?phaseId=), sans
 * endpoint dédié « liste des votes » côté backend. Remplace le placeholder
 * « Bientôt disponible » d'admin.routes.ts.
 */
@Component({
  selector: 'app-votes',
  imports: [DecimalPipe],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Votes</h1>
      <p class="page-header__subtitle">Suivi en temps réel des votes en ligne (payants), sociaux et sur place, par phase.</p>
    </div>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="banner banner--err" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreurChargement }}
    </div>
  }

  @if (!isLoading && !erreurChargement) {

    @if (phases.length === 0) {
      <div class="empty-state">Aucune phase ouverte au vote sur l'édition en cours.</div>
    } @else {

      <div class="card">
        <h2 class="card__title">Votes par candidat</h2>

        <div class="field field--sm">
          <label for="phaseSelect">Phase</label>
          <select id="phaseSelect" [value]="phaseSelectionneeId" (change)="selectionnerPhase($any($event.target).value)">
            @for (p of phases; track p.id) {
              <option [value]="p.id">{{ labelPhase(p.nom) }}</option>
            }
          </select>
        </div>

        @if (phaseSelectionnee(); as phase) {
          <div class="vote-status" [class.vote-status--on]="phase.voteActif" style="margin-top: 12px;">
            <span class="dot" aria-hidden="true"></span>
            {{ phase.voteActif ? 'Votes ouverts' : 'Votes fermés' }}
          </div>
        }

        <div class="form__actions" style="margin-top: 12px;">
          <button type="button" class="btn btn--ghost" [disabled]="chargementVotes" (click)="chargerVotes()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            {{ chargementVotes ? 'Actualisation…' : 'Actualiser' }}
          </button>
        </div>

        @if (erreurVotes) {
          <div class="field-error" role="alert" style="margin-top: 12px;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            {{ erreurVotes }}
          </div>
        }

        @if (chargementVotes) {
          <div class="skeletons" role="status" style="margin-top: 12px;"><div class="sk" aria-hidden="true"></div></div>
        }

        @if (!chargementVotes && !erreurVotes) {
          @if (lignes.length === 0) {
            <div class="empty-state">Aucun candidat actif sur cette édition.</div>
          } @else {
            <div class="table-wrap">
              <table class="tbl" aria-label="Votes par candidat">
                <thead>
                  <tr>
                    <th scope="col">Rang</th>
                    <th scope="col">Candidat</th>
                    <th scope="col">Payants</th>
                    <th scope="col">Sociaux</th>
                    <th scope="col">Sur place</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of lignes; track l.candidat.id; let i = $index) {
                    <tr [class.tbl__row--rang1]="i === 0 && l.compteur.total > 0">
                      <td>{{ i + 1 }}</td>
                      <td>{{ nomCandidat(l.candidat) }} · {{ l.candidat.codeCandidat }}</td>
                      <td>{{ l.compteur.votesPayants | number:'1.0-0' }}</td>
                      <td>{{ l.compteur.votesSociaux | number:'1.0-0' }}</td>
                      <td>{{ l.compteur.votesSurPlace | number:'1.0-0' }}</td>
                      <td><strong>{{ l.compteur.total | number:'1.0-0' }}</strong></td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" style="text-align: right; font-weight: 600;">Total général</td>
                    <td><strong>{{ totalGeneral | number:'1.0-0' }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        }
      </div>
    }
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../resultats/resultats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class VotesComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  phases: Phase[] = [];
  private candidats: CandidatPublicResponse[] = [];

  phaseSelectionneeId = '';
  chargementVotes = false;
  erreurVotes: string | null = null;
  lignes: LigneVote[] = [];

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.adminSvc.editions().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
          if (!active) return of(null);
          this.edition = active;
          return forkJoin({
            phases: this.adminSvc.phases(active.id),
            candidats: this.candidatSvc.galerie(active.id, 0, 200, 'ACTIF'),
          });
        }),
        catchError(() => of(null)),
      ).subscribe(res => {
        this.isLoading = false;
        if (res === null) { this.erreurChargement = 'Erreur de chargement (backend hors ligne ou aucune édition ?)'; return; }
        // Le vote n'existe pas sur la Présélection (phase de candidatures, pas de vote).
        this.phases = res.phases.filter(p => p.nom !== 'PRESELECTION');
        this.candidats = res.candidats.content;
        if (this.phases.length > 0) this.selectionnerPhase(this.phases[0].id);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  labelPhase(n: string): string { return LABEL_PHASE[n] ?? n; }

  phaseSelectionnee(): Phase | null {
    return this.phases.find(p => p.id === this.phaseSelectionneeId) ?? null;
  }

  nomCandidat(c: CandidatPublicResponse): string {
    return `${c.prenom} ${c.nom}`;
  }

  selectionnerPhase(phaseId: string): void {
    this.phaseSelectionneeId = phaseId;
    this.chargerVotes();
  }

  /**
   * Pas d'endpoint « liste des votes » côté backend : on interroge
   * GET /votes/candidat/{id}?phaseId= pour chaque candidat actif de l'édition.
   * Un échec isolé (ex. candidat sans aucun vote) retombe sur un compteur à zéro
   * plutôt que de casser tout le tableau.
   */
  chargerVotes(): void {
    if (!this.phaseSelectionneeId || this.candidats.length === 0) { this.lignes = []; return; }
    this.chargementVotes = true;
    this.erreurVotes = null;
    const phaseId = this.phaseSelectionneeId;
    this.sub.add(
      forkJoin(
        this.candidats.map(candidat =>
          this.voteSvc.compteur(candidat.id, phaseId).pipe(
            catchError(() => of<VoteCompteur>({ votesPayants: 0, votesSociaux: 0, votesSurPlace: 0, total: 0 })),
            map(compteur => ({ candidat, compteur }))
          )
        )
      ).pipe(
        catchError(err => { this.erreurVotes = messageErreur(err, 'Erreur de chargement des votes.'); return of([] as LigneVote[]); }),
        finalize(() => { this.chargementVotes = false; })
      ).subscribe(lignes => {
        this.lignes = [...lignes].sort((a, b) => b.compteur.total - a.compteur.total);
      })
    );
  }

  get totalGeneral(): number {
    return this.lignes.reduce((s, l) => s + l.compteur.total, 0);
  }
}
