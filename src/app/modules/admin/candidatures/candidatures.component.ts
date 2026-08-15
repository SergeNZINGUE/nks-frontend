import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, forkJoin, of, catchError, switchMap } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { CandidatService } from '@core/services/candidat.service';
import { VideoService } from '@core/services/video.service';
import { MediaService } from '@core/services/media.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { CandidatureDetailResponse, CandidatPublicResponse, Video, Page } from '@core/models';

type Filtre = 'TOUS' | 'EN_ATTENTE' | 'ACTIVE' |'VALIDEE'| 'REJETEE' | 'EN_ATTENTE_PAIEMENT';

interface DetailComplement {
  candidat: CandidatPublicResponse | null;
  videos: Video[];
  photoUrl: string | null;
  chargement: boolean;
  erreur: string | null;
}

@Component({
  selector: 'app-candidatures',
  imports: [DatePipe, RouterModule, ReactiveFormsModule, TopbarComponent],
  template: `
<div class="page">
  <app-topbar title="Candidatures" icon="📋" backLink="/admin" backLabel="Retour à l'administration" />

  <!-- Filtres -->
  <div class="filtres" role="group" aria-label="Filtrer par statut">
    @for (f of filtres; track f) {
      <button
        type="button"
        class="chip"
        [class.chip--active]="filtreCourant === f.val"
        [attr.aria-pressed]="filtreCourant === f.val"
        (click)="setFiltre(f.val)">
        {{ f.label }}
      </button>
    }
  </div>

  <!-- Loading -->
  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement des candidatures">
      @for (i of [1,2,3]; track i) {
        <div class="sk" aria-hidden="true"></div>
      }
    </div>
  }

  <!-- Erreur -->
  @if (!isLoading && erreur) {
    <div class="banner banner--err" role="alert">{{ erreur }}</div>
  }

  <!-- Liste CRUD -->
  @if (!isLoading && !erreur) {
    <div class="table" role="table" aria-label="Liste des candidatures">
      @if (page && page.content.length === 0) {
        <div class="empty">Aucune candidature pour ce filtre.</div>
      }
      @if (page && page.content.length > 0) {
        <div class="row row--head" role="row">
          <span role="columnheader">Code</span>
          <span role="columnheader">Candidat</span>
          <span role="columnheader">Statut</span>
          <span role="columnheader">Soumise le</span>
          <span role="columnheader">Actions</span>
        </div>
      }
      @for (c of page?.content; track c) {
        <div class="row" role="row">
          <span role="cell" class="row__code">{{ c.codeCandidat }}</span>
          <span role="cell" class="row__nom">
            {{ c.prenom }} {{ c.nom }}
            <small>{{ c.email }}</small>
          </span>
          <span role="cell"><span class="badge" [class]="badgeClass(c.statut)">{{ c.statut }}</span></span>
          <span role="cell" class="row__date">{{ c.dateSoumission | date:'dd/MM/yyyy HH:mm' }}</span>
          <span role="cell" class="row__actions">
            <button type="button" class="btn btn--ghost btn--sm" (click)="ouvrirDossier(c)">
              📁 Voir le dossier
            </button>
            @if (c.statut === 'EN_ATTENTE') {
              <button type="button" class="btn btn--ok btn--sm" (click)="valider(c)" [disabled]="actionEnCours === c.id">
                {{ actionEnCours === c.id ? '…' : '✓ Valider' }}
              </button>
              <button type="button" class="btn btn--err btn--sm" (click)="ouvrirModalRejet(c)" [disabled]="actionEnCours === c.id">
                ✗ Rejeter
              </button>
            }
          </span>
        </div>
      }
      <!-- Pagination -->
      @if (page && page.totalPages > 1) {
        <nav class="pagination" aria-label="Pagination">
          <button type="button" [disabled]="pageCourante === 0"
          aria-label="Page précédente" (click)="chargerPage(pageCourante - 1)">‹</button>
          <span aria-live="polite">{{ pageCourante + 1 }} / {{ page.totalPages }}</span>
          <button type="button" [disabled]="pageCourante >= page.totalPages - 1"
          aria-label="Page suivante" (click)="chargerPage(pageCourante + 1)">›</button>
        </nav>
      }
    </div>
  }

  <!-- Modal dossier complet -->
  @if (dossierOuvert; as d) {
    <div class="modal-bg" (click)="fermerDossier()">
      <div class="modal modal--dossier" role="dialog" aria-modal="true" aria-labelledby="titre-dossier"
        (click)="$event.stopPropagation()">
        <h2 id="titre-dossier">{{ d.codeCandidat }} — {{ d.prenom }} {{ d.nom }}</h2>

        @if (complement(d.id); as comp) {
          @if (comp.chargement) {
            <p class="modal__loading">Chargement du dossier…</p>
          }
          @if (comp.erreur) {
            <p class="modal__err" role="alert">⚠️ {{ comp.erreur }}</p>
          }
          @if (comp.photoUrl; as photo) {
            <img [src]="photo" [alt]="d.prenom + ' ' + d.nom" class="modal__photo" />
          }
        }

        <div class="dossier__champ"><strong>Statut :</strong> <span class="badge" [class]="badgeClass(d.statut)">{{ d.statut }}</span></div>
        <div class="dossier__champ"><strong>Contact :</strong> {{ d.email }} · {{ d.telephone }}</div>
        <div class="dossier__champ"><strong>Soumise le :</strong> {{ d.dateSoumission | date:'dd/MM/yyyy HH:mm' }}</div>

        @if (complement(d.id)?.candidat; as cd) {
          <div class="dossier__champ"><strong>Chanson de présélection :</strong> 🎵 {{ cd.chansonPreselection }}</div>
          @if (cd.biographie) {
            <div class="dossier__champ"><strong>Bio :</strong> {{ cd.biographie }}</div>
          }
        }

        @if (d.motivation) {
          <div class="dossier__champ dossier__motivation">
            <strong>Motivation :</strong>
            <p>{{ d.motivation }}</p>
          </div>
        }

        @if (d.captureFbTiktokUrl) {
          <div class="dossier__champ">
            <a [href]="d.captureFbTiktokUrl" target="_blank" rel="noopener" class="lien-inline">
              🖼️ Voir la capture d'abonnement Facebook/TikTok
            </a>
          </div>
        }

        @if (complement(d.id)?.videos?.length) {
          <div class="dossier__champ">
            <strong>Vidéo de présélection :</strong>
            @for (v of complement(d.id)?.videos; track v.id) {
              <p class="dossier__video-meta">
                🎬 {{ v.titreChanson }} — {{ v.dureeSecondes }}s — {{ v.statut }}
                @if (v.urlStreaming) {
                  <a [href]="v.urlStreaming" target="_blank" rel="noopener" class="lien-inline">lire</a>
                } @else {
                  <span class="text-muted"> (lien non disponible — gap backend)</span>
                }
              </p>
            }
          </div>
        }

        @if (d.motifRejet) {
          <div class="dossier__champ dossier__reject-reason">
            <strong>Motif rejet :</strong> {{ d.motifRejet }}
          </div>
        }

        <div class="modal__actions">
          @if (d.statut === 'EN_ATTENTE') {
            <button type="button" class="btn btn--ok" (click)="valider(d)" [disabled]="actionEnCours === d.id">
              {{ actionEnCours === d.id ? '…' : '✓ Valider' }}
            </button>
            <button type="button" class="btn btn--err" (click)="ouvrirModalRejet(d)" [disabled]="actionEnCours === d.id">
              ✗ Rejeter
            </button>
          }
          <button type="button" class="btn btn--ghost" (click)="fermerDossier()">Fermer</button>
        </div>
      </div>
    </div>
  }

  <!-- Modal rejet -->
  @if (candidatureArejeter) {
    <div class="modal-bg" (click)="fermerModal()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-rejet"
        (click)="$event.stopPropagation()">
        <h2 id="titre-rejet">Rejeter {{ candidatureArejeter.codeCandidat }} — {{ candidatureArejeter.prenom }}</h2>
        <label for="motif" class="sr-only">Motif de rejet</label>
        <textarea id="motif"
          class="modal__textarea"
          [formControl]="motifCtrl"
          placeholder="Motif de rejet (minimum 10 caractères, obligatoire)"
        rows="4"></textarea>
        @if (motifCtrl.invalid && motifCtrl.touched) {
          <div class="modal__err" role="alert">
            Motif obligatoire (minimum 10 caractères).
          </div>
        }
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="fermerModal()">Annuler</button>
          <button type="button" class="btn btn--err"
            [disabled]="motifCtrl.invalid || actionEnCours === candidatureArejeter.id"
            (click)="confirmerRejet()">
            {{ actionEnCours === candidatureArejeter.id ? '…' : 'Confirmer le rejet' }}
          </button>
        </div>
      </div>
    </div>
  }
</div>
`,
  styleUrls: ['./candidatures.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidaturesComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private candidatSvc = inject(CandidatService);
  private videoSvc = inject(VideoService);
  private mediaSvc = inject(MediaService);
  router = inject(Router);

  page: Page<CandidatureDetailResponse> | null = null;
  isLoading = true;
  erreur: string | null = null;
  filtreCourant: Filtre = 'EN_ATTENTE';
  pageCourante = 0;
  actionEnCours: string | null = null;
  candidatureArejeter: CandidatureDetailResponse | null = null;
  motifCtrl = new FormControl('', [Validators.required, Validators.minLength(10)]);

  /** Édition EN_COURS — nécessaire pour résoudre codeCandidat → CandidatPublicResponse (GET /candidats/code/{code}?editionId=). */
  private editionId: string | null = null;
  dossierOuvert: CandidatureDetailResponse | null = null;
  private complements = new Map<string, DetailComplement>();

  filtres: { val: Filtre; label: string }[] = [
    { val: 'EN_ATTENTE', label: 'En attente' },
    { val: 'ACTIVE',     label: 'Actives'    },
    { val: 'VALIDEE',    label: 'Validées'   },
    { val: 'EN_ATTENTE_PAIEMENT',    label: 'En attente de paiement'   },
    { val: 'REJETEE',    label: 'Rejetées'   },
    { val: 'TOUS',       label: 'Toutes'     },
  ];

  private sub = new Subscription();

  ngOnInit(): void {
    this.chargerPage(0);
    this.sub.add(
      this.adminSvc.editions().pipe(catchError(() => of([]))).subscribe(editions => {
        this.editionId = editions.find(e => e.statut === 'EN_COURS')?.id ?? editions[0]?.id ?? null;
      })
    );
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  complement(candidatureId: string): DetailComplement | undefined {
    return this.complements.get(candidatureId);
  }

  /**
   * Charge chanson/bio (GET /candidats/code/{code}) + métadonnées vidéo (GET /videos/candidat/{id})
   * + photo (GET /medias/candidat/{id}) à l'ouverture du dossier, pas à la construction de la liste
   * (N+1 évité sur une liste potentiellement longue). Mis en cache par candidature : réouvrir le même
   * dossier ne refait pas les appels.
   */
  ouvrirDossier(c: CandidatureDetailResponse): void {
    this.dossierOuvert = c;
    if (this.complements.has(c.id) || !this.editionId) return;

    const etat: DetailComplement = { candidat: null, videos: [], photoUrl: null, chargement: true, erreur: null };
    this.complements.set(c.id, etat);

    this.sub.add(
      this.candidatSvc.parCode(c.codeCandidat, this.editionId).pipe(
        switchMap(candidat => forkJoin({
          candidat: of(candidat),
          videos: this.videoSvc.videosCandidat(candidat.id).pipe(catchError(() => of([] as Video[]))),
          medias: this.mediaSvc.mediasCandidat(candidat.id).pipe(catchError(() => of([]))),
        })),
        catchError(() => of(null)),
      ).subscribe(res => {
        etat.chargement = false;
        if (!res) { etat.erreur = 'Impossible de charger les détails du candidat.'; return; }
        etat.candidat = res.candidat;
        etat.videos = res.videos;
        etat.photoUrl = this.mediaSvc.photoProfilUrl(res.medias);
      })
    );
  }

  fermerDossier(): void {
    this.dossierOuvert = null;
  }

  setFiltre(f: Filtre): void {
    this.filtreCourant = f;
    this.chargerPage(0);
  }

  chargerPage(p: number): void {
    this.isLoading = true;
    this.erreur = null;
    const statut = this.filtreCourant === 'TOUS' ? null : this.filtreCourant;
    this.sub.add(
      this.adminSvc.candidatures(statut, p, 20)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          this.isLoading = false;
          if (!res) { this.erreur = 'Impossible de charger les candidatures (backend hors ligne ?)'; return; }
          this.page = res;
          this.pageCourante = p;
        })
    );
  }

  valider(c: CandidatureDetailResponse): void {
    this.actionEnCours = c.id;
    this.sub.add(
      this.adminSvc.valider(c.id)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          this.actionEnCours = null;
          if (!res) { this.erreur = 'Erreur lors de la validation'; return; }
          this.fermerDossier(); // statut affiché deviendrait immédiatement obsolète sinon
          this.chargerPage(this.pageCourante);
        })
    );
  }

  /** Échap ferme la modale au premier plan (rejet, puis dossier) quel que soit l'élément ayant le focus */
  @HostListener('document:keydown.escape')
  onEchap(): void {
    if (this.candidatureArejeter) { this.fermerModal(); return; }
    if (this.dossierOuvert) this.fermerDossier();
  }

  ouvrirModalRejet(c: CandidatureDetailResponse): void {
    this.candidatureArejeter = c;
    this.motifCtrl.reset('');
  }

  fermerModal(): void {
    this.candidatureArejeter = null;
    this.motifCtrl.reset('');
  }

  confirmerRejet(): void {
    if (!this.candidatureArejeter || this.motifCtrl.invalid) return;
    const id = this.candidatureArejeter.id;
    const motif = this.motifCtrl.value as string;
    this.actionEnCours = id;
    this.sub.add(
      this.adminSvc.rejeter(id, motif)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          this.actionEnCours = null;
          this.fermerModal();
          if (!res) { this.erreur = 'Erreur lors du rejet'; return; }
          this.fermerDossier();
          this.chargerPage(this.pageCourante);
        })
    );
  }

  badgeClass(statut: string): string {
    return 'badge badge-' + statut.toLowerCase().replace('_', '');
  }
}
