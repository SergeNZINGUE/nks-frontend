import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, switchMap, catchError, of, finalize, forkJoin } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { SoireeService } from '@core/services/soiree.service';
import { BilletterieService } from '@core/services/billetterie.service';
import { Edition, Phase, SoireeEvent, CategorieTicket, StatutSoiree } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-soirees',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterModule],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Soirées &amp; catégories</h1>
      <p class="page-header__subtitle">Créer les soirées de l'édition en cours et gérer leurs catégories de tickets.</p>
    </div>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
  }

  @if (!isLoading && erreurChargement) {
    <div class="banner banner--err" role="alert">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      {{ erreurChargement }}
    </div>
  }

  @if (!isLoading && !erreurChargement) {

    <div class="card">
      <h2 class="card__title">Créer une soirée</h2>
      <form [formGroup]="formSoiree" (ngSubmit)="creerSoiree()" class="form">
        <div class="field">
          <label for="phase">Phase</label>
          <select id="phase" formControlName="phaseId">
            <option value="" disabled>— choisir —</option>
            @for (p of phases; track p.id) { <option [value]="p.id">{{ p.nom }}</option> }
          </select>
        </div>
        <div class="form__row">
          <div class="field"><label for="nom">Nom</label><input id="nom" type="text" formControlName="nom" maxlength="150" /></div>
          <div class="field field--sm"><label for="dateHeure">Date &amp; heure</label><input id="dateHeure" type="datetime-local" formControlName="dateHeure" /></div>
        </div>
        <div class="form__row">
          <div class="field"><label for="lieu">Lieu</label><input id="lieu" type="text" formControlName="lieu" maxlength="150" /></div>
          <div class="field field--sm"><label for="capaciteMax">Capacité max</label><input id="capaciteMax" type="number" min="1" formControlName="capaciteMax" /></div>
        </div>
        <div class="field"><label for="adresse">Adresse (optionnel)</label><input id="adresse" type="text" formControlName="adresse" maxlength="255" /></div>
        @if (erreurCreation) {
          <div class="field-error" role="alert">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            {{ erreurCreation }}
          </div>
        }
        <div class="form__actions">
          <button type="submit" class="btn btn--primary" [disabled]="formSoiree.invalid || creationEnCours">
            {{ creationEnCours ? 'Création…' : 'Créer la soirée' }}
          </button>
        </div>
        @if (messageSoiree) {
          <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messageSoiree }}</div>
        }
      </form>
    </div>

    <div class="list">
      @if (erreurSoirees) {
        <div class="field-error" role="alert">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          Impossible de charger les soirées (backend indisponible — 500/503 constaté en test live). Les soirées existantes en base ne sont pas forcément absentes, juste non affichables pour l'instant.
        </div>
      } @else if (soirees.length === 0) {
        <div class="empty-state">Aucune soirée pour cette édition.</div>
      }
      @for (s of soirees; track s.id) {
        <div class="phase-card">
          <div class="phase-card__header">
            <div>
              <div class="phase-card__nom">{{ s.nom }}</div>
              <div class="phase-card__dates">{{ s.dateHeure | date:'dd/MM/yyyy HH:mm' }} · {{ s.lieu }} · {{ s.capaciteMax }} places · {{ s.statut }}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" class="btn btn--sm btn--ghost" (click)="ouvrirEditionSoiree(s)">✏ Modifier</button>
              <a class="btn btn--sm btn--ghost" [routerLink]="['/admin/billets']" [queryParams]="{ soireeId: s.id }">Réservations →</a>
            </div>
          </div>
          <div class="phase-card__body">
            @if (categoriesParSoiree[s.id]; as cats) {
              @if (cats.length > 0) {
                <ul class="candidat-list">
                  @for (c of cats; track c.id) {
                    <li>{{ c.nom }} — {{ c.prix | number:'1.0-0' }} FCFA — {{ c.nbPlacesReservees }}/{{ c.nbPlacesDisponibles }} réservées</li>
                  }
                </ul>
              } @else {
                <p class="field-hint">Aucune catégorie de ticket pour cette soirée.</p>
              }
            }

            @if (formulaireCategorieOuvertPour === s.id) {
              <form [formGroup]="formCategorie" (ngSubmit)="creerCategorie(s.id)" class="form form--inline">
                <div class="form__row">
                  <div class="field field--sm">
                    <label [for]="'catNom' + s.id">Catégorie</label>
                    <select [id]="'catNom' + s.id" formControlName="nom">
                      <option value="STANDARD">Standard</option>
                      <option value="VIP">VIP</option>
                      <option value="PARTENAIRE">Partenaire</option>
                    </select>
                  </div>
                  <div class="field field--sm"><label [for]="'catPrix' + s.id">Prix (FCFA)</label><input [id]="'catPrix' + s.id" type="number" min="0" formControlName="prix" /></div>
                  <div class="field field--sm"><label [for]="'catPlaces' + s.id">Places</label><input [id]="'catPlaces' + s.id" type="number" min="1" formControlName="nbPlacesDisponibles" /></div>
                </div>
                @if (erreurCategorie) {
                  <div class="field-error" role="alert">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    {{ erreurCategorie }}
                  </div>
                }
                <div class="form__actions">
                  <button type="submit" class="btn btn--sm btn--primary" [disabled]="formCategorie.invalid || creationCategorieEnCours">
                    {{ creationCategorieEnCours ? '…' : 'Ajouter' }}
                  </button>
                  <button type="button" class="btn btn--sm btn--ghost" (click)="fermerFormulaireCategorie()">Annuler</button>
                </div>
              </form>
            } @else {
              <div class="phase-card__footer">
                <button type="button" class="btn btn--sm" (click)="ouvrirFormulaireCategorie(s.id)">+ Ajouter une catégorie de ticket</button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  }

  <!-- Modal édition soirée -->
  @if (soireeEnEdition) {
    <div class="modal-bg" (click)="fermerEditionSoiree()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titre-edit-soiree"
        (click)="$event.stopPropagation()" style="max-width:600px">
        <h2 id="titre-edit-soiree">Modifier « {{ soireeEnEdition.nom }} »</h2>
        <form [formGroup]="formEditionSoiree" (ngSubmit)="enregistrerSoiree()" class="form">
          <div class="form__row">
            <div class="field"><label for="editNom">Nom</label><input id="editNom" type="text" formControlName="nom" maxlength="150" /></div>
            <div class="field field--sm"><label for="editDateHeure">Date &amp; heure</label><input id="editDateHeure" type="datetime-local" formControlName="dateHeure" /></div>
          </div>
          <div class="form__row">
            <div class="field"><label for="editLieu">Lieu</label><input id="editLieu" type="text" formControlName="lieu" maxlength="150" /></div>
            <div class="field field--sm"><label for="editCapacite">Capacité max</label><input id="editCapacite" type="number" min="1" formControlName="capaciteMax" /></div>
          </div>
          <div class="field"><label for="editAdresse">Adresse (optionnel)</label><input id="editAdresse" type="text" formControlName="adresse" maxlength="255" /></div>
          <div class="field">
            <label for="editStatut">Statut</label>
            <select id="editStatut" formControlName="statut">
              <option value="PLANIFIEE">Planifiée</option>
              <option value="EN_COURS">En cours</option>
              <option value="TERMINEE">Terminée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
          <label class="checkbox">
            <input type="checkbox" formControlName="voteSurPlaceActif" />
            Vote sur place actif
          </label>
          @if (erreurEditionSoiree) {
            <div class="field-error" role="alert">{{ erreurEditionSoiree }}</div>
          }
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" (click)="fermerEditionSoiree()">Annuler</button>
            <button type="submit" class="btn btn--primary" [disabled]="formEditionSoiree.invalid || editionSoireeEnCours">
              {{ editionSoireeEnCours ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', '../resultats/resultats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SoireesComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private soireeSvc = inject(SoireeService);
  private billetterieSvc = inject(BilletterieService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  phases: Phase[] = [];
  soirees: SoireeEvent[] = [];
  categoriesParSoiree: Record<string, CategorieTicket[]> = {};
  erreurSoirees = false;

  formSoiree = this.fb.nonNullable.group({
    phaseId: ['', Validators.required],
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    dateHeure: ['', Validators.required],
    lieu: ['', [Validators.required, Validators.maxLength(150)]],
    adresse: [''],
    capaciteMax: [200, [Validators.required, Validators.min(1)]],
  });
  erreurCreation: string | null = null;
  creationEnCours = false;
  messageSoiree: string | null = null;

  soireeEnEdition: SoireeEvent | null = null;
  formEditionSoiree = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    dateHeure: ['', Validators.required],
    lieu: ['', [Validators.required, Validators.maxLength(150)]],
    adresse: [''],
    capaciteMax: [200, [Validators.required, Validators.min(1)]],
    statut: ['PLANIFIEE', Validators.required],
    voteSurPlaceActif: [false],
  });
  erreurEditionSoiree: string | null = null;
  editionSoireeEnCours = false;

  formulaireCategorieOuvertPour: string | null = null;
  formCategorie = this.fb.nonNullable.group({
    nom: ['STANDARD', Validators.required],
    prix: [0, [Validators.required, Validators.min(0)]],
    nbPlacesDisponibles: [100, [Validators.required, Validators.min(1)]],
  });
  erreurCategorie: string | null = null;
  creationCategorieEnCours = false;

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.adminSvc.editions().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0] ?? null;
          if (!active) return of(null);
          this.edition = active;
          // Chaque source garde son propre échec (via un marqueur, pas juste `[]`) : sans
          // ça, un 500/503 sur /soirees est indiscernable d'une édition sans soirée —
          // constaté en test live le 16/08/2026 (soirées silencieusement vidées par un 503).
          return forkJoin([
            this.adminSvc.phases(active.id).pipe(catchError(() => of([] as Phase[]))),
            this.soireeSvc.lister(active.id).pipe(
              catchError(() => { this.erreurSoirees = true; return of([] as SoireeEvent[]); })
            ),
          ]);
        }),
        catchError(() => of(null)),
      ).subscribe(res => {
        this.isLoading = false;
        if (res === null) { this.erreurChargement = 'Erreur de chargement (backend hors ligne ou aucune édition ?)'; return; }
        const [phases, soirees] = res;
        this.phases = phases;
        this.soirees = soirees;
        soirees.forEach(s => this.chargerCategories(s.id));
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  private chargerCategories(soireeId: string): void {
    this.sub.add(
      this.soireeSvc.disponibilite(soireeId).pipe(catchError(() => of([] as CategorieTicket[])))
        .subscribe(cats => { this.categoriesParSoiree = { ...this.categoriesParSoiree, [soireeId]: cats }; })
    );
  }

  creerSoiree(): void {
    if (this.formSoiree.invalid) { this.formSoiree.markAllAsTouched(); return; }
    this.erreurCreation = null;
    this.creationEnCours = true;
    const v = this.formSoiree.getRawValue();
    const corps = {
      nom: v.nom,
      dateHeure: new Date(v.dateHeure).toISOString(),
      lieu: v.lieu,
      adresse: v.adresse || null,
      capaciteMax: v.capaciteMax,
      statut: 'PLANIFIEE' as const,
      voteSurPlaceActif: false,
    };
    this.sub.add(
      this.soireeSvc.creer(v.phaseId, corps).pipe(
        catchError(err => { this.erreurCreation = messageErreur(err, 'Échec de la création de la soirée.'); return of(null); }),
        finalize(() => { this.creationEnCours = false; })
      ).subscribe(soiree => {
        if (!soiree) return;
        this.soirees = [...this.soirees, soiree];
        this.categoriesParSoiree = { ...this.categoriesParSoiree, [soiree.id]: [] };
        this.formSoiree.reset({ phaseId: '', nom: '', dateHeure: '', lieu: '', adresse: '', capaciteMax: 200 });
        this.messageSoiree = `Soirée "${soiree.nom}" créée.`;
      })
    );
  }

  ouvrirEditionSoiree(s: SoireeEvent): void {
    this.soireeEnEdition = s;
    this.erreurEditionSoiree = null;
    this.formEditionSoiree.setValue({
      nom: s.nom,
      dateHeure: new Date(s.dateHeure).toISOString().slice(0, 16),
      lieu: s.lieu,
      adresse: s.adresse ?? '',
      capaciteMax: s.capaciteMax,
      statut: s.statut,
      voteSurPlaceActif: s.voteSurPlaceActif,
    });
  }

  fermerEditionSoiree(): void { this.soireeEnEdition = null; }

  enregistrerSoiree(): void {
    if (this.formEditionSoiree.invalid || !this.soireeEnEdition) { this.formEditionSoiree.markAllAsTouched(); return; }
    this.erreurEditionSoiree = null;
    this.editionSoireeEnCours = true;
    const v = this.formEditionSoiree.getRawValue();
    const corps = { ...this.soireeEnEdition, ...v, dateHeure: new Date(v.dateHeure).toISOString(), statut: v.statut as StatutSoiree };
    this.sub.add(
      this.soireeSvc.mettreAJour(this.soireeEnEdition.id, corps).pipe(
        catchError(err => { this.erreurEditionSoiree = messageErreur(err, 'Échec de la mise à jour.'); return of(null); }),
        finalize(() => { this.editionSoireeEnCours = false; })
      ).subscribe(soiree => {
        if (!soiree) return;
        this.soirees = this.soirees.map(s => s.id === soiree.id ? soiree : s);
        this.fermerEditionSoiree();
      })
    );
  }

  ouvrirFormulaireCategorie(soireeId: string): void {
    this.formulaireCategorieOuvertPour = soireeId;
    this.erreurCategorie = null;
    this.formCategorie.reset({ nom: 'STANDARD', prix: 0, nbPlacesDisponibles: 100 });
  }

  fermerFormulaireCategorie(): void { this.formulaireCategorieOuvertPour = null; }

  creerCategorie(soireeId: string): void {
    if (this.formCategorie.invalid) { this.formCategorie.markAllAsTouched(); return; }
    this.erreurCategorie = null;
    this.creationCategorieEnCours = true;
    const v = this.formCategorie.getRawValue();
    const nouvelleCategorie: Omit<CategorieTicket, 'id'> = {
      nom: v.nom,
      prix: v.prix,
      nbPlacesDisponibles: v.nbPlacesDisponibles,
      nbPlacesReservees: 0,
    };
    this.sub.add(
      this.billetterieSvc.creerCategorie(soireeId, nouvelleCategorie).pipe(
        catchError(err => { this.erreurCategorie = messageErreur(err, 'Échec de la création de la catégorie.'); return of(null); }),
        finalize(() => { this.creationCategorieEnCours = false; })
      ).subscribe(cat => {
        if (!cat) return;
        this.categoriesParSoiree = {
          ...this.categoriesParSoiree,
          [soireeId]: [...(this.categoriesParSoiree[soireeId] ?? []), cat],
        };
        this.messageSoiree = `Catégorie "${cat.nom}" ajoutée.`;
        this.fermerFormulaireCategorie();
      })
    );
  }
}
