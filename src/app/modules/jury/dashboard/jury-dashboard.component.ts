import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, forkJoin, catchError, of } from 'rxjs';

import { JuryService, CandidatBrut, NoteJuryBrut } from '@core/services/jury.service';
import { AuthService } from '@core/services/auth.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { SoireeEvent } from '@core/models';

@Component({
  selector: 'app-jury-dashboard',
  imports: [DatePipe, RouterModule, TopbarComponent],
  template: `
<div class="jury-page">

  <!-- Topbar -->
  <app-topbar title="Espace Jury" icon="⭐" [logout]="true" (logoutClick)="deconnecter()" />

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
      <p>⚠️ {{ erreur }}</p>
      <a routerLink="/" class="btn btn--ghost">← Accueil</a>
    </div>
  }

  <!-- Aucune soirée -->
  @if (!isLoading && !erreur && soirees.length === 0) {
    <div class="empty-state">
      <p>Aucune soirée assignée à votre compte.</p>
      <a routerLink="/" class="btn btn--ghost">← Accueil</a>
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
                    <div class="card__chanson">🎵 {{ c.chansonPreselection }}</div>
                  }
                </div>
                <div class="card__arrow" aria-hidden="true">→</div>
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
                <div class="card__avatar card__avatar--done">✓</div>
                <div class="card__info">
                  <div class="card__nom">{{ nomCandidat(c) }}</div>
                  <div class="card__code">{{ c.codeCandidat }}</div>
                  <div class="card__score">Score : {{ totalScore(c.id) }} pts</div>
                </div>
                <div class="card__arrow" aria-hidden="true">✏️</div>
              </button>
            }
          </div>
        </section>
      }
      @if (!isLoadingCandidats && candidats.length === 0) {
        <div class="empty-state" style="padding-top:40px">
          Aucun candidat assigné à cette soirée.
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
  private authSvc = inject(AuthService);
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
          const cid = n.candidat.id;
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
    if (c.utilisateur) return `${c.utilisateur.prenom} ${c.utilisateur.nom}`;
    return c.codeCandidat; // fallback si LAZY non chargé
  }

  initiales(c: CandidatBrut): string {
    if (c.utilisateur) {
      return (c.utilisateur.prenom[0] ?? '') + (c.utilisateur.nom[0] ?? '');
    }
    return c.codeCandidat.slice(-2).toUpperCase();
  }

  noter(c: CandidatBrut): void {
    if (!this.soireeSelectionnee) return;
    this.router.navigate(['/jury/noter', c.id], {
      queryParams: { soireeId: this.soireeSelectionnee.id },
    });
  }

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }
}
