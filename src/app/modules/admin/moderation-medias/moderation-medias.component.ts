import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of, catchError, switchMap } from 'rxjs';

import { MomentEvenementService, CreerMomentAdminRequest } from '@core/services/moment-evenement.service';
import { MediaService } from '@core/services/media.service';
import { CandidatService } from '@core/services/candidat.service';
import { SoireeService } from '@core/services/soiree.service';
import { EditionService } from '@core/services/edition.service';
import { CandidatPublicResponse, MomentEvenement, SoireeEvent, StatutProfilCandidat, TypeMoment } from '@core/models';
import { ModalComponent } from '../shared/ui/modal/modal.component';

/** Fichier en attente d'envoi dans la modal "Ajouter des médias" — un par ligne de la liste de sélection. */
interface FichierEnAttente {
  file: File;
  type: TypeMoment;
}

/**
 * "Moments de l'événement" — file de modération des envois candidats + ajout direct
 * admin/organisateur (publié immédiatement, avec candidats tagués/soirée/légende —
 * réservés à ce second chemin, décision produit confirmée).
 */
@Component({
  selector: 'app-moderation-medias',
  imports: [DatePipe, FormsModule, ModalComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Moments de l'événement</h1>
      <p class="page-header__subtitle">Envois candidats : visibles publiquement uniquement après validation. Tes propres ajouts sont publiés immédiatement.</p>
    </div>
  </div>

  <div class="toolbar">
    <button type="button" class="btn btn--primary" (click)="ouvrirAjout()">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Ajouter des médias
    </button>
  </div>

  @if (chargement) {
    <div class="skeleton-wrapper">
      @for (i of [1,2,3]; track i) { <div class="skeleton"></div> }
    </div>
  }

  @if (!chargement && erreur) {
    <div class="empty-state">
      <p>{{ erreur }}</p>
      <button type="button" class="btn btn--ghost" (click)="charger()">Réessayer</button>
    </div>
  }

  @if (!chargement && !erreur && enAttente.length === 0) {
    <div class="empty-state">
      <p>Aucun envoi en attente de validation.</p>
    </div>
  }

  @if (!chargement && enAttente.length > 0) {
    <p class="section-label">En attente de validation (candidats)</p>
    <div class="mod-list">
      @for (m of enAttente; track m.id) {
        <div class="mod-row">
          <div class="mod-row__photo">
            @if (m.type === 'VIDEO') {
              <video [src]="m.urlStockage" preload="metadata" muted></video>
            } @else {
              <img [src]="m.urlStockage" alt="" />
            }
          </div>
          <div class="mod-row__meta">
            <div class="mod-row__name">{{ m.candidatUploadeurCode || 'Candidat' }}</div>
            <div class="mod-row__sub">{{ m.type === 'VIDEO' ? 'Vidéo' : 'Photo' }} · {{ m.dateUpload | date:'d MMM, HH:mm' }}</div>
          </div>
          <div class="mod-row__actions">
            <button type="button" class="btn btn--primary btn--sm" (click)="valider(m)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>
              Valider
            </button>
            <button type="button" class="btn btn--ghost btn--sm" (click)="mettreALaUne(m)">
              <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4Z"/></svg>
              À la une
            </button>
            <button type="button" class="btn btn--danger btn--sm" (click)="ouvrirRejet(m)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Rejeter
            </button>
          </div>
        </div>
      }
    </div>
  }

  @if (!chargement && publies.length > 0) {
    <p class="section-label">Médias publiés</p>
    <div class="mod-list">
      @for (m of publies; track m.id) {
        <div class="mod-row">
          <div class="mod-row__photo">
            @if (m.type === 'VIDEO') {
              <video [src]="m.urlStockage" preload="metadata" muted></video>
            } @else {
              <img [src]="m.urlStockage" alt="" />
            }
          </div>
          <div class="mod-row__meta">
            <div class="mod-row__name">{{ creditMoment(m) }}</div>
            <div class="mod-row__sub">{{ m.type === 'VIDEO' ? 'Vidéo' : 'Photo' }} · {{ m.dateUpload | date:'d MMM, HH:mm' }}</div>
          </div>
          <div class="mod-row__actions">
            <button type="button" class="btn btn--danger btn--sm" (click)="ouvrirSuppression(m)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              Supprimer
            </button>
          </div>
        </div>
      }
    </div>
  }

</div>

<!-- MODAL DE SUPPRESSION — confirmation avant suppression définitive -->
@if (suppressionCible) {
  <app-modal titre="Supprimer ce média" (fermer)="fermerSuppression()">
    <p class="modal-subtitle">
      Cette action est <strong>irréversible</strong>. Le média sera définitivement retiré de la galerie publique.
    </p>
    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" (click)="fermerSuppression()">Annuler</button>
      <button type="button" class="btn btn--danger" [disabled]="suppressionEnCours" (click)="confirmerSuppression()">
        {{ suppressionEnCours ? 'Suppression…' : 'Supprimer définitivement' }}
      </button>
    </div>
  </app-modal>
}

<!-- MODAL DE REJET — motif obligatoire, jamais un rejet en un clic -->
@if (rejetCible) {
  <app-modal titre="Rejeter ce moment" (fermer)="fermerRejet()">
    <p class="modal-subtitle">
      Le motif est communiqué à <strong>{{ rejetCible.candidatUploadeurCode }}</strong> par notification,
      pour qu'il/elle comprenne la décision et puisse envoyer autre chose.
    </p>
    <label for="motif-rejet">Motif du rejet <span class="requis">*</span></label>
    <textarea id="motif-rejet" rows="3" [(ngModel)]="motifRejet" placeholder="Ex. : photo floue, hors-sujet, contenu inapproprié…"></textarea>
    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" (click)="fermerRejet()">Annuler</button>
      <button type="button" class="btn btn--danger" [disabled]="!motifRejet.trim() || rejetEnCours" (click)="confirmerRejet()">
        {{ rejetEnCours ? 'Envoi…' : 'Confirmer le rejet' }}
      </button>
    </div>
  </app-modal>
}

<!-- MODAL "AJOUTER DES MÉDIAS" — admin/organisateur, plusieurs photos/vidéos en une fois -->
@if (ajoutOuvert) {
  <app-modal titre="Ajouter des médias" (fermer)="fermerAjout()">
    @if (ajoutErreur) { <div class="upload-erreur" role="alert">{{ ajoutErreur }}</div> }

    <div class="dropzone">
      <p class="dropzone__title">Glisse tes photos ou vidéos ici</p>
      <p class="dropzone__hint">
        Photo — JPG/PNG, 5 Mo max &nbsp;·&nbsp; Vidéo — MP4, 100 Mo max, aucune limite de durée<br>
        Plusieurs fichiers à la fois.
      </p>
      <label class="btn btn--primary">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
        Parcourir mes fichiers
        <input type="file" accept="image/jpeg,image/png,video/mp4" multiple (change)="onFichiersChoisis($event)" hidden />
      </label>
    </div>

    @if (fichiersEnAttente.length > 0) {
      <div class="fichiers-chips">
        @for (f of fichiersEnAttente; track f.file.name; let i = $index) {
          <span class="chip-fichier">
            {{ f.file.name }}
            <button type="button" aria-label="Retirer" (click)="retirerFichier(i)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </span>
        }
      </div>
    }

    <label>Candidats visibles sur ce média (facultatif, plusieurs possibles)</label>
    <div class="candidat-picker">
      @for (c of candidatsDisponibles; track c.id) {
        <label class="candidat-picker__item">
          <input type="checkbox" [checked]="candidatsCoches.has(c.id)" (change)="toggleCandidat(c.id)" />
          {{ c.codeCandidat }} · {{ c.prenom }} {{ c.nom }}
        </label>
      }
    </div>
    <p class="hint">Aucun candidat coché → publié crédité "Équipe NKS".</p>

    <label for="ajout-soiree">Soirée (facultatif)</label>
    <select id="ajout-soiree" [(ngModel)]="soireeChoisie">
      <option value="">— Non rattaché à une soirée précise —</option>
      @for (s of soireesDisponibles; track s.id) {
        <option [value]="s.id">{{ s.nom }}</option>
      }
    </select>

    <label for="ajout-legende">Légende (facultatif)</label>
    <textarea id="ajout-legende" rows="2" maxlength="140" [(ngModel)]="legende" placeholder="Ex. : L'ambiance explose pendant le passage de..."></textarea>
    <p class="hint hint--droite">{{ 140 - legende.length }} caractères restants</p>

    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" (click)="fermerAjout()">Annuler</button>
      <button type="button" class="btn btn--primary" [disabled]="fichiersEnAttente.length === 0 || ajoutEnCours" (click)="confirmerAjout()">
        {{ ajoutEnCours ? 'Publication…' : 'Publier' }}
      </button>
    </div>
  </app-modal>
}
`,
  styleUrls: ['./moderation-medias.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ModerationMediasComponent implements OnInit, OnDestroy {
  private momentSvc = inject(MomentEvenementService);
  private mediaSvc = inject(MediaService);
  private candidatSvc = inject(CandidatService);
  private soireeSvc = inject(SoireeService);
  private editionSvc = inject(EditionService);
  private sub = new Subscription();

  chargement = true;
  erreur: string | null = null;
  enAttente: MomentEvenement[] = [];
  publies: MomentEvenement[] = [];

  // ── Modal de suppression ──
  suppressionCible: MomentEvenement | null = null;
  suppressionEnCours = false;

  private editionId: string | null = null;

  // ── Modal de rejet ──
  rejetCible: MomentEvenement | null = null;
  motifRejet = '';
  rejetEnCours = false;

  // ── Modal "Ajouter des médias" ──
  ajoutOuvert = false;
  ajoutEnCours = false;
  ajoutErreur: string | null = null;
  fichiersEnAttente: FichierEnAttente[] = [];
  candidatsDisponibles: CandidatPublicResponse[] = [];
  candidatsCoches = new Set<string>();
  soireesDisponibles: SoireeEvent[] = [];
  soireeChoisie = '';
  legende = '';

  ngOnInit(): void {
    this.charger();
    this.sub.add(
      this.editionSvc.enCours().pipe(catchError(() => of(null))).subscribe(edition => {
        this.editionId = edition?.id ?? null;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  charger(): void {
    this.chargement = true;
    this.erreur = null;
    this.sub.add(
      forkJoin({
        attente: this.momentSvc.listerEnAttente().pipe(catchError(() => of(null))),
        publies: this.momentSvc.listerPublic(0, 50).pipe(catchError(() => of(null))),
      }).subscribe(({ attente, publies }) => {
        this.chargement = false;
        if (attente === null) { this.erreur = 'Impossible de charger les envois en attente.'; return; }
        this.enAttente = attente;
        this.publies = publies?.content ?? [];
      })
    );
  }

  valider(m: MomentEvenement): void {
    this.sub.add(
      this.momentSvc.valider(m.id).pipe(catchError(() => of(null))).subscribe(() => {
        this.enAttente = this.enAttente.filter(x => x.id !== m.id);
      })
    );
  }

  mettreALaUne(m: MomentEvenement): void {
    this.sub.add(
      this.momentSvc.mettreALaUne(m.id).pipe(catchError(() => of(null))).subscribe(() => {
        this.enAttente = this.enAttente.filter(x => x.id !== m.id);
      })
    );
  }

  ouvrirRejet(m: MomentEvenement): void {
    this.rejetCible = m;
    this.motifRejet = '';
  }

  fermerRejet(): void {
    this.rejetCible = null;
    this.rejetEnCours = false;
  }

  confirmerRejet(): void {
    if (!this.rejetCible || !this.motifRejet.trim() || this.rejetEnCours) return;
    this.rejetEnCours = true;
    const cible = this.rejetCible;
    this.sub.add(
      this.momentSvc.rejeter(cible.id, this.motifRejet.trim()).pipe(catchError(() => of(null))).subscribe(res => {
        this.rejetEnCours = false;
        if (!res) return;
        this.enAttente = this.enAttente.filter(x => x.id !== cible.id);
        this.fermerRejet();
      })
    );
  }

  creditMoment(m: MomentEvenement): string {
    return this.momentSvc.credit(m);
  }

  ouvrirSuppression(m: MomentEvenement): void {
    this.suppressionCible = m;
    this.suppressionEnCours = false;
  }

  fermerSuppression(): void {
    this.suppressionCible = null;
    this.suppressionEnCours = false;
  }

  confirmerSuppression(): void {
    if (!this.suppressionCible || this.suppressionEnCours) return;
    this.suppressionEnCours = true;
    const cible = this.suppressionCible;
    this.sub.add(
      this.momentSvc.supprimerAdmin(cible.id).pipe(catchError(() => of(null))).subscribe(() => {
        this.publies = this.publies.filter(x => x.id !== cible.id);
        this.fermerSuppression();
      })
    );
  }

  // ── "Ajouter des médias" ──

  ouvrirAjout(): void {
    this.ajoutOuvert = true;
    this.ajoutErreur = null;
    this.fichiersEnAttente = [];
    this.candidatsCoches.clear();
    this.soireeChoisie = '';
    this.legende = '';
    if (this.candidatsDisponibles.length === 0 && this.editionId) {
      this.chargerCandidatsDisponibles(this.editionId);
    }
    if (this.soireesDisponibles.length === 0 && this.editionId) {
      this.sub.add(
        this.soireeSvc.lister(this.editionId).pipe(catchError(() => of([]))).subscribe(s => { this.soireesDisponibles = s; })
      );
    }
  }

  fermerAjout(): void {
    this.ajoutOuvert = false;
  }

  /** Éliminés compris : ce ne sont pas seulement les candidats encore en lice qui peuvent apparaître sur une photo de l'événement. */
  private chargerCandidatsDisponibles(editionId: string): void {
    const statuts: StatutProfilCandidat[] = ['ACTIF', 'ELIMINE', 'FINALISTE', 'GAGNANT'];
    this.sub.add(
      forkJoin(statuts.map(s => this.candidatSvc.galerie(editionId, 0, 200, s).pipe(catchError(() => of({ content: [] as CandidatPublicResponse[], totalElements: 0, totalPages: 0, number: 0, size: 0 })))))
        .subscribe(pages => {
          const vus = new Set<string>();
          this.candidatsDisponibles = pages.flatMap(p => p.content)
            .filter(c => !vus.has(c.id) && vus.add(c.id))
            .sort((a, b) => a.codeCandidat.localeCompare(b.codeCandidat));
        })
    );
  }

  toggleCandidat(id: string): void {
    if (this.candidatsCoches.has(id)) this.candidatsCoches.delete(id);
    else this.candidatsCoches.add(id);
  }

  onFichiersChoisis(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    for (const file of files) {
      const estVideo = file.type === 'video/mp4';
      const estPhoto = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!estVideo && !estPhoto) continue;
      this.fichiersEnAttente.push({ file, type: estVideo ? 'VIDEO' : 'PHOTO' });
    }
    input.value = '';
  }

  retirerFichier(i: number): void {
    this.fichiersEnAttente.splice(i, 1);
  }

  confirmerAjout(): void {
    if (this.fichiersEnAttente.length === 0 || this.ajoutEnCours) return;
    this.ajoutEnCours = true;
    this.ajoutErreur = null;

    const candidatIds = Array.from(this.candidatsCoches);
    const soireeId = this.soireeChoisie || undefined;
    const legende = this.legende.trim() || undefined;

    const envois$ = this.fichiersEnAttente.map(({ file, type }) => {
      const upload$ = type === 'VIDEO'
        ? this.mediaSvc.uploadVideo(file, 'VIDEO_EVENEMENT')
        : this.mediaSvc.uploadPhoto(file, 'PHOTO_EVENEMENT');
      return upload$.pipe(
        switchMap(result => {
          const request: CreerMomentAdminRequest = {
            type, publicId: result.publicId, url: result.url, tailleOctets: result.tailleOctets,
            soireeId, candidatIds, legende,
          };
          return this.momentSvc.ajouterAdmin(request);
        }),
        catchError(() => of(null))
      );
    });

    this.sub.add(
      forkJoin(envois$).subscribe(resultats => {
        this.ajoutEnCours = false;
        const echecs = resultats.filter(r => r === null).length;
        if (echecs > 0) {
          this.ajoutErreur = `${echecs} fichier(s) n'ont pas pu être publiés. Réessaie.`;
          this.fichiersEnAttente = this.fichiersEnAttente.filter((_, i) => resultats[i] === null);
          return;
        }
        this.fermerAjout();
      })
    );
  }
}
