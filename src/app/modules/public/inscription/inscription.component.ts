import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { EditionService } from '@core/services/edition.service';
import { MediaService, MediaUploadResult } from '@core/services/media.service';
import { CandidatureService } from '@core/services/candidature.service';
import { CandidatureSubmitRequest } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';

/** Règles médias — CdC §3.1.1 + arbitrage client (README backend §1) */
const PHOTO_MAX_OCTETS = 5 * 1024 * 1024;          // 5 Mo
const VIDEO_MAX_OCTETS = 100 * 1024 * 1024;        // 100 Mo (décision client, pas 500)
const VIDEO_DUREE_MIN_S = 45;
const VIDEO_DUREE_MAX_S = 60;

@Component({
  selector: 'app-inscription',
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent, SiteHeaderComponent],
  templateUrl: './inscription.component.html',
  styleUrls: ['./inscription.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class InscriptionComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private editionSvc = inject(EditionService);
  private mediaSvc = inject(MediaService);
  private candidatureSvc = inject(CandidatureService);

  // ── Navigation ──────────────────────────────────────────────────────────
  // 4 étapes : le paiement N'A PAS lieu à l'inscription.
  // CdC §3.1.2 : soumission → examen admin → notification → PUIS paiement.
  // Techniquement, POST /paiements/initier exige un JWT et le compte candidat
  // n'est créé qu'au moment de la validation par l'admin (CandidatureService:225).
  step = 1;
  readonly TOTAL_STEPS = 4;
  readonly ETAPES = ['Infos perso', 'Photo', 'Vidéo', 'Présentation'];
  /** Millésime affiché dans le hero — évite un '2026' figé dans le gabarit */
  readonly annee = new Date().getFullYear();

  // ── State ────────────────────────────────────────────────────────────────
  photoState: 'idle' | 'uploading' | 'done' | 'error' = 'idle';
  videoState: 'idle' | 'uploading' | 'done' | 'error' = 'idle';
  photoPreview: string | null = null;
  photoResult: MediaUploadResult | null = null;
  videoResult: MediaUploadResult | null = null;
  videoFileName: string | null = null;
  videoDureeSecondes = 0;
  photoFormat: 'JPG' | 'PNG' = 'JPG';

  // Capture d'abonnement Facebook / TikTok — CdC §3.1.1.
  // C'est une image à téléverser, pas un lien à saisir : le fichier part vers
  // le CDN (type CAPTURE_SOCIAL) et c'est l'URL retournée qui alimente
  // urlCaptureSocial dans la candidature.
  captureState: 'idle' | 'uploading' | 'done' | 'error' = 'idle';
  capturePreview: string | null = null;
  captureResult: MediaUploadResult | null = null;

  editionId: string | null = null;
  isSubmitting = false;
  soumissionReussie = false;
  codeCandidat: string | null = null;
  erreur: string | null = null;
  /** true tant que l'édition n'est pas encore chargée : évite d'afficher "fermé" en flash */
  chargementEdition = true;
  /** Filet de sécurité : le CTA d'accès est déjà masqué (site-header/home) hors fenêtre,
   *  mais un accès direct par URL ou un onglet resté ouvert doit aussi être bloqué ici. */
  inscriptionsOuvertes = false;
  private sub = new Subscription();

  // Exposés au template
  readonly VIDEO_DUREE_MIN_S = VIDEO_DUREE_MIN_S;
  readonly VIDEO_DUREE_MAX_S = VIDEO_DUREE_MAX_S;

  // ── Forms ────────────────────────────────────────────────────────────────
  step1!: FormGroup;
  step2!: FormGroup;
  step3!: FormGroup;
  step4!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.sub.add(
      // courante() (et non un filtre EN_COURS strict) : la fenêtre d'inscription
      // se déroule typiquement pendant qu'une édition est encore EN_PREPARATION
      // (l'édition ne passe EN_COURS qu'au démarrage de la compétition elle-même,
      // après la présélection). Un filtre EN_COURS ici bloquait access à /inscription
      // même quand les dates d'inscription étaient réellement dans leur fenêtre.
      this.editionSvc.courante().subscribe({
        next: active => {
          this.editionId = active?.id ?? null;
          this.inscriptionsOuvertes = this.editionSvc.inscriptionsOuvertes(active);
          this.chargementEdition = false;
        },
        error: () => { this.chargementEdition = false; },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Form Init ────────────────────────────────────────────────────────────
  private initForms(): void {
    const telPattern = /^(\+226|00226)?[0-9]{8}$/;

    this.step1 = this.fb.group({
      prenom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      dateNaissance: ['', [Validators.required, this.ageMinimumValidator(20)]],
      telephone: ['', [Validators.required, Validators.pattern(telPattern)]],
      email: ['', [Validators.required, Validators.email]],
    });

    this.step2 = this.fb.group({
      photoUploaded: [false, Validators.requiredTrue],
    });

    this.step3 = this.fb.group({
      videoUploaded: [false, Validators.requiredTrue],
    });

    this.step4 = this.fb.group({
      chansonPreselection: ['', [Validators.required, Validators.maxLength(150)]],
      motivation: ['', [Validators.required, this.maxMotsValidator(200)]],
      // Renseigné par l'upload de la capture, jamais saisi à la main.
      // @NotBlank côté backend (CandidatureSubmitRequest.urlCaptureSocial).
      captureUploaded: [false, Validators.requiredTrue],
    });
  }

  // ── Custom Validators ────────────────────────────────────────────────────
  /**
   * Date de naissance la plus tardive acceptable (aujourd'hui - 20 ans), au format
   * yyyy-MM-dd attendu par [max] sur un input[type=date]. Recalculée à chaque accès
   * (getter) plutôt que figée en dur : une constante littérale se décale silencieusement
   * chaque jour qui passe (bug trouvé en revue : '2006-08-06' était déjà faux de 6 jours).
   */
  get dateNaissanceMax(): string {
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 20);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${limite.getFullYear()}-${pad(limite.getMonth() + 1)}-${pad(limite.getDate())}`;
  }

  /**
   * input[type=date] n'ouvre le calendrier natif qu'au clic sur la petite icône (et
   * pas de façon fiable selon le navigateur) : on force l'ouverture sur clic n'importe
   * où dans le champ, showPicker() étant une progressive enhancement (no-op silencieux
   * si non supportée, le champ reste saisissable au clavier comme avant).
   */
  ouvrirSelecteurDate(event: Event): void {
    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch { /* ignoré : certains navigateurs refusent hors interaction directe */ }
    }
  }

  private ageMinimumValidator(ageMin: number): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      if (!ctrl.value) return null;
      const naissance = new Date(ctrl.value);
      if (isNaN(naissance.getTime())) return { dateInvalide: true };
      const limite = new Date();
      limite.setFullYear(limite.getFullYear() - ageMin);
      return naissance <= limite ? null : { ageMinimum: { requis: ageMin } };
    };
  }

  private maxMotsValidator(max: number): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const val = (ctrl.value ?? '').trim();
      const mots = val ? val.split(/\s+/).length : 0;
      return mots <= max ? null : { maxMots: { max, actuel: mots } };
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  get motivationMots(): number {
    const val = (this.step4.get('motivation')?.value ?? '').trim();
    return val ? val.split(/\s+/).length : 0;
  }

  formForStep(s: number): FormGroup {
    return [this.step1, this.step2, this.step3, this.step4][s - 1];
  }

  isStepValid(s: number): boolean {
    return this.formForStep(s).valid;
  }

  field(form: FormGroup, name: string) {
    return form.get(name);
  }

  hasError(form: FormGroup, name: string, err: string): boolean {
    const ctrl = form.get(name);
    return !!(ctrl?.touched && ctrl?.hasError(err));
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  suivant(): void {
    const form = this.formForStep(this.step);
    form.markAllAsTouched();
    if (form.invalid) return;
    if (this.step < this.TOTAL_STEPS) this.step++;
  }

  precedent(): void {
    if (this.step > 1) this.step--;
  }

  allerEtape(n: number): void {
    // Allow going back to completed steps
    if (n < this.step) this.step = n;
  }

  // ── Photo Upload ─────────────────────────────────────────────────────────
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.erreur = null;
    if (file.size > PHOTO_MAX_OCTETS) {
      this.erreur = 'Photo trop lourde — maximum 5 Mo.';
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.erreur = 'Format invalide — JPG ou PNG uniquement.';
      return;
    }

    // Le backend valide formatPhoto contre {JPG, JPEG, PNG} (MediaController:24)
    this.photoFormat = file.type === 'image/png' ? 'PNG' : 'JPG';

    // Aperçu local immédiat
    const reader = new FileReader();
    reader.onload = e => (this.photoPreview = e.target?.result as string);
    reader.readAsDataURL(file);

    this.photoState = 'uploading';
    this.mediaSvc.uploadPhoto(file).subscribe({
      next: res => {
        this.photoResult = res;
        this.photoState = 'done';
        this.step2.get('photoUploaded')!.setValue(true);
      },
      error: () => {
        this.photoState = 'error';
        this.erreur = 'Échec de l\'upload photo. Réessaie.';
      },
    });
  }

  // ── Capture d'abonnement social ──────────────────────────────────────────
  onCaptureChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.erreur = null;
    if (file.size > PHOTO_MAX_OCTETS) {
      this.erreur = 'Capture trop lourde — maximum 5 Mo.';
      input.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.erreur = 'Format invalide — JPG ou PNG uniquement.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = e => (this.capturePreview = e.target?.result as string);
    reader.readAsDataURL(file);

    this.captureState = 'uploading';
    // Type CAPTURE_SOCIAL : le backend distingue cette pièce de la photo de profil
    this.mediaSvc.uploadPhoto(file, 'CAPTURE_SOCIAL').subscribe({
      next: res => {
        this.captureResult = res;
        this.captureState = 'done';
        this.step4.get('captureUploaded')!.setValue(true);
      },
      error: () => {
        this.captureState = 'error';
        this.erreur = 'Échec de l\'envoi de la capture. Réessaie.';
      },
    });
  }

  // ── Video Upload ─────────────────────────────────────────────────────────
  onVideoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.erreur = null;
    this.videoResult = null;
    this.videoDureeSecondes = 0;
    this.step3.get('videoUploaded')!.setValue(false);

    // Taille : 100 Mo (décision client). Le backend rejette au-delà (MediaController:51).
    if (file.size > VIDEO_MAX_OCTETS) {
      this.erreur = `Vidéo trop lourde — maximum 100 Mo (fichier : ${this.formatSize(file.size)}).`;
      input.value = '';
      return;
    }
    // Format : le backend n'accepte que MP4 (MediaController:25).
    if (file.type !== 'video/mp4') {
      this.erreur = 'Format invalide — MP4 uniquement.';
      input.value = '';
      return;
    }

    this.videoFileName = file.name;
    this.videoState = 'uploading';

    // Mesure de la durée réelle : dureeVideoSecondes est @Positive côté backend,
    // envoyer 0 provoquait un HTTP 400 systématique.
    this.mesurerDureeVideo(file).then(
      duree => {
        this.videoDureeSecondes = Math.round(duree);
        // CdC §3.1.1 : 45 secondes à 1 minute
        if (this.videoDureeSecondes < VIDEO_DUREE_MIN_S || this.videoDureeSecondes > VIDEO_DUREE_MAX_S) {
          this.videoState = 'error';
          this.erreur =
            `Durée non conforme : ${this.videoDureeSecondes} s. ` +
            `La vidéo doit durer entre ${VIDEO_DUREE_MIN_S} et ${VIDEO_DUREE_MAX_S} secondes.`;
          input.value = '';
          return;
        }
        this.lancerUploadVideo(file);
      },
      () => {
        this.videoState = 'error';
        this.erreur = 'Impossible de lire la durée de cette vidéo. Vérifie que le fichier est un MP4 valide.';
        input.value = '';
      }
    );
  }

  /** Lit la durée via un élément <video> hors DOM. Rejette si les métadonnées sont illisibles. */
  private mesurerDureeVideo(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';

      const nettoyer = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
      };

      video.onloadedmetadata = () => {
        const duree = video.duration;
        nettoyer();
        if (!isFinite(duree) || duree <= 0) reject(new Error('Durée illisible'));
        else resolve(duree);
      };
      video.onerror = () => { nettoyer(); reject(new Error('Lecture impossible')); };

      video.src = url;
    });
  }

  private lancerUploadVideo(file: File): void {
    this.mediaSvc.uploadVideo(file).subscribe({
      next: res => {
        this.videoResult = res;
        this.videoState = 'done';
        this.step3.get('videoUploaded')!.setValue(true);
      },
      error: () => {
        this.videoState = 'error';
        this.erreur = 'Échec de l\'upload vidéo. Réessaie.';
      },
    });
  }

  // ── Submit Final ─────────────────────────────────────────────────────────
  /**
   * POST /candidatures uniquement. Le paiement des frais d'inscription intervient
   * APRÈS validation par l'administrateur (CdC §3.1.2), depuis l'espace candidat,
   * une fois le compte créé et le mot de passe temporaire reçu par SMS/e-mail.
   */
  soumettre(): void {
    [this.step1, this.step2, this.step3, this.step4].forEach(f => f.markAllAsTouched());

    if (!this.editionId) {
      this.erreur = 'Aucune édition ouverte aux inscriptions.';
      return;
    }
    if (!this.inscriptionsOuvertes) {
      this.erreur = 'La période d\'inscription est terminée.';
      return;
    }
    if (!this.photoResult || !this.videoResult || !this.captureResult) {
      this.erreur = 'Photo, vidéo et capture d\'abonnement requises.';
      return;
    }
    if (this.videoDureeSecondes <= 0) {
      this.erreur = 'Durée de la vidéo non déterminée. Recharge ta vidéo.';
      return;
    }
    if ([this.step1, this.step2, this.step3, this.step4].some(f => f.invalid)) {
      this.erreur = 'Certains champs sont incomplets ou invalides.';
      return;
    }

    const s1 = this.step1.value;
    const s4 = this.step4.value;

    const req: CandidatureSubmitRequest = {
      prenom: s1.prenom.trim(),
      nom: s1.nom.trim(),
      dateNaissance: s1.dateNaissance,
      telephone: s1.telephone,
      email: s1.email.trim().toLowerCase(),
      chansonPreselection: s4.chansonPreselection.trim(),
      motivation: s4.motivation.trim(),
      urlPhoto: this.photoResult.url,
      formatPhoto: this.photoFormat,
      taillePhotoOctets: this.photoResult.tailleOctets,
      urlVideo: this.videoResult.url,
      dureeVideoSecondes: this.videoDureeSecondes,
      tailleVideoOctets: this.videoResult.tailleOctets,
      urlCaptureSocial: this.captureResult.url,
      editionId: this.editionId,
    };

    this.isSubmitting = true;
    this.erreur = null;

    this.candidatureSvc.soumettre(req).subscribe({
      next: res => {
        this.isSubmitting = false;
        this.codeCandidat = res.codeCandidat;
        this.soumissionReussie = true;
      },
      error: err => {
        this.isSubmitting = false;
        this.erreur = messageErreur(err, 'Une erreur est survenue. Réessaie.');
      },
    });
  }

  formatSize(octets: number): string {
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
    return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
  }
}
