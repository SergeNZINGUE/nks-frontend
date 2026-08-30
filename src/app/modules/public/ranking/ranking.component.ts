import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { forkJoin, interval, Subscription, startWith, switchMap, catchError, of } from 'rxjs';
import { ClassementService } from '@core/services/classement.service';
import { EditionService } from '@core/services/edition.service';
import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { Classement, CandidatPublicResponse } from '@core/models';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';
import { VoteModalComponent } from '@shared/components/vote-modal/vote-modal.component';

@Component({
    selector: 'app-ranking',
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    BottomNavComponent,
    SiteFooterComponent,
    StarMarkComponent,
    VoteModalComponent,
    DecimalPipe,
    DatePipe
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class RankingComponent implements OnInit, OnDestroy {
  private classementSvc = inject(ClassementService);
  private editionSvc = inject(EditionService);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private cdr = inject(ChangeDetectorRef);

  classement: Classement[] = [];
  /** Profils (nom/photo) des candidats du classement — résolus séparément, cf. profilClasse(). */
  candidats: CandidatPublicResponse[] = [];
  loading = true;
  lastUpdate = new Date();

  /** null tant qu'aucune phase n'a voteActif=true — masque le CTA "Voter" (même garde que gallery.component). */
  phaseActiveId: string | null = null;

  /** Candidat ciblé par la modale de vote — null tant qu'aucune carte n'a déclenché "Voter". */
  candidatVote: CandidatPublicResponse | null = null;

  /** Ids de candidats dont la photo a échoué à charger — bascule sur le fallback initiales. */
  photoEnErreur = new Set<string>();

  private sub = new Subscription();

  ngOnInit(): void {
    this.editionSvc.enCours().subscribe(edition => {
      if (!edition) { this.loading = false; return; }

      this.editionSvc.phaseActive(edition.id).pipe(catchError(() => of(null))).subscribe(phase => {
        this.phaseActiveId = phase?.id ?? null;
      });

      // Taille 100 : couvre la quasi-totalité des compositions de candidats d'une édition —
      // seul le classement pilote l'ordre affiché, cette liste ne sert qu'à résoudre les profils.
      this.candidatSvc.galerie(edition.id, 0, 100).pipe(catchError(() => of(null))).subscribe(page => {
        this.candidats = page?.content ?? [];
        this.chargerPhotos(this.candidats);
      });

      // catchError DANS le switchMap (pas autour) : placé à l'extérieur, la première
      // erreur réseau terminerait le flux et le rafraîchissement s'arrêterait
      // définitivement — même bug déjà identifié et corrigé sur ce pattern ailleurs.
      const poll = interval(environment.pollIntervalMs).pipe(
        startWith(0),
        switchMap(() => this.classementSvc.global().pipe(catchError(() => of(null)))),
      ).subscribe(c => {
        if (c) { this.classement = c; this.lastUpdate = new Date(); }
        this.loading = false;
      });
      this.sub.add(poll);
    });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  /** Résout la photo de profil de chaque candidat en parallèle (best-effort, silencieux si l'appel échoue). */
  private chargerPhotos(candidats: CandidatPublicResponse[]): void {
    if (candidats.length === 0) return;
    forkJoin(
      candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
    ).subscribe(resultats => {
      resultats.forEach((medias, i) => {
        candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias);
      });
    });
  }

  /** Podium — les 3 premiers, dans l'ordre du classement (1er, 2e, 3e). */
  get podium(): Classement[] {
    return this.classement.slice(0, 3);
  }

  /** Reste du classement, à partir du 4e rang. */
  get reste(): Classement[] {
    return this.classement.slice(3);
  }

  /** Somme des points cumulés du classement affiché — repère d'engagement global de la soirée. */
  get totalPoints(): number {
    return this.classement.reduce((total, item) => total + item.totalPointsCumules, 0);
  }

  /**
   * Profil complet (prénom/nom/photo) d'une entrée de classement, si le candidat fait
   * partie de la liste chargée en parallèle — sinon `null` : le template retombe alors
   * sur `codeCandidat` seul plutôt que d'inventer un nom.
   */
  profilClasse(item: Classement): CandidatPublicResponse | null {
    return this.candidats.find(c => c.id === item.candidatId) ?? null;
  }

  initiales(item: Classement): string {
    const profil = this.profilClasse(item);
    return profil ? this.candidatSvc.initiales(profil) : item.codeCandidat.slice(-2).toUpperCase();
  }

  photoValide(item: Classement): boolean {
    const profil = this.profilClasse(item);
    return !!profil?.photoUrl && !this.photoEnErreur.has(item.candidatId);
  }

  /**
   * Mutation déclenchée par l'évènement natif `(error)` de l'`<img>`, jamais par une
   * réponse HTTP — nécessite un `detectChanges()` explicite en zoneless (même besoin que
   * gallery.component.onPhotoErreur()), sinon le fallback initiales ne s'affiche jamais.
   */
  onPhotoErreur(item: Classement): void {
    this.photoEnErreur.add(item.candidatId);
    this.cdr.detectChanges();
  }

  rankIcon(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;
  }

  /** Largeur proportionnelle de la barre — 100% pour le 1er, relative ensuite. */
  largeurBarre(item: Classement): number {
    const max = this.classement[0]?.totalPointsCumules;
    return max ? (item.totalPointsCumules / max) * 100 : 0;
  }

  ouvrirVote(item: Classement): void {
    const profil = this.profilClasse(item);
    if (!profil) return;
    this.candidatVote = profil;
    this.cdr.detectChanges();
  }

  fermerVote(): void {
    this.candidatVote = null;
    this.cdr.detectChanges();
  }
}
