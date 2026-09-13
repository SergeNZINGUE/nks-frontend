import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { JuryService, JuryBrut, NoteJuryBrut, GrilleDeliberationResponse } from '@core/services/jury.service';
import { SoireeService } from '@core/services/soiree.service';
import { CritereNotationService, CritereNotationAdminResponse } from '@core/services/critere-notation.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { GrilleDeliberationComponent } from '@shared/components/grille-deliberation/grille-deliberation.component';
import { ModalComponent } from '../shared/ui/modal/modal.component';
import { Edition, SoireeEvent } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-jury',
  imports: [ReactiveFormsModule, ConfirmDialogComponent, ModalComponent, GrilleDeliberationComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Gestion du jury</h1>
      <p class="page-header__subtitle">Créer les jurés, consulter leurs notes et clôturer la notation par soirée.</p>
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
      <h2 class="card__title">Créer un juré</h2>
      <form [formGroup]="formJury" (ngSubmit)="creerJury()" class="form">
        <div class="form__row">
          <div class="field"><label for="prenom">Prénom</label><input id="prenom" type="text" formControlName="prenom" maxlength="100" /></div>
          <div class="field"><label for="nom">Nom</label><input id="nom" type="text" formControlName="nom" maxlength="100" /></div>
        </div>
        <div class="form__row">
          <div class="field"><label for="email">Email</label><input id="email" type="email" formControlName="email" /></div>
          <div class="field"><label for="telephone">Téléphone</label><input id="telephone" type="tel" formControlName="telephone" placeholder="+226..." /></div>
        </div>
        <div class="field"><label for="specialite">Spécialité (optionnel)</label><input id="specialite" type="text" formControlName="specialite" maxlength="150" /></div>
        @if (erreurCreation) {
          <div class="field-error" role="alert">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            {{ erreurCreation }}
          </div>
        }
        <div class="form__actions">
          <button type="submit" class="btn btn--primary" [disabled]="formJury.invalid || creationEnCours">
            {{ creationEnCours ? 'Création…' : 'Créer le juré' }}
          </button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2 class="card__title">Jurés de l'édition</h2>
      @if (chargementListe) {
        <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
      }
      @if (!chargementListe && erreurListe) {
        <div class="field-error" role="alert">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreurListe }}
        </div>
      }
      @if (!chargementListe && !erreurListe && jurys.length === 0) {
        <div class="empty-state">Aucun juré pour cette édition.</div>
      }
      @if (!chargementListe && jurys.length > 0) {
        <div class="table-wrap">
          <table class="tbl" aria-label="Liste des jurés">
            <thead><tr><th scope="col">Nom</th><th scope="col">Spécialité</th><th scope="col">Contact</th><th scope="col">Statut</th><th scope="col">Soirées</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              @for (j of jurys; track j.id) {
                <tr>
                  <td>{{ j.prenom }} {{ j.nom }}</td>
                  <td>{{ j.specialite ?? '—' }}</td>
                  <td class="mono">{{ j.utilisateurId.slice(0, 8) }}…</td>
                  <td><span class="badge-tbl" [class]="'badge-tbl--' + j.statut">{{ j.statut }}</span></td>
                  <td>
                    {{ j.soireeIds.length }} soirée{{ j.soireeIds.length === 1 ? '' : 's' }}
                    <button type="button" class="btn btn--ghost btn--sm" (click)="ouvrirAffectation(j)">Gérer</button>
                  </td>
                  <td>
                    @if (j.statut === 'ACTIF') {
                      <button type="button" class="btn btn--err btn--sm" [disabled]="desactivationEnCoursId === j.id" (click)="juryADesactiver = j">
                        {{ desactivationEnCoursId === j.id ? '…' : 'Désactiver' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (messageJury) {
        <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messageJury }}</div>
      }
    </div>

    <div class="card">
      <h2 class="card__title">Critères de notation</h2>
      <p class="field-hint">Grille utilisée par les jurés pour cette édition (§3.4 du cahier des charges).</p>

      <form [formGroup]="formCritere" (ngSubmit)="creerCritere()" class="form">
        <div class="form__row">
          <div class="field"><label for="critNom">Nom du critère</label><input id="critNom" type="text" formControlName="nom" maxlength="150" /></div>
          <div class="field field--sm"><label for="critOrdre">Ordre</label><input id="critOrdre" type="number" min="1" formControlName="ordre" /></div>
        </div>
        <div class="form__row">
          <div class="field field--sm"><label for="critMin">Note min</label><input id="critMin" type="number" step="0.01" min="0" formControlName="noteMin" /></div>
          <div class="field field--sm"><label for="critMax">Note max</label><input id="critMax" type="number" step="0.01" min="0.01" formControlName="noteMax" /></div>
        </div>
        @if (erreurCreationCritere) {
          <div class="field-error" role="alert">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            {{ erreurCreationCritere }}
          </div>
        }
        <div class="form__actions">
          <button type="submit" class="btn btn--primary" [disabled]="formCritere.invalid || creationCritereEnCours">
            {{ creationCritereEnCours ? 'Création…' : 'Ajouter le critère' }}
          </button>
        </div>
      </form>

      @if (chargementCriteres) {
        <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
      }
      @if (!chargementCriteres && erreurCriteres) {
        <div class="field-error" role="alert">{{ erreurCriteres }}</div>
      }
      @if (!chargementCriteres && !erreurCriteres && criteres.length === 0) {
        <div class="empty-state">Aucun critère configuré pour cette édition — les jurés n'auront aucune grille à remplir tant qu'aucun critère n'est ajouté.</div>
      }
      @if (!chargementCriteres && criteres.length > 0) {
        <div class="table-wrap" style="margin-top: 16px;">
          <table class="tbl" aria-label="Critères de notation">
            <thead><tr><th scope="col">Ordre</th><th scope="col">Nom</th><th scope="col">Barème</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              @for (c of criteres; track c.id) {
                <tr>
                  <td>{{ c.ordre }}</td>
                  <td>{{ c.nom }}</td>
                  <td>{{ c.noteMin }} – {{ c.noteMax }}</td>
                  <td><span class="badge-tbl" [class]="c.actif ? 'badge-tbl--ACTIF' : 'badge-tbl--INACTIF'">{{ c.actif ? 'Actif' : 'Inactif' }}</span></td>
                  <td><button type="button" class="btn btn--ghost btn--sm" (click)="ouvrirEditionCritere(c)">Modifier</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <div class="card">
      <h2 class="card__title">Notes saisies par soirée</h2>
      <div class="field field--sm">
        <label for="soireeSelect">Soirée</label>
        <select id="soireeSelect" [value]="soireeSelectionneeId" (change)="selectionnerSoiree($any($event.target).value)">
          <option value="" disabled>— choisir —</option>
          @for (s of soirees; track s.id) {
            <option [value]="s.id">{{ s.nom }}</option>
          }
        </select>
      </div>
      <div class="form__actions" style="margin-top: 12px;">
        <button type="button" class="btn" [disabled]="!soireeSelectionneeId || chargementNotes" (click)="chargerNotes()">
          {{ chargementNotes ? 'Chargement…' : 'Charger les notes' }}
        </button>
        <button type="button" class="btn btn--primary" [disabled]="!soireeSelectionneeId || chargementGrille" (click)="ouvrirGrilleDeliberation()">
          {{ chargementGrille ? 'Chargement…' : 'Grille de délibération' }}
        </button>
        <button type="button" class="btn btn--err" [disabled]="!soireeSelectionneeId || clotureEnCours" (click)="demandeCloture = true">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          {{ clotureEnCours ? 'Clôture…' : 'Clôturer la notation de cette soirée' }}
        </button>
      </div>
      @if (erreurNotes) {
        <div class="field-error" role="alert" style="margin-top: 12px;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreurNotes }}
        </div>
      }
      @if (erreurGrille) {
        <div class="field-error" role="alert" style="margin-top: 12px;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreurGrille }}
        </div>
      }
      @if (messageCloture) {
        <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messageCloture }}</div>
      }
      @if (notes.length > 0) {
        <table class="tbl">
          <thead><tr><th>Candidat</th><th>Juré</th><th>Critère</th><th>Note</th><th>Verrouillée</th></tr></thead>
          <tbody>
            @for (n of notes; track n.id) {
              <tr>
                <td>{{ n.candidatId.slice(0, 8) }}…</td>
                <td>{{ n.juryId.slice(0, 8) }}…</td>
                <td>{{ n.critereNom }}</td>
                <td>{{ n.valeur }}</td>
                <td>
                  @if (n.verrouille) {
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  } @else {
                    —
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  }

  @if (juryADesactiver; as j) {
    <app-confirm-dialog
      titre="Désactiver ce juré"
      [message]="'Désactiver ' + j.prenom + ' ' + j.nom + ' ? Il ne pourra plus noter tant qu\\'il ne sera pas réactivé.'"
      libelleConfirmer="Désactiver"
      [danger]="true"
      [enCours]="desactivationEnCoursId === j.id"
      (confirmed)="confirmerDesactivation(j)"
      (cancelled)="juryADesactiver = null" />
  }

  @if (demandeCloture) {
    <app-confirm-dialog
      titre="Clôturer la notation"
      message="Clôturer définitivement la fenêtre de notation jury de cette soirée ? Les jurés ne pourront plus saisir ni modifier de notes. Cette action est irréversible."
      libelleConfirmer="Clôturer"
      [danger]="true"
      [enCours]="clotureEnCours"
      [erreur]="erreurCloture"
      (confirmed)="confirmerCloture()"
      (cancelled)="demandeCloture = false; erreurCloture = null" />
  }

  @if (grille) {
    <app-grille-deliberation [grille]="grille" (fermer)="fermerGrilleDeliberation()" />
  }

  @if (critereEnEdition; as ce) {
    <app-modal [titre]="'Modifier « ' + ce.nom + ' »'" (fermer)="fermerEditionCritere()">
      <form [formGroup]="formEditionCritere" (ngSubmit)="enregistrerCritere()" class="form">
        <div class="field"><label for="ceNom">Nom</label><input id="ceNom" type="text" formControlName="nom" maxlength="150" /></div>
        <div class="form__row">
          <div class="field field--sm"><label for="ceMin">Note min</label><input id="ceMin" type="number" step="0.01" min="0" formControlName="noteMin" /></div>
          <div class="field field--sm"><label for="ceMax">Note max</label><input id="ceMax" type="number" step="0.01" min="0.01" formControlName="noteMax" /></div>
          <div class="field field--sm"><label for="ceOrdre">Ordre</label><input id="ceOrdre" type="number" min="1" formControlName="ordre" /></div>
        </div>
        <label class="checklist__item">
          <input type="checkbox" formControlName="actif" />
          <span>Actif (visible des jurés dans leur grille de notation)</span>
        </label>
        @if (erreurEditionCritere) {
          <div class="field-error" role="alert">{{ erreurEditionCritere }}</div>
        }
        <div class="form__actions" style="margin-top: 16px;">
          <button type="button" class="btn btn--ghost" [disabled]="editionCritereEnCours" (click)="fermerEditionCritere()">Annuler</button>
          <button type="submit" class="btn btn--primary" [disabled]="formEditionCritere.invalid || editionCritereEnCours">
            {{ editionCritereEnCours ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </app-modal>
  }

  @if (juryPourAffectation; as j) {
    <app-modal [titre]="'Soirées de ' + j.prenom + ' ' + j.nom" (fermer)="fermerAffectation()">
      @if (soirees.length === 0) {
        <p>Aucune soirée disponible pour cette édition.</p>
      } @else {
        <ul class="checklist">
          @for (s of soirees; track s.id) {
            <li>
              <label class="checklist__item">
                <input type="checkbox"
                  [checked]="selectionSoirees.has(s.id)"
                  (change)="toggleSoiree(s.id)" />
                <span>{{ s.nom }}</span>
              </label>
            </li>
          }
        </ul>
      }
      @if (erreurAffectation) {
        <div class="field-error" role="alert">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreurAffectation }}
        </div>
      }
      <div class="form__actions" style="margin-top: 16px;">
        <button type="button" class="btn btn--ghost" [disabled]="affectationEnCours" (click)="fermerAffectation()">Annuler</button>
        <button type="button" class="btn btn--primary" [disabled]="affectationEnCours" (click)="confirmerAffectation()">
          {{ affectationEnCours ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </app-modal>
  }
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', '../resultats/resultats.component.scss'],
  styles: [`
    .checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
    .checklist__item { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  `],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class JuryComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private jurySvc = inject(JuryService);
  private soireeSvc = inject(SoireeService);
  private critereSvc = inject(CritereNotationService);
  private fb = inject(FormBuilder);

  isLoading = true;
  erreurChargement: string | null = null;
  edition: Edition | null = null;
  soirees: SoireeEvent[] = [];

  formJury = this.fb.nonNullable.group({
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
    specialite: [''],
  });
  erreurCreation: string | null = null;
  creationEnCours = false;

  chargementListe = false;
  erreurListe: string | null = null;
  jurys: JuryBrut[] = [];
  messageJury: string | null = null;

  desactivationEnCoursId: string | null = null;
  juryADesactiver: JuryBrut | null = null;

  soireeSelectionneeId = '';
  chargementNotes = false;
  erreurNotes: string | null = null;
  notes: NoteJuryBrut[] = [];

  demandeCloture = false;
  clotureEnCours = false;
  erreurCloture: string | null = null;
  messageCloture: string | null = null;

  chargementGrille = false;
  erreurGrille: string | null = null;
  grille: GrilleDeliberationResponse | null = null;

  juryPourAffectation: JuryBrut | null = null;
  selectionSoirees = new Set<string>();
  affectationEnCours = false;
  erreurAffectation: string | null = null;

  chargementCriteres = false;
  erreurCriteres: string | null = null;
  criteres: CritereNotationAdminResponse[] = [];
  formCritere = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    noteMin: [0, [Validators.required, Validators.min(0)]],
    noteMax: [20, [Validators.required, Validators.min(0.01)]],
    ordre: [1, [Validators.required, Validators.min(1)]],
  });
  erreurCreationCritere: string | null = null;
  creationCritereEnCours = false;
  critereEnEdition: CritereNotationAdminResponse | null = null;
  formEditionCritere = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    noteMin: [0, [Validators.required, Validators.min(0)]],
    noteMax: [20, [Validators.required, Validators.min(0.01)]],
    ordre: [1, [Validators.required, Validators.min(1)]],
    actif: [true],
  });
  erreurEditionCritere: string | null = null;
  editionCritereEnCours = false;

  private sub = new Subscription();

  ngOnInit(): void {
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
        this.chargerJurys();
        this.chargerCriteres();
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  // ── Critères de notation ─────────────────────────────────────────────────
  private chargerCriteres(): void {
    if (!this.edition) return;
    this.chargementCriteres = true;
    this.erreurCriteres = null;
    this.sub.add(
      this.critereSvc.lister(this.edition.id).pipe(
        catchError(err => { this.erreurCriteres = messageErreur(err, 'Erreur de chargement des critères.'); return of(null); }),
        finalize(() => { this.chargementCriteres = false; })
      ).subscribe(criteres => { if (criteres) this.criteres = criteres; })
    );
  }

  creerCritere(): void {
    if (this.formCritere.invalid || !this.edition) { this.formCritere.markAllAsTouched(); return; }
    const v = this.formCritere.getRawValue();
    if (v.noteMax <= v.noteMin) { this.erreurCreationCritere = 'La note max doit être supérieure à la note min.'; return; }
    this.erreurCreationCritere = null;
    this.creationCritereEnCours = true;
    this.sub.add(
      this.critereSvc.creer({ editionId: this.edition.id, nom: v.nom, noteMin: v.noteMin, noteMax: v.noteMax, ordre: v.ordre }).pipe(
        catchError(err => { this.erreurCreationCritere = messageErreur(err, 'Échec de la création du critère.'); return of(null); }),
        finalize(() => { this.creationCritereEnCours = false; })
      ).subscribe(critere => {
        if (!critere) return;
        this.criteres = [...this.criteres, critere].sort((a, b) => a.ordre - b.ordre);
        this.formCritere.reset({ nom: '', noteMin: 0, noteMax: 20, ordre: this.criteres.length + 1 });
      })
    );
  }

  ouvrirEditionCritere(c: CritereNotationAdminResponse): void {
    this.critereEnEdition = c;
    this.erreurEditionCritere = null;
    this.formEditionCritere.setValue({ nom: c.nom, noteMin: c.noteMin, noteMax: c.noteMax, ordre: c.ordre, actif: c.actif });
  }

  fermerEditionCritere(): void {
    this.critereEnEdition = null;
    this.erreurEditionCritere = null;
  }

  enregistrerCritere(): void {
    if (this.formEditionCritere.invalid || !this.critereEnEdition) return;
    const v = this.formEditionCritere.getRawValue();
    if (v.noteMax <= v.noteMin) { this.erreurEditionCritere = 'La note max doit être supérieure à la note min.'; return; }
    this.erreurEditionCritere = null;
    this.editionCritereEnCours = true;
    const id = this.critereEnEdition.id;
    this.sub.add(
      this.critereSvc.mettreAJour(id, v).pipe(
        catchError(err => { this.erreurEditionCritere = messageErreur(err, 'Échec de la mise à jour.'); return of(null); }),
        finalize(() => { this.editionCritereEnCours = false; })
      ).subscribe(res => {
        if (!res) return;
        this.criteres = this.criteres.map(c => c.id === id ? res : c).sort((a, b) => a.ordre - b.ordre);
        this.fermerEditionCritere();
      })
    );
  }

  private chargerJurys(): void {
    if (!this.edition) return;
    this.chargementListe = true;
    this.erreurListe = null;
    this.sub.add(
      this.jurySvc.listerAdmin(this.edition.id).pipe(
        catchError(err => { this.erreurListe = messageErreur(err, 'Erreur de chargement des jurés.'); return of(null); }),
        finalize(() => { this.chargementListe = false; })
      ).subscribe(jurys => { if (jurys) this.jurys = jurys; })
    );
  }

  creerJury(): void {
    if (this.formJury.invalid || !this.edition) { this.formJury.markAllAsTouched(); return; }
    this.erreurCreation = null;
    this.creationEnCours = true;
    const v = this.formJury.getRawValue();
    this.sub.add(
      this.jurySvc.creerAdmin({ ...v, specialite: v.specialite || undefined, editionId: this.edition.id }).pipe(
        catchError(err => { this.erreurCreation = messageErreur(err, 'Échec de la création du juré.'); return of(null); }),
        finalize(() => { this.creationEnCours = false; })
      ).subscribe(jury => {
        if (!jury) return;
        this.jurys = [...this.jurys, jury];
        this.formJury.reset({ prenom: '', nom: '', email: '', telephone: '', specialite: '' });
        this.messageJury = `Juré ${jury.prenom} ${jury.nom} créé.`;
      })
    );
  }

  confirmerDesactivation(j: JuryBrut): void {
    this.desactivationEnCoursId = j.id;
    this.messageJury = null;
    this.sub.add(
      this.jurySvc.desactiverAdmin(j.id).pipe(
        catchError(() => { this.messageJury = 'Échec de la désactivation.'; return of(null); }),
        finalize(() => { this.desactivationEnCoursId = null; this.juryADesactiver = null; })
      ).subscribe(() => {
        const idx = this.jurys.findIndex(x => x.id === j.id);
        if (idx !== -1) {
          this.jurys[idx] = { ...this.jurys[idx], statut: 'INACTIF' };
          this.messageJury = `Juré ${j.prenom} ${j.nom} désactivé.`;
        }
      })
    );
  }

  selectionnerSoiree(id: string): void {
    this.soireeSelectionneeId = id;
    this.notes = [];
    this.erreurNotes = null;
    this.messageCloture = null;
  }

  chargerNotes(): void {
    if (!this.soireeSelectionneeId) return;
    this.chargementNotes = true;
    this.erreurNotes = null;
    this.sub.add(
      this.jurySvc.notesSoireeAdmin(this.soireeSelectionneeId).pipe(
        catchError(err => { this.erreurNotes = messageErreur(err, 'Erreur de chargement des notes.'); return of(null); }),
        finalize(() => { this.chargementNotes = false; })
      ).subscribe(notes => { if (notes) this.notes = notes; })
    );
  }

  // ── Grille de délibération ───────────────────────────────────────────────
  ouvrirGrilleDeliberation(): void {
    if (!this.soireeSelectionneeId) return;
    this.chargementGrille = true;
    this.erreurGrille = null;
    this.sub.add(
      this.jurySvc.grilleDeliberation(this.soireeSelectionneeId).pipe(
        catchError(err => { this.erreurGrille = messageErreur(err, 'Erreur de chargement de la grille.'); return of(null); }),
        finalize(() => { this.chargementGrille = false; })
      ).subscribe(grille => { if (grille) this.grille = grille; })
    );
  }

  fermerGrilleDeliberation(): void {
    this.grille = null;
  }

  confirmerCloture(): void {
    if (!this.soireeSelectionneeId) return;
    this.clotureEnCours = true;
    this.erreurCloture = null;
    // 204 No Content : Angular HttpClient renvoie `null` aussi bien sur succès que sur le
    // repli catchError → distinction par indicateur local, pas par la valeur émise (même
    // pattern que ResultatsComponent.publier()).
    let echec = false;
    this.sub.add(
      this.jurySvc.cloturerNotationSoiree(this.soireeSelectionneeId).pipe(
        catchError(err => { echec = true; this.erreurCloture = messageErreur(err, 'Échec de la clôture de la notation.'); return of(undefined); }),
        finalize(() => { this.clotureEnCours = false; })
      ).subscribe(() => {
        if (echec) return; // la modale reste ouverte avec l'erreur affichée
        this.demandeCloture = false;
        this.messageCloture = 'Notation clôturée pour cette soirée.';
      })
    );
  }

  ouvrirAffectation(j: JuryBrut): void {
    this.juryPourAffectation = j;
    this.selectionSoirees = new Set(j.soireeIds);
    this.erreurAffectation = null;
  }

  fermerAffectation(): void {
    this.juryPourAffectation = null;
    this.erreurAffectation = null;
  }

  toggleSoiree(soireeId: string): void {
    if (this.selectionSoirees.has(soireeId)) this.selectionSoirees.delete(soireeId);
    else this.selectionSoirees.add(soireeId);
  }

  confirmerAffectation(): void {
    const j = this.juryPourAffectation;
    if (!j || this.affectationEnCours) return;
    this.affectationEnCours = true;
    this.erreurAffectation = null;
    this.sub.add(
      this.jurySvc.affecterSoirees(j.id, { soireeIds: [...this.selectionSoirees] }).pipe(
        catchError(err => { this.erreurAffectation = messageErreur(err, 'Échec de l\'affectation des soirées.'); return of(null); }),
        finalize(() => { this.affectationEnCours = false; })
      ).subscribe(jury => {
        if (!jury) return;
        const idx = this.jurys.findIndex(x => x.id === jury.id);
        if (idx !== -1) this.jurys[idx] = jury;
        this.juryPourAffectation = null;
      })
    );
  }
}
