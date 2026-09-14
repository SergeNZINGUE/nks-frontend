import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { catchError, of, startWith, switchMap, takeWhile } from 'rxjs';
import * as QRCode from 'qrcode';

import { BilletterieService } from '@core/services/billetterie.service';
import { PaiementService } from '@core/services/paiement.service';
import { SoireeService } from '@core/services/soiree.service';
import { TicketImageService } from '@core/services/ticket-image.service';
import { CategorieTicket, ReservationResponse, SoireeEvent, TicketAvecQr } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';

type Etape = 'reservation' | 'confirmation';

@Component({
  selector: 'app-reservation',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterModule,
    TopbarComponent,
    StarMarkComponent,
    SiteHeaderComponent,
    BottomNavComponent,
  ],
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ReservationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billetterieSvc = inject(BilletterieService);
  private paiementSvc = inject(PaiementService);
  private soireeSvc = inject(SoireeService);
  private ticketImageSvc = inject(TicketImageService);
  private cdr = inject(ChangeDetectorRef);

  soireeId: string | null = null;
  /** Résolue une fois (GET /soirees/{id}) — utilisée pour composer l'image du billet
   *  (nom, dateHeure, lieu) sur l'écran de confirmation. */
  private soiree: SoireeEvent | null = null;
  etape: Etape = 'reservation';
  isLoading = true;
  isSubmitting = false;
  categories: CategorieTicket[] = [];
  categorieSelectionnee: CategorieTicket | null = null;
  confirmation: ReservationResponse | null = null;

  /** Billets réels (un par place) de la réservation en cours — GET /reservations/{id}/ticket,
   *  utilisable immédiatement via ticketAccessToken (pas besoin d'OTP sur cet écran). */
  tickets: TicketAvecQr[] = [];
  chargementTickets = false;
  erreurTickets: string | null = null;
  private qrDataUrls: Record<string, string> = {};
  private billetImages: Record<string, string> = {};
  billetEnCoursDeGeneration: Record<string, boolean> = {};
  private ticketsDejaCharges = false;
  /** true une fois la page de paiement ouverte dans un nouvel onglet — cet onglet ne navigue jamais. */
  paiementOuvert = false;
  /**
   * Issue du paiement constatée depuis CET onglet. Sans ce suivi, l'écran de confirmation
   * resterait indéfiniment sur « ouvert dans un nouvel onglet » sans jamais dire si les
   * billets ont été émis — sur mobile, l'acheteur ne revient souvent que sur cet onglet-ci.
   */
  issuePaiement: 'attente' | 'confirme' | 'echoue' | null = null;
  erreur: string | null = null;

  formInfos!: FormGroup;

  private sub = new Subscription();

  ngOnInit(): void {
    this.formInfos = this.fb.group({
      nomReservant:       ['', [Validators.required, Validators.minLength(3)]],
      telephoneReservant: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      emailReservant:     ['', [Validators.email]],
      nbPlaces:           [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    });

    this.soireeId = this.route.snapshot.paramMap.get('soireeId');

    if (!this.soireeId) {
      // Navigation vers /billetterie sans soireeId → rediriger vers la liste
      this.router.navigate(['/billetterie']);
      return;
    }

    this.sub.add(
      this.billetterieSvc.categoriesTicket(this.soireeId).pipe(
        catchError(() => of(null))
      ).subscribe(data => {
        this.isLoading = false;
        if (data === null) {
          this.erreur = 'Impossible de charger les catégories. Vérifie ta connexion.';
        } else {
          this.categories = data;
        }
      })
    );

    // Résolu une fois, en tâche de fond — sert uniquement à composer l'image du billet
    // (nom/dateHeure/lieu) sur l'écran de confirmation ; un échec ici n'empêche pas la réservation.
    this.sub.add(
      this.soireeSvc.detail(this.soireeId).pipe(catchError(() => of(null)))
        .subscribe(soiree => { this.soiree = soiree; })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  /** nbPlacesDisponibles = capacité totale, nbPlacesReservees = déjà réservées (CategorieTicketResponse backend). */
  placesRestantes(cat: CategorieTicket): number {
    return Math.max(0, cat.nbPlacesDisponibles - cat.nbPlacesReservees);
  }

  /** Libellé affiché dans le <select> — nom, prix et disponibilité en un coup d'œil. */
  libelleCategorie(cat: CategorieTicket): string {
    const restantes = this.placesRestantes(cat);
    const prixFmt = new Intl.NumberFormat('fr').format(cat.prix);
    const dispo = restantes > 0
      ? `${restantes} place${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`
      : 'Complet';
    return `${cat.nom} — ${prixFmt} FCFA (${dispo})`;
  }

  /** Déclenché par le <select> catégorie — ne change plus d'étape, le formulaire est sur le même écran. */
  selectionnerCategorie(cat: CategorieTicket): void {
    const restantes = this.placesRestantes(cat);
    if (restantes === 0) return;
    this.categorieSelectionnee = cat;
    // Adapter max nbPlaces
    this.formInfos.get('nbPlaces')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(Math.min(10, restantes)),
    ]);
    this.formInfos.get('nbPlaces')?.updateValueAndValidity();
  }

  /** Handler du (change) sur le <select> — résout la catégorie depuis son id puis délègue. */
  onCategorieChange(categorieId: string): void {
    const cat = this.categories.find(c => c.id === categorieId);
    if (cat) this.selectionnerCategorie(cat);
  }

  get montantTotal(): number {
    const nb = this.formInfos.get('nbPlaces')?.value ?? 1;
    return (this.categorieSelectionnee?.prix ?? 0) * nb;
  }

  soumettre(): void {
    if (!this.categorieSelectionnee || !this.soireeId || this.formInfos.invalid) {
      this.formInfos.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    this.erreur = null;

    const infos = this.formInfos.value;
    const req = {
      soireeId:          this.soireeId,
      categorieId:       this.categorieSelectionnee.id,
      nbPlaces:          infos.nbPlaces,
      nomReservant:      infos.nomReservant,
      telephoneReservant: infos.telephoneReservant,
      emailReservant:    infos.emailReservant || undefined,
    };

    this.sub.add(
      this.billetterieSvc.reserver(req).subscribe({
        next: res => {
          this.isSubmitting = false;
          this.confirmation = res;
          this.etape = 'confirmation';
          // Fix IDOR du 13/09/2026 : ticketAccessToken est scopé à cette réservation
          // précise — jamais mis dans une URL, stocké uniquement en sessionStorage
          // (jamais localStorage), sert à télécharger le billet sans passer par l'OTP.
          this.stockerTokenSession(res);
          // Catégorie gratuite (ex. PARTENAIRE) : la réservation est déjà CONFIRMEE,
          // le billet est donc disponible immédiatement, sans attendre de paiement.
          if (res.statut === 'CONFIRMEE') this.chargerTicketsConfirmation();
          // BUG identique déjà corrigé dans vote.component.ts : urlPaiement était ignoré,
          // le parcours s'arrêtait sur l'écran de confirmation sans jamais déclencher le paiement.
          // Nouvel onglet, jamais le même : ouverture synchrone (pas de setTimeout), au-delà
          // d'un délai la plupart des navigateurs bloquent l'appel comme une popup non sollicitée.
          if (res.urlPaiement) {
            window.open(res.urlPaiement, '_blank', 'noopener');
            this.paiementOuvert = true;
            if (res.paiementId) this.suivrePaiement(res.paiementId);
          }
        },
        error: err => {
          this.isSubmitting = false;
          this.erreur = messageErreur(err, 'Erreur lors de la réservation. Réessaie.');
        },
      })
    );
  }

  /**
   * Stocke le jeton "post-achat" (scope=["read"], ~25min) en sessionStorage — jamais
   * localStorage, jamais en query string. Clé incluant reservationId, comme demandé
   * (permet de retrouver le jeton même si `this.confirmation` était perdu sur cette page).
   */
  private stockerTokenSession(res: ReservationResponse): void {
    if (!res.ticketAccessToken) return;
    try {
      sessionStorage.setItem(
        `nks_ticket_token_${res.reservationId}`,
        JSON.stringify({ token: res.ticketAccessToken, expiresAt: Date.now() + res.ticketAccessTokenExpiresIn * 1000 }),
      );
    } catch {
      // sessionStorage indisponible (navigation privée stricte) — le jeton reste utilisable
      // depuis `this.confirmation` en mémoire pour la durée de cette page.
    }
  }

  private lireTokenSession(reservationId: string): string | null {
    try {
      const brut = sessionStorage.getItem(`nks_ticket_token_${reservationId}`);
      if (!brut) return null;
      const { token, expiresAt } = JSON.parse(brut) as { token: string; expiresAt: number };
      return Date.now() < expiresAt ? token : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère les billets réels (un par place, chacun avec son propre qrUuid) via le jeton
   * post-achat — pas d'OTP nécessaire sur cet écran (contrairement à "Mes tickets").
   * Peut renvoyer une liste vide tant que le paiement n'est pas confirmé côté backend :
   * ce n'est pas une erreur, la section "Télécharger mon billet" reste simplement masquée.
   */
  private chargerTicketsConfirmation(): void {
    if (this.ticketsDejaCharges || !this.confirmation) return;
    const telephone = this.formInfos.get('telephoneReservant')?.value;
    const token = this.confirmation.ticketAccessToken || this.lireTokenSession(this.confirmation.reservationId);
    if (!telephone || !token) return;

    this.chargementTickets = true;
    this.erreurTickets = null;
    this.sub.add(
      this.billetterieSvc.ticketsAvecQr(this.confirmation.reservationId, telephone, token)
        .pipe(catchError(() => of(null)))
        .subscribe(tickets => {
          this.chargementTickets = false;
          if (tickets === null) {
            this.erreurTickets = 'Impossible de charger ton billet pour le moment.';
            return;
          }
          if (tickets.length === 0) return; // paiement pas encore confirmé côté backend
          this.ticketsDejaCharges = true;
          this.tickets = tickets;
          void this.genererQrCodes(tickets);
        })
    );
  }

  /**
   * QR code généré côté frontend, un par billet physique (un ticket = un qrUuid).
   * 100% local (librairie `qrcode`, aucun appel réseau) : le qrUuid, secret d'entrée,
   * ne doit jamais transiter par un service tiers (cf. audit sécurité tickets.component).
   */
  private async genererQrCodes(tickets: TicketAvecQr[]): Promise<void> {
    for (const t of tickets) {
      if (!t.qrUuid || this.qrDataUrls[t.qrUuid]) continue;
      try {
        this.qrDataUrls[t.qrUuid] = await QRCode.toDataURL(`NKS:${t.qrUuid}`, { width: 200, margin: 1 });
      } catch {
        // Échec de génération locale : le ticket demeure consultable sans QR.
      }
      this.cdr.markForCheck();
    }
  }

  /** Data URL du QR déjà généré pour ce ticket, ou null tant qu'il n'est pas prêt. */
  qrDataUrl(qrUuid: string): string | null {
    return this.qrDataUrls[qrUuid] ?? null;
  }

  /**
   * Génère (Canvas 2D côté navigateur — cf. TicketImageService) puis télécharge l'image du
   * billet façon "badge événement", à partir du QR déjà généré localement et des infos de
   * la soirée résolues au chargement de la page.
   */
  async telechargerBillet(ticket: TicketAvecQr, index: number): Promise<void> {
    if (this.billetEnCoursDeGeneration[ticket.ticketId]) return;
    const qr = this.qrDataUrl(ticket.qrUuid);
    if (!qr) return;

    this.billetEnCoursDeGeneration[ticket.ticketId] = true;
    this.cdr.markForCheck();
    try {
      const dataUrl = this.billetImages[ticket.ticketId] ?? await this.ticketImageSvc.genererImageBillet({
        soireeNom: this.soiree?.nom ?? 'Night Karaoke Stars',
        soireeDateHeure: this.soiree?.dateHeure ?? new Date().toISOString(),
        soireeLieu: this.soiree?.lieu ?? null,
        nomSpectateur: ticket.nomSpectateur || (this.formInfos.get('nomReservant')?.value ?? ''),
        categorieNom: this.categorieSelectionnee?.nom ?? null,
        qrDataUrl: qr,
        numeroBillet: this.tickets.length > 1 ? `${index + 1}/${this.tickets.length}` : null,
      });
      this.billetImages[ticket.ticketId] = dataUrl;
      this.ticketImageSvc.telecharger(dataUrl, `billet-nks-${ticket.ticketId}.png`);
    } catch {
      // Échec de composition (ex. logos indisponibles hors-ligne) — le QR reste consultable à l'écran.
    } finally {
      this.billetEnCoursDeGeneration[ticket.ticketId] = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Interroge GET /paiements/{id}/statut-public (public, sans JWT — l'acheteur de billet
   * n'a pas de compte). Même cadence que PaiementRetourComponent : 3s, ~2 min.
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
        if (res.statut === 'COMPLETED') {
          this.issuePaiement = 'confirme';
          this.chargerTicketsConfirmation();
        } else if (res.statut !== 'PENDING') {
          this.issuePaiement = 'echoue';
        }
      })
    );
  }
}
