import { ChangeDetectionStrategy, Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subscription, interval, of } from 'rxjs';
import { catchError, startWith, switchMap, takeWhile } from 'rxjs/operators';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
import { PaiementService } from '@core/services/paiement.service';
import { CandidatPublicResponse, InitierVoteResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { environment } from '@env/environment';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';

type VoteOption = { nb: number; label: string; prix: string };

/**
 * Modale de vote — même parcours que VoteComponent (page dédiée `/voter/:id`,
 * conservée pour l'accès direct/partage de lien), présenté ici sans quitter
 * la galerie : POST /votes/initier puis redirection vers la page de paiement
 * LigdiCash renvoyée par le backend (urlPaiement). Le candidat et la phase
 * active sont fournis par le parent (déjà résolus pour la galerie) plutôt que
 * rechargés ici.
 */
@Component({
  selector: 'app-vote-modal',
  templateUrl: './vote-modal.component.html',
  styleUrl: './vote-modal.component.scss',
  imports: [ModalComponent, ReactiveFormsModule, DecimalPipe, StarMarkComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class VoteModalComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);
  private paiementSvc = inject(PaiementService);

  candidat = input.required<CandidatPublicResponse>();
  phaseId = input.required<string>();

  closed = output<void>();

  submitting = signal(false);
  success = signal<InitierVoteResponse | null>(null);
  /** true une fois la page de paiement ouverte dans un nouvel onglet — l'onglet courant ne navigue jamais. */
  paiementOuvert = signal(false);
  error = signal<string | null>(null);
  photoErreur = signal(false);

  /**
   * Issue du paiement telle que constatée depuis CET onglet. Le paiement se déroule dans
   * un onglet séparé (décision produit) : sans ce suivi, l'onglet d'origine resterait
   * indéfiniment sur « ouvert dans un nouvel onglet » et le votant ne saurait jamais si
   * ses votes ont été crédités — sur mobile, il ne revient souvent que sur cet onglet-ci.
   */
  issuePaiement = signal<'attente' | 'confirme' | 'echoue' | null>(null);

  private sub = new Subscription();

  readonly voteOptions: VoteOption[] = [1, 5, 10, 20].map(nb => ({
    nb,
    label: nb === 1 ? '1 vote' : `${nb} votes`,
    prix: `${(nb * environment.votePriceFcfa).toLocaleString('fr-FR')} FCFA`,
  }));

  form: FormGroup = this.fb.group({
    nbVotes: [10, [Validators.required, Validators.min(1)]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
  });

  selectOption(nb: number): void {
    this.form.patchValue({ nbVotes: nb });
  }

  get total(): number {
    return this.voteSvc.prixVote(this.form.value.nbVotes ?? 0);
  }

  get totalFormate(): string {
    return this.total.toLocaleString('fr-FR') + ' FCFA';
  }

  initiales(): string {
    return this.candidatSvc.initiales(this.candidat());
  }

  onPhotoErreur(): void {
    this.photoErreur.set(true);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const { nbVotes, telephone } = this.form.value;
    this.voteSvc.initier({
      candidatId: this.candidat().id,
      phaseId: this.phaseId(),
      nbVotes,
      telephone,
    }).subscribe({
      next: res => {
        this.success.set(res);
        this.submitting.set(false);
        if (res.urlPaiement) {
          // Nouvel onglet, jamais le même : l'appelant (galerie, page de vote) doit rester
          // affiché en arrière-plan. Ouverture synchrone (pas de setTimeout) : au-delà d'un
          // délai, la plupart des navigateurs ne considèrent plus l'appel comme issu du geste
          // utilisateur et bloquent la popup.
          window.open(res.urlPaiement, '_blank', 'noopener');
          this.paiementOuvert.set(true);
          this.suivrePaiement(res.paiementId);
        }
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(messageErreur(err, 'Erreur lors de l\'initiation du vote.'));
      },
    });
  }

  /**
   * Interroge GET /paiements/{id}/statut-public (public, sans JWT — le votant est anonyme)
   * jusqu'à une issue définitive. Même cadence que PaiementRetourComponent : 3s, ~2 min.
   * On ne fait jamais confiance à un signal venant de l'onglet de paiement lui-même.
   */
  private suivrePaiement(paiementId: string): void {
    this.issuePaiement.set('attente');
    let tentative = 0;
    this.sub.add(
      interval(3000).pipe(
        startWith(0),
        switchMap(() => {
          tentative++;
          return this.paiementSvc.statutPublic(paiementId).pipe(catchError(() => of(null)));
        }),
        takeWhile(res => {
          if (!res) return tentative < 40;           // coupure réseau ponctuelle : on retente
          return res.statut === 'PENDING' && tentative < 40;
        }, true),
      ).subscribe(res => {
        if (!res) return;
        if (res.statut === 'COMPLETED') this.issuePaiement.set('confirme');
        else if (res.statut !== 'PENDING') this.issuePaiement.set('echoue');
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  fermer(): void {
    this.closed.emit();
  }
}
