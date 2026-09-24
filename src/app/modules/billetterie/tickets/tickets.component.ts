import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import * as QRCode from 'qrcode';

import { BilletterieService } from '@core/services/billetterie.service';
import { TicketImageService } from '@core/services/ticket-image.service';
import { SoireeService } from '@core/services/soiree.service';
import { Reservation, SoireeEvent, TicketAvecQr } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';

/** Délai entre deux demandes de code (recherche initiale ou renvoi) — mitigation
 *  frontend complémentaire au rate-limit serveur (3/10min par numéro, 10/10min par IP). */
const THROTTLE_RECHERCHE_MS = 4000;

type Etape = 'telephone' | 'verification' | 'resultats';

/**
 * CdC §3.6.2 : « Le spectateur peut accéder à ses tickets depuis la plateforme
 * (sans création de compte obligatoire, via son numéro de téléphone) ».
 *
 * Fix IDOR du 13/09/2026 : GET /reservations/mes-tickets exige désormais un jeton
 * "phone-wide" obtenu via un flux OTP en 2 temps (POST .../otp/demander puis
 * .../otp/verifier) — le numéro seul ne suffit plus à consulter les tickets d'autrui.
 * Le jeton obtenu ne vit qu'en mémoire de ce composant (jamais sessionStorage/localStorage) :
 * il n'a besoin de survivre que le temps de cette session de consultation.
 */
@Component({
  selector: 'app-tickets',
  imports: [RouterModule, ReactiveFormsModule, TopbarComponent, SiteHeaderComponent, BottomNavComponent],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TicketsComponent implements OnDestroy {
  private billetterieSvc = inject(BilletterieService);
  private ticketImageSvc = inject(TicketImageService);
  private soireeSvc = inject(SoireeService);
  private cdr = inject(ChangeDetectorRef);

  /** Cache des soirées déjà résolues (nom/dateHeure/lieu), indexé par soireeId —
   *  évite de refaire GET /soirees/{id} pour chaque billet d'une même soirée. */
  private soireesCache: Record<string, SoireeEvent> = {};

  etape: Etape = 'telephone';

  /** Jeton "phone-wide" (scope=["read","cancel"]) — mémoire composant uniquement. */
  private token: string | null = null;

  isEnvoiOtp = false;
  isVerification = false;
  erreurOtp: string | null = null;
  otpMessage: string | null = null;

  isLoading = false;
  rechercheEffectuee = false;
  reservations: Reservation[] = [];
  erreur: string | null = null;
  /** true pendant la fenêtre de throttle suivant une demande de code — mitigation
   *  frontend complémentaire, cf. commentaire sur THROTTLE_RECHERCHE_MS. */
  throttled = false;

  /** QR codes générés localement (data URL), indexés par qrUuid — jamais envoyés à un tiers. */
  private qrDataUrls: Record<string, string> = {};
  /** Images de billet (PNG data URL) générées localement, indexées par ticketId. */
  private billetImages: Record<string, string> = {};
  /** true pendant la composition canvas d'un billet — évite les double-clics. */
  billetEnCoursDeGeneration: Record<string, boolean> = {};

  /** Tickets réels (un par billet physique, chacun avec son propre qrUuid) — GET
   *  /reservations/{id}/ticket?telephone=, indexés par reservation.id. */
  ticketsParReservation: Record<string, TicketAvecQr[]> = {};
  /** true pendant l'appel ticketsAvecQr() pour cette réservation — le temps que les QR
   *  arrivent après la liste des réservations. */
  chargementTicketsParReservation: Record<string, boolean> = {};

  telephoneCtrl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^(\+226|00226)?[0-9]{8}$/),
  ]);

  codeCtrl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^[0-9]{6}$/),
  ]);

  private sub = new Subscription();
  private throttleTimer: ReturnType<typeof setTimeout> | undefined;

  /** Étape 1 : demande d'envoi du code (WhatsApp/SMS) pour ce numéro. */
  demanderCode(): void {
    this.telephoneCtrl.markAsTouched();
    if (this.telephoneCtrl.invalid || this.isEnvoiOtp || this.throttled) return;

    this.isEnvoiOtp = true;
    this.erreurOtp = null;
    const telephone = (this.telephoneCtrl.value ?? '').trim();

    this.armerThrottle();

    this.sub.add(
      this.billetterieSvc.demanderOtp(telephone).subscribe({
        next: () => {
          this.isEnvoiOtp = false;
          this.otpMessage = 'Si ce numéro a des billets, un code vient d\'être envoyé par WhatsApp ou SMS.';
          this.codeCtrl.reset();
          this.etape = 'verification';
        },
        error: err => {
          this.isEnvoiOtp = false;
          this.erreurOtp = this.messageOtp(err);
        },
      })
    );
  }

  /** Lien discret "Je n'ai rien reçu, renvoyer un code" — même appel, sans changer d'étape. */
  renvoyerCode(): void {
    if (this.isEnvoiOtp || this.throttled) return;
    this.isEnvoiOtp = true;
    this.erreurOtp = null;
    this.otpMessage = null;
    const telephone = (this.telephoneCtrl.value ?? '').trim();

    this.armerThrottle();

    this.sub.add(
      this.billetterieSvc.demanderOtp(telephone).subscribe({
        next: () => {
          this.isEnvoiOtp = false;
          this.otpMessage = 'Si ce numéro a des billets, un nouveau code vient d\'être envoyé.';
        },
        error: err => {
          this.isEnvoiOtp = false;
          this.erreurOtp = this.messageOtp(err);
        },
      })
    );
  }

  /** Retour à la saisie du numéro (ex. faute de frappe) — réinitialise l'étape OTP. */
  modifierTelephone(): void {
    this.etape = 'telephone';
    this.erreurOtp = null;
    this.otpMessage = null;
    this.codeCtrl.reset();
  }

  /** Étape 2 : vérification du code — en cas de succès, obtient le jeton phone-wide. */
  verifierCode(): void {
    this.codeCtrl.markAsTouched();
    if (this.codeCtrl.invalid || this.isVerification) return;

    this.isVerification = true;
    this.erreurOtp = null;
    const telephone = (this.telephoneCtrl.value ?? '').trim();
    const code = (this.codeCtrl.value ?? '').trim();

    this.sub.add(
      this.billetterieSvc.verifierOtp(telephone, code).subscribe({
        next: res => {
          this.isVerification = false;
          this.token = res.accessToken;
          this.otpMessage = null;
          this.etape = 'resultats';
          this.rechercherTickets(telephone);
        },
        error: err => {
          this.isVerification = false;
          this.codeCtrl.reset();
          this.erreurOtp = this.messageOtp(err, 'Code invalide ou expiré.');
        },
      })
    );
  }

  private armerThrottle(): void {
    this.throttled = true;
    this.throttleTimer = setTimeout(() => { this.throttled = false; }, THROTTLE_RECHERCHE_MS);
  }

  /** 429 → message rate-limit dédié ; sinon message générique (uniforme, pas de distinction de cas). */
  private messageOtp(err: unknown, repli = "Impossible d'envoyer le code. Réessaie."): string {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return 'Trop de tentatives, réessaie dans quelques minutes.';
    }
    return repli;
  }

  /** Étape 3 (résultats) : charge les réservations puis les billets/QR, avec le jeton phone-wide. */
  private rechercherTickets(telephone: string): void {
    if (!this.token) return;
    this.isLoading = true;
    this.erreur = null;
    this.reservations = [];
    this.ticketsParReservation = {};
    this.chargementTicketsParReservation = {};

    this.sub.add(
      this.billetterieSvc.mesTickets(telephone, this.token)
        .pipe(catchError(() => of(null)))
        .subscribe(data => {
          this.isLoading = false;
          this.rechercheEffectuee = true;
          if (data === null) {
            this.erreur = 'Impossible de charger tes tickets. Réessaie.';
          } else {
            this.reservations = data;
            this.chargerTicketsAvecQr(data, telephone);
          }
        })
    );
  }

  /**
   * Pour chaque réservation confirmée, récupère la liste réelle des billets (un par place,
   * chacun avec son propre qrUuid) via GET /reservations/{id}/ticket?telephone= — en
   * parallèle (forkJoin) plutôt qu'en boucle séquentielle.
   */
  private chargerTicketsAvecQr(reservations: Reservation[], telephone: string): void {
    if (!this.token) return;
    const token = this.token;
    const confirmees = reservations.filter(r => r.statut === 'CONFIRMEE');
    if (confirmees.length === 0) return;

    for (const r of confirmees) this.chargementTicketsParReservation[r.id] = true;

    const appels = confirmees.reduce<Record<string, ReturnType<typeof this.billetterieSvc.ticketsAvecQr>>>((acc, r) => {
      acc[r.id] = this.billetterieSvc.ticketsAvecQr(r.id, telephone, token).pipe(catchError(() => of([])));
      return acc;
    }, {});

    this.sub.add(
      forkJoin(appels).subscribe(resultats => {
        for (const [reservationId, tickets] of Object.entries(resultats)) {
          this.ticketsParReservation[reservationId] = tickets;
          this.chargementTicketsParReservation[reservationId] = false;
        }
        this.cdr.markForCheck();
        void this.genererQrCodes(Object.values(resultats).flat());
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
   * Badge de STATUT DU BILLET (ticket.statut : EMIS/UTILISE/EXPIRE/ANNULE) — distinct du
   * badge de statut de la RÉSERVATION ci-dessus (statutLabel/statutClass). Pas de badge pour
   * EMIS (comportement nominal, aucune mention nécessaire).
   */
  ticketStatutLabel(s: TicketAvecQr['statut']): string {
    const map: Record<string, string> = {
      UTILISE: 'Utilisé',
      EXPIRE: '⏰ Expiré',
      ANNULE: 'Annulé',
    };
    return map[s] ?? s;
  }

  ticketStatutClass(s: TicketAvecQr['statut']): string {
    const map: Record<string, string> = { UTILISE: 'success', EXPIRE: 'default', ANNULE: 'danger' };
    return map[s] ?? 'default';
  }

  /**
   * QR code généré côté frontend, un par billet physique (un ticket = un qrUuid).
   * Généré 100% localement (librairie `qrcode`, aucun appel réseau) : le qrUuid,
   * secret d'entrée, ne doit jamais être envoyé à un service tiers (ex. l'ancienne
   * implémentation via Google Charts, corrigée — cf. audit sécurité).
   */
  private async genererQrCodes(tickets: TicketAvecQr[]): Promise<void> {
    for (const t of tickets) {
      if (!t.qrUuid || this.qrDataUrls[t.qrUuid]) continue;
      try {
        this.qrDataUrls[t.qrUuid] = await QRCode.toDataURL(`NKS:${t.qrUuid}`, {
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

  /** Tickets réels (un par billet) déjà chargés pour cette réservation, ou [] tant que
   *  l'appel ticketsAvecQr() n'est pas terminé (ou si la réservation n'est pas confirmée). */
  ticketsDe(reservationId: string): TicketAvecQr[] {
    return this.ticketsParReservation[reservationId] ?? [];
  }

  /** true pendant le chargement des billets/QR réels de cette réservation. */
  chargementTickets(reservationId: string): boolean {
    return this.chargementTicketsParReservation[reservationId] === true;
  }

  /**
   * Génère (si besoin, via Canvas 2D côté navigateur — cf. TicketImageService) puis télécharge
   * l'image du billet façon "badge événement", à partir du QR déjà généré localement et des
   * infos de la soirée (résolues une fois par soireeId, mises en cache).
   */
  async telechargerBillet(reservation: Reservation, ticket: TicketAvecQr, index: number, total: number): Promise<void> {
    if (this.billetEnCoursDeGeneration[ticket.ticketId]) return;
    const qr = this.qrDataUrl(ticket.qrUuid);
    if (!qr) return;

    this.billetEnCoursDeGeneration[ticket.ticketId] = true;
    this.cdr.markForCheck();
    try {
      const soiree = await this.resoudreSoiree(reservation.soireeId);
      const dataUrl = this.billetImages[ticket.ticketId] ?? await this.ticketImageSvc.genererImageBillet({
        soireeNom: soiree?.nom ?? 'Night Karaoke Stars',
        soireeDateHeure: soiree?.dateHeure ?? new Date().toISOString(),
        soireeLieu: soiree?.lieu ?? null,
        nomSpectateur: ticket.nomSpectateur || reservation.nomReservant,
        qrDataUrl: qr,
        numeroBillet: total > 1 ? `${index + 1}/${total}` : null,
      });
      this.billetImages[ticket.ticketId] = dataUrl;
      this.ticketImageSvc.telecharger(dataUrl, `billet-nks-${ticket.ticketId}.png`);
    } catch {
      // Échec de composition/chargement d'image (logos indisponibles hors-ligne, etc.) —
      // le QR reste consultable à l'écran même si le téléchargement échoue.
    } finally {
      this.billetEnCoursDeGeneration[ticket.ticketId] = false;
      this.cdr.markForCheck();
    }
  }

  private async resoudreSoiree(soireeId: string): Promise<SoireeEvent | null> {
    if (this.soireesCache[soireeId]) return this.soireesCache[soireeId];
    try {
      const soiree = await new Promise<SoireeEvent>((resolve, reject) => {
        this.sub.add(this.soireeSvc.detail(soireeId).subscribe({ next: resolve, error: reject }));
      });
      this.soireesCache[soireeId] = soiree;
      return soiree;
    } catch {
      return null;
    }
  }
}
