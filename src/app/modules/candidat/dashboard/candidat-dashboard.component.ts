import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable, Subscription, forkJoin, switchMap, catchError, finalize, map, of } from 'rxjs';

import { CandidatureService } from '@core/services/candidature.service';
import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { ParametresService } from '@core/services/parametres.service';
import { EditionService } from '@core/services/edition.service';
import { AuthService } from '@core/services/auth.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { KpiCardComponent } from '../../admin/shared/ui/kpi-card/kpi-card.component';
import { BadgeComponent, BadgeVariant } from '../../admin/shared/ui/badge/badge.component';
import { ModalComponent } from '../../admin/shared/ui/modal/modal.component';
import {
  CandidatureDetailResponse,
  CandidatPublicResponse,
  NomPhase,
  Phase,
  ResultatPhase,
  StatutCandidature,
  StatutQualification,
} from '@core/models';
import { environment } from '@env/environment';

interface MembrePoule {
  id: string;
  codeCandidat: string;
  prenom: string;
  nom: string;
}

interface MonAffectation {
  phaseLabel: string;
  texte: string;
  /** Uniquement pour type 'POULE' — le duo affiche déjà son partenaire dans `texte`. */
  membres?: MembrePoule[];
}

/** Même dictionnaire que resultats.component.ts (admin) — garder les deux alignés si une phase est renommée. */
const LABEL_PHASE: Record<string, string> = {
  PRESELECTION:  'Présélection',
  ELIMINATOIRES: 'Éliminatoires',
  DEMI_FINALE:   'Demi-finale',
  FINALE:        'Finale',
};

@Component({
  selector: 'app-candidat-dashboard',
  imports: [DatePipe, RouterModule, KpiCardComponent, BadgeComponent, ModalComponent],
  templateUrl: './candidat-dashboard.component.html',
  styleUrls: ['./candidat-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidatDashboardComponent implements OnInit, OnDestroy {
  private candidatureSvc = inject(CandidatureService);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private parametresSvc = inject(ParametresService);
  private editionSvc = inject(EditionService);
  private authSvc = inject(AuthService);
  private pouleDuoSvc = inject(PouleDuoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  erreur: string | null = null;
  candidature: CandidatureDetailResponse | null = null;
  profil: CandidatPublicResponse | null = null;
  photoPreview: string | null = null;
  photoErreur = false;
  scores: ResultatPhase[] = [];
  montantInscription = environment.inscriptionPriceFcfa;

  mesAffectations: MonAffectation[] = [];
  chargementAffectations = false;
  pouleMembresOuverte: MonAffectation | null = null;

  private sub = new Subscription();

  /**
   * maCandidature() fournit déjà le codeCandidat : on enchaîne directement sur
   * GET /candidats/code/{code} plutôt que de repasser par monProfil() (qui
   * rappellerait ma-candidature une seconde fois).
   */
  ngOnInit(): void {
    this.sub.add(
      this.parametresSvc.publics().pipe(catchError(() => of(null)))
        .subscribe(p => { if (p) this.montantInscription = p.prixInscriptionFcfa; })
    );

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
            .pipe(catchError(() => of(null)), map(profil => ({ profil, editionId: active.id })));
        }),
      ).subscribe(res => {
        this.profil = res?.profil ?? null;
        this.isLoading = false;

        if (res?.profil?.id) {
          const profilId = res.profil.id;
          this.sub.add(
            this.candidatSvc.scores(profilId)
              .pipe(catchError(() => of([])))
              .subscribe(s => (this.scores = s))
          );
          this.sub.add(
            this.mediaSvc.mediasCandidat(profilId)
              .pipe(catchError(() => of([])))
              .subscribe(medias => (this.photoPreview = this.mediaSvc.photoProfilUrl(medias)))
          );
          this.chargerAffectations(res.editionId, profilId);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  get montantInscriptionFormate(): string {
    return `${this.montantInscription.toLocaleString('fr-FR')} FCFA`;
  }

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

  /** statutClass ('warning'/'success'/'danger'/'default') → variante <app-badge>. */
  get statutBadgeVariant(): BadgeVariant {
    const map: Record<string, BadgeVariant> = { warning: 'warning', success: 'success', danger: 'error', default: 'neutral' };
    return map[this.statutClass] ?? 'neutral';
  }

  /** Même mapping que le badge de qualification du tableau des scores (admin resultats.component). */
  qualificationBadgeVariant(statut: StatutQualification): BadgeVariant {
    const map: Record<string, BadgeVariant> = { QUALIFIE: 'success', ELIMINE: 'error', EN_ATTENTE: 'warning', REPECHAGE: 'info' };
    return map[statut] ?? 'neutral';
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

  /**
   * Aucun endpoint backend ne renvoie directement "ma poule" / "mon duo" — reconstruit
   * côté client à partir des endpoints publics existants (GET /poules/phase/{id},
   * GET /poules/{id}/candidats, GET /duos/phase/{id}), phase par phase, hors Présélection
   * (pas de notion de poule/duo à ce stade). Volontairement lu-seul : jamais de modification
   * du backend nks-backend depuis ce projet.
   */
  private chargerAffectations(editionId: string, profilId: string): void {
    this.chargementAffectations = true;
    this.sub.add(
      this.editionSvc.phases(editionId).pipe(
        switchMap(phases => {
          const eligibles = phases.filter(p => p.nom !== 'PRESELECTION');
          if (!eligibles.length) return of([] as (MonAffectation | null)[]);
          return forkJoin(eligibles.map(phase => this.resoudreAffectation(phase, profilId)));
        }),
        catchError(() => of([] as (MonAffectation | null)[])),
        finalize(() => { this.chargementAffectations = false; }),
      ).subscribe(resultats => {
        this.mesAffectations = resultats.filter((r): r is MonAffectation => r !== null);
      })
    );
  }

  private resoudreAffectation(phase: Phase, profilId: string): Observable<MonAffectation | null> {
    if (phase.typePhase === 'DUO') {
      return this.pouleDuoSvc.duosPhase(phase.id).pipe(
        map(duos => {
          const duo = duos.find(d => d.candidat1.id === profilId || d.candidat2.id === profilId);
          if (!duo) return null;
          const partenaire = duo.candidat1.id === profilId ? duo.candidat2 : duo.candidat1;
          return { phaseLabel: this.labelPhase(phase.nom), texte: `Duo avec ${partenaire.prenom} ${partenaire.nom}` };
        }),
        catchError(() => of(null)),
      );
    }
    return this.pouleDuoSvc.poulesPhase(phase.id).pipe(
      switchMap(poules => {
        if (!poules.length) return of(null);
        return forkJoin(poules.map(poule =>
          this.pouleDuoSvc.candidatsPoule(poule.id).pipe(
            map(candidats => ({ nom: poule.nom, candidats, appartient: candidats.some(a => a.candidat.id === profilId) })),
            catchError(() => of({ nom: poule.nom, candidats: [], appartient: false })),
          )
        )).pipe(
          map(resultats => resultats.find(r => r.appartient) ?? null),
        );
      }),
      map(trouve => trouve ? {
        phaseLabel: this.labelPhase(phase.nom),
        texte: `Poule ${trouve.nom}`,
        membres: trouve.candidats
          .filter(a => a.candidat.id !== profilId)
          .map(a => ({ id: a.candidat.id, codeCandidat: a.candidat.codeCandidat, prenom: a.candidat.prenom, nom: a.candidat.nom })),
      } : null),
      catchError(() => of(null)),
    );
  }

  voirMembres(a: MonAffectation): void {
    this.pouleMembresOuverte = a;
  }

  fermerMembres(): void {
    this.pouleMembresOuverte = null;
  }

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }

  /**
   * Filet de secours pour les hôtes bloqués (réseau/CSP) qui ne déclenchent jamais
   * (error) — l'image se termine en "complete" mais avec naturalWidth=0.
   */
  verifierImage(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth === 0) { this.photoErreur = true; this.cdr.detectChanges(); }
  }

  onPhotoErreur(): void {
    this.photoErreur = true;
    this.cdr.detectChanges();
  }
}
