import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, finalize, of, switchMap } from 'rxjs';

import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { EditionService } from '@core/services/edition.service';
import { AuthService } from '@core/services/auth.service';
import { CandidatPublicResponse, MediaPublicResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';

@Component({
  selector: 'app-mon-profil',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './mon-profil.component.html',
  styleUrls: ['./mon-profil.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MonProfilComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private editionSvc = inject(EditionService);
  private authSvc = inject(AuthService);

  isLoading = true;
  isSaving = false;
  isUploadingPhoto = false;
  profil: CandidatPublicResponse | null = null;
  photoPreview: string | null = null;
  successMsg: string | null = null;
  erreur: string | null = null;

  isChangingPassword = false;
  successMdp: string | null = null;
  erreurMdp: string | null = null;

  form!: FormGroup;
  formMdp!: FormGroup;
  private sub = new Subscription();

  ngOnInit(): void {
    // MettreAJourProfilRequest limite la biographie à 2000 caractères
    this.form = this.fb.group({
      biographie: ['', [Validators.maxLength(2000)]],
    });

    this.formMdp = this.fb.group({
      motDePasseActuel: ['', Validators.required],
      nouveauMotDePasse: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    }, { validators: this.mdpIdentiques });

    this.sub.add(
      this.editionSvc.lister().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0];
          if (!active) throw new Error('Aucune édition en cours');
          return this.candidatSvc.monProfil(active.id);
        }),
        switchMap(p => {
          this.profil = p;
          if (p.biographie) this.form.patchValue({ biographie: p.biographie });
          return this.mediaSvc.mediasCandidat(p.id).pipe(
            catchError(() => of([] as MediaPublicResponse[])),
          );
        }),
        catchError(() => of(null)),
      ).subscribe(medias => {
        this.isLoading = false;
        if (medias === null) { this.erreur = 'Impossible de charger ton profil.'; return; }
        const photoUrl = this.mediaSvc.photoProfilUrl(medias);
        if (photoUrl) this.photoPreview = photoUrl;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get initiales(): string {
    if (this.profil) return `${this.profil.prenom?.[0] ?? ''}${this.profil.nom?.[0] ?? ''}`.toUpperCase();
    return '?';
  }

  /** MettreAJourProfilRequest.biographie : @Size(max = 2000) — caractères, pas mots */
  get biographieCaracteres(): number {
    return (this.form.get('biographie')?.value ?? '').length;
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.erreur = null;
    if (file.size > 5 * 1024 * 1024) { this.erreur = 'Photo trop lourde (max 5 Mo).'; return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { this.erreur = 'JPG ou PNG uniquement.'; return; }

    const reader = new FileReader();
    reader.onload = e => (this.photoPreview = e.target?.result as string);
    reader.readAsDataURL(file);

    this.isUploadingPhoto = true;
    this.sub.add(
      this.mediaSvc.uploadPhoto(file).pipe(
        switchMap(res => this.mediaSvc.enregistrerPhoto(res)),
        catchError(err => { this.erreur = messageErreur(err, 'Échec upload photo.'); return of(null); }),
        finalize(() => { this.isUploadingPhoto = false; }),
      ).subscribe(media => {
        if (!media) return;
        if (media.urlStockage?.startsWith('https://')) this.photoPreview = media.urlStockage;
        this.successMsg = 'Photo mise à jour.';
        setTimeout(() => (this.successMsg = null), 3000);
      })
    );
  }

  private mdpIdentiques(control: AbstractControl): ValidationErrors | null {
    const n = control.get('nouveauMotDePasse')?.value;
    const c = control.get('confirmation')?.value;
    return n && c && n !== c ? { mismatch: true } : null;
  }

  changerMotDePasse(): void {
    this.formMdp.markAllAsTouched();
    if (this.formMdp.invalid || this.isChangingPassword) return;
    this.erreurMdp = null;
    this.successMdp = null;
    this.isChangingPassword = true;
    const { motDePasseActuel, nouveauMotDePasse } = this.formMdp.value;
    let echec = false;
    this.sub.add(
      this.authSvc.changerMotDePasse({ motDePasseActuel, nouveauMotDePasse }).pipe(
        catchError(err => { echec = true; this.erreurMdp = messageErreur(err, 'Échec du changement de mot de passe.'); return of(undefined); }),
        finalize(() => { this.isChangingPassword = false; }),
      ).subscribe(() => {
        if (echec) return;
        this.formMdp.reset();
        this.successMdp = 'Mot de passe modifié.';
        setTimeout(() => (this.successMdp = null), 4000);
      })
    );
  }

  sauvegarder(): void {
    if (this.form.invalid) return;
    this.isSaving = true;
    this.erreur = null;
    this.successMsg = null;

    this.candidatSvc.mettreAJourMonProfil(this.form.value.biographie ?? '').subscribe({
      next: p => {
        this.isSaving = false;
        this.profil = p;
        this.successMsg = 'Biographie enregistrée.';
        setTimeout(() => (this.successMsg = null), 3000);
      },
      error: err => {
        this.isSaving = false;
        this.erreur = messageErreur(err, 'Erreur lors de la sauvegarde.');
      },
    });
  }
}
