import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, Subscription, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { JuryService, CandidatBrut, NoteJuryBrut } from '@core/services/jury.service';
import { SoireeEvent } from '@core/models';
import { KpiCardComponent } from '../../admin/shared/ui/kpi-card/kpi-card.component';
import { ModalComponent } from '../../admin/shared/ui/modal/modal.component';

interface EntreeHistorique {
  soiree: SoireeEvent;
  candidat: CandidatBrut;
  notes: NoteJuryBrut[];
  totalPoints: number;
  dateSaisie: string;
}

@Component({
  selector: 'app-historique',
  imports: [DatePipe, RouterModule, KpiCardComponent, ModalComponent],
  template: `
<div class="jury-page">

  <div class="page-header">
    <h1 class="page-header__title">Historique de mes notations</h1>
    <p class="page-header__subtitle">Retrouve toutes les notes que tu as saisies, toutes soirées confondues.</p>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement de l'historique">
      <div class="sk sk--banner" aria-hidden="true"></div>
      @for (i of [1,2,3]; track i) {
        <div class="sk sk--card" aria-hidden="true"></div>
      }
    </div>
  }

  @if (!isLoading && erreur) {
    <div class="empty-state" role="alert">
      <svg class="icon icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <p>{{ erreur }}</p>
    </div>
  }

  @if (!isLoading && !erreur && entrees.length === 0) {
    <div class="empty-state">
      <p>Tu n'as encore noté aucun candidat.</p>
      <a routerLink="/jury" class="btn btn--ghost">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Aller au tableau de bord
      </a>
    </div>
  }

  @if (!isLoading && !erreur && entrees.length > 0) {
    <div class="stats-banner">
      <app-kpi-card label="Candidats notés" [value]="entrees.length" variant="gold">
        <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </app-kpi-card>
      <app-kpi-card label="Soirées couvertes" [value]="nbSoirees" variant="info">
        <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </app-kpi-card>
      <app-kpi-card label="Score moyen" [value]="scoreMoyen" variant="success">
        <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      </app-kpi-card>
    </div>

    <section class="section">
      <div class="cards">
        @for (e of entrees; track e.candidat.id + e.soiree.id) {
          <button type="button" class="card card--done" (click)="voirDetail(e)">
            <div class="card__avatar card__avatar--done">{{ initiales(e.candidat) }}</div>
            <div class="card__info">
              <div class="card__nom">{{ nomCandidat(e.candidat) }}</div>
              <div class="card__code">{{ e.candidat.codeCandidat }}</div>
              <div class="card__soiree">{{ e.soiree.nom }} · {{ e.dateSaisie | date:'dd/MM/yyyy' }}</div>
              <div class="card__score">Score : {{ e.totalPoints }} pts</div>
            </div>
            <svg class="card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        }
      </div>
    </section>
  }

  @if (detailOuvert) {
    <app-modal [titre]="nomCandidat(detailOuvert.candidat)" (fermer)="fermerDetail()">
      <p class="detail-soiree">{{ detailOuvert.soiree.nom }} — {{ detailOuvert.dateSaisie | date:'EEEE d MMMM yyyy, HH:mm' }}</p>
      <ul class="criteres-list">
        @for (n of detailOuvert.notes; track n.id) {
          <li>
            <span>{{ n.critereNom }}</span>
            <strong>{{ n.valeur }} pts</strong>
          </li>
        }
      </ul>
      <div class="criteres-total">
        <span>Total</span>
        <strong>{{ detailOuvert.totalPoints }} pts</strong>
      </div>
    </app-modal>
  }

</div>
`,
  styleUrls: ['../dashboard/jury-dashboard.component.scss', './historique.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class HistoriqueComponent implements OnInit, OnDestroy {
  private jurySvc = inject(JuryService);

  isLoading = true;
  erreur: string | null = null;
  entrees: EntreeHistorique[] = [];
  detailOuvert: EntreeHistorique | null = null;

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.jurySvc.mesSoirees().pipe(
        switchMap(soirees => {
          if (!soirees.length) return of([] as EntreeHistorique[][]);
          return forkJoin(soirees.map(s => this.chargerSoiree(s)));
        }),
        catchError(() => of(null)),
        finalize(() => { this.isLoading = false; }),
      ).subscribe(groupes => {
        if (groupes === null) { this.erreur = 'Impossible de charger l\'historique (backend hors ligne ?)'; return; }
        this.entrees = groupes.flat().sort((a, b) => new Date(b.dateSaisie).getTime() - new Date(a.dateSaisie).getTime());
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  /** Une "entrée" par candidat déjà noté dans cette soirée — plusieurs notes (une par critère) agrégées. */
  private chargerSoiree(soiree: SoireeEvent): Observable<EntreeHistorique[]> {
    return forkJoin({
      notes: this.jurySvc.mesNotes(soiree.id).pipe(catchError(() => of([] as NoteJuryBrut[]))),
      candidats: this.jurySvc.candidatsPourSoiree(soiree.id).pipe(catchError(() => of([] as CandidatBrut[]))),
    }).pipe(
      map(({ notes, candidats }) => {
        const parCandidat = new Map<string, NoteJuryBrut[]>();
        for (const n of notes) {
          if (!parCandidat.has(n.candidatId)) parCandidat.set(n.candidatId, []);
          parCandidat.get(n.candidatId)!.push(n);
        }
        return Array.from(parCandidat.entries()).map(([candidatId, notesCandidat]) => {
          const candidat = candidats.find(c => c.id === candidatId)
            ?? { id: candidatId, codeCandidat: '—', prenom: '', nom: '', biographie: null, chansonPreselection: null, statutProfil: '' };
          return {
            soiree,
            candidat,
            notes: notesCandidat,
            totalPoints: notesCandidat.reduce((s, n) => s + n.valeur, 0),
            dateSaisie: notesCandidat.map(n => n.dateSaisie).sort().at(-1) ?? soiree.dateHeure,
          };
        });
      }),
    );
  }

  get nbSoirees(): number {
    return new Set(this.entrees.map(e => e.soiree.id)).size;
  }

  get scoreMoyen(): number {
    if (!this.entrees.length) return 0;
    return Math.round(this.entrees.reduce((s, e) => s + e.totalPoints, 0) / this.entrees.length);
  }

  nomCandidat(c: CandidatBrut): string {
    if (c.prenom || c.nom) return `${c.prenom} ${c.nom}`.trim();
    return c.codeCandidat;
  }

  initiales(c: CandidatBrut): string {
    if (c.prenom || c.nom) return (c.prenom[0] ?? '') + (c.nom[0] ?? '');
    return c.codeCandidat.slice(-2).toUpperCase();
  }

  voirDetail(e: EntreeHistorique): void {
    this.detailOuvert = e;
  }

  fermerDetail(): void {
    this.detailOuvert = null;
  }
}
