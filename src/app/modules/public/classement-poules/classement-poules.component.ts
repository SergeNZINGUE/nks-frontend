import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { forkJoin, interval, of, startWith, Subscription, switchMap, catchError } from 'rxjs';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';

import { ClassementService } from '@core/services/classement.service';
import { EditionService } from '@core/services/edition.service';
import { PouleDuoService } from '@core/services/poule-duo.service';
import { MediaService } from '@core/services/media.service';
import { CandidatService } from '@core/services/candidat.service';
import { CandidatPublicResponse, Phase, PouleResponse, ResultatPhase } from '@core/models';
import { environment } from '@env/environment';

import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { VoteModalComponent } from '@shared/components/vote-modal/vote-modal.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';

interface CandidatDansPoule {
  candidat: CandidatPublicResponse;
  resultat: ResultatPhase | null;
  rang: number;
}

interface PouleVue {
  poule: PouleResponse;
  candidats: CandidatDansPoule[];
}

@Component({
  selector: 'app-classement-poules',
  templateUrl: './classement-poules.component.html',
  styleUrls: ['./classement-poules.component.scss'],
  imports: [
    SiteHeaderComponent,
    TopbarComponent,
    BottomNavComponent,
    SiteFooterComponent,
    VoteModalComponent,
    StarMarkComponent,
    RouterLink,
    DecimalPipe,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ClassementPoulesComponent implements OnInit, OnDestroy {
  private classementSvc = inject(ClassementService);
  private editionSvc    = inject(EditionService);
  private pouleSvc      = inject(PouleDuoService);
  private mediaSvc      = inject(MediaService);
  private candidatSvc   = inject(CandidatService);
  private cdr           = inject(ChangeDetectorRef);

  phases: Phase[]               = [];
  phaseSelectionneeId: string | null = null;
  poules: PouleVue[]            = [];
  pouleSelectionneeId: string | null = null;
  loading  = true;
  lastUpdate = new Date();

  /** Phase avec voteActif=true — pilote l'affichage du CTA "Voter". */
  phaseActiveId: string | null  = null;
  candidatVote: CandidatPublicResponse | null = null;
  photoEnErreur = new Set<string>();

  private sub     = new Subscription();
  private pollSub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.editionSvc.enCours().subscribe(edition => {
        if (!edition) { this.loading = false; return; }

        this.editionSvc.phases(edition.id).pipe(catchError(() => of([]))).subscribe(phases => {
          this.phases       = phases;
          this.phaseActiveId = phases.find(p => p.voteActif)?.id ?? null;

          const defaut = phases.find(p => p.voteActif)
            ?? phases.find(p => p.statut === 'EN_COURS')
            ?? phases[phases.length - 1]
            ?? null;

          if (defaut) {
            this.changerPhase(defaut.id);
          } else {
            this.loading = false;
          }
        });
      })
    );
  }

  get poulesAffichees(): PouleVue[] {
    if (!this.pouleSelectionneeId) return this.poules;
    return this.poules.filter(p => p.poule.id === this.pouleSelectionneeId);
  }

  filtrerPoule(pouleId: string | null): void {
    this.pouleSelectionneeId = pouleId;
  }

  changerPhase(phaseId: string): void {
    this.phaseSelectionneeId = phaseId;
    this.pouleSelectionneeId = null;
    this.pollSub.unsubscribe();
    this.pollSub = new Subscription();
    this.loading = true;

    this.pouleSvc.poulesPhase(phaseId).pipe(
      catchError(() => of([] as PouleResponse[]))
    ).subscribe(poules => {
      if (!poules.length) {
        this.poules  = [];
        this.loading = false;
        return;
      }

      forkJoin(
        poules.map(p => this.pouleSvc.candidatsPoule(p.id).pipe(catchError(() => of([]))))
      ).subscribe(affs => {
        const tousCandidats: CandidatPublicResponse[] = [];

        this.poules = poules.map((poule, i) => {
          const candidats: CandidatDansPoule[] = affs[i].map(a => {
            tousCandidats.push(a.candidat);
            return { candidat: a.candidat, resultat: null, rang: 0 };
          });
          return { poule, candidats };
        });

        this.chargerPhotos(tousCandidats);
        this.demarrerPolling(phaseId);
      });
    });
  }

  private demarrerPolling(phaseId: string): void {
    const poll = interval(environment.pollIntervalMs).pipe(
      startWith(0),
      switchMap(() => this.classementSvc.parPhase(phaseId).pipe(catchError(() => of(null)))),
    ).subscribe(resultats => {
      if (resultats) {
        this.appliquerResultats(resultats);
        this.lastUpdate = new Date();
      }
      this.loading = false;
    });
    this.pollSub.add(poll);
  }

  private appliquerResultats(resultats: ResultatPhase[]): void {
    const map = new Map(resultats.map(r => [r.candidatId, r]));
    for (const pVue of this.poules) {
      pVue.candidats.forEach(c => c.resultat = map.get(c.candidat.id) ?? null);
      pVue.candidats.sort((a, b) => {
        const diff = (b.resultat?.totalPoints ?? 0) - (a.resultat?.totalPoints ?? 0);
        return diff !== 0 ? diff : a.candidat.codeCandidat.localeCompare(b.candidat.codeCandidat);
      });
      pVue.candidats.forEach((c, i) => c.rang = i + 1);
    }
  }

  private chargerPhotos(candidats: CandidatPublicResponse[]): void {
    if (!candidats.length) return;
    forkJoin(
      candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
    ).subscribe(resultats => {
      resultats.forEach((medias, i) => {
        candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias);
      });
    });
  }

  phaseName(phase: Phase): string {
    const labels: Record<string, string> = {
      PRESELECTION: 'Présélection',
      ELIMINATOIRES: 'Éliminatoires',
      DEMI_FINALE: 'Demi-finale',
      FINALE: 'Finale',
    };
    return labels[phase.nom] ?? phase.nom;
  }

  initiales(c: CandidatPublicResponse): string { return this.candidatSvc.initiales(c); }

  photoValide(c: CandidatPublicResponse): boolean {
    return !!c.photoUrl && !this.photoEnErreur.has(c.id);
  }

  onPhotoErreur(c: CandidatPublicResponse): void {
    this.photoEnErreur.add(c.id);
    this.cdr.detectChanges();
  }

  ouvrirVote(c: CandidatPublicResponse): void {
    this.candidatVote = c;
    this.cdr.detectChanges();
  }

  fermerVote(): void {
    this.candidatVote = null;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.pollSub.unsubscribe();
  }
}
