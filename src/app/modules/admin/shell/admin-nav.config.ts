/**
 * Configuration de la navigation du back-office admin.
 * `statut: 'soon'` = endpoint(s) backend non exposés côté frontend pour le moment
 * → l'écran affiche un message « Bientôt disponible » plutôt qu'un lien mort.
 * Source du périmètre : CLAUDE.md (§ Fonctionnement attendu, cahier des charges NKS).
 */
export interface AdminNavItem {
  label: string;
  route: string;
  icon: string;
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
      { label: 'Tableau de bord', route: '/admin', icon: '📊', statut: 'ready' },
    ],
  },
  {
    titre: 'Compétition',
    items: [
      { label: 'Éditions',           route: '/admin/edition',   icon: '🗓️', statut: 'ready' },
      { label: 'Phases',             route: '/admin/phases',    icon: '🏆', statut: 'ready' },
      { label: 'Poules & Duos',      route: '/admin/poules',    icon: '🎭', statut: 'ready' },
      { label: 'Résultats & classement', route: '/admin/resultats', icon: '📈', statut: 'ready' },
    ],
  },
  {
    titre: 'Candidats',
    items: [
      { label: 'Candidatures',  route: '/admin/candidatures', icon: '📋', statut: 'ready' },
      { label: 'Jury',          route: '/admin/jury',         icon: '🎤', statut: 'ready' },
      { label: 'Votes',         route: '/admin/votes',        icon: '🗳️', statut: 'soon'  },
    ],
  },
  {
    titre: 'Billetterie',
    items: [
      { label: 'Soirées & catégories', route: '/admin/soirees', icon: '🎉', statut: 'ready' },
      { label: 'Réservations & scans', route: '/admin/billets',  icon: '🎟️', statut: 'ready' },
    ],
  },
  {
    titre: 'Partenaires & communication',
    items: [
      { label: 'Partenaires',   route: '/admin/partenaires',   icon: '🤝', statut: 'ready' },
      { label: 'Communication', route: '/admin/communication', icon: '📢', statut: 'ready' },
    ],
  },
  {
    titre: 'Plateforme',
    items: [
      { label: 'Paiements',           route: '/admin/paiements',     icon: '💳', statut: 'ready' },
      { label: 'Utilisateurs & rôles', route: '/admin/utilisateurs', icon: '👤', statut: 'soon' },
      { label: 'Audit & sécurité',    route: '/admin/audit',         icon: '🛡️', statut: 'ready' },
      { label: 'Paramètres',          route: '/admin/parametres',    icon: '⚙️', statut: 'soon' },
    ],
  },
];
