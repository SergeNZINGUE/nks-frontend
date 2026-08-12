# NKS Frontend — Night Karaoke Stars

Frontend Angular de la plateforme de compétition karaoké NKS (La Terrasse, Ouagadougou).

## Stack

- Angular 22.1 
- TypeScript 6.0, RxJS 7.8
- SCSS custom (`src/styles/_tokens.scss`) 
- Build : `@angular/build` (esbuild/Vite)
- Change detection zoneless (Angular 22 par défaut, `OnPush`/`Eager` sur chaque composant)

## Démarrage

```bash
npm install
npm start           # ng serve
npm run build:prod  # build production
```

## Architecture

```
src/app/
  core/
    guards/        authGuard, roleGuard
    interceptors/   auth, http-timeout, change-detection
    models/         interfaces TS (DTO backend)
    services/       un service par domaine métier
  modules/
    public/         accueil, galerie, profil candidat, vote, classement, inscription, login
    candidat/       espace candidat connecté (dashboard, profil, vidéos, paiements)
    jury/           dashboard + grille de notation
    admin/          back-office
    billetterie/    soirées, réservation, tickets, scan QR
  shared/components/ topbar, site-header, bottom-nav, site-footer, partners-strip
styles/
  _tokens.scss      charte graphique NKS (noir/or/blanc)
```

Alias TypeScript : `@core/*`, `@shared/*`, `@env/*`.

## Fonctionnalités live

**Public**
- Accueil, galerie candidats, profil candidat public
- Vote en ligne, classement
- Inscription candidature, connexion

**Espace candidat**
- Dashboard, profil, mes vidéos, paiements

**Jury**
- Dashboard, grille de notation

**Billetterie**
- Soirées, réservation, mes tickets, scan QR

**Admin (back-office)**
- Tableau de bord
- Éditions (créer/modifier/clôturer)
- Phases (créer/modifier/clôturer/votes)
- Candidatures (CRUD, validation/rejet, dossier complet)
- Communication (SMS/e-mail)
- Poules & duos
- Partenaires (CRUD)

## À développer

- Résultats & classement (publication officielle)
- Jury — écran admin (affectation, suivi)
- Votes — suivi/modération admin
- Soirées & catégories de billets — écran admin
- Réservations & scans — tableau de bord admin
- Paiements — historique, remboursement
- Utilisateurs & rôles
- Audit & sécurité
- Paramètres plateforme

Ces modules sont présents dans la navigation admin avec un statut "bientôt disponible".
