import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';
import * as QRCode from 'qrcode';

import { BilletterieService } from '@core/services/billetterie.service';
import { Reservation } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/** Délai entre deux recherches par téléphone — mitigation frontend contre le
 *  brute-force de numéros (le vrai fix, un OTP SMS côté backend, est hors scope ici). */
const THROTTLE_RECHERCHE_MS = 4000;

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
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  rechercheEffectuee = false;
  reservations: Reservation[] = [];
  erreur: string | null = null;
  /** true pendant la fenêtre de throttle suivant une recherche — mitigation
   *  frontend anti brute-force, cf. commentaire sur THROTTLE_RECHERCHE_MS. */
  throttled = false;

  /** QR codes générés localement (data URL), indexés par qrUuid — jamais envoyés à un tiers. */
  private qrDataUrls: Record<string, string> = {};

  telephoneCtrl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^(\+226|00226)?[0-9]{8}$/),
  ]);

  private sub = new Subscription();
  private throttleTimer: ReturnType<typeof setTimeout> | undefined;

  rechercher(): void {
    this.telephoneCtrl.markAsTouched();
    if (this.telephoneCtrl.invalid || this.isLoading || this.throttled) return;

    this.isLoading = true;
    this.erreur = null;
    this.reservations = [];

    // Mitigation frontend uniquement contre le brute-force de numéros de téléphone
    // (GAP IDOR billetterie) : ralentit un script, ne le bloque pas. Le vrai fix
    // (vérification OTP par SMS côté backend) reste à faire et est hors scope ici.
    this.throttled = true;
    this.throttleTimer = setTimeout(() => { this.throttled = false; }, THROTTLE_RECHERCHE_MS);

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
            void this.genererQrCodes(data);
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      PENDING:    '⏳ En attente',
      CONFIRMEE:  'Confirmée',
      ANNULEE:    'Annulée',
      EXPIREE:    '⏰ Expirée',
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    return { PENDING: 'warning', CONFIRMEE: 'success', ANNULEE: 'danger', EXPIREE: 'default' }[s] ?? 'default';
  }

  /**
   * GAP-03 : pas d'endpoint OTP → QR code généré côté frontend via qrUuid.
   * Généré 100% localement (librairie `qrcode`, aucun appel réseau) : le qrUuid,
   * secret d'entrée, ne doit jamais être envoyé à un service tiers (ex. l'ancienne
   * implémentation via Google Charts, corrigée — cf. audit sécurité).
   */
  private async genererQrCodes(reservations: Reservation[]): Promise<void> {
    for (const r of reservations) {
      if (r.statut !== 'CONFIRMEE' || !r.qrUuid || this.qrDataUrls[r.qrUuid]) continue;
      try {
        this.qrDataUrls[r.qrUuid] = await QRCode.toDataURL(`NKS:${r.qrUuid}`, {
          width: 200,
          margin: 1,
        });
      } catch {
        // Échec de génération locale (entrée invalide) : le QR reste simplement absent,
        // le ticket demeure consultable sans QR.
      }
      this.cdr.markForCheck();
    }
  }

  /** Data URL du QR déjà généré pour ce ticket, ou null tant qu'il n'est pas prêt. */
  qrDataUrl(qrUuid: string): string | null {
    return this.qrDataUrls[qrUuid] ?? null;
  }
}
