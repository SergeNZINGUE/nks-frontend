import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { AppareilService } from '@core/services/appareil.service';
import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { CandidatVoteSurPlace, DroitVoteResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const MSG_APPAREIL_DEJA_UTILISE = 'Ce téléphone a déjà servi à voter pour un autre billet lors de cette soirée.';

/**
 * Page publique de vote sur place — accessible via le lien envoyé automatiquement par
 * WhatsApp après validation d'une consommation réelle par une hôtesse (cf. VoteSurPlaceService
 * côté backend). Aucune
 * authentification : la connaissance du qrUuid du billet suffit, comme pour le reste du
 * parcours billetterie public. Un seul vote possible par billet, jamais deux.
 */
@Component({
  selector: 'app-vote-sur-place',
  imports: [FormsModule, DatePipe],
  templateUrl: './vote-sur-place.component.html',
  styleUrls: ['./vote-sur-place.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class VoteSurPlaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private billetterieSvc = inject(BilletterieService);
  private appareilSvc = inject(AppareilService);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private cdr = inject(ChangeDetectorRef);

  private soireeId!: string;
  private qrUuid!: string;

  isLoading = true;
  isVoting = false;
  erreur: string | null = null;
  droit: DroitVoteResponse | null = null;
  candidatChoisi: string | null = null;
  /**
   * Blocage dur : ce téléphone a déjà servi à voter pour un autre billet de la soirée
   * (GET `appareilDejaUtilise` ou 409 code APPAREIL_DEJA_UTILISE au vote). État non répétable : formulaire masqué.
   */
  appareilBloque = false;
  messageBlocage: string | null = null;
  /** Autre conflit d'état (409 CONFLITETAT, ex. plus de vote disponible) : message serveur, titre neutre. */
  conflit: string | null = null;
  /** true une fois qu'il ne reste plus aucun vote disponible sur ce billet (0/N). */
  tousVotesUtilises = false;

  /** Ids de candidats dont la photo a échoué à charger — bascule sur le fallback initiales. */
  photoEnErreur = new Set<string>();

  /**
   * Champ facultatif, purement déclaratif — jamais vérifié ni requis pour voter. Sert
   * uniquement de trace d'audit a posteriori, comme protection contre un jeton intercepté
   * et utilisé par un tiers à la place du client.
   */
  telephoneVotant = '';

  /** Position capturée en best-effort via l'API Geolocation du navigateur — jamais bloquant
   *  si l'utilisateur refuse ou si le navigateur ne supporte pas l'API (audit uniquement). */
  private position: { lat: number; lon: number; precision: number } | null = null;

  ngOnInit(): void {
    this.soireeId = this.route.snapshot.paramMap.get('soireeId')!;
    this.qrUuid = this.route.snapshot.paramMap.get('qrUuid')!;

    this.appareilSvc.avecAppareil(h => this.billetterieSvc.consulterDroitVote(this.soireeId, this.qrUuid, h))
      .pipe(catchError(err => of({ __erreur: err })))
      .subscribe((res: any) => {
        this.isLoading = false;
        if (res?.__erreur) {
          this.erreur = messageErreur(res.__erreur,
            "Aucune consommation validée pour ce billet — demande au bar de valider ta commande.");
          return;
        }
        this.appliquerDroit(res);
        if (!this.tousVotesUtilises && !this.appareilBloque) this.capturerPosition();
      });
  }

  private appliquerDroit(res: DroitVoteResponse): void {
    this.droit = res;
    this.tousVotesUtilises = res.nbVotesDisponibles === 0;
    if (!this.tousVotesUtilises && res.appareilDejaUtilise) this.bloquer(MSG_APPAREIL_DEJA_UTILISE);
    this.chargerPhotos(res.candidats);
  }

  /** Résout la photo de profil de chaque candidat en parallèle (best-effort, silencieux si l'appel
   *  échoue — même pattern que ranking.component.chargerPhotos()). */
  private chargerPhotos(candidats: CandidatVoteSurPlace[]): void {
    if (candidats.length === 0) return;
    forkJoin(
      candidats.map(c => this.mediaSvc.mediasCandidat(c.id).pipe(catchError(() => of([]))))
    ).subscribe(resultats => {
      resultats.forEach((medias, i) => {
        candidats[i].photoUrl = this.mediaSvc.photoProfilUrl(medias);
      });
    });
  }

  /** Best-effort, silencieux en cas de refus/échec — ne bloque jamais le parcours de vote. */
  private capturerPosition(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.position = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: pos.coords.accuracy,
        };
      },
      () => { /* refusé ou indisponible — on continue sans, purement informatif */ },
      { timeout: 5000, maximumAge: 60000 },
    );
  }

  choisir(candidatId: string): void {
    if (this.tousVotesUtilises) return;
    this.candidatChoisi = candidatId;
  }

  /**
   * Vote pour le candidat choisi. Le billet peut porter plusieurs votes (1 de base + N bonus) :
   * tant que `nbVotesDisponibles > 0` après ce vote, on réaffiche la liste des candidats pour un
   * vote suivant au lieu de basculer directement sur l'état final "tous les votes sont utilisés".
   */
  confirmer(): void {
    if (!this.candidatChoisi || this.isVoting) return;
    this.isVoting = true;
    this.erreur = null;
    this.conflit = null;

    const audit = {
      telephoneVotant: this.telephoneVotant.trim() || undefined,
      positionLatitude: this.position?.lat,
      positionLongitude: this.position?.lon,
      positionPrecisionM: this.position?.precision,
    };
    // avecAppareil(): ajoute X-Appareil-Token/Empreinte et rejoue UNE fois sur 400 APPAREIL_INCONNU.
    this.appareilSvc.avecAppareil(h =>
      this.billetterieSvc.voterSurPlace(this.soireeId, this.qrUuid, this.candidatChoisi!, audit, h)
    ).subscribe({
      next: res => {
        this.isVoting = false;
        this.droit = res;
        this.candidatChoisi = null;
        this.tousVotesUtilises = res.nbVotesDisponibles === 0;
      },
      error: err => {
        this.isVoting = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          const message = messageErreur(err, MSG_APPAREIL_DEJA_UTILISE);
          if (this.appareilSvc.codeErreur(err) === 'APPAREIL_DEJA_UTILISE') {
            // Blocage dur : ce téléphone a déjà voté pour un autre billet — non répétable.
            this.bloquer(message);
          } else {
            // Autre conflit d'état (CONFLITETAT) : message serveur tel quel, titre neutre, et
            // rechargement du droit pour refléter les votes restants.
            this.conflit = message;
            this.candidatChoisi = null;
            this.recharger();
          }
          return;
        }
        this.erreur = this.appareilSvc.estAppareilInconnu(err)
          ? "Ce téléphone n'a pas pu être reconnu. Réessaie dans un instant."
          : messageErreur(err, "Impossible d'enregistrer ton vote.");
      },
    });
  }

  /** Relit le droit de vote (GET) après un conflit ; en cas d'échec on garde l'état affiché. */
  private recharger(): void {
    this.appareilSvc.avecAppareil(h => this.billetterieSvc.consulterDroitVote(this.soireeId, this.qrUuid, h))
      .pipe(catchError(() => of(null)))
      .subscribe(res => { if (res) this.appliquerDroit(res); });
  }

  private bloquer(message: string): void {
    this.appareilBloque = true;
    this.messageBlocage = message;
    this.erreur = null;
    this.candidatChoisi = null;
  }

  nomCandidat(c: { prenom: string; nom: string }): string {
    return `${c.prenom} ${c.nom}`.trim();
  }

  initiales(c: CandidatVoteSurPlace): string {
    return this.candidatSvc.initiales(c);
  }

  photoValide(c: CandidatVoteSurPlace): boolean {
    return !!c.photoUrl && !this.photoEnErreur.has(c.id);
  }

  /**
   * Mutation déclenchée par l'évènement natif `(error)` de l'`<img>`, jamais par une réponse
   * HTTP — nécessite un `detectChanges()` explicite en zoneless (même besoin que
   * ranking.component.onPhotoErreur()), sinon le fallback initiales ne s'affiche jamais.
   */
  onPhotoErreur(candidatId: string): void {
    this.photoEnErreur.add(candidatId);
    this.cdr.detectChanges();
  }
}
