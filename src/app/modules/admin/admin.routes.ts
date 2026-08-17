import { Routes } from '@angular/router';

const comingSoon = () =>
  import('./shared/coming-soon.component').then(c => c.ComingSoonComponent);

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/admin-shell.component').then(c => c.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/admin-dashboard.component').then(c => c.AdminDashboardComponent),
      },
      {
        path: 'candidatures',
        loadComponent: () =>
          import('./candidatures/candidatures.component').then(c => c.CandidaturesComponent),
      },
      {
        path: 'phases',
        loadComponent: () => import('./phases/phases.component').then(c => c.PhasesComponent),
      },
      {
        path: 'edition',
        loadComponent: () => import('./edition/edition.component').then(c => c.EditionComponent),
      },
      {
        path: 'communication',
        loadComponent: () =>
          import('./communication/communication.component').then(c => c.CommunicationComponent),
      },
      {
        path: 'poules',
        loadComponent: () => import('./poules/poules.component').then(c => c.PoulesComponent),
      },
      // ── Écrans câblés sur les vrais endpoints backend (15/08/2026). Plusieurs de ces
      // endpoints renvoient 500 en pratique aujourd'hui (LazyInitializationException,
      // correction en attente côté backend) : l'écran affiche l'erreur explicitement plutôt que de
      // masquer le module, pour ne pas revenir à un lien mort. ──
      {
        path: 'resultats',
        loadComponent: () => import('./resultats/resultats.component').then(c => c.ResultatsComponent),
      },
      {
        path: 'jury',
        loadComponent: () => import('./jury/jury.component').then(c => c.JuryComponent),
      },
      {
        path: 'votes',
        loadComponent: comingSoon,
        data: {
          titre: 'Votes',
          icon: '🗳️',
          description: "Suivi et modération des votes en ligne / payants n'est pas encore conçu côté admin.",
        },
      },
      {
        path: 'soirees',
        loadComponent: () => import('./billetterie/soirees.component').then(c => c.SoireesComponent),
      },
      {
        path: 'billets',
        loadComponent: () => import('./billetterie/billets.component').then(c => c.BilletsComponent),
      },
      {
        path: 'partenaires',
        loadComponent: () =>
          import('./partenaires/partenaires.component').then(c => c.PartenairesComponent),
      },
      {
        path: 'paiements',
        loadComponent: () => import('./payments/payments.component').then(c => c.PaymentsComponent),
      },
      {
        path: 'utilisateurs',
        loadComponent: comingSoon,
        data: {
          titre: 'Utilisateurs & rôles',
          icon: '👤',
          description: "Gestion des comptes (admin, jury, agent d'accueil) et de leurs rôles n'est pas encore conçue.",
        },
      },
      {
        path: 'audit',
        loadComponent: () => import('./audit/audit.component').then(c => c.AuditComponent),
      },
      {
        path: 'parametres',
        loadComponent: comingSoon,
        data: {
          titre: 'Paramètres plateforme',
          icon: '⚙️',
          description: "Paramètres globaux (tarifs, textes légaux, consentement RGPD) n'est pas encore conçu.",
        },
      },
    ],
  },
];
