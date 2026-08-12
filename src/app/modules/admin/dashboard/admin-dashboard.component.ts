import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { catchError, of } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { DashboardResponse } from '@core/models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DecimalPipe, RouterModule],
  template: `
<div class="dash">

  <div class="page-header">
    <h1 class="page-header__title">Tableau de bord</h1>
    <p class="page-header__subtitle">Vue d'ensemble de l'édition en cours</p>
  </div>

  @if (isLoading) {
    <div class="skeletons" role="status" aria-label="Chargement du tableau de bord">
      @for (i of [1,2,3,4]; track i) {
        <div class="sk sk--stat" aria-hidden="true"></div>
      }
    </div>
  }

  @if (!isLoading && !data && aucuneEdition) {
    <div class="banner banner--info" role="status">
      Aucune édition en cours pour l'instant.
      <a routerLink="/admin/edition">Créer une édition</a> pour faire apparaître le tableau de bord.
    </div>
  }

  @if (!isLoading && !data && !aucuneEdition) {
    <div class="banner banner--err" role="alert">Impossible de charger le tableau de bord (backend hors ligne ?)</div>
  }

  @if (!isLoading && data) {
    <section class="kpi-grid">
      <div class="kpi kpi--gold">
        <div class="kpi__label">Candidats total</div>
        <div class="kpi__val">{{ data.candidatsTotal }}</div>
      </div>
      <div class="kpi kpi--success">
        <div class="kpi__label">Validés</div>
        <div class="kpi__val">{{ data.candidatsValides }}</div>
      </div>
      <div class="kpi kpi--warning">
        <div class="kpi__label">En attente</div>
        <div class="kpi__val">{{ data.candidatsEnAttente }}</div>
      </div>
      <div class="kpi kpi--error">
        <div class="kpi__label">Rejetés</div>
        <div class="kpi__val">{{ data.candidatsRejetes }}</div>
      </div>
    </section>

    <h2 class="section-title">Revenus</h2>
    <section class="kpi-grid">
      <div class="kpi kpi--info">
        <div class="kpi__label">Inscriptions</div>
        <div class="kpi__val">{{ data.revenusInscriptions | number }} <span>FCFA</span></div>
      </div>
      <div class="kpi kpi--info">
        <div class="kpi__label">Votes</div>
        <div class="kpi__val">{{ data.revenusVotes | number }} <span>FCFA</span></div>
      </div>
      <div class="kpi kpi--info">
        <div class="kpi__label">Billets</div>
        <div class="kpi__val">{{ data.revenusBillets | number }} <span>FCFA</span></div>
      </div>
      <div class="kpi kpi--gold">
        <div class="kpi__label">Remplissage moyen soirées</div>
        <div class="kpi__val">{{ data.tauxRemplissageMoyenSoirees | number:'1.0-0' }}%</div>
      </div>
    </section>
  }
</div>
`,
  styleUrls: ['./admin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);

  isLoading = true;
  data: DashboardResponse | null = null;
  /** GET /admin/dashboard renvoie 404 RESOURCENOTFOUND « Aucune édition en cours »
   *  tant qu'aucune édition n'a le statut EN_COURS — état normal juste après un
   *  reset, pas une panne. On distingue ce cas d'une vraie erreur réseau/serveur
   *  pour ne pas afficher « backend hors ligne ? » à tort. */
  aucuneEdition = false;
  private sub = new Subscription();

  ngOnInit(): void {
    this.sub.add(
      this.adminSvc.dashboard().pipe(
        catchError((err: HttpErrorResponse) => {
          this.aucuneEdition = err.status === 404;
          return of(null);
        })
      ).subscribe(d => {
        this.isLoading = false;
        this.data = d;
      })
    );
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
