import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  forwardRef,
  input,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

/**
 * Éditeur de texte riche (façon "Word" minimal) réutilisable, branché sur
 * Reactive Forms via ControlValueAccessor — s'utilise exactement comme un
 * textarea : <app-rich-text-editor formControlName="description" />.
 *
 * Le HTML produit par Quill est stocké tel quel (writeValue/onChange). Le
 * consommateur de la valeur (affichage public) DOIT le lier via [innerHTML]
 * (sanitizer Angular par défaut) — jamais bypassSecurityTrustHtml().
 *
 * Choix lib : `quill` (core, sans wrapper Angular) plutôt que `ngx-quill`,
 * pour éviter tout conflit de peerDependencies avec Angular 22.
 */
@Component({
  selector: 'app-rich-text-editor',
  template: `
<div class="nks-rte" [class.nks-rte--disabled]="disabled">
  <div #editor></div>
</div>
`,
  styleUrl: './rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  /** Texte affiché quand l'éditeur est vide. */
  placeholder = input<string>('');
  /** Libellé accessible posé sur la zone d'édition (le `<label for>` classique
   *  ne peut pas cibler le contenteditable généré par Quill). */
  ariaLabel = input<string>('');

  private editorEl = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  private quill: Quill | null = null;
  private valeurEnAttente = '';
  disabled = false;

  private onChange: (valeur: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    this.quill = new Quill(this.editorEl().nativeElement, {
      theme: 'snow',
      placeholder: this.placeholder(),
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: ['center', 'right'] }],
          ['link'],
        ],
      },
    });

    if (this.valeurEnAttente) {
      this.quill.clipboard.dangerouslyPasteHTML(this.valeurEnAttente, 'silent');
    }
    this.quill.enable(!this.disabled);
    if (this.ariaLabel()) {
      this.quill.root.setAttribute('role', 'textbox');
      this.quill.root.setAttribute('aria-label', this.ariaLabel());
    }

    this.quill.on('text-change', (_delta, _oldDelta, source) => {
      if (source !== 'user') return;
      this.onChange(this.contenuVide() ? '' : this.quill!.root.innerHTML);
    });
    this.quill.on('selection-change', range => {
      if (!range) this.onTouched();
    });
  }

  ngOnDestroy(): void {
    this.quill = null;
  }

  private contenuVide(): boolean {
    return !this.quill || this.quill.getText().trim().length === 0;
  }

  writeValue(valeur: string | null): void {
    const html = valeur ?? '';
    this.valeurEnAttente = html;
    if (this.quill) {
      this.quill.clipboard.dangerouslyPasteHTML(html, 'silent');
    }
  }

  registerOnChange(fn: (valeur: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.quill?.enable(!isDisabled);
  }
}
