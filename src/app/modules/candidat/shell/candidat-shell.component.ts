import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subscription, catchError, finalize, of } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { CandidatureService } from '@core/services/candidature.service';
import { messageErreur } from '@core/utils/http-error.util';
import { ModalComponent } from '../../admin/shared/ui/modal/modal.component';
import { CANDIDAT_NAV } from './candidat-nav.config';

/**
 * Coquille persistante du panel candidat — même langage visuel que app-admin-shell
 * (Panel 2026 : surface-1 + surface-sheen, bordures hairline, liseré doré actif,
 * carte compte en pied de sidebar).
 *
 * Le changement de mot de passe vit ici (pas dans mon-profil.component) : c'est une
 * action de compte transversale à tout l'espace candidat, accessible depuis le menu
 * sous le nom — même emplacement que sur la plupart des plateformes (Google, GitHub…).
 */
@Component({
  selector: 'app-candidat-shell',
  imports: [RouterModule, NgTemplateOutlet, ReactiveFormsModule, ModalComponent],
  template: `
<div class="shell">

  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="assets/logos/nks.png" alt="" class="sidebar__logo" />
      <span class="sidebar__brand-text">NKS <span>Candidat</span></span>
    </div>

    <nav class="sidebar__nav" aria-label="Navigation de l'espace candidat">
      @for (item of nav; track item.key) {
        <a class="sidebar__item" [routerLink]="item.route" routerLinkActive="sidebar__item--active">
          <span class="sidebar__item-icon" aria-hidden="true">
            <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ key: item.key }" />
          </span>
          <span class="sidebar__item-label">{{ item.label }}</span>
        </a>
      }
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__account">
        <span class="sidebar__account-avatar" aria-hidden="true">{{ initiales() }}</span>
        <div class="sidebar__account-info">
          <span class="sidebar__account-role">{{ nomComplet() }}</span>
          <span class="sidebar__account-sub">Espace personnel</span>
        </div>
      </div>
      <button type="button" class="sidebar__site-link" (click)="ouvrirModalMdp()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span class="sidebar__item-label">Changer le mot de passe</span>
      </button>
      <a routerLink="/" class="sidebar__site-link">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <span class="sidebar__item-label">Voir le site public</span>
      </a>
      <button type="button" class="sidebar__logout" (click)="deconnecter()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        <span class="sidebar__item-label">Déconnexion</span>
      </button>
    </div>
  </aside>

  <div class="shell__main">
    <header class="shell__topbar">
      <a routerLink="/mon-espace" class="shell__brand-mobile">
        <img src="assets/logos/nks.png" alt="" class="shell__brand-icon" />
        <span>Mon espace</span>
      </a>
      <span class="shell__topbar-spacer"></span>
      <button type="button" class="shell__account" (click)="ouvrirModalMdp()" aria-label="Changer le mot de passe">
        <span class="shell__account-avatar" aria-hidden="true">{{ initiales() }}</span>
      </button>
    </header>

    <main class="shell__content">
      <router-outlet />
    </main>
  </div>

  <nav class="bottom-nav" aria-label="Navigation de l'espace candidat">
    @for (item of nav; track item.key) {
      <a class="bottom-nav__item" [routerLink]="item.route" routerLinkActive="bottom-nav__item--active">
        <span class="bottom-nav__icon" aria-hidden="true">
          <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ key: item.key }" />
        </span>
        <span class="bottom-nav__label">{{ item.label }}</span>
      </a>
    }
  </nav>

</div>

<ng-template #navIcon let-key="key">
  @switch (key) {
    @case ('dashboard') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
    }
    @case ('profil') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
    }
    @case ('videos') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
    }
    @case ('paiements') {
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
    }
  }
</ng-template>

@if (modalMdpOuvert) {
  <app-modal titre="Changer de mot de passe" (fermer)="fermerModalMdp()">
    @if (erreurMdp) {
      <div class="toast toast--error">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        {{ erreurMdp }}
      </div>
    }
    <form [formGroup]="formMdp" (ngSubmit)="changerMotDePasse()" class="mdp-form">
      <div class="mdp-field">
        <label for="mdp-actuel">Mot de passe actuel</label>
        <input id="mdp-actuel" type="password" formControlName="motDePasseActuel" autocomplete="current-password" />
        @if (formMdp.get('motDePasseActuel')?.invalid && formMdp.get('motDePasseActuel')?.touched) {
          <span class="mdp-erreur">Champ requis.</span>
        }
      </div>
      <div class="mdp-field">
        <label for="mdp-nouveau">Nouveau mot de passe <small>(min. 8 caractères)</small></label>
        <input id="mdp-nouveau" type="password" formControlName="nouveauMotDePasse" autocomplete="new-password" />
        @if (formMdp.get('nouveauMotDePasse')?.hasError('minlength') && formMdp.get('nouveauMotDePasse')?.touched) {
          <span class="mdp-erreur">8 caractères minimum.</span>
        }
      </div>
      <div class="mdp-field">
        <label for="mdp-confirm">Confirmer le nouveau mot de passe</label>
        <input id="mdp-confirm" type="password" formControlName="confirmation" autocomplete="new-password" />
        @if (formMdp.hasError('mismatch') && formMdp.get('confirmation')?.touched) {
          <span class="mdp-erreur">Les mots de passe ne correspondent pas.</span>
        }
      </div>
      <div class="mdp-actions">
        <button type="button" class="btn btn--ghost" (click)="fermerModalMdp()">Annuler</button>
        <button type="submit" class="btn btn--primary" [disabled]="isChangingPassword || formMdp.invalid">
          @if (isChangingPassword) { <span class="spinner spinner--inline"></span> }
          <span>{{ isChangingPassword ? 'Modification…' : 'Changer le mot de passe' }}</span>
        </button>
      </div>
    </form>
  </app-modal>
}
`,
  styleUrls: ['./candidat-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CandidatShellComponent implements OnInit, OnDestroy {
  private authSvc = inject(AuthService);
  private router = inject(Router);
  private candidatureSvc = inject(CandidatureService);
  private fb = inject(FormBuilder);

  nav = CANDIDAT_NAV;

  private prenom = '';
  private nom = '';
  private sub = new Subscription();

  modalMdpOuvert = false;
  isChangingPassword = false;
  erreurMdp: string | null = null;
  formMdp: FormGroup = this.fb.group({
    motDePasseActuel: ['', Validators.required],
    nouveauMotDePasse: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required],
  }, { validators: this.mdpIdentiques });

  ngOnInit(): void {
    this.sub.add(
      this.candidatureSvc.maCandidature().pipe(catchError(() => of(null))).subscribe(c => {
        this.prenom = c?.prenom ?? '';
        this.nom = c?.nom ?? '';
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  nomComplet(): string {
    return this.prenom || this.nom ? `${this.prenom} ${this.nom}`.trim() : 'Candidat';
  }

  initiales(): string {
    if (!this.prenom && !this.nom) return '?';
    return `${this.prenom[0] ?? ''}${this.nom[0] ?? ''}`.toUpperCase();
  }

  deconnecter(): void {
    this.authSvc.logout();
    this.router.navigate(['/']);
  }

  private mdpIdentiques(control: AbstractControl): ValidationErrors | null {
    const n = control.get('nouveauMotDePasse')?.value;
    const c = control.get('confirmation')?.value;
    return n && c && n !== c ? { mismatch: true } : null;
  }

  ouvrirModalMdp(): void {
    this.formMdp.reset();
    this.erreurMdp = null;
    this.modalMdpOuvert = true;
  }

  fermerModalMdp(): void {
    this.modalMdpOuvert = false;
  }

  changerMotDePasse(): void {
    this.formMdp.markAllAsTouched();
    if (this.formMdp.invalid || this.isChangingPassword) return;
    this.erreurMdp = null;
    this.isChangingPassword = true;
    const { motDePasseActuel, nouveauMotDePasse } = this.formMdp.value;
    let echec = false;
    this.sub.add(
      this.authSvc.changerMotDePasse({ motDePasseActuel, nouveauMotDePasse }).pipe(
        catchError(err => { echec = true; this.erreurMdp = messageErreur(err, 'Échec du changement de mot de passe.'); return of(undefined); }),
        finalize(() => { this.isChangingPassword = false; }),
      ).subscribe(() => {
        if (echec) return;
        this.modalMdpOuvert = false;
      })
    );
  }
}
