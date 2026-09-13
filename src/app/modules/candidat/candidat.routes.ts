import { Routes } from '@angular/router';
import { consentGuard } from '@core/guards/consent.guard';

export const candidatRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shell/candidat-shell.component').then(c => c.CandidatShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      // Pas de consentGuard ici : c'est la page vers laquelle il redirige — sinon boucle infinie.
      {
        path: 'consentement',
        loadComponent: () =>
          import('./consentement/consentement.component').then(c => c.ConsentementComponent),
      },
      {
        path: 'dashboard',
        canActivate: [consentGuard],
        loadComponent: () =>
          import('./dashboard/candidat-dashboard.component').then(c => c.CandidatDashboardComponent),
      },
      {
        path: 'profil',
        canActivate: [consentGuard],
        loadComponent: () => import('./mon-profil/mon-profil.component').then(c => c.MonProfilComponent),
      },
      {
        path: 'videos',
        canActivate: [consentGuard],
        loadComponent: () => import('./mes-videos/mes-videos.component').then(c => c.MesVideosComponent),
      },
      {
        path: 'paiements',
        canActivate: [consentGuard],
        loadComponent: () =>
          import('./mes-paiements/mes-paiements.component').then(c => c.MesPaiementsComponent),
      },
      {
        path: 'mon-titre',
        canActivate: [consentGuard],
        loadComponent: () => import('./mon-titre/mon-titre.component').then(c => c.MonTitreComponent),
      },
    ],
  },
];
