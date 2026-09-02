import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { catchError, of, startWith, switchMap, takeWhile } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { PaiementService } from '@core/services/paiement.service';
import { CategorieTicket, ReservationResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { StarMarkComponent } from '@shared/components/star-mark/star-mark.component';

type Etape = 'categorie' | 'infos' | 'paiement' | 'confirmation';

@Component({
  selector: 'app-reservation',
  imports: [DecimalPipe, ReactiveFormsModule, RouterModule, TopbarComponent, StarMarkComponent],
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

  soireeId: string | null = null;
  etape: Etape = 'categorie';
  isLoading = true;
  isSubmitting = false;
  categories: CategorieTicket[] = [];
  categorieSelectionnee: CategorieTicket | null = null;
  confirmation: ReservationResponse | null = null;
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
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  /** nbPlacesDisponibles = capacité totale, nbPlacesReservees = déjà réservées (CategorieTicketResponse backend). */
  placesRestantes(cat: CategorieTicket): number {
    return Math.max(0, cat.nbPlacesDisponibles - cat.nbPlacesReservees);
  }

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
    this.etape = 'infos';
  }

  get montantTotal(): number {
    const nb = this.formInfos.get('nbPlaces')?.value ?? 1;
    return (this.categorieSelectionnee?.prix ?? 0) * nb;
  }

  passerAuPaiement(): void {
    if (this.formInfos.invalid) return;
    this.etape = 'paiement';
  }

  soumettre(): void {
    if (!this.categorieSelectionnee || !this.soireeId) return;
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
        if (res.statut === 'COMPLETED') this.issuePaiement = 'confirme';
        else if (res.statut !== 'PENDING') this.issuePaiement = 'echoue';
      })
    );
  }

  retourCategories(): void {
    this.etape = 'categorie';
    this.categorieSelectionnee = null;
  }
}
