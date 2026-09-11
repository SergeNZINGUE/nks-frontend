import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, finalize, of } from 'rxjs';

import {
  AdminService,
  CreerUtilisateurAdminRequest,
  RoleAdmin,
  UtilisateurAdminResponse,
} from '@core/services/admin.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-utilisateurs',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  template: `
<div class="page">

  <div class="page-header">
    <div>
      <h1 class="page-header__title">Utilisateurs &amp; rôles</h1>
      <p class="page-header__subtitle">Créer les comptes admin, super-admin et agents d'accueil. Réinitialiser leurs mots de passe.</p>
    </div>
  </div>

  <!-- Formulaire de création -->
  <div class="card">
    <h2 class="card__title">Créer un utilisateur</h2>
    <form [formGroup]="form" (ngSubmit)="creer()" class="form">
      <div class="form__row">
        <div class="field"><label for="prenom">Prénom</label><input id="prenom" type="text" formControlName="prenom" maxlength="100" /></div>
        <div class="field"><label for="nom">Nom</label><input id="nom" type="text" formControlName="nom" maxlength="100" /></div>
      </div>
      <div class="form__row">
        <div class="field"><label for="email">Email</label><input id="email" type="email" formControlName="email" /></div>
        <div class="field"><label for="telephone">Téléphone</label><input id="telephone" type="tel" formControlName="telephone" placeholder="+226..." /></div>
      </div>
      <div class="field">
        <label for="role">Rôle</label>
        <select id="role" formControlName="role">
          <option value="" disabled>— choisir un rôle —</option>
          <option value="ADMIN">Administrateur</option>
          <option value="SUPER_ADMIN">Super administrateur</option>
          <option value="AGENT_ACCUEIL">Agent d'accueil</option>
          <option value="ORGANISATEUR">Organisateur</option>
        </select>
      </div>
      @if (erreurCreation) {
        <div class="field-error" role="alert">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          {{ erreurCreation }}
        </div>
      }
      @if (messageCreation) {
        <div class="field-hint" role="status" aria-live="polite">{{ messageCreation }}</div>
      }
      <div class="form__actions">
        <button type="submit" class="btn btn--primary" [disabled]="form.invalid || creationEnCours">
          {{ creationEnCours ? 'Création…' : 'Créer l\'utilisateur' }}
        </button>
      </div>
    </form>
  </div>

  <!-- Liste des utilisateurs -->
  <div class="card">
    <h2 class="card__title">Comptes non-candidats</h2>
    @if (chargement) {
      <div class="skeletons" role="status"><div class="sk" aria-hidden="true"></div></div>
    }
    @if (!chargement && erreurListe) {
      <div class="field-error" role="alert">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        {{ erreurListe }}
      </div>
    }
    @if (!chargement && !erreurListe && utilisateurs.length === 0) {
      <div class="empty-state">Aucun compte admin trouvé.</div>
    }
    @if (!chargement && utilisateurs.length > 0) {
      <div class="table-wrap">
        <table class="tbl" aria-label="Liste des utilisateurs admin">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Email</th>
              <th scope="col">Téléphone</th>
              <th scope="col">Rôle(s)</th>
              <th scope="col">Statut</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of utilisateurs; track u.id) {
              <tr>
                <td>{{ u.prenom }} {{ u.nom }}</td>
                <td class="mono">{{ u.email }}</td>
                <td class="mono">{{ u.telephone }}</td>
                <td>{{ u.roles.join(', ') }}</td>
                <td><span class="badge-tbl" [class]="'badge-tbl--' + u.statut">{{ u.statut }}</span></td>
                <td>
                  <button type="button" class="btn btn--sm" [disabled]="reinitEnCoursId === u.id" (click)="demandeReinit = u">
                    {{ reinitEnCoursId === u.id ? '…' : 'Réinitialiser MDP' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (messageReinit) {
        <div class="field-hint" role="status" aria-live="polite" style="margin-top: 8px;">{{ messageReinit }}</div>
      }
    }
  </div>

  @if (demandeReinit; as u) {
    <app-confirm-dialog
      titre="Réinitialiser le mot de passe"
      [message]="'Réinitialiser le mot de passe de ' + u.prenom + ' ' + u.nom + ' ? Un mot de passe temporaire lui sera envoyé par SMS et email.'"
      libelleConfirmer="Réinitialiser"
      [danger]="true"
      [enCours]="reinitEnCoursId === u.id"
      [erreur]="erreurReinit"
      (confirmed)="confirmerReinit(u)"
      (cancelled)="demandeReinit = null; erreurReinit = null" />
  }

</div>
`,
  styleUrls: ['../phases/phases.component.scss', '../poules/poules.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UtilisateursComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private fb = inject(FormBuilder);

  chargement = true;
  erreurListe: string | null = null;
  utilisateurs: UtilisateurAdminResponse[] = [];

  form = this.fb.nonNullable.group({
    prenom:    ['', [Validators.required, Validators.maxLength(100)]],
    nom:       ['', [Validators.required, Validators.maxLength(100)]],
    email:     ['', [Validators.required, Validators.email]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
    role:      ['' as RoleAdmin, Validators.required],
  });
  erreurCreation: string | null = null;
  messageCreation: string | null = null;
  creationEnCours = false;

  demandeReinit: UtilisateurAdminResponse | null = null;
  reinitEnCoursId: string | null = null;
  erreurReinit: string | null = null;
  messageReinit: string | null = null;

  private sub = new Subscription();

  ngOnInit(): void {
    this.charger();
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  private charger(): void {
    this.chargement = true;
    this.sub.add(
      this.adminSvc.listerUtilisateurs().pipe(
        catchError(err => { this.erreurListe = messageErreur(err, 'Erreur de chargement des utilisateurs.'); return of(null); }),
        finalize(() => { this.chargement = false; }),
      ).subscribe(liste => { if (liste) this.utilisateurs = liste; })
    );
  }

  creer(): void {
    if (this.form.invalid || this.creationEnCours) { this.form.markAllAsTouched(); return; }
    this.erreurCreation = null;
    this.messageCreation = null;
    this.creationEnCours = true;
    const v = this.form.getRawValue() as CreerUtilisateurAdminRequest;
    this.sub.add(
      this.adminSvc.creerUtilisateur(v).pipe(
        catchError(err => { this.erreurCreation = messageErreur(err, 'Échec de la création.'); return of(null); }),
        finalize(() => { this.creationEnCours = false; }),
      ).subscribe(u => {
        if (!u) return;
        this.utilisateurs = [...this.utilisateurs, u];
        this.form.reset({ prenom: '', nom: '', email: '', telephone: '', role: '' as RoleAdmin });
        this.messageCreation = `Compte créé pour ${u.prenom} ${u.nom}. Un mot de passe temporaire lui a été envoyé.`;
      })
    );
  }

  confirmerReinit(u: UtilisateurAdminResponse): void {
    this.reinitEnCoursId = u.id;
    this.erreurReinit = null;
    this.messageReinit = null;
    let echec = false;
    this.sub.add(
      this.adminSvc.reinitialiserMotDePasse(u.id).pipe(
        catchError(err => { echec = true; this.erreurReinit = messageErreur(err, 'Échec de la réinitialisation.'); return of(undefined); }),
        finalize(() => { this.reinitEnCoursId = null; }),
      ).subscribe(() => {
        if (echec) return;
        this.demandeReinit = null;
        this.messageReinit = `Mot de passe réinitialisé pour ${u.prenom} ${u.nom}.`;
      })
    );
  }
}