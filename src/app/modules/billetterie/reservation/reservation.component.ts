import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, of, switchMap } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { CategorieTicket, ReservationResponse } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

type Etape = 'categorie' | 'infos' | 'paiement' | 'confirmation';

@Component({
  selector: 'app-reservation',
  imports: [DecimalPipe, ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ReservationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billetterieSvc = inject(BilletterieService);

  soireeId: string | null = null;
  etape: Etape = 'categorie';
  isLoading = true;
  isSubmitting = false;
  categories: CategorieTicket[] = [];
  categorieSelectionnee: CategorieTicket | null = null;
  confirmation: ReservationResponse | null = null;
  redirectionEnCours = false;
  erreur: string | null = null;

  formInfos!: FormGroup;
  formPaiement!: FormGroup;

  readonly operateurs = [
    { value: 'ORANGE_MONEY', label: '🟠 Orange Money' },
    { value: 'MOOV_MONEY',   label: '🔵 Moov Money' },
  ];

  private sub = new Subscription();

  ngOnInit(): void {
    this.formInfos = this.fb.group({
      nomReservant:       ['', [Validators.required, Validators.minLength(3)]],
      telephoneReservant: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      emailReservant:     ['', [Validators.email]],
      nbPlaces:           [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    });

    this.formPaiement = this.fb.group({
      telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      operateur: ['ORANGE_MONEY', Validators.required],
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
    // Pré-remplir téléphone paiement avec le téléphone de réservation
    const tel = this.formInfos.get('telephoneReservant')?.value;
    if (tel) this.formPaiement.get('telephone')?.setValue(tel);
    this.etape = 'paiement';
  }

  soumettre(): void {
    if (this.formPaiement.invalid || !this.categorieSelectionnee || !this.soireeId) return;
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
          if (res.urlPaiement) {
            this.redirectionEnCours = true;
            setTimeout(() => window.location.assign(res.urlPaiement), 1200);
          }
        },
        error: err => {
          this.isSubmitting = false;
          this.erreur = err?.error?.message ?? 'Erreur lors de la réservation. Réessaie.';
        },
      })
    );
  }

  retourCategories(): void {
    this.etape = 'categorie';
    this.categorieSelectionnee = null;
  }
}
