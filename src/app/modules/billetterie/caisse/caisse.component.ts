import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';
import { Html5Qrcode } from 'html5-qrcode';

import { BilletterieService } from '@core/services/billetterie.service';
import { DroitVoteResponse, SoireeEvent } from '@core/models';
import { messageErreur } from '@core/utils/http-error.util';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';

/** Format UUID v4 — CaisseValiderRequest.qrUuid est typé UUID côté backend */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id du conteneur DOM dans lequel html5-qrcode dessine le flux caméra + la cible de visée. */
const SCANNER_ELEMENT_ID = 'caisse-scanner';

/** Même format que celui encodé par tickets.component.ts (QRCode.toDataURL(`NKS:${qrUuid}`)). */
function extraireUuid(texteDecode: string): string | null {
  const brut = texteDecode.startsWith('NKS:') ? texteDecode.slice(4) : texteDecode;
  return UUID_PATTERN.test(brut) ? brut : null;
}

/**
 * Écran hôtesse : scanne le billet (si pas déjà fait) et active sa consommation en une seule
 * action, ce qui crée le droit de vote sur place correspondant (1 billet = au plus 1 droit,
 * jamais deux — cf. VoteSurPlaceService côté backend pour la cinématique complète). Plusieurs
 * hôtesses peuvent utiliser cet écran en parallèle depuis leur propre téléphone, à chaque
 * service, sans passer par un point de caisse unique. Mirroir volontaire de scan.component.ts
 * (même structure, même conventions).
 *
 * Pas de choix de soirée par l'hôtesse (cf. retour terrain du 13/09/2026) : seule la soirée
 * `EN_COURS` (au plus une à la fois, contrôlée par l'admin/organisateur) peut recevoir des
 * consommations — tant qu'aucune soirée n'est en cours, le scan reste bloqué.
 */
@Component({
  selector: 'app-caisse',
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './caisse.component.html',
  styleUrls: ['./caisse.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CaisseComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private billetterieSvc = inject(BilletterieService);

  form: FormGroup;
  isValidating = false;
  resultat: DroitVoteResponse | null = null;
  erreur: string | null = null;
  chargementSoirees = true;
  /** Au plus une soirée EN_COURS à la fois — null tant qu'aucune n'est active. */
  soireeActive: SoireeEvent | null = null;

  /** Scan caméra par défaut (gain de temps pour l'hôtesse) — bascule possible vers saisie manuelle en secours. */
  modeManuel = false;
  erreurCamera: string | null = null;
  /**
   * La caméra ne démarre JAMAIS automatiquement au chargement — les navigateurs n'affichent
   * l'invite d'autorisation caméra qu'en réponse à un geste utilisateur explicite (retour
   * terrain du 13/09/2026 : sans ce tap, l'invite n'apparaît pas sur téléphone et le scan
   * reste bloqué). Un seul tap ("Activer la caméra") suffit pour toute la session — une fois
   * la permission accordée par le navigateur, les redémarrages entre deux scans n'ont plus
   * besoin d'un nouveau geste.
   */
  cameraActivee = false;
  private scannerEnCours = false;
  private traitementEnCours = false;
  private html5Qrcode: Html5Qrcode | null = null;

  private sub = new Subscription();

  constructor() {
    this.form = this.fb.group({
      soireeId: ['', Validators.required],
      qrUuid: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.billetterieSvc.soirees().pipe(catchError(() => of([] as SoireeEvent[])))
        .subscribe(list => {
          this.chargementSoirees = false;
          this.soireeActive = list.find(s => s.statut === 'EN_COURS') ?? null;
          if (this.soireeActive) this.form.get('soireeId')!.setValue(this.soireeActive.id);
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.arreterScanner();
  }

  /** Premier tap de l'hôtesse — déclenche la vraie demande de permission caméra du navigateur. */
  activerCamera(): void {
    this.cameraActivee = true;
    this.demarrerScanner();
  }

  /** Bascule scan caméra ↔ saisie manuelle — la caméra n'est pas toujours fiable/disponible (permissions, matériel). */
  basculerModeManuel(manuel: boolean): void {
    this.modeManuel = manuel;
    this.erreurCamera = null;
    if (manuel) this.arreterScanner();
    else if (this.cameraActivee) this.demarrerScanner();
  }

  private async demarrerScanner(): Promise<void> {
    if (this.scannerEnCours || this.modeManuel || this.resultat || !this.soireeActive) return;
    this.erreurCamera = null;

    // getUserMedia (donc la caméra) n'est exposé par le navigateur que sur un "contexte
    // sécurisé" (HTTPS, ou localhost/127.0.0.1) — jamais sur un simple http://<IP locale>,
    // même si l'autorisation caméra de l'app/du navigateur est accordée dans les réglages
    // système : ce sont deux vérifications indépendantes, la seconde ne compense pas la
    // première. Sans cette détection explicite, l'échec est silencieux/confus pour l'hôtesse.
    if (!window.isSecureContext) {
      this.erreurCamera = "Le scan caméra nécessite une connexion sécurisée (https). "
        + "Ouvre cette page via le lien fourni par l'administrateur plutôt que par une adresse IP directe, ou utilise la saisie manuelle.";
      return;
    }

    this.scannerEnCours = true;
    try {
      this.html5Qrcode = new Html5Qrcode(SCANNER_ELEMENT_ID);
      const demarrage = this.html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        texteDecode => this.onScanReussi(texteDecode),
        () => { /* aucun QR dans le champ à cette frame — attendu en continu, rien à faire */ },
      );
      // Filet de sécurité : si le navigateur reste bloqué sur la demande de permission caméra
      // (matériel absent, permission jamais accordée/refusée...), on ne laisse jamais l'hôtesse
      // coincée sans recours — bascule automatique vers la saisie manuelle après 8s.
      const delaiDepasse = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Délai caméra dépassé')), 8000));
      await Promise.race([demarrage, delaiDepasse]);
    } catch {
      this.scannerEnCours = false;
      this.erreurCamera = "Caméra indisponible — vérifie l'autorisation d'accès, ou utilise la saisie manuelle.";
      this.arreterScanner();
    }
  }

  private async arreterScanner(): Promise<void> {
    this.scannerEnCours = false;
    const instance = this.html5Qrcode;
    this.html5Qrcode = null;
    if (!instance) return;
    try { await instance.stop(); instance.clear(); } catch { /* déjà arrêté */ }
  }

  private onScanReussi(texteDecode: string): void {
    if (this.traitementEnCours) return;
    const uuid = extraireUuid(texteDecode);
    if (!uuid) return;
    this.traitementEnCours = true;
    this.arreterScanner();
    this.form.get('qrUuid')!.setValue(uuid);
    this.valider();
  }

  valider(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.traitementEnCours = false; return; }

    this.isValidating = true;
    this.resultat = null;
    this.erreur = null;

    const { qrUuid, soireeId } = this.form.value;

    this.billetterieSvc.validerConsommation(qrUuid.trim(), soireeId).subscribe({
      next: res => {
        this.isValidating = false;
        this.traitementEnCours = false;
        this.resultat = res;
        this.form.get('qrUuid')!.reset('');
      },
      error: err => {
        this.isValidating = false;
        this.traitementEnCours = false;
        this.erreur = messageErreur(err,
          "Impossible d'activer le vote — billet invalide, annulé, ou droit déjà activé pour cette soirée.");
        if (!this.modeManuel && this.cameraActivee) setTimeout(() => this.demarrerScanner(), 0);
      },
    });
  }

  nouvelleValidation(): void {
    this.resultat = null;
    this.erreur = null;
    this.form.get('qrUuid')!.reset('');
    if (!this.modeManuel && this.cameraActivee) setTimeout(() => this.demarrerScanner(), 0);
  }
}
