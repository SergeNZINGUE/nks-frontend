import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { Reservation } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/**
 * CdC §3.6.2 : « Le spectateur peut accéder à ses tickets depuis la plateforme
 * (sans création de compte obligatoire, via son numéro de téléphone) ».
 * L'endpoint backend est GET /reservations/mes-tickets?telephone= — le numéro
 * doit donc être saisi, il n'y a pas de session.
 */
@Component({
  selector: 'app-tickets',
  imports: [RouterModule, ReactiveFormsModule, TopbarComponent],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TicketsComponent implements OnDestroy {
  private billetterieSvc = inject(BilletterieService);

  isLoading = false;
  rechercheEffectuee = false;
  reservations: Reservation[] = [];
  erreur: string | null = null;

  telephoneCtrl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^(\+226|00226)?[0-9]{8}$/),
  ]);

  private sub = new Subscription();

  rechercher(): void {
    this.telephoneCtrl.markAsTouched();
    if (this.telephoneCtrl.invalid) return;

    this.isLoading = true;
    this.erreur = null;
    this.reservations = [];

    this.sub.add(
      this.billetterieSvc.mesTickets((this.telephoneCtrl.value ?? '').trim())
        .pipe(catchError(() => of(null)))
        .subscribe(data => {
          this.isLoading = false;
          this.rechercheEffectuee = true;
          if (data === null) {
            this.erreur = 'Impossible de charger tes tickets. Réessaie.';
          } else {
            this.reservations = data;
          }
        })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      PENDING:    '⏳ En attente',
      CONFIRMEE:  '✅ Confirmée',
      ANNULEE:    '❌ Annulée',
      EXPIREE:    '⏰ Expirée',
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    return { PENDING: 'warning', CONFIRMEE: 'success', ANNULEE: 'danger', EXPIREE: 'default' }[s] ?? 'default';
  }

  // GAP-03 : pas d'endpoint OTP → QR code généré côté frontend via qrUuid
  qrPlaceholderUrl(qrUuid: string): string {
    // Utilise l'API QR code de Google Charts comme fallback visuel en attendant l'endpoint backend
    const data = encodeURIComponent(`NKS:${qrUuid}`);
    return `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${data}&choe=UTF-8`;
  }
}
