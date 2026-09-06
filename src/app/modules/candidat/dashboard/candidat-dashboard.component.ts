import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription, forkJoin, switchMap, catchError, of } from 'rxjs';

import { CandidatureService } from '@core/services/candidature.service';
import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { EditionService } from '@core/services/edition.service';
import { AuthService } from '@core/services/auth.service';
import {
  CandidatureDetailResponse,
  CandidatPublicResponse,
  NomPhase,
  ResultatPhase,
  StatutCandidature,
} from '@core/models';
import { environment } from '@env/environment';

/** Même dictionnaire que resultats.component.ts (admin) — garder les deux alignés si une phase est renommée. */
const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

@Component({
  selector: 'app-candidat-dashboard',
  imports: [DatePipe, RouterModule],
  templateUrl: './candidat-dashboard.component.html',
  styleUrls: ['./candidat-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidatDashboardComponent implements OnInit, OnDestroy {
  private candidatureSvc = inject(CandidatureService);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private editionSvc = inject(EditionService);
  private authSvc = inject(AuthService);
  private router = inject(Router);

  isLoading = true;
  erreur: string | null = null;
  candidature: CandidatureDetailResponse | null = null;
  profil: CandidatPublicResponse | null = null;
  photoPreview: string | null = null;
  scores: ResultatPhase[] = [];

  private sub = new Subscription();

  /**
   * maCandidature() fournit déjà le codeCandidat : on enchaîne directement sur
   * GET /candidats/code/{code} plutôt que de repasser par monProfil() (qui
   * rappellerait ma-candidature une seconde fois).
   */
  ngOnInit(): void {
    this.sub.add(
      forkJoin({
        candidature: this.candidatureSvc.maCandidature().pipe(catchError(() => of(null))),
        editions: this.editionSvc.lister().pipe(catchError(() => of([]))),
      }).pipe(
        switchMap(({ candidature, editions }) => {
          this.candidature = candidature;
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0];
          if (!candidature || !active) return of(null);
          return this.candidatSvc.parCode(candidature.codeCandidat, active.id)
            .pipe(catchError(() => of(null)));
        }),
      ).subscribe(profil => {
        this.profil = profil;
        this.isLoading = false;

        if (profil?.id) {
          this.sub.add(
            this.candidatSvc.scores(profil.id)
              .pipe(catchError(() => of([])))
              .subscribe(s => (this.scores = s))
          );
          this.sub.add(
            this.mediaSvc.mediasCandidat(profil.id)
              .pipe(catchError(() => of([])))
              .subscribe(medias => (this.photoPreview = this.mediaSvc.photoProfilUrl(medias)))
          );
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  /** Affiché dans le CTA de paiement — même source que mes-paiements.component.ts. */
  readonly montantInscriptionFormate =
    `${environment.inscriptionPriceFcfa.toLocaleString('fr-FR')} FCFA`;

  get initiales(): string {
    const c = this.candidature;
    if (!c) return '?';
    return `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase();
  }

  get statutClass(): string {
    const map: Record<StatutCandidature, string> = {
      EN_ATTENTE: 'warning',
      EN_ATTENTE_PAIEMENT: 'warning',
      VALIDEE: 'success',
      ACTIVE: 'success',
      REJETEE: 'danger',
    };
    return map[this.candidature?.statut as StatutCandidature] ?? 'default';
  }

  get statutLabel(): string {
    const map: Record<StatutCandidature, string> = {
      EN_ATTENTE: 'En attente de validation',
      EN_ATTENTE_PAIEMENT: 'Paiement en attente',
      VALIDEE: 'Validée',
      ACTIVE: 'Active',
      REJETEE: 'Rejetée',
    };
    return map[this.candidature?.statut as StatutCandidature] ?? (this.candidature?.statut ?? '');
  }

  get totalPoints(): number {
    return this.scores.reduce((sum, s) => sum + s.totalPoints, 0);
  }

  get meilleurRang(): number | null {
    if (!this.scores.length) return null;
    return Math.min(...this.scores.map(s => s.rang));
  }

  labelPhase(n: NomPhase | string): string {
    return LABEL_PHASE[n] ?? n;
  }

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }
}
