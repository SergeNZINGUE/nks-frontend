import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Stub générique pour tout module prévu au cahier des charges mais pas encore conçu
 * côté écran admin. Évite les liens morts dans la sidebar : chaque item `statut: 'soon'`
 * de `ADMIN_NAV` pointe vers cette même route générique, paramétrée par `route.data`.
 *
 * `icon` est une clé `AdminIconKey` (pas un emoji) — résolue en SVG inline par le
 * `@switch` ci-dessous, même vocabulaire que `admin-shell.component.ts`.
 */
@Component({
  selector: 'app-coming-soon',
  template: `
<div class="coming-soon">
  <div class="coming-soon__icon" aria-hidden="true">
    @switch (icon) {
      @case ('vote') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
      }
      @case ('user') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
      }
      @case ('settings') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      }
      @default {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      }
    }
  </div>
  <h1 class="coming-soon__title">{{ titre }}</h1>
  <p class="coming-soon__desc">{{ description }}</p>
  <span class="coming-soon__badge">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    Bientôt disponible
  </span>
</div>
`,
  styleUrls: ['./coming-soon.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ComingSoonComponent {
  private route = inject(ActivatedRoute);

  private data = this.route.snapshot.data as { titre?: string; icon?: string; description?: string };

  titre = this.data.titre ?? 'Module';
  icon = this.data.icon ?? '';
  description = this.data.description ?? "Cet écran n'a pas encore été conçu.";
}
