import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Modale de confirmation générique — remplace les `confirm()`/`alert()` natifs
 * (bloquants, non stylés, invisibles aux tests) sur les actions sensibles admin
 * (désactivation jury, publication officielle des résultats, etc.).
 * Le parent pilote l'ouverture via un `@if` sur son propre état (pas de `visible`
 * input ici : afficher/masquer CE composant EST le signal d'ouverture).
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
<div class="confirm-bg" (click)="cancelled.emit()">
  <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-titre" (click)="$event.stopPropagation()">
    <h2 id="confirm-dialog-titre">{{ titre() }}</h2>
    <p class="confirm__message">{{ message() }}</p>
    @if (erreur()) {
      <p class="confirm__erreur" role="alert">⚠️ {{ erreur() }}</p>
    }
    <div class="confirm__actions">
      <button type="button" class="btn btn--ghost" [disabled]="enCours()" (click)="cancelled.emit()">
        {{ libelleAnnuler() }}
      </button>
      <button
        type="button"
        class="btn"
        [class.btn--err]="danger()"
        [class.btn--ok]="!danger()"
        [disabled]="enCours()"
        (click)="confirmed.emit()">
        {{ enCours() ? '…' : libelleConfirmer() }}
      </button>
    </div>
  </div>
</div>
`,
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfirmDialogComponent {
  titre = input('Confirmer');
  message = input('');
  libelleConfirmer = input('Confirmer');
  libelleAnnuler = input('Annuler');
  /** Style le bouton de confirmation en rouge (action destructive) plutôt qu'en vert */
  danger = input(false);
  enCours = input(false);
  /** Message d'échec affiché dans la modale (reste ouverte tant que le parent ne la ferme pas) */
  erreur = input<string | null>(null);

  confirmed = output<void>();
  cancelled = output<void>();
}
