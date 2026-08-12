import { Routes } from '@angular/router';

export const juryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/jury-dashboard.component').then(c => c.JuryDashboardComponent),
  },
  {
    path: 'noter/:candidatId',
    loadComponent: () => import('./notation/notation.component').then(c => c.NotationComponent),
  },
];
