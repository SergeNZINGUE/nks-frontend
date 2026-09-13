export interface CandidatNavItem {
  key: 'dashboard' | 'profil' | 'videos' | 'paiements' | 'mon-titre';
  label: string;
  route: string;
}

export const CANDIDAT_NAV: CandidatNavItem[] = [
  { key: 'dashboard',  label: 'Tableau de bord', route: '/mon-espace/dashboard' },
  { key: 'profil',     label: 'Mon profil',      route: '/mon-espace/profil' },
  { key: 'videos',     label: 'Ma Galerie',      route: '/mon-espace/videos' },
  { key: 'mon-titre',  label: 'Mon titre',       route: '/mon-espace/mon-titre' },
  { key: 'paiements',  label: 'Paiements',       route: '/mon-espace/paiements' },
];
