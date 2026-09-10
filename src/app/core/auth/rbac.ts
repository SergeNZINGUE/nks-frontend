/**
 * Matrice RBAC frontend — miroir exact du contrôle d'accès réel côté backend.
 *
 * Le backend (SecurityConfig.java, commentaire « RBAC (§14.3) : 8 rôles ») fait du
 * RBAC pur via Spring Security `@PreAuthorize(hasRole/hasAnyRole(...))` sur chaque
 * contrôleur — aucun `@PostAuthorize`, aucun `PermissionEvaluator`, aucune évaluation
 * d'attribut dynamique (ownership, tenant, contexte) : donc PAS d'ABAC. Ce fichier ne
 * fait qu'un seul travail : refléter fidèlement cette même matrice de rôles côté
 * frontend, pour masquer/désactiver ce qui échouerait de toute façon en 403 — jamais
 * pour se substituer au contrôle serveur (cf. CLAUDE.md § Security Rules : « Never
 * trust client role/permissions — require server-side validation »).
 *
 * Toute divergence entre ce fichier et les `@PreAuthorize` réels est un bug : en cas
 * de doute, se référer au contrôleur backend, jamais l'inverse.
 */

/**
 * Les rôles Enums.RoleName (backend) — aucun rôle frontend qui n'existe pas côté serveur.
 * ORGANISATEUR ajouté le 10/09/2026 (commit 6675cd7 nks-backend, migration V12) : accès
 * partiel au back-office, périmètre exact détaillé dans admin-nav.config.ts.
 */
export type Role =
  | 'VISITEUR' | 'CANDIDAT' | 'VOTANT_PUBLIC' | 'JURY'
  | 'PARTENAIRE' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT_ACCUEIL' | 'ORGANISATEUR';

/**
 * Capacités du back-office — une capacité = un groupe d'endpoints protégés par le
 * même `@PreAuthorize` sur un même contrôleur. Nommage aligné sur le contrôleur
 * source pour pouvoir grep l'un à partir de l'autre.
 */
export type Capacite =
  | 'ADMIN_ACCES'              // hasAnyRole('ADMIN','SUPER_ADMIN') — accès général au back-office
  | 'ADMIN_UTILISATEURS_GERER' // hasRole('SUPER_ADMIN') — AdminController POST/GET /utilisateurs
  | 'AGENT_ACCUEIL_SCAN'       // hasAnyRole('AGENT_ACCUEIL','ADMIN','SUPER_ADMIN')
  | 'JURY_NOTER'               // hasRole('JURY')
  | 'CANDIDAT_ESPACE';         // hasRole('CANDIDAT')

/** Miroir exact des `@PreAuthorize` observés (grep sur src/main/java/.../controller/, 09/09/2026). */
const MATRICE: Record<Capacite, Role[]> = {
  ADMIN_ACCES:              ['ADMIN', 'SUPER_ADMIN'],
  ADMIN_UTILISATEURS_GERER: ['SUPER_ADMIN'],
  AGENT_ACCUEIL_SCAN:       ['AGENT_ACCUEIL', 'ADMIN', 'SUPER_ADMIN'],
  JURY_NOTER:               ['JURY'],
  CANDIDAT_ESPACE:          ['CANDIDAT'],
};

/** `roles` vient de AuthService.roles (JWT décodé au login, cf. LoginResponse.roles). */
export function peut(roles: string[], capacite: Capacite): boolean {
  return MATRICE[capacite].some(r => roles.includes(r));
}
