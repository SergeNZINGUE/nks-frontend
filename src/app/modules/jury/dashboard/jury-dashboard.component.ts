import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, forkJoin, catchError, of, finalize } from 'rxjs';

import { JuryService, CandidatBrut, NoteJuryBrut, GrilleDeliberationResponse } from '@core/services/jury.service';
import { SoireeEvent } from '@core/models';
import { KpiCardComponent } from '../../admin/shared/ui/kpi-card/kpi-card.component';
import { GrilleDeliberationComponent } from '@shared/components/grille-deliberation/grille-deliberation.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-jury-dashboard',
  imports: [DatePipe, RouterModule, KpiCardComponent, GrilleDeliberationComponent, ConfirmDialogComponent],
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
        <div class="phase-banner__actions">
          @if (soireeSelectionnee?.statut === 'TERMINEE') {
            <div class="terminee-banner" role="alert">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg>
              Soirée terminée — la notation est clôturée.
            </div>
            <a routerLink="/classement-poules" [queryParams]="{ soireeId: soireeSelectionnee?.id }" class="btn btn--ghost">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
              Voir les résultats
            </a>
          }
          <button type="button" class="btn btn--ghost" [disabled]="chargementGrille" (click)="ouvrirGrilleDeliberation()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17V7h6l4 4v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
            {{ chargementGrille ? 'Chargement…' : 'Grille de délibération' }}
          </button>
          @if (erreurGrille) {
            <span class="field-hint" role="alert">{{ erreurGrille }}</span>
          }
          @if (!soireeSelectionnee?.votesArretesLe && !soireeSelectionnee?.deliberationVerrouilee) {
            <button type="button" class="btn btn--warn" [disabled]="arreterVotesEnCours" (click)="demandeArretVotes = true">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9"/></svg>
              {{ arreterVotesEnCours ? 'Arrêt…' : 'Arrêt des votes' }}
            </button>
          }
          @if (soireeSelectionnee?.votesArretesLe && !soireeSelectionnee?.deliberationVerrouilee) {
            <button type="button" class="btn btn--err" [disabled]="finDeliberationEnCours" (click)="demandeFinDeliberation = true">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              {{ finDeliberationEnCours ? 'Clôture…' : 'Fin délibération' }}
            </button>
          }
          @if (soireeSelectionnee?.deliberationVerrouilee) {
            <span class="badge-delib-ok">Délibération clôturée</span>
          }
          @if (messageAction) {
            <span class="field-hint" role="status" aria-live="polite" style="display:block;width:100%;margin-top:4px;">{{ messageAction }}</span>
          }
        </div>
        <div class="phase-banner__stats">
          <app-kpi-card label="Candidats" [value]="candidats.length" variant="gold">
            <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </app-kpi-card>
          <app-kpi-card label="À noter" [value]="candidatsANoter.length" variant="warning">
            <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </app-kpi-card>
          <app-kpi-card label="Notés" [value]="candidatsNotes.length" variant="success">
            <svg icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          </app-kpi-card>
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
      <!-- Candidats à noter (masqué si soirée terminée) -->
      @if (candidatsANoter.length && soireeSelectionnee?.statut !== 'TERMINEE') {
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

  @if (demandeArretVotes) {
    <app-confirm-dialog
      titre="Arrêt des votes"
      message="Figer la photo des votes (en ligne et sur place) pour la délibération ? Les votes seront capturés tels quels à cet instant. La grille de délibération affichera ces valeurs figées."
      libelleConfirmer="Arrêter les votes"
      [danger]="false"
      [enCours]="arreterVotesEnCours"
      [erreur]="erreurArretVotes"
      (confirmed)="confirmerArretVotes()"
      (cancelled)="demandeArretVotes = false; erreurArretVotes = null" />
  }

  @if (demandeFinDeliberation) {
    <app-confirm-dialog
      titre="Fin de délibération"
      message="Clôturer la délibération ? Les notes jury seront verrouillées et les scores des candidats éliminés seront définitivement figés. Les qualifiés conservent leurs points pour la phase suivante. Action irréversible."
      libelleConfirmer="Clôturer la délibération"
      [danger]="true"
      [enCours]="finDeliberationEnCours"
      [erreur]="erreurFinDeliberation"
      (confirmed)="confirmerFinDeliberation()"
      (cancelled)="demandeFinDeliberation = false; erreurFinDeliberation = null" />
  }

  @if (grille) {
    <app-grille-deliberation [grille]="grille" (fermer)="grille = null" />
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

  grille: GrilleDeliberationResponse | null = null;
  chargementGrille = false;
  erreurGrille: string | null = null;

  demandeArretVotes = false;
  arreterVotesEnCours = false;
  erreurArretVotes: string | null = null;

  demandeFinDeliberation = false;
  finDeliberationEnCours = false;
  erreurFinDeliberation: string | null = null;

  messageAction: string | null = null;

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
    this.messageAction = null;
    this.erreurArretVotes = null;
    this.erreurFinDeliberation = null;

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
    if (this.soireeSelectionnee.statut === 'TERMINEE') return;
    this.router.navigate(['/jury/noter', c.id], {
      queryParams: { soireeId: this.soireeSelectionnee.id },
    });
  }

  confirmerArretVotes(): void {
    if (!this.soireeSelectionnee) return;
    const id = this.soireeSelectionnee.id;
    this.arreterVotesEnCours = true;
    this.erreurArretVotes = null;
    let echec = false;
    this.sub.add(
      this.jurySvc.arreterVotesSoiree(id).pipe(
        catchError(err => { echec = true; this.erreurArretVotes = messageErreur(err, 'Échec de l\'arrêt des votes.'); return of(undefined); }),
        finalize(() => { this.arreterVotesEnCours = false; })
      ).subscribe(() => {
        if (echec) return;
        this.demandeArretVotes = false;
        const now = new Date().toISOString();
        this.soirees = this.soirees.map(s => s.id === id ? { ...s, votesArretesLe: now } : s);
        this.soireeSelectionnee = { ...this.soireeSelectionnee!, votesArretesLe: now };
        this.messageAction = 'Votes figés — la grille de délibération affiche désormais les scores au moment de l\'arrêt.';
      })
    );
  }

  confirmerFinDeliberation(): void {
    if (!this.soireeSelectionnee) return;
    const id = this.soireeSelectionnee.id;
    this.finDeliberationEnCours = true;
    this.erreurFinDeliberation = null;
    let echec = false;
    this.sub.add(
      this.jurySvc.cloturerDeliberationSoiree(id).pipe(
        catchError(err => { echec = true; this.erreurFinDeliberation = messageErreur(err, 'Échec de la clôture de délibération.'); return of(undefined); }),
        finalize(() => { this.finDeliberationEnCours = false; })
      ).subscribe(() => {
        if (echec) return;
        this.demandeFinDeliberation = false;
        this.soirees = this.soirees.map(s => s.id === id ? { ...s, deliberationVerrouilee: true } : s);
        this.soireeSelectionnee = { ...this.soireeSelectionnee!, deliberationVerrouilee: true };
        this.messageAction = 'Délibération clôturée — notes jury verrouillées, scores éliminés figés définitivement.';
      })
    );
  }

  ouvrirGrilleDeliberation(): void {
    if (!this.soireeSelectionnee) return;
    this.chargementGrille = true;
    this.erreurGrille = null;
    this.sub.add(
      this.jurySvc.grilleDeliberation(this.soireeSelectionnee.id).pipe(
        finalize(() => this.chargementGrille = false)
      ).subscribe({
        next: (grille) => { this.grille = grille; },
        error: (err) => { this.erreurGrille = messageErreur(err, 'Impossible de charger la grille de délibération.'); },
      })
    );
  }
}
