import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { DroitVoteResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

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

  private soireeId!: string;
  private qrUuid!: string;

  isLoading = true;
  isVoting = false;
  erreur: string | null = null;
  droit: DroitVoteResponse | null = null;
  candidatChoisi: string | null = null;
  /** true une fois qu'il ne reste plus aucun vote disponible sur ce billet (0/N). */
  tousVotesUtilises = false;

  /**
   * Champ facultatif, purement déclaratif — jamais vérifié ni requis pour voter. Sert
   * uniquement de trace d'audit a posteriori (cf. échange du 13/09/2026 sur le risque
   * qu'un jeton soit intercepté et utilisé par un tiers à la place du client).
   */
  telephoneVotant = '';

  /** Position capturée en best-effort via l'API Geolocation du navigateur — jamais bloquant
   *  si l'utilisateur refuse ou si le navigateur ne supporte pas l'API (audit uniquement). */
  private position: { lat: number; lon: number; precision: number } | null = null;

  ngOnInit(): void {
    this.soireeId = this.route.snapshot.paramMap.get('soireeId')!;
    this.qrUuid = this.route.snapshot.paramMap.get('qrUuid')!;

    this.billetterieSvc.consulterDroitVote(this.soireeId, this.qrUuid)
      .pipe(catchError(err => of({ __erreur: err })))
      .subscribe((res: any) => {
        this.isLoading = false;
        if (res?.__erreur) {
          this.erreur = messageErreur(res.__erreur,
            "Aucune consommation validée pour ce billet — demande au bar de valider ta commande.");
          return;
        }
        this.droit = res;
        if (res.nbVotesDisponibles === 0) this.tousVotesUtilises = true;
        else this.capturerPosition();
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

    this.billetterieSvc.voterSurPlace(this.soireeId, this.qrUuid, this.candidatChoisi, {
      telephoneVotant: this.telephoneVotant.trim() || undefined,
      positionLatitude: this.position?.lat,
      positionLongitude: this.position?.lon,
      positionPrecisionM: this.position?.precision,
    }).subscribe({
      next: res => {
        this.isVoting = false;
        this.droit = res;
        this.candidatChoisi = null;
        this.tousVotesUtilises = res.nbVotesDisponibles === 0;
      },
      error: err => {
        this.isVoting = false;
        this.erreur = messageErreur(err, "Impossible d'enregistrer ton vote.");
      },
    });
  }

  nomCandidat(c: { prenom: string; nom: string }): string {
    return `${c.prenom} ${c.nom}`.trim();
  }
}
