import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, forkJoin, catchError, of } from 'rxjs';

import { JuryService, CandidatBrut, NoteJuryBrut } from '@core/services/jury.service';
import { SoireeEvent } from '@core/models';

@Component({
  selector: 'app-jury-dashboard',
  imports: [DatePipe, RouterModule],
  template: `
<div class="jury-page">

  <div class="page-header">
    <h1 class="page-header__title">Tableau de bord</h1>
    <p class="page-header__subtitle">Notez les candidats de vos soirées assignées.</p>
  </div>

  <!-- Loading -->
  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement des soirées">
      <div class="sk sk--banner" aria-hidden="true"></div>
      @for (i of [1,2,3]; track i) {
        <div class="sk sk--card" aria-hidden="true"></div>
      }
    </div>
  }

  <!-- Erreur -->
  @if (!isLoading && erreur) {
    <div class="empty-state" role="alert">
      <svg class="icon icon--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <p>{{ erreur }}</p>
      <a routerLink="/" class="btn btn--ghost">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Accueil
      </a>
    </div>
  }

  <!-- Aucune soirée -->
  @if (!isLoading && !erreur && soirees.length === 0) {
    <div class="empty-state">
      <p>Aucune soirée assignée à votre compte.</p>
      <a routerLink="/" class="btn btn--ghost">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        Accueil
      </a>
    </div>
  }

  <!-- Contenu -->
  @if (!isLoading && !erreur && soirees.length > 0) {
    <!-- Sélecteur de soirée (si plusieurs) -->
    @if (soirees.length > 1) {
      <div class="soiree-tabs">
        @for (s of soirees; track s) {
          <button
            type="button"
            [attr.aria-pressed]="soireeSelectionnee?.id === s.id"
            class="soiree-tab"
            [class.soiree-tab--active]="soireeSelectionnee?.id === s.id"
            (click)="selectionnerSoiree(s)">
            {{ s.nom }}<br><small>{{ s.dateHeure | date:'dd/MM HH:mm' }}</small>
          </button>
        }
      </div>
    }
    <!-- Soirée banner -->
    @if (soireeSelectionnee) {
      <div class="phase-banner">
        <div class="phase-banner__label">Soirée sélectionnée</div>
        <div class="phase-banner__nom">{{ soireeSelectionnee.nom }}</div>
        <div class="phase-banner__sub">{{ soireeSelectionnee.dateHeure | date:'EEEE d MMMM yyyy, HH:mm' }} — {{ soireeSelectionnee.lieu }}</div>
        <div class="phase-banner__stats">
          <span class="stat"><strong>{{ candidats.length }}</strong> candidats</span>
          <span class="stat-sep">·</span>
          <span class="stat"><strong>{{ candidatsANoter.length }}</strong> à noter</span>
          <span class="stat-sep">·</span>
          <span class="stat"><strong>{{ candidatsNotes.length }}</strong> notés</span>
        </div>
      </div>
    }
    <!-- Chargement candidats -->
    @if (isLoadingCandidats) {
      <div class="skeletons" role="status" aria-label="Chargement des candidats">
        @for (i of [1,2,3]; track i) {
          <div class="sk sk--card" aria-hidden="true"></div>
        }
      </div>
    }
    @if (!isLoadingCandidats && soireeSelectionnee) {
      <!-- Candidats à noter -->
      @if (candidatsANoter.length) {
        <section class="section">
          <h2 class="section__title">À noter ({{ candidatsANoter.length }})</h2>
          <div class="cards">
            @for (c of candidatsANoter; track c) {
              <button type="button" class="card" (click)="noter(c)">
                <div class="card__avatar">{{ initiales(c) }}</div>
                <div class="card__info">
                  <div class="card__nom">{{ nomCandidat(c) }}</div>
                  <div class="card__code">{{ c.codeCandidat }}</div>
                  @if (c.chansonPreselection) {
                    <div class="card__chanson">
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      {{ c.chansonPreselection }}
                    </div>
                  }
                </div>
                <svg class="card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            }
          </div>
        </section>
      }
      <!-- Candidats notés -->
      @if (candidatsNotes.length) {
        <section class="section">
          <h2 class="section__title section__title--done">Notés ({{ candidatsNotes.length }})</h2>
          <div class="cards">
            @for (c of candidatsNotes; track c) {
              <button type="button" class="card card--done" (click)="noter(c)">
                <div class="card__avatar card__avatar--done">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="card__info">
                  <div class="card__nom">{{ nomCandidat(c) }}</div>
                  <div class="card__code">{{ c.codeCandidat }}</div>
                  <div class="card__score">Score : {{ totalScore(c.id) }} pts</div>
                </div>
                <svg class="card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            }
          </div>
        </section>
      }
      @if (!isLoadingCandidats && candidats.length === 0) {
        <div class="empty-state" style="padding-top:40px">
          <p>Aucun candidat n'est encore affecté à cette soirée.</p>
          <p class="empty-state__hint">Les candidats apparaissent ici une fois qu'un administrateur les a regroupés en poules ou en duos pour cette soirée — rien à faire de ton côté en attendant.</p>
        </div>
      }
    }
  }

</div>
`,
  styleUrls: ['./jury-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class JuryDashboardComponent implements OnInit, OnDestroy {
  private jurySvc = inject(JuryService);
  private router = inject(Router);

  isLoading = true;
  isLoadingCandidats = false;
  erreur: string | null = null;
  soirees: SoireeEvent[] = [];
  soireeSelectionnee: SoireeEvent | null = null;
  candidats: CandidatBrut[] = [];
  /** Map<candidatId, NoteJuryBrut[]> — notes déjà saisies par ce juré pour la soirée */
  private notesMap = new Map<string, NoteJuryBrut[]>();

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.jurySvc.mesSoirees().pipe(
        catchError(() => of(null))
      ).subscribe(soirees => {
        this.isLoading = false;
        if (soirees === null) {
          this.erreur = 'Impossible de charger les soirées (backend hors ligne ?)';
          return;
        }
        this.soirees = soirees;
        // Sélectionner automatiquement la soirée EN_COURS ou la première
        const active = soirees.find(s => s.statut === 'EN_COURS') ?? soirees[0] ?? null;
        if (active) this.selectionnerSoiree(active);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  selectionnerSoiree(s: SoireeEvent): void {
    this.soireeSelectionnee = s;
    this.candidats = [];
    this.notesMap.clear();
    this.isLoadingCandidats = true;

    // Charger candidats + mes notes en parallèle
    this.sub.add(
      forkJoin({
        candidats: this.jurySvc.candidatsPourSoiree(s.id).pipe(catchError(() => of([] as CandidatBrut[]))),
        notes:     this.jurySvc.mesNotes(s.id).pipe(catchError(() => of([] as NoteJuryBrut[]))),
      }).subscribe(({ candidats, notes }) => {
        this.isLoadingCandidats = false;
        this.candidats = candidats;

        // Construire notesMap : candidatId → NoteJuryBrut[]
        for (const n of notes) {
          const cid = n.candidatId;
          if (!this.notesMap.has(cid)) this.notesMap.set(cid, []);
          this.notesMap.get(cid)!.push(n);
        }
      })
    );
  }

  get candidatsANoter(): CandidatBrut[] {
    return this.candidats.filter(c => !this.notesMap.has(c.id));
  }
  get candidatsNotes(): CandidatBrut[] {
    return this.candidats.filter(c => this.notesMap.has(c.id));
  }

  totalScore(candidatId: string): number {
    const notes = this.notesMap.get(candidatId) ?? [];
    return notes.reduce((s, n) => s + n.valeur, 0);
  }

  nomCandidat(c: CandidatBrut): string {
    if (c.prenom || c.nom) return `${c.prenom} ${c.nom}`.trim();
    return c.codeCandidat;
  }

  initiales(c: CandidatBrut): string {
    if (c.prenom || c.nom) {
      return (c.prenom[0] ?? '') + (c.nom[0] ?? '');
    }
    return c.codeCandidat.slice(-2).toUpperCase();
  }

  noter(c: CandidatBrut): void {
    if (!this.soireeSelectionnee) return;
    this.router.navigate(['/jury/noter', c.id], {
      queryParams: { soireeId: this.soireeSelectionnee.id },
    });
  }
}
