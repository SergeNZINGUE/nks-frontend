/**
 * Configuration de la navigation du back-office admin.
 * `statut: 'soon'` = endpoint(s) backend non exposés côté frontend pour le moment
 * → l'écran affiche un message « Bientôt disponible » plutôt qu'un lien mort.
 * Source du périmètre : CLAUDE.md (§ Fonctionnement attendu, cahier des charges NKS).
 *
 * `icon` est une clé (pas un emoji) — résolue en SVG inline par le
 * `@switch` de admin-shell.component.ts, cf. adminIcon.
 */
import { Role } from '@core/auth/rbac';

export type AdminIconKey =
  | 'dashboard' | 'calendar' | 'trophy' | 'users' | 'trending-up'
  | 'clipboard' | 'mic' | 'vote' | 'music' | 'ticket'
  | 'briefcase' | 'megaphone' | 'credit-card' | 'user' | 'shield' | 'settings';

export interface AdminNavItem {
  label: string;
  route: string;
  icon: AdminIconKey;
  statut: 'ready' | 'soon';
  /**
   * Restreint l'entrée aux rôles listés (cf. core/auth/rbac.ts) — en plus du gate
   * ADMIN/SUPER_ADMIN déjà posé sur toute la branche /admin par roleGuard. Omis =
   * visible à tout titulaire d'un accès admin. Purement cosmétique : la vraie
   * barrière reste le `@PreAuthorize` backend, ceci évite juste d'afficher un lien
   * qui répondrait 403.
   */
  roles?: Role[];
}

export interface AdminNavGroup {
  titre: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    titre: 'Général',
    items: [
      { label: 'Tableau de bord', route: '/back-office', icon: 'dashboard', statut: 'ready' },
    ],
  },
  {
    titre: 'Compétition',
    items: [
      // ORGANISATEUR exclu : EditionController est 100% ADMIN/SUPER_ADMIN
      // (cf. commit 6675cd7 nks-backend, 10/09/2026 — endpoints ouverts listés en commentaire).
      { label: 'Éditions',           route: '/back-office/edition',   icon: 'calendar',     statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Phases',             route: '/back-office/phases',    icon: 'trophy',       statut: 'ready' },
      // ORGANISATEUR exclu : PouleDuoController est 100% ADMIN/SUPER_ADMIN.
      { label: 'Poules & Duos',      route: '/back-office/poules',    icon: 'users',        statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      // ORGANISATEUR exclu : ClassementController (calculer/publier) est 100% ADMIN/SUPER_ADMIN.
      { label: 'Résultats & classement', route: '/back-office/resultats', icon: 'trending-up', statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    titre: 'Candidats',
    items: [
      // ORGANISATEUR exclu : valider/rejeter une candidature reste ADMIN/SUPER_ADMIN.
      { label: 'Candidatures',  route: '/back-office/candidatures', icon: 'clipboard', statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      // ORGANISATEUR exclu : création d'un membre du jury (AdminController) reste ADMIN/SUPER_ADMIN.
      { label: 'Jury',          route: '/back-office/jury',         icon: 'mic',       statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Votes',         route: '/back-office/votes',        icon: 'vote',      statut: 'ready' },
    ],
  },
  {
    titre: 'Billetterie',
    items: [
      { label: 'Soirées & catégories', route: '/back-office/soirees', icon: 'music',  statut: 'ready' },
      // ORGANISATEUR exclu : GET reservations + POST tickets-gratuits restent ADMIN/SUPER_ADMIN
      // (seule la création de catégorie, sur la page Soirées, a été ouverte).
      { label: 'Réservations & scans', route: '/back-office/billets',  icon: 'ticket', statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    titre: 'Partenaires & communication',
    items: [
      { label: 'Partenaires',   route: '/back-office/partenaires',   icon: 'briefcase',  statut: 'ready' },
      { label: 'Communication', route: '/back-office/communication', icon: 'megaphone',  statut: 'ready' },
    ],
  },
  {
    titre: 'Plateforme',
    items: [
      // ORGANISATEUR exclu : PaiementController (liste/gestion admin) reste ADMIN/SUPER_ADMIN.
      { label: 'Paiements',           route: '/back-office/paiements',     icon: 'credit-card', statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Utilisateurs & rôles', route: '/back-office/utilisateurs', icon: 'user',        statut: 'ready', roles: ['SUPER_ADMIN'] },
      // ORGANISATEUR exclu : les logs d'audit (AdminController) restent ADMIN/SUPER_ADMIN.
      { label: 'Audit & sécurité',    route: '/back-office/audit',         icon: 'shield',      statut: 'ready', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Paramètres',          route: '/back-office/parametres',    icon: 'settings',    statut: 'soon' },
    ],
  },
];
