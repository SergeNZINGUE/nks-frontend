import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, of, switchMap } from 'rxjs';

import { CandidatService } from '@core/services/candidat.service';
import { MediaService } from '@core/services/media.service';
import { EditionService } from '@core/services/edition.service';
import { CandidatPublicResponse } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

@Component({
  selector: 'app-mon-profil',
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './mon-profil.component.html',
  styleUrls: ['./mon-profil.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MonProfilComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private candidatSvc = inject(CandidatService);
  private mediaSvc = inject(MediaService);
  private editionSvc = inject(EditionService);

  isLoading = true;
  isSaving = false;
  isUploadingPhoto = false;
  profil: CandidatPublicResponse | null = null;
  photoPreview: string | null = null;
  successMsg: string | null = null;
  erreur: string | null = null;

  form!: FormGroup;
  private sub = new Subscription();

  ngOnInit(): void {
    // MettreAJourProfilRequest limite la biographie à 2000 caractères
    this.form = this.fb.group({
      biographie: ['', [Validators.maxLength(2000)]],
    });

    this.sub.add(
      this.editionSvc.lister().pipe(
        switchMap(editions => {
          const active = editions.find(e => e.statut === 'EN_COURS') ?? editions[0];
          if (!active) throw new Error('Aucune édition en cours');
          return this.candidatSvc.monProfil(active.id);
        }),
        catchError(() => of(null)),
      ).subscribe(p => {
        this.profil = p;
        this.isLoading = false;
        if (!p) { this.erreur = 'Impossible de charger ton profil.'; return; }
        if (p.biographie) this.form.patchValue({ biographie: p.biographie });
        if (p.photoUrl) this.photoPreview = p.photoUrl;
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
    this.mediaSvc.uploadPhoto(file).subscribe({
      next: res => {
        this.isUploadingPhoto = false;
        this.successMsg = '📸 Photo mise à jour.';
        setTimeout(() => (this.successMsg = null), 3000);
        // TODO: appeler POST /medias/photo avec res.publicId quand endpoint disponible
      },
      error: () => {
        this.isUploadingPhoto = false;
        this.erreur = 'Échec upload photo.';
      },
    });
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
        this.successMsg = '✅ Biographie enregistrée.';
        setTimeout(() => (this.successMsg = null), 3000);
      },
      error: err => {
        this.isSaving = false;
        this.erreur = messageErreur(err, 'Erreur lors de la sauvegarde.');
      },
    });
  }
}
