import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, switchMap, catchError, of, finalize } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { JuryService, JuryBrut, NoteJuryBrut } from '@core/services/jury.service';
import { SoireeService } from '@core/services/soiree.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Edition, SoireeEvent } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-jury',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
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
            <thead><tr><th scope="col">Nom</th><th scope="col">Spécialité</th><th scope="col">Contact</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              @for (j of jurys; track j.id) {
                <tr>
                  <td>{{ j.prenom }} {{ j.nom }}</td>
                  <td>{{ j.specialite ?? '—' }}</td>
                  <td class="mono">{{ j.utilisateurId.slice(0, 8) }}…</td>
                  <td><span class="badge-tbl" [class]="'badge-tbl--' + j.statut">{{ j.statut }}</span></td>
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
</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss', '../resultats/resultats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class JuryComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private jurySvc = inject(JuryService);
  private soireeSvc = inject(SoireeService);
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
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

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
}
