import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, switchMap, catchError, of, finalize, forkJoin } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { SoireeService } from '@core/services/soiree.service';
import { BilletterieService } from '@core/services/billetterie.service';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { Edition, SoireeEvent, CategorieTicket, Reservation, Page } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

const MSG_BACKEND_CASSE =
  "Backend indisponible : LazyInitializationException connue sur Reservation.soiree/.paiement (LAZY sans @JsonIgnore). Correction en attente côté backend.";

@Component({
  selector: 'app-billets',
  imports: [ReactiveFormsModule, DecimalPipe, TopbarComponent],
  template: `
<div class="page">
  <app-topbar title="Réservations & scans" icon="🎟️" backLink="/admin" backLabel="Retour à l'administration" />

  <div class="gap-banner" role="note">
    ⚠️ Écran câblé sur les endpoints réels de <code>BilletterieController</code>. La liste des
    réservations admin est aujourd'hui cassée côté backend (500 confirmé en test live, dès qu'il y a
    des réservations en base pour la soirée).
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="banner banner--err" role="alert">⚠️ {{ erreurChargement }}</div>
  }

  @if (!isLoading && !erreurChargement) {

    <div class="card">
      <div class="field field--sm">
        <label for="soireeSelect">Soirée</label>
        <select id="soireeSelect" [value]="soireeSelectionneeId" (change)="selectionnerSoiree($any($event.target).value)">
          <option value="" disabled>— choisir —</option>
          @for (s of soirees; track s.id) { <option [value]="s.id">{{ s.nom }}</option> }
        </select>
      </div>
      @if (compteur) {
        <p class="field-hint" style="margin-top: 8px;">Entrées scannées : {{ compteur['total'] ?? 0 }}</p>
      }
    </div>

    @if (soireeSelectionneeId) {

      <div class="card">
        <h2 class="card__title">Émettre des tickets gratuits</h2>
        <form [formGroup]="formGratuit" (ngSubmit)="emettreGratuit()" class="form">
          <div class="form__row">
            <div class="field">
              <label for="categorie">Catégorie</label>
              <select id="categorie" formControlName="categorieId">
                <option value="" disabled>— choisir —</option>
                @for (c of categories; track c.id) { <option [value]="c.id">{{ c.nom }} — {{ c.prix | number:'1.0-0' }} FCFA</option> }
              </select>
            </div>
            <div class="field field--sm"><label for="nbPlaces">Places</label><input id="nbPlaces" type="number" min="1" formControlName="nbPlaces" /></div>
          </div>
          <div class="form__row">
            <div class="field"><label for="nom">Nom du bénéficiaire</label><input id="nom" type="text" formControlName="nom" maxlength="150" /></div>
            <div class="field"><label for="telephone">Téléphone</label><input id="telephone" type="tel" formControlName="telephone" /></div>
          </div>
          @if (erreurGratuit) {
            <div class="field-error" role="alert">⚠️ {{ erreurGratuit }}</div>
          }
          <div class="form__actions">
            <button type="submit" class="btn btn--primary" [disabled]="formGratuit.invalid || emissionEnCours">
              {{ emissionEnCours ? 'Émission…' : 'Émettre le(s) ticket(s)' }}
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2 class="card__title">Réservations</h2>
        @if (chargementReservations) {
          <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
        }
        @if (!chargementReservations && erreurReservations) {
          <div class="field-error" role="alert">⚠️ {{ erreurReservations }}</div>
        }
        @if (!chargementReservations && !erreurReservations && reservations.length === 0) {
          <div class="empty-state">Aucune réservation pour cette soirée.</div>
        }
        @if (!chargementReservations && reservations.length > 0) {
          <div class="table-wrap">
            <table class="tbl" aria-label="Réservations de la soirée">
              <thead><tr><th scope="col">Réservant</th><th scope="col">Téléphone</th><th scope="col">Places</th><th scope="col">Statut</th></tr></thead>
              <tbody>
                @for (r of reservations; track r.id) {
                  <tr>
                    <td>{{ r.nomReservant }}</td>
                    <td>{{ r.telephoneReservant }}</td>
                    <td>{{ r.nbPlaces }}</td>
                    <td><span class="badge-tbl" [class]="'badge-tbl--' + r.statut">{{ r.statut }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (messageGratuit) {
          <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messageGratuit }}</div>
        }
      </div>
    }
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', '../resultats/resultats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BilletsComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private soireeSvc = inject(SoireeService);
  private billetterieSvc = inject(BilletterieService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  soirees: SoireeEvent[] = [];
  categories: CategorieTicket[] = [];
  compteur: Record<string, number | undefined> | null = null;

  soireeSelectionneeId = '';

  chargementReservations = false;
  erreurReservations: string | null = null;
  reservations: Reservation[] = [];

  formGratuit = this.fb.nonNullable.group({
    categorieId: ['', Validators.required],
    nbPlaces: [1, [Validators.required, Validators.min(1)]],
    nom: ['', Validators.required],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
  });
  erreurGratuit: string | null = null;
  emissionEnCours = false;
  messageGratuit: string | null = null;

  private sub = new Subscription();

  ngOnInit(): void {
    const soireeIdDepuisUrl = this.route.snapshot.queryParamMap.get('soireeId');
    this.sub.add(
      this.adminSvc.editions().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
          if (!active) return of(null);
          this.edition = active;
          return this.soireeSvc.lister(active.id).pipe(catchError(() => of([] as SoireeEvent[])));
        }),
        catchError(() => of(null)),
      ).subscribe(soirees => {
        this.isLoading = false;
        if (soirees === null) { this.erreurChargement = 'Erreur de chargement (backend hors ligne ou aucune édition ?)'; return; }
        this.soirees = soirees;
        const idInitial = soireeIdDepuisUrl && soirees.some(s => s.id === soireeIdDepuisUrl) ? soireeIdDepuisUrl : (soirees[0]?.id ?? '');
        if (idInitial) this.selectionnerSoiree(idInitial);
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  selectionnerSoiree(id: string): void {
    this.soireeSelectionneeId = id;
    this.formGratuit.reset({ categorieId: '', nbPlaces: 1, nom: '', telephone: '' });
    this.chargerReservations();
    this.sub.add(
      forkJoin([
        this.soireeSvc.disponibilite(id).pipe(catchError(() => of([] as CategorieTicket[]))),
        this.billetterieSvc.compteurEntrees(id).pipe(catchError(() => of(null))),
      ]).subscribe(([cats, compteur]) => {
        this.categories = cats;
        this.compteur = compteur;
      })
    );
  }

  private chargerReservations(): void {
    if (!this.soireeSelectionneeId) return;
    this.chargementReservations = true;
    this.erreurReservations = null;
    this.sub.add(
      this.billetterieSvc.reservationsAdmin(this.soireeSelectionneeId, 0, 50).pipe(
        catchError(() => { this.erreurReservations = MSG_BACKEND_CASSE; return of(null); }),
        finalize(() => { this.chargementReservations = false; })
      ).subscribe((res: Page<Reservation> | null) => { if (res) this.reservations = res.content; })
    );
  }

  emettreGratuit(): void {
    if (this.formGratuit.invalid || !this.soireeSelectionneeId) { this.formGratuit.markAllAsTouched(); return; }
    this.erreurGratuit = null;
    this.emissionEnCours = true;
    const v = this.formGratuit.getRawValue();
    this.sub.add(
      this.billetterieSvc.ticketsGratuits({ soireeId: this.soireeSelectionneeId, ...v }).pipe(
        catchError(err => { this.erreurGratuit = messageErreur(err, 'Échec de l\'émission.'); return of(null); }),
        finalize(() => { this.emissionEnCours = false; })
      ).subscribe(reservation => {
        if (!reservation) return;
        this.reservations = [reservation, ...this.reservations];
        this.formGratuit.reset({ categorieId: '', nbPlaces: 1, nom: '', telephone: '' });
        this.messageGratuit = `✓ Ticket(s) émis pour ${reservation.nomReservant}.`;
      })
    );
  }
}
