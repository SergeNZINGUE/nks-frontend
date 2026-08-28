import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
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
export class VoteModalComponent {
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);

  candidat = input.required<CandidatPublicResponse>();
  phaseId = input.required<string>();

  closed = output<void>();

  submitting = signal(false);
  success = signal<InitierVoteResponse | null>(null);
  redirectionEnCours = signal(false);
  error = signal<string | null>(null);
  photoErreur = signal(false);

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
          this.redirectionEnCours.set(true);
          setTimeout(() => window.location.assign(res.urlPaiement), 1200);
        }
      },
      error: err => {
        this.submitting.set(false);
        this.error.set(messageErreur(err, 'Erreur lors de l\'initiation du vote.'));
      },
    });
  }

  fermer(): void {
    this.closed.emit();
  }
}
