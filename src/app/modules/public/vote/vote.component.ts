import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription, interval, of, switchMap } from 'rxjs';
import { catchError, startWith, takeWhile } from 'rxjs/operators';
import { CandidatService } from '@core/services/candidat.service';
import { VoteService } from '@core/services/vote.service';
import { PaiementService } from '@core/services/paiement.service';
import { EditionService } from '@core/services/edition.service';
import { CandidatPublicResponse, InitierVoteResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { DecimalPipe } from '@angular/common';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';
import { SiteFooterComponent } from '../../../shared/components/site-footer/site-footer.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';

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
    SiteFooterComponent,
    DecimalPipe,
    StarMarkComponent
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class VoteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private voteSvc = inject(VoteService);
  private paiementSvc = inject(PaiementService);
  private editionSvc = inject(EditionService);

  candidat: CandidatPublicResponse | null = null;
  phaseId: string | null = null;
  loading = true;
  submitting = false;
  success: InitierVoteResponse | null = null;
  /** true une fois la page de paiement ouverte dans un nouvel onglet — cet onglet ne navigue jamais. */
  paiementOuvert = false;

  /**
   * Issue du paiement constatée depuis CET onglet. Le paiement se déroule dans un onglet
   * séparé (décision produit) : sans ce suivi, l'onglet d'origine resterait indéfiniment
   * sur « ouvert dans un nouvel onglet » sans jamais dire si les votes ont été crédités.
   */
  issuePaiement: 'attente' | 'confirme' | 'echoue' | null = null;

  private sub = new Subscription();
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
        // Nouvel onglet, jamais le même : ouverture synchrone (pas de setTimeout), au-delà
        // d'un délai la plupart des navigateurs bloquent l'appel comme une popup non sollicitée.
        if (res.urlPaiement) {
          window.open(res.urlPaiement, '_blank', 'noopener');
          this.paiementOuvert = true;
          this.suivrePaiement(res.paiementId);
        }
      },
      error: err => {
        this.submitting = false;
        this.error = messageErreur(err, 'Erreur lors de l\'initiation du vote.');
      },
    });
  }

  /**
   * Interroge GET /paiements/{id}/statut-public (public, sans JWT — le votant est anonyme)
   * jusqu'à une issue définitive. Même cadence que PaiementRetourComponent : 3s, ~2 min.
   */
  private suivrePaiement(paiementId: string): void {
    this.issuePaiement = 'attente';
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
        if (res.statut === 'COMPLETED') this.issuePaiement = 'confirme';
        else if (res.statut !== 'PENDING') this.issuePaiement = 'echoue';
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  initiales(): string {
    return this.candidat ? this.candidatSvc.initiales(this.candidat) : '';
  }
}
