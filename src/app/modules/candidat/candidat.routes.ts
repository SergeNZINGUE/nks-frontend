import { Routes } from '@angular/router';

export const candidatRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/candidat-dashboard.component').then(c => c.CandidatDashboardComponent),
  },
  {
    path: 'profil',
    loadComponent: () => import('./mon-profil/mon-profil.component').then(c => c.MonProfilComponent),
  },
  {
    path: 'videos',
    loadComponent: () => import('./mes-videos/mes-videos.component').then(c => c.MesVideosComponent),
  },
  {
    path: 'paiements',
    loadComponent: () =>
      import('./mes-paiements/mes-paiements.component').then(c => c.MesPaiementsComponent),
  },
];
