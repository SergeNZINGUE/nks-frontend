import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { catchError, of } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import { DashboardResponse, DashboardOrganisateurResponse } from '@core/models';

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
      <div class="kpi kpi--warning">
        <div class="kpi__label">En attente de paiement</div>
        <div class="kpi__val">{{ data.candidatsEnAttentePaiement }}</div>
      </div>
      
      <div class="kpi kpi--error">
        <div class="kpi__label">Rejetés</div>
        <div class="kpi__val">{{ data.candidatsRejetes }}</div>
      </div>
    </section>

    @if (!estOrganisateur) {
      <h2 class="section-title">Revenus</h2>
      <section class="kpi-grid">
        <div class="kpi kpi--info">
          <div class="kpi__label">Inscriptions</div>
          <div class="kpi__val">{{ asAdmin(data).revenusInscriptions | number }} <span>FCFA</span></div>
        </div>
        <div class="kpi kpi--info">
          <div class="kpi__label">Votes</div>
          <div class="kki__val">{{ asAdmin(data).revenusVotes | number }} <span>FCFA</span></div>
        </div>
        <div class="kpi kpi--info">
          <div class="kpi__label">Billets</div>
          <div class="kpi__val">{{ asAdmin(data).revenusBillets | number }} <span>FCFA</span></div>
        </div>
      </section>
    }
    <section class="kpi-grid">
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
  private auth     = inject(AuthService);

  isLoading = true;
  data: DashboardResponse | DashboardOrganisateurResponse | null = null;
  aucuneEdition = false;
  estOrganisateur = this.auth.isOrganisateur();
  private sub = new Subscription();

  ngOnInit(): void {
    const req$ = this.estOrganisateur
      ? this.adminSvc.dashboardOrganisateur()
      : this.adminSvc.dashboard();

    this.sub.add(
      req$.pipe(
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

  asAdmin(d: DashboardResponse | DashboardOrganisateurResponse | null): DashboardResponse {
    return d as DashboardResponse;
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
