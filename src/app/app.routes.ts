import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';

export const routes: Routes = [
  // Pages publiques
  {
    path: '',
    loadChildren: () => import('./modules/public/public.routes').then(m => m.publicRoutes),
  },
  // Login
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/public/auth/login.component').then(c => c.LoginComponent),
  },
  // Espace Candidat
  {
    path: 'mon-espace',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CANDIDAT'] },
    loadChildren: () =>
      import('./modules/candidat/candidat.routes').then(m => m.candidatRoutes),
  },
  // Espace Jury
  {
    path: 'jury',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['JURY'] },
    loadChildren: () =>
      import('./modules/jury/jury.routes').then(m => m.juryRoutes),
  },
  // Back-office Admin
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'SUPER_ADMIN'] },
    loadChildren: () =>
      import('./modules/admin/admin.routes').then(m => m.adminRoutes),
  },
  // Billetterie & Scan
  {
    path: 'billetterie',
    loadChildren: () =>
      import('./modules/billetterie/billetterie.routes').then(m => m.billetterieRoutes),
  },
  // Scan QR (agent accueil) — composant direct, pas le module billetterie
  {
    path: 'scan',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['AGENT_ACCUEIL', 'ADMIN', 'SUPER_ADMIN'] },
    loadComponent: () =>
      import('./modules/billetterie/scan/scan.component').then(c => c.ScanComponent),
  },
  // Accès non autorisé
  { path: 'unauthorized', loadComponent: () => import('./modules/public/home/home.component').then(c => c.HomeComponent) },
  // Fallback
  { path: '**', redirectTo: '' },
];
