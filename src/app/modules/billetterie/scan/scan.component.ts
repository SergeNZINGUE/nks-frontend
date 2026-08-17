import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { ScanResponse, SoireeEvent } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

type ScanResultat = 'VALIDE' | 'INVALIDE' | 'DEJA_UTILISE' | null;

/** Format UUID v4 — ScanRequest.qrUuid est typé UUID côté backend */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-scan',
  imports: [DatePipe, ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ScanComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private billetterieSvc = inject(BilletterieService);

  form: FormGroup;
  isScanning = false;
  resultat: ScanResponse | null = null;
  erreur: string | null = null;
  soirees: SoireeEvent[] = [];
  chargementSoirees = true;
  /** Compteur d'entrées de la soirée sélectionnée — CdC §3.6.3 */
  nbEntrees: number | null = null;

  private sub = new Subscription();

  constructor() {
    this.form = this.fb.group({
      // ScanRequest exige soireeId ET qrUuid, tous deux @NotNull
      soireeId: ['', Validators.required],
      qrUuid: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.billetterieSvc.soirees().pipe(catchError(() => of([] as SoireeEvent[])))
        .subscribe(list => {
          this.chargementSoirees = false;
          // Soirées pertinentes pour un contrôle d'entrée
          this.soirees = list.filter(s => s.statut === 'EN_COURS' || s.statut === 'PLANIFIEE');
          const active = this.soirees.find(s => s.statut === 'EN_COURS') ?? this.soirees[0];
          if (active) {
            this.form.get('soireeId')!.setValue(active.id);
            this.rafraichirCompteur();
          }
        })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  onSoireeChange(): void {
    this.nbEntrees = null;
    this.rafraichirCompteur();
  }

  rafraichirCompteur(): void {
    const soireeId = this.form.get('soireeId')?.value;
    if (!soireeId) return;
    this.sub.add(
      this.billetterieSvc.compteurEntrees(soireeId)
        .pipe(catchError(() => of(null)))
        .subscribe(res => {
          if (res) this.nbEntrees = Object.values(res)[0] ?? 0;
        })
    );
  }

  scanner(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isScanning = true;
    this.resultat = null;
    this.erreur = null;

    const { qrUuid, soireeId } = this.form.value;

    this.billetterieSvc.scannerQR(qrUuid.trim(), soireeId).subscribe({
      next: res => {
        this.isScanning = false;
        this.resultat = res;
        // On ne réinitialise que le QR : la soirée reste sélectionnée pour le scan suivant
        this.form.get('qrUuid')!.reset('');
        if (res.resultat === 'VALIDE') this.rafraichirCompteur();
      },
      error: err => {
        this.isScanning = false;
        this.erreur = messageErreur(err, 'Erreur de scan — ticket introuvable.');
      },
    });
  }

  nouveauScan(): void {
    this.resultat = null;
    this.erreur = null;
    this.form.get('qrUuid')!.reset('');
  }

  get resultatClass(): string {
    const map: Record<ScanResultat & string, string> = {
      VALIDE:      'success',
      INVALIDE:    'danger',
      DEJA_UTILISE:'warning',
    };
    return this.resultat ? (map[this.resultat.resultat] ?? 'default') : '';
  }

  get resultatIcon(): string {
    const map: Record<string, string> = {
      VALIDE:       '✅',
      INVALIDE:     '❌',
      DEJA_UTILISE: '⚠️',
    };
    return this.resultat ? (map[this.resultat.resultat] ?? '?') : '';
  }

  get resultatTexte(): string {
    const map: Record<string, string> = {
      VALIDE:       'Ticket valide — accès autorisé',
      INVALIDE:     'Ticket invalide ou inconnu',
      DEJA_UTILISE: 'Ticket déjà scanné',
    };
    return this.resultat ? (map[this.resultat.resultat] ?? this.resultat.resultat) : '';
  }
}
