import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, forkJoin, of, catchError, switchMap, finalize } from 'rxjs';

import { AdminService, SmsBulkResponse, SMS_CANDIDATURE_VALIDEE, normaliserTelephone } from '@core/services/admin.service';
import { CandidatService } from '@core/services/candidat.service';
import { VideoService } from '@core/services/video.service';
import { MediaService } from '@core/services/media.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CandidatureDetailResponse, CandidatPublicResponse, Video, Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

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
  imports: [DatePipe, RouterModule, ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Candidatures</h1>
      <p class="page-header__subtitle">Consulter, valider ou rejeter les candidatures soumises pour l'édition en cours.</p>
    </div>
  </div>

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

  <!-- Rattrapage SMS confirmation — visible uniquement sur le filtre "En attente de paiement" -->
  @if (filtreCourant === 'EN_ATTENTE_PAIEMENT') {
    <div class="sms-relance">
      <button type="button" class="btn btn--ghost btn--sm" [disabled]="smsEnCours" (click)="renvoyerSms()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {{ smsEnCours ? 'Envoi…' : 'Renvoyer le SMS de confirmation à tous' }}
      </button>
      @if (smsResultat) {
        <span class="sms-relance__resultat">
          {{ smsResultat.nbEnvoyes }} envoyé(s)
          @if (smsResultat.nbEchecs > 0) {
            <span class="sms-relance__echecs">, {{ smsResultat.nbEchecs }} échec(s)</span>
          }
        </span>
      }
      @if (smsErreur) {
        <span class="sms-relance__echecs">{{ smsErreur }}</span>
      }
    </div>
  }

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
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
              Voir le dossier
            </button>
            @if (c.statut === 'EN_ATTENTE') {
              <button type="button" class="btn btn--ok btn--sm" (click)="valider(c)" [disabled]="actionEnCours === c.id">
                @if (actionEnCours !== c.id) {
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                }
                {{ actionEnCours === c.id ? '…' : 'Valider' }}
              </button>
              <button type="button" class="btn btn--err btn--sm" (click)="ouvrirModalRejet(c)" [disabled]="actionEnCours === c.id">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                Rejeter
              </button>
            }
            @if (c.statut === 'EN_ATTENTE_PAIEMENT') {
              <button type="button" class="btn btn--ghost btn--sm" [disabled]="smsUnitaireEnCoursId === c.id" (click)="renvoyerSmsUnitaire(c)">
                @if (smsUnitaireEnCoursId !== c.id) {
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                }
                {{ smsUnitaireEnCoursId === c.id ? '…' : 'Renvoyer le SMS' }}
              </button>
              @if (smsUnitaireResultatId === c.id) {
                <span class="sms-unitaire-ok">Envoyé</span>
              }
              @if (smsUnitaireErreurId === c.id) {
                <span class="sms-unitaire-err">Échec</span>
              }
              <button type="button" class="btn btn--ghost btn--sm" [disabled]="whatsappUnitaireEnCoursId === c.id" (click)="renvoyerWhatsappUnitaire(c)">
                @if (whatsappUnitaireEnCoursId !== c.id) {
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                }
                {{ whatsappUnitaireEnCoursId === c.id ? '…' : 'Renvoyer via WhatsApp' }}
              </button>
              @if (whatsappUnitaireResultatId === c.id) {
                <span class="sms-unitaire-ok">Envoyé</span>
              }
              @if (whatsappUnitaireErreurId === c.id) {
                <span class="sms-unitaire-err">Échec</span>
              }
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
            <p class="modal__err" role="alert">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              {{ comp.erreur }}
            </p>
          }
          @if (comp.photoUrl; as photo) {
            <img [src]="photo" [alt]="d.prenom + ' ' + d.nom" class="modal__photo" />
          }
        }

        <div class="dossier__champ"><strong>Statut :</strong> <span class="badge" [class]="badgeClass(d.statut)">{{ d.statut }}</span></div>
        <div class="dossier__champ"><strong>Contact :</strong> {{ d.email }} · {{ d.telephone }}</div>
        <div class="dossier__champ"><strong>Soumise le :</strong> {{ d.dateSoumission | date:'dd/MM/yyyy HH:mm' }}</div>

        @if (complement(d.id)?.candidat; as cd) {
          <div class="dossier__champ">
            <strong>Chanson de présélection :</strong>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            {{ cd.chansonPreselection }}
          </div>
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
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              Voir la capture d'abonnement Facebook/TikTok
            </a>
          </div>
        }

        @if (complement(d.id)?.videos?.length) {
          <div class="dossier__champ">
            <strong>Vidéo de présélection :</strong>
            @for (v of complement(d.id)?.videos; track v.id) {
              <div class="dossier__video-meta">
                <span>
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
                  {{ v.titreChanson }} — {{ dureeFormatee(v.dureeSecondes) }} — {{ statutVideoLabel(v.statut) }}
                </span>
                @if (v.urlStreaming) {
                  <a [href]="v.urlStreaming" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">
                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="m7 4 15 8-15 8V4z"/></svg>
                    Voir la vidéo
                  </a>
                } @else {
                  <span class="text-muted">Lien de lecture non disponible</span>
                }
                @if (v.statut === 'DISPONIBLE') {
                  <button type="button" class="btn btn--err btn--sm" [disabled]="masquageEnCoursId === v.id" (click)="videoAMasquer = v">
                    @if (masquageEnCoursId !== v.id) {
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    }
                    {{ masquageEnCoursId === v.id ? '…' : 'Masquer la vidéo' }}
                  </button>
                }
              </div>
            }
            @if (erreurMasquage) {
              <div class="modal__err" role="alert">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                {{ erreurMasquage }}
              </div>
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
              @if (actionEnCours !== d.id) {
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              }
              {{ actionEnCours === d.id ? '…' : 'Valider' }}
            </button>
            <button type="button" class="btn btn--err" (click)="ouvrirModalRejet(d)" [disabled]="actionEnCours === d.id">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              Rejeter
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

  <!-- Confirmation masquage vidéo -->
  @if (videoAMasquer; as v) {
    <app-confirm-dialog
      titre="Masquer cette vidéo"
      [message]="'Masquer « ' + v.titreChanson + ' » ? La vidéo ne sera plus visible publiquement ni dans la galerie candidat. Cette action peut être motivée par une modération de contenu.'"
      libelleConfirmer="Masquer"
      [danger]="true"
      [enCours]="masquageEnCoursId === v.id"
      (confirmed)="confirmerMasquage(v)"
      (cancelled)="videoAMasquer = null" />
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

  smsEnCours = false;
  smsResultat: SmsBulkResponse | null = null;
  smsErreur: string | null = null;

  smsUnitaireEnCoursId: string | null = null;
  smsUnitaireResultatId: string | null = null;
  smsUnitaireErreurId: string | null = null;

  /** Endpoint backend pas encore implémenté (POST /whatsapp/envoyer, cf. AdminService) — échoue en 404 pour l'instant. */
  whatsappUnitaireEnCoursId: string | null = null;
  whatsappUnitaireResultatId: string | null = null;
  whatsappUnitaireErreurId: string | null = null;

  /** Édition EN_COURS — nécessaire pour résoudre codeCandidat → CandidatPublicResponse (GET /candidats/code/{code}?editionId=). */
  private editionId: string | null = null;
  dossierOuvert: CandidatureDetailResponse | null = null;
  private complements = new Map<string, DetailComplement>();

  videoAMasquer: Video | null = null;
  masquageEnCoursId: string | null = null;
  erreurMasquage: string | null = null;

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
    this.erreurMasquage = null;
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
    this.smsResultat = null;
    this.smsErreur = null;
    this.chargerPage(0);
  }

  renvoyerSms(): void {
    this.smsEnCours = true;
    this.smsResultat = null;
    this.smsErreur = null;
    this.sub.add(
      this.adminSvc.renvoyerSmsConfirmation().pipe(
        catchError(err => { this.smsErreur = messageErreur(err, "Échec de l'envoi."); return of(null); })
      ).subscribe(res => {
        this.smsEnCours = false;
        if (res) this.smsResultat = res;
      })
    );
  }

  renvoyerSmsUnitaire(c: CandidatureDetailResponse): void {
    this.smsUnitaireEnCoursId = c.id;
    this.smsUnitaireResultatId = null;
    this.smsUnitaireErreurId = null;
    this.sub.add(
      this.adminSvc.envoyerSmsUnitaire(normaliserTelephone(c.telephone), SMS_CANDIDATURE_VALIDEE).pipe(
        catchError(() => { this.smsUnitaireErreurId = c.id; return of(null); })
      ).subscribe(res => {
        this.smsUnitaireEnCoursId = null;
        if (res) this.smsUnitaireResultatId = c.id;
      })
    );
  }

  /** POST /whatsapp/envoyer pas encore implémenté côté backend — échoue en 404 tant que Serge ne l'a pas ajouté. */
  renvoyerWhatsappUnitaire(c: CandidatureDetailResponse): void {
    this.whatsappUnitaireEnCoursId = c.id;
    this.whatsappUnitaireResultatId = null;
    this.whatsappUnitaireErreurId = null;
    this.sub.add(
      this.adminSvc.envoyerWhatsappUnitaire(normaliserTelephone(c.telephone), SMS_CANDIDATURE_VALIDEE).pipe(
        catchError(() => { this.whatsappUnitaireErreurId = c.id; return of(null); })
      ).subscribe(res => {
        this.whatsappUnitaireEnCoursId = null;
        if (res) this.whatsappUnitaireResultatId = c.id;
      })
    );
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

  dureeFormatee(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  statutVideoLabel(statut: string): string {
    const map: Record<string, string> = {
      EN_COURS_UPLOAD: 'En cours',
      DISPONIBLE:      'Disponible',
      MASQUEE:         'Masquée',
    };
    return map[statut] ?? statut;
  }

  /**
   * PUT /videos/{id}/masquer — modération de contenu. Met à jour localement le statut de la
   * vidéo dans le cache de complément (évite de recharger tout le dossier candidat).
   * 204 No Content : distinction succès/échec par indicateur local, pas par la valeur émise
   * (même pattern que ResultatsComponent.publier()).
   */
  confirmerMasquage(v: Video): void {
    this.masquageEnCoursId = v.id;
    this.erreurMasquage = null;
    let echec = false;
    this.sub.add(
      this.videoSvc.masquer(v.id).pipe(
        catchError(err => { echec = true; this.erreurMasquage = messageErreur(err, 'Échec du masquage de la vidéo.'); return of(undefined); }),
        finalize(() => { this.masquageEnCoursId = null; this.videoAMasquer = null; })
      ).subscribe(() => {
        if (echec || !this.dossierOuvert) return;
        const comp = this.complements.get(this.dossierOuvert.id);
        if (comp) {
          comp.videos = comp.videos.map(video => video.id === v.id ? { ...video, statut: 'MASQUEE' } : video);
        }
      })
    );
  }
}
