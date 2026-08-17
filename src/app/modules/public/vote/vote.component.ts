import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
import { EditionService } from '@core/services/edition.service';
import { CandidatPublicResponse, InitierVoteResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { DecimalPipe } from '@angular/common';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';

type VoteOption = { nb: number; label: string; prix: string };

@Component({
    selector: 'app-vote',
    templateUrl: './vote.component.html',
    styleUrls: ['./vote.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    ReactiveFormsModule,
    BottomNavComponent,
    DecimalPipe
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class VoteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);
  private editionSvc = inject(EditionService);

  candidat: CandidatPublicResponse | null = null;
  phaseId: string | null = null;
  loading = true;
  submitting = false;
  success: InitierVoteResponse | null = null;
  redirectionEnCours = false;
  error: string | null = null;

  /**
   * Prix dérivés du tarif unitaire, jamais écrits en dur : le backend lit
   * PRIX_VOTE_FCFA en base (ParametrePlateformeService) et peut le changer.
   * Un prix codé en dur afficherait un montant différent de celui débité.
   */
  readonly voteOptions: VoteOption[] = [1, 5, 10, 20].map(nb => ({
    nb,
    label: nb === 1 ? '1 vote' : `${nb} votes`,
    prix: `${(nb * environment.votePriceFcfa).toLocaleString('fr-FR')} FCFA`,
  }));

  form!: FormGroup;

  ngOnInit(): void {
    // Pas de champ « opérateur » : InitierVoteRequest ne l'accepte pas et le
    // choix Orange/Moov se fait sur la page LigdiCash. Le proposer ici aurait
    // laissé croire à un choix pris en compte alors qu'il était jeté.
    this.form = this.fb.group({
      nbVotes:  [10, [Validators.required, Validators.min(1)]],
      telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
    });

    const id = this.route.snapshot.paramMap.get('id')!;
    this.candidatSvc.profil(id).pipe(
      switchMap(candidat => {
        this.candidat = candidat;
        return this.editionSvc.enCours();
      }),
      switchMap(edition => {
        if (!edition) throw new Error('Aucune édition en cours');
        return this.editionSvc.phaseActive(edition.id);
      })
    ).subscribe({
      next: phase => {
        this.phaseId = phase?.id ?? null;
        this.loading = false;
      },
      error: () => { this.loading = false; this.error = 'Candidat ou phase introuvable.'; },
    });
  }

  selectOption(nb: number): void {
    this.form.patchValue({ nbVotes: nb });
  }

  get total(): number {
    return this.voteSvc.prixVote(this.form.value.nbVotes ?? 0);
  }

  get totalFormate(): string {
    return this.total.toLocaleString('fr-FR') + ' FCFA';
  }

  submit(): void {
    if (this.form.invalid || !this.candidat || !this.phaseId) return;
    this.submitting = true;
    this.error = null;
    const { nbVotes, telephone } = this.form.value;
    this.voteSvc.initier({
      candidatId: this.candidat.id,
      phaseId: this.phaseId,
      nbVotes,
      telephone,
    }).subscribe({
      next: res => {
        this.success = res;
        this.submitting = false;
        // urlPaiement était ignoré : le parcours s'arrêtait sur un écran de
        // confirmation sans qu'aucun paiement ne soit jamais déclenché.
        if (res.urlPaiement) {
          this.redirectionEnCours = true;
          setTimeout(() => window.location.assign(res.urlPaiement), 1200);
        }
      },
      error: err => {
        this.submitting = false;
        this.error = messageErreur(err, 'Erreur lors de l\'initiation du vote.');
      },
    });
  }

  initiales(): string {
    return this.candidat ? this.candidatSvc.initiales(this.candidat) : '';
  }
}
