import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { CandidatService } from '@core/services/candidat.service';
import { messageErreur } from '@core/utils/http-error.util';

/**
 * Recueil de consentement — présenté automatiquement au candidat tant qu'il n'a pas
 * explicitement accepté (cf. consentGuard, AuthService.consentementRequis(),
 * LoginResponse.consentementRequis côté backend). Contenu condensé du document complet
 * (docs/RECUEIL-CONSENTEMENT.md) : 6 items obligatoires + 1 facultatif (communications
 * promotionnelles). Le bouton "J'accepte" reste désactivé tant que les 6 items
 * obligatoires ne sont pas tous cochés.
 *
 * ⚠️ Document provisoire, non relu par un juriste (cf. bandeau dans le template) — voir
 * docs/RECUEIL-CONSENTEMENT.md pour le détail complet et les réserves.
 */
@Component({
  selector: 'app-consentement',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './consentement.component.html',
  styleUrls: ['./consentement.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConsentementComponent {
  private fb = inject(FormBuilder);
  private authSvc = inject(AuthService);
  private candidatSvc = inject(CandidatService);
  private router = inject(Router);

  isSaving = false;
  erreur: string | null = null;

  form: FormGroup = this.fb.group({
    reglement: [false, Validators.requiredTrue],
    donnees: [false, Validators.requiredTrue],
    frais: [false, Validators.requiredTrue],
    image: [false, Validators.requiredTrue],
    exactitude: [false, Validators.requiredTrue],
    litiges: [false, Validators.requiredTrue],
    communicationPromo: [false],
  });

  accepter(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSaving) return;

    this.isSaving = true;
    this.erreur = null;

    this.candidatSvc.accepterConsentement().pipe(
      catchError(err => {
        this.erreur = messageErreur(err, "Impossible d'enregistrer ton consentement — réessaie.");
        return of(null);
      }),
      finalize(() => { this.isSaving = false; }),
    ).subscribe(res => {
      if (res === null && this.erreur) return;
      this.authSvc.marquerConsentementAccepte();
      this.router.navigate(['/mon-espace/dashboard']);
    });
  }
}
