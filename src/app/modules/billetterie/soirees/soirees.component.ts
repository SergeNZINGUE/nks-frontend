import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, of } from 'rxjs';

import { BilletterieService } from '@core/services/billetterie.service';
import { SoireeEvent } from '@core/models';
import { TopbarComponent } from '@shared/components/topbar/topbar.component';
import { SiteHeaderComponent } from '@shared/components/site-header/site-header.component';
import { SiteFooterComponent } from '@shared/components/site-footer/site-footer.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-soirees',
  imports: [DatePipe, RouterModule, TopbarComponent, SiteHeaderComponent, SiteFooterComponent, BottomNavComponent],
  templateUrl: './soirees.component.html',
  styleUrls: ['./soirees.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SoireesComponent implements OnInit, OnDestroy {
  private billetterieSvc = inject(BilletterieService);

  isLoading = true;
  soirees: SoireeEvent[] = [];
  erreur: string | null = null;

  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.billetterieSvc.soirees().pipe(
        catchError(() => of(null))
      ).subscribe(data => {
        this.isLoading = false;
        if (data === null) {
          this.erreur = 'Impossible de charger les soirées. Vérifie ta connexion.';
        } else {
          this.soirees = this.trierSoirees(data);
        }
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  /**
   * Soirées à venir (PLANIFIEE/EN_COURS) d'abord, triées par proximité — même
   * logique que la home — puis les soirées TERMINEE/ANNULEE ensuite, sans les
   * masquer : chaque statut garde son action propre (cf. template).
   */
  private trierSoirees(soirees: SoireeEvent[]): SoireeEvent[] {
    const aVenir = (s: SoireeEvent) => s.statut === 'PLANIFIEE' || s.statut === 'EN_COURS';
    return [...soirees].sort((a, b) => {
      const aAVenir = aVenir(a);
      const bAVenir = aVenir(b);
      if (aAVenir !== bAVenir) return aAVenir ? -1 : 1;
      return new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime();
    });
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      PLANIFIEE: 'Planifiée',
      EN_COURS:  'En cours',
      TERMINEE:  'Terminée',
      ANNULEE:   'Annulée',
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    return { PLANIFIEE: 'info', EN_COURS: 'success', TERMINEE: 'default', ANNULEE: 'danger' }[s] ?? 'default';
  }
}
