import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter,
  HostListener, Input, OnInit, Output, ViewChild, inject,
} from '@angular/core';

/**
 * Modale accessible réutilisable — remplace les panneaux ad hoc dupliqués par
 * écran. `role="dialog"` + `aria-modal="true"` + piège de focus (Tab/Shift+Tab
 * cyclent parmi les éléments focusables de la modale, jamais vers la page
 * derrière) + fermeture Échap, conformément à frontend-design § Accessibilité.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
<div class="modal__backdrop" (click)="onBackdropClick()">
  <div
    #dialog
    class="modal"
    role="dialog"
    [attr.aria-modal]="true"
    [attr.aria-label]="titre"
    tabindex="-1"
    (click)="$event.stopPropagation()">
    <div class="modal__header">
      <h2 class="modal__titre">{{ titre }}</h2>
      <button type="button" class="modal__fermer" aria-label="Fermer" (click)="fermer.emit()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="modal__body">
      <ng-content />
    </div>
  </div>
</div>
`,
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent implements OnInit {
  @Input({ required: true }) titre!: string;
  @Input() fermableParBackdrop = true;
  @Output() fermer = new EventEmitter<void>();

  @ViewChild('dialog') private dialogRef!: ElementRef<HTMLElement>;
  private hote = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    // Focus initial sur la modale elle-même (tabindex=-1) plutôt que sur un
    // champ précis — évite de présumer de la structure du contenu projeté.
    queueMicrotask(() => this.dialogRef?.nativeElement.focus());
  }

  onBackdropClick(): void {
    if (this.fermableParBackdrop) this.fermer.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.fermer.emit();
  }

  @HostListener('document:keydown.tab', ['$event'])
  onTab(domEvent: Event): void {
    const event = domEvent as KeyboardEvent;
    const dialog = this.dialogRef?.nativeElement;
    if (!dialog) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!dialog.contains(active)) {
      // Focus échappé de la modale (ex. clic programmatique ailleurs) : le ramener.
      event.preventDefault();
      first.focus();
    }
  }
}
