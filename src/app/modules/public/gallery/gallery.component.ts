import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { CandidatService } from '@core/services/candidat.service';
import { EditionService } from '@core/services/edition.service';
import { MediaService } from '@core/services/media.service';
import { ClassementService } from '@core/services/classement.service';
import { MomentEvenementService } from '@core/services/moment-evenement.service';
import { CandidatPublicResponse, MomentEvenement, StatutProfilCandidat } from '@core/models';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';

import { RouterLink } from '@angular/router';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';
import { VoteModalComponent } from '@shared/components/vote-modal/vote-modal.component';

@Component({
    selector: 'app-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    BottomNavComponent,
    SiteFooterComponent,
    StarMarkComponent,
    VoteModalComponent
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class GalleryComponent implements OnInit {
  private candidatSvc = inject(CandidatService);
  private editionSvc = inject(EditionService);
  private mediaSvc = inject(MediaService);
  private classementSvc = inject(ClassementService);
  private momentSvc = inject(MomentEvenementService);
  private cdr = inject(ChangeDetectorRef);

  onglet: 'candidats' | 'evenement' = 'candidats';

  // ── Moments de l'événement ──────────────────────────────────────────────────
  moments: MomentEvenement[] = [];
  momentsLoading = false;
  momentsErreur: string | null = null;
  private momentsCharges = false;

  candidats: CandidatPublicResponse[] = [];
  loading = true;
  erreur: string | null = null;
  editionId: string | null = null;
  /** null tant qu'aucune phase n'a voteActif=true — masque le CTA "Voter" (même garde que candidate-profile.component). */
  phaseActiveId: string | null = null;

  /** Rang global par candidatId — résolu séparément (GET /classement), best-effort : silencieux si l'édition n'a pas encore de classement publié. */
  rangParCandidat: Record<string, number> = {};

  /** Ids de candidats dont la photo a échoué à charger (404/URL invalide) — bascule sur le fallback initiales, jamais l'icône d'image cassée native. */
  photoEnErreur = new Set<string>();

  /** Candidat ciblé par la modale de vote — null tant qu'aucune carte n'a déclenché "Voter". */
  candidatVote: CandidatPublicResponse | null = null;

  /**
   * Chargement en une seule page : l'édition compte quelques dizaines de candidats
   * (21 constatés en EN_COURS le 2026-09-14, backend n'impose aucun plafond de `size`
   * — vérifié via GET /candidats?...&size=500, `numberOfElements` = total réel). Une
   * valeur haute couvre la totalité sans pagination manuelle ni scroll infini, adapté
   * tant que le total reste de l'ordre de quelques centaines. À revoir (scroll infini)
   * si le volume de candidats par édition change d'ordre de grandeur.
   */
  pageSize = 500;
  totalElements = 0;

  filtreStatut: StatutProfilCandidat = 'ACTIF';

  readonly statutOptions: { label: string; value: StatutProfilCandidat }[] = [
    { label: 'Actifs',     value: 'ACTIF' },
    { label: 'Finalistes', value: 'FINALISTE' },
    { label: 'Tous',       value: 'EN_ATTENTE' },
  ];

  ngOnInit(): void {
    this.editionSvc.enCours().subscribe(edition => {
      this.editionId = edition?.id ?? null;
      if (this.editionId) {
        this.charger();
        this.editionSvc.phaseActive(this.editionId).subscribe(phase => {
          this.phaseActiveId = phase?.id ?? null;
        });
        this.classementSvc.global().pipe(catchError(() => of([]))).subscribe(classement => {
          this.rangParCandidat = Object.fromEntries(classement.map(c => [c.candidatId, c.rangGlobal]));
        });
      } else {
        this.loading = false;
      }
    });
  }

  charger(): void {
    if (!this.editionId) return;
    this.loading = true;
    this.erreur = null;
    this.candidatSvc.galerie(this.editionId, 0, this.pageSize, this.filtreStatut).subscribe({
      next: res => {
        this.candidats     = res.content;
        this.totalElements = res.totalElements;
        this.loading       = false;
        this.chargerPhotos(this.candidats);
      },
      // Une erreur serveur ne doit pas être présentée comme une liste vide :
      // l'utilisateur croirait qu'aucun candidat n'est inscrit.
      error: err => {
        this.loading  = false;
        this.candidats = [];
        this.totalElements = 0;
        this.erreur = err?.status === 0
          ? 'Serveur injoignable. Vérifie que l\'API est démarrée.'
          : `Impossible de charger les candidats (erreur ${err?.status ?? 'inconnue'}).`;
      },
    });
  }

  /**
   * Résout la photo de profil de chaque candidat en parallèle (GET /medias/candidat/{id} par candidat —
   * acceptable pour une page de 12 candidats, à revoir si le backend expose un jour un endpoint batch).
   * Échec individuel silencieux : fallback avatar-initiales déjà géré par le template.
   */
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

  onFiltreChange(statut: StatutProfilCandidat): void {
    this.filtreStatut = statut;
    this.charger();
  }

  initiales(c: CandidatPublicResponse): string {
    return this.candidatSvc.initiales(c);
  }

  /** Rang global du candidat si le classement est déjà connu, sinon null (n'affiche rien plutôt qu'inventer une donnée). */
  rang(c: CandidatPublicResponse): number | null {
    return this.rangParCandidat[c.id] ?? null;
  }

  photoValide(c: CandidatPublicResponse): boolean {
    return !!c.photoUrl && !this.photoEnErreur.has(c.id);
  }

  /**
   * Mutation déclenchée par l'évènement natif `(error)` de l'`<img>`, jamais par une
   * réponse HTTP — le filet de sécurité de `changeDetectionInterceptor` (qui ne force un
   * tick qu'après les réponses HttpClient, cf. son commentaire) ne couvre pas ce cas.
   * `detectChanges()` explicite indispensable, sinon le fallback ne s'affiche jamais
   * malgré l'état interne correctement mis à jour (confirmé en DevTools).
   */
  onPhotoErreur(c: CandidatPublicResponse): void {
    this.photoEnErreur.add(c.id);
    this.cdr.detectChanges();
  }

  /** Ouverture/fermeture de la modale : mutation purement locale (pas d'appel HTTP), même besoin de detectChanges() explicite que onPhotoErreur(). */
  ouvrirVote(c: CandidatPublicResponse): void {
    this.candidatVote = c;
    this.cdr.detectChanges();
  }

  fermerVote(): void {
    this.candidatVote = null;
    this.cdr.detectChanges();
  }

  // ── Moments de l'événement ──────────────────────────────────────────────────

  changerOnglet(o: 'candidats' | 'evenement'): void {
    this.onglet = o;
    if (o === 'evenement' && !this.momentsCharges) {
      this.chargerMoments();
    }
  }

  chargerMoments(): void {
    this.momentsCharges = true;
    this.momentsLoading = true;
    this.momentsErreur = null;
    this.momentSvc.listerPublic(0, 48).pipe(catchError(() => of(null))).subscribe(res => {
      this.momentsLoading = false;
      if (res === null) { this.momentsErreur = 'Impossible de charger les moments.'; return; }
      this.moments = res.content;
      this.cdr.detectChanges();
    });
  }

  /** Le moment mis en avant par l'équipe (enVedette), sinon le plus récent — jamais rien si la liste est vide. */
  get momentVedette(): MomentEvenement | null {
    return this.moments.find(m => m.enVedette) ?? this.moments[0] ?? null;
  }

  /** Les 8 plus récents, en tête de liste (déjà triés par date décroissante côté backend). */
  get momentsRecents(): MomentEvenement[] {
    return this.moments.slice(0, 8);
  }

  creditMoment(m: MomentEvenement): string {
    return this.momentSvc.credit(m);
  }

  estCreditEquipe(m: MomentEvenement): boolean {
    return this.momentSvc.estCreditEquipe(m);
  }
}
