import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { DroitVoteResponse, SoireeEvent } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/** Format UUID v4 — CaisseValiderRequest.qrUuid est typé UUID côté backend */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Écran hôtesse : scanne le billet (si pas déjà fait) et active sa consommation en une seule
 * action, ce qui crée le droit de vote sur place correspondant (1 billet = au plus 1 droit,
 * jamais deux — cf. VoteSurPlaceService côté backend pour la cinématique complète). Plusieurs
 * hôtesses peuvent utiliser cet écran en parallèle depuis leur propre téléphone, à chaque
 * service, sans passer par un point de caisse unique. Mirroir volontaire de scan.component.ts
 * (même structure, même conventions).
 */
@Component({
  selector: 'app-caisse',
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './caisse.component.html',
  styleUrls: ['./caisse.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CaisseComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private billetterieSvc = inject(BilletterieService);

  form: FormGroup;
  isValidating = false;
  resultat: DroitVoteResponse | null = null;
  erreur: string | null = null;
  soirees: SoireeEvent[] = [];
  chargementSoirees = true;

  private sub = new Subscription();

  constructor() {
    this.form = this.fb.group({
      soireeId: ['', Validators.required],
      qrUuid: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.billetterieSvc.soirees().pipe(catchError(() => of([] as SoireeEvent[])))
        .subscribe(list => {
          this.chargementSoirees = false;
          this.soirees = list.filter(s => s.statut === 'EN_COURS' || s.statut === 'PLANIFIEE');
          const active = this.soirees.find(s => s.statut === 'EN_COURS') ?? this.soirees[0];
          if (active) this.form.get('soireeId')!.setValue(active.id);
        })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  valider(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isValidating = true;
    this.resultat = null;
    this.erreur = null;

    const { qrUuid, soireeId } = this.form.value;

    this.billetterieSvc.validerConsommation(qrUuid.trim(), soireeId).subscribe({
      next: res => {
        this.isValidating = false;
        this.resultat = res;
        this.form.get('qrUuid')!.reset('');
      },
      error: err => {
        this.isValidating = false;
        this.erreur = messageErreur(err,
          "Impossible d'activer le vote — billet invalide, annulé, ou droit déjà activé pour cette soirée.");
      },
    });
  }

  nouvelleValidation(): void {
    this.resultat = null;
    this.erreur = null;
    this.form.get('qrUuid')!.reset('');
  }
}
