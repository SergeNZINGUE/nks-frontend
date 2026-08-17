import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';

import { CandidatureService } from '@core/services/candidature.service';
import { CandidatureDetailResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/**
 * Paiement des frais d'inscription — CdC §3.1.2 :
 * « En cas d'acceptation : le candidat procède au paiement des frais d'inscription
 *   via Mobile Money. Paiement confirmé : profil public activé. »
 *
 * Le paiement n'a donc PAS lieu au moment de l'inscription : il est déclenché ici,
 * une fois la candidature au statut EN_ATTENTE_PAIEMENT (validée par l'admin).
 *
 * GAP BACKEND #1 : aucun endpoint ne liste les paiements d'un candidat.
 *   GET /paiements est réservé ADMIN/SUPER_ADMIN, GET /paiements/{id} exige de
 *   connaître l'identifiant. L'historique (CdC §5.2) n'est donc pas affichable.
 * GAP BACKEND #2 : PRIX_INSCRIPTION_FCFA n'est exposé par aucun endpoint
 *   (aucun contrôleur ne sert parametres_plateforme). Le montant doit être saisi
 *   ou communiqué hors plateforme.
 */
@Component({
  selector: 'app-mes-paiements',
  imports: [RouterModule, ReactiveFormsModule, TopbarComponent],
  templateUrl: './mes-paiements.component.html',
  styleUrls: ['./mes-paiements.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MesPaiementsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private candidatureSvc = inject(CandidatureService);

  isLoading = true;
  isPaying = false;
  candidature: CandidatureDetailResponse | null = null;
  erreur: string | null = null;
  paiementInitie = false;
  urlPaiement: string | null = null;

  form!: FormGroup;
  private sub = new Subscription();

  ngOnInit(): void {
    this.form = this.fb.group({
      montant: [null, [Validators.required, Validators.min(1)]],
      telephone: ['', [Validators.required, Validators.pattern(/^(\+226|00226)?[0-9]{8}$/)]],
    });

    this.sub.add(
      this.candidatureSvc.maCandidature()
        .pipe(catchError(() => of(null)))
        .subscribe(c => {
          this.isLoading = false;
          this.candidature = c;
          if (!c) { this.erreur = 'Impossible de charger ta candidature.'; return; }
          // Pré-remplit avec le numéro déclaré à l'inscription
          this.form.patchValue({ telephone: c.telephone });
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

    const { montant, telephone } = this.form.value;

    this.sub.add(
      this.candidatureSvc.initierPaiementInscription(Number(montant), telephone.trim())
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
      EN_ATTENTE:          '⏳ En attente d\'examen',
      VALIDEE:             '✅ Validée',
      EN_ATTENTE_PAIEMENT: '💳 Paiement requis',
      ACTIVE:              '🌟 Active',
      REJETEE:             '❌ Rejetée',
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
