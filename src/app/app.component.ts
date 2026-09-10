import { ApplicationRef, ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleTimeoutService } from '@core/services/idle-timeout.service';

/**
 * Filet de sécurité post-migration Angular 22 — volet "événements DOM locaux".
 *
 * changeDetectionInterceptor (core/interceptors) force un tick() après chaque
 * réponse HTTP, mais de nombreuses mutations d'état n'impliquent aucun appel
 * réseau : sélection d'une carte, changement d'étape d'un stepper, ouverture
 * d'une modale, toggle de filtre, etc. Confirmé empiriquement (billetterie/
 * reserver, étape 1→2) : le FormControl / champ du composant est bien muté
 * (vérifiable via window.ng.getComponent) mais le DOM n'est jamais repeint,
 * car NgZone ne forke jamais de zone enfant dans cette configuration (voir
 * commentaire détaillé dans change-detection.interceptor.ts) — aucun cycle de
 * détection n'est donc déclenché après un simple clic/saisie sans requête HTTP.
 *
 * Même remède que pour HTTP : un tick() applicatif forcé après CHAQUE clic/
 * saisie/changement, différé à la microtask suivante pour laisser le handler
 * du composant (click)="..." muter son état avant le repaint.
 *
 * À retirer lors d'une bascule ultérieure vers les signaux / resource().
 */
@Component({
    selector: 'app-root',
    template: `<router-outlet />`,
    imports: [RouterOutlet],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class AppComponent {
  private appRef = inject(ApplicationRef);
  private idleSvc = inject(IdleTimeoutService);

  constructor() {
    // Couvre le cas d'une session déjà active au chargement (rechargement de
    // page) — sans interaction, les @HostListener ci-dessous ne s'exécutent
    // jamais et le minuteur ne démarrerait sinon qu'au premier clic.
    this.idleSvc.reinitialiser();
  }

  private forcerTick(): void {
    queueMicrotask(() => this.appRef.tick());
  }

  // Ces mêmes événements marquent aussi une activité utilisateur réelle
  // (cf. IdleTimeoutService) : pas de nouveaux listeners, on réutilise ceux-ci.
  @HostListener('document:click')
  onClick(): void { this.forcerTick(); this.idleSvc.reinitialiser(); }

  @HostListener('document:input')
  onInput(): void { this.forcerTick(); this.idleSvc.reinitialiser(); }

  @HostListener('document:change')
  onChange(): void { this.forcerTick(); this.idleSvc.reinitialiser(); }

  @HostListener('document:keyup')
  onKeyup(): void { this.forcerTick(); this.idleSvc.reinitialiser(); }
}
