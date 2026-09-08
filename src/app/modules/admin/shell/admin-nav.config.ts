/**
 * Configuration de la navigation du back-office admin.
 * `statut: 'soon'` = endpoint(s) backend non exposés côté frontend pour le moment
 * → l'écran affiche un message « Bientôt disponible » plutôt qu'un lien mort.
 * Source du périmètre : CLAUDE.md (§ Fonctionnement attendu, cahier des charges NKS).
 *
 * `icon` est une clé (pas un emoji) — résolue en SVG inline par le
 * `@switch` de admin-shell.component.ts, cf. adminIcon.
 */
export type AdminIconKey =
  | 'dashboard' | 'calendar' | 'trophy' | 'users' | 'trending-up'
  | 'clipboard' | 'mic' | 'vote' | 'music' | 'ticket'
  | 'briefcase' | 'megaphone' | 'credit-card' | 'user' | 'shield' | 'settings';

export interface AdminNavItem {
  label: string;
  route: string;
  icon: AdminIconKey;
  statut: 'ready' | 'soon';
}

export interface AdminNavGroup {
  titre: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    titre: 'Général',
    items: [
      { label: 'Tableau de bord', route: '/admin', icon: 'dashboard', statut: 'ready' },
    ],
  },
  {
    titre: 'Compétition',
    items: [
      { label: 'Éditions',           route: '/admin/edition',   icon: 'calendar',     statut: 'ready' },
      { label: 'Phases',             route: '/admin/phases',    icon: 'trophy',       statut: 'ready' },
      { label: 'Poules & Duos',      route: '/admin/poules',    icon: 'users',        statut: 'ready' },
      { label: 'Résultats & classement', route: '/admin/resultats', icon: 'trending-up', statut: 'ready' },
    ],
  },
  {
    titre: 'Candidats',
    items: [
      { label: 'Candidatures',  route: '/admin/candidatures', icon: 'clipboard', statut: 'ready' },
      { label: 'Jury',          route: '/admin/jury',         icon: 'mic',       statut: 'ready' },
      { label: 'Votes',         route: '/admin/votes',        icon: 'vote',      statut: 'soon'  },
    ],
  },
  {
    titre: 'Billetterie',
    items: [
      { label: 'Soirées & catégories', route: '/admin/soirees', icon: 'music',  statut: 'ready' },
      { label: 'Réservations & scans', route: '/admin/billets',  icon: 'ticket', statut: 'ready' },
    ],
  },
  {
    titre: 'Partenaires & communication',
    items: [
      { label: 'Partenaires',   route: '/admin/partenaires',   icon: 'briefcase',  statut: 'ready' },
      { label: 'Communication', route: '/admin/communication', icon: 'megaphone',  statut: 'ready' },
    ],
  },
  {
    titre: 'Plateforme',
    items: [
      { label: 'Paiements',           route: '/admin/paiements',     icon: 'credit-card', statut: 'ready' },
      { label: 'Utilisateurs & rôles', route: '/admin/utilisateurs', icon: 'user',        statut: 'ready' },
      { label: 'Audit & sécurité',    route: '/admin/audit',         icon: 'shield',      statut: 'ready' },
      { label: 'Paramètres',          route: '/admin/parametres',    icon: 'settings',    statut: 'soon' },
    ],
  },
];
