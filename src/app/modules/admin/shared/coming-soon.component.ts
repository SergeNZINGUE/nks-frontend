import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Stub générique pour tout module prévu au cahier des charges mais pas encore conçu
 * côté écran admin. Évite les liens morts dans la sidebar : chaque item `statut: 'soon'`
 * de `ADMIN_NAV` pointe vers cette même route générique, paramétrée par `route.data`.
 */
@Component({
  selector: 'app-coming-soon',
  template: `
<div class="coming-soon">
  <div class="coming-soon__icon" aria-hidden="true">{{ icon }}</div>
  <h1 class="coming-soon__title">{{ titre }}</h1>
  <p class="coming-soon__desc">{{ description }}</p>
  <span class="coming-soon__badge">🚧 Bientôt disponible</span>
</div>
`,
  styleUrls: ['./coming-soon.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ComingSoonComponent {
  private route = inject(ActivatedRoute);

  private data = this.route.snapshot.data as { titre?: string; icon?: string; description?: string };

  titre = this.data.titre ?? 'Module';
  icon = this.data.icon ?? '🚧';
  description = this.data.description ?? "Cet écran n'a pas encore été conçu.";
}
