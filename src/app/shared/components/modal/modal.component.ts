import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, input, output } from '@angular/core';

/**
 * Modale générique réutilisable — overlay plein écran, fermeture au clic
 * extérieur ou à l'Échap, focus renvoyé sur le panneau à l'ouverture et
 * piégé dedans tant qu'elle est visible (Tab ne fait jamais sortir le focus
 * derrière l'overlay). Contenu et actions entièrement projetés (`<ng-content>`) :
 * ce composant ne connaît rien du métier (vote, aperçu candidat, partage...),
 * seulement l'enveloppe visuelle et le comportement d'accessibilité — même
 * esprit que ConfirmDialogComponent mais générique, pour être réutilisé par
 * d'autres flux courts côté public sans dupliquer l'overlay/focus trap.
 * Affichage piloté par le parent via un `@if` sur son propre état (pas de
 * `visible` input ici : afficher/masquer CE composant EST le signal d'ouverture).
 */
@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ModalComponent implements OnInit, OnDestroy {
  /** Titre affiché en en-tête. Laisser vide et fournir `ariaLabel` si le contenu projeté porte déjà un titre visuel. */
  titre = input('');
  /** aria-label de substitution quand `titre` est vide (ex: contenu projeté avec son propre <h2>). */
  ariaLabel = input<string | null>(null);

  closed = output<void>();

  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;

  private previouslyFocused: HTMLElement | null = null;

  ngOnInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    // queueMicrotask : laisse le panneau se poser dans le DOM avant de lui donner le focus.
    queueMicrotask(() => this.panelRef?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  /** Échap ferme la modale ; Tab/Shift+Tab bouclent le focus sur les éléments focusables du panneau. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
      return;
    }
    if (event.key === 'Tab') {
      this.trapTab(event);
    }
  }

  private trapTab(event: KeyboardEvent): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  onBackdropClick(): void {
    this.closed.emit();
  }
}
