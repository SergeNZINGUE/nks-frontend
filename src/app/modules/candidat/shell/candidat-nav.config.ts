export interface CandidatNavItem {
  key: 'dashboard' | 'profil' | 'videos' | 'paiements';
  label: string;
  route: string;
}

export const CANDIDAT_NAV: CandidatNavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', route: '/mon-espace/dashboard' },
  { key: 'profil',    label: 'Mon profil',      route: '/mon-espace/profil' },
  { key: 'videos',    label: 'Ma Galerie',      route: '/mon-espace/videos' },
  { key: 'paiements', label: 'Paiements',       route: '/mon-espace/paiements' },
];
