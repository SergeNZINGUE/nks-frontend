import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, forkJoin, of } from 'rxjs';

import { CandidatureService } from '@core/services/candidature.service';
import { ParametresService } from '@core/services/parametres.service';
import { CandidatureDetailResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { environment } from '@env/environment';
@Component({
  selector: 'app-mes-paiements',
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './mes-paiements.component.html',
  styleUrls: ['./mes-paiements.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MesPaiementsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private candidatureSvc = inject(CandidatureService);
  private parametresSvc = inject(ParametresService);

  isLoading = true;
  isPaying = false;
  candidature: CandidatureDetailResponse | null = null;
  erreur: string | null = null;
  paiementInitie = false;
  urlPaiement: string | null = null;
  montantInscription = environment.inscriptionPriceFcfa;

  form!: FormGroup;
  private sub = new Subscription();

  get montantFormate(): string {
    return `${this.montantInscription.toLocaleString('fr-FR')} FCFA`;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      telephone: ['', [Validators.required, Validators.pattern(/^(\+226|00226)?[0-9]{8}$/)]],
    });

    this.sub.add(
      forkJoin({
        candidature: this.candidatureSvc.maCandidature().pipe(catchError(() => of(null))),
        parametres: this.parametresSvc.publics().pipe(catchError(() => of(null))),
      }).subscribe(({ candidature, parametres }) => {
        this.isLoading = false;
        this.candidature = candidature;
        if (parametres) this.montantInscription = parametres.prixInscriptionFcfa;
        if (!candidature) { this.erreur = 'Impossible de charger ta candidature.'; return; }
        this.form.patchValue({ telephone: candidature.telephone });
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get paiementRequis(): boolean {
    return this.candidature?.statut === 'EN_ATTENTE_PAIEMENT';
  }

  payer(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isPaying) return;

    this.isPaying = true;
    this.erreur = null;

    const { telephone } = this.form.value;

    this.sub.add(
      this.candidatureSvc.initierPaiementInscription(this.montantInscription, telephone.trim())
        .pipe(catchError(err => {
          this.erreur = messageErreur(err, 'Échec de l\'initiation du paiement.');
          return of(null);
        }))
        .subscribe(res => {
          this.isPaying = false;
          if (!res) return;
          this.paiementInitie = true;
          this.urlPaiement = res.urlPaiement ?? null;
          if (res.urlPaiement) window.open(res.urlPaiement, '_blank', 'noopener');
        })
    );
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE:          'En attente d\'examen',
      VALIDEE:             'Validée',
      EN_ATTENTE_PAIEMENT: 'Paiement requis',
      ACTIVE:              'Active',
      REJETEE:             'Rejetée',
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    return {
      EN_ATTENTE: 'warning',
      VALIDEE: 'success',
      EN_ATTENTE_PAIEMENT: 'warning',
      ACTIVE: 'success',
      REJETEE: 'danger',
    }[s] ?? 'default';
  }
}
