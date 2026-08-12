import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page login-page">
      <div class="login-glow" aria-hidden="true"></div>

      <div class="login-card">
        <div class="login-brands">
          <img src="assets/logos/nks.png" alt="Night Karaoke Stars" class="login-brands__logo login-brands__logo--nks" />
          <span class="login-brands__sep" aria-hidden="true"></span>
          <img src="assets/logos/la-terrasse.png" alt="La Terrasse" class="login-brands__logo login-brands__logo--terrasse" />
        </div>

        <h1 class="login-title">Connexion</h1>
        <span class="login-title__underline" aria-hidden="true"></span>

        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <div class="form-field">
            <label for="email" class="form-field__label">Adresse e-mail</label>
            <div class="form-field__control">
              <svg class="form-field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" stroke-linejoin="round"/>
                <path d="m4 6.5 8 6.2 8-6.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <input id="email" type="email" class="input-field" formControlName="email"
                placeholder="vous@exemple.com" autocomplete="email"
                [attr.aria-invalid]="form.get('email')?.invalid && form.get('email')?.touched">
            </div>
            @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
              <span class="form-field__error">Adresse e-mail invalide.</span>
            }
          </div>

          <div class="form-field">
            <label for="motDePasse" class="form-field__label">Mot de passe</label>
            <div class="form-field__control">
              <svg class="form-field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke-linejoin="round"/>
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <input [type]="showPassword ? 'text' : 'password'" id="motDePasse" class="input-field" formControlName="motDePasse"
                placeholder="••••••••" autocomplete="current-password">
              <button type="button" class="form-field__toggle" (click)="showPassword = !showPassword"
                [attr.aria-label]="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                @if (showPassword) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                    <path d="M3 3l18 18" stroke-linecap="round"/>
                    <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.6 6.6C4.5 8 3 10 2 12c1 3 5 7 10 7 1.3 0 2.5-.3 3.6-.7" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9.9 10a3 3 0 0 0 4.1 4.1" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                    <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7s-9-4-10-7Z" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke-linejoin="round"/>
                  </svg>
                }
              </button>
            </div>
          </div>

          @if (error) {
            <div class="login-error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke-linejoin="round"/>
                <path d="M12 8v5" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none"/>
              </svg>
              <span>{{ error }}</span>
            </div>
          }

          <button type="submit" class="btn btn--primary btn--full btn--lg login-submit" [disabled]="form.invalid || loading">
            @if (loading) {
              <span class="login-spinner" aria-hidden="true"></span>
              <span>Connexion…</span>
            } @else {
              <span>✦ Se connecter</span>
            }
          </button>
        </form>
      </div>
    </div>
    `,
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form: FormGroup;
  loading = false;
  error: string | null = null;
  showPassword = false;

  constructor() {
    this.form = this.fb.group({
      email:     ['', [Validators.required, Validators.email]],
      motDePasse: ['', Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    this.auth.login(this.form.value).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? this.redirectByRole();
        this.router.navigateByUrl(returnUrl);
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Identifiants incorrects.';
      },
    });
  }

  private redirectByRole(): string {
    if (this.auth.isAdmin())    return '/admin';
    if (this.auth.isCandidat()) return '/mon-espace';
    if (this.auth.isJury())     return '/jury';
    if (this.auth.isAgent())    return '/scan';
    return '/';
  }
}
