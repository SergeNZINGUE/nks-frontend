import { Routes } from '@angular/router';

export const billetterieRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./soirees/soirees.component').then(c => c.SoireesComponent),
  },
  {
    path: 'reserver/:soireeId',
    loadComponent: () =>
      import('./reservation/reservation.component').then(c => c.ReservationComponent),
  },
  {
    path: 'mes-tickets',
    loadComponent: () => import('./tickets/tickets.component').then(c => c.TicketsComponent),
  },
];
