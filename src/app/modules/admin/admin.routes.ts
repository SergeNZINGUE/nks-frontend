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
      // ── Modules prévus au cahier des charges, pas encore conçus côté écran admin ──
      {
        path: 'resultats',
        loadComponent: comingSoon,
        data: {
          titre: 'Résultats & classement',
          icon: '📈',
          description: "Publication officielle des résultats et pilotage du classement par phase n'est pas encore conçu côté admin.",
        },
      },
      {
        path: 'jury',
        loadComponent: comingSoon,
        data: {
          titre: 'Gestion du jury',
          icon: '🎤',
          description: "Affectation des jurés, critères de notation et suivi des notations depuis l'admin n'est pas encore conçu.",
        },
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
        loadComponent: comingSoon,
        data: {
          titre: 'Soirées & catégories de billets',
          icon: '🎉',
          description: "Création et édition des soirées et catégories de tickets n'est pas encore conçue. Seule la réservation côté public existe aujourd'hui.",
        },
      },
      {
        path: 'billets',
        loadComponent: comingSoon,
        data: {
          titre: 'Réservations & scans',
          icon: '🎟️',
          description: "Tableau de bord billetterie (remplissage, réservations, historique de scans) n'est pas encore conçu.",
        },
      },
      {
        path: 'partenaires',
        loadComponent: () =>
          import('./partenaires/partenaires.component').then(c => c.PartenairesComponent),
      },
      {
        path: 'paiements',
        loadComponent: comingSoon,
        data: {
          titre: 'Paiements',
          icon: '💳',
          description: "Historique des transactions Mobile Money et remboursements manuels n'est pas encore conçu.",
        },
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
        loadComponent: comingSoon,
        data: {
          titre: 'Audit & sécurité',
          icon: '🛡️',
          description: "Consultation des logs d'audit et des actions de correction admin n'est pas encore conçue.",
        },
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
