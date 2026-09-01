# NKS Frontend — Night Karaoke Stars

Frontend Angular de la plateforme de compétition karaoké NKS (La Terrasse, Ouagadougou).

## Stack

- Angular 22.1
- TypeScript 6.0, RxJS 7.8
- SCSS custom (`src/styles/_tokens.scss`)
- Build : `@angular/build` (esbuild/Vite)
- Change detection zoneless (Angular 22 par défaut, `ChangeDetectionStrategy.Eager` sur chaque composant)

## Démarrage

```bash
npm install
npm start           # ng serve
npm run build:prod  # build production
```

Backend attendu sur `http://localhost:8082/api/v1` en dev (voir `src/environments/`).

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
    candidat/       espace candidat connecté (coquille + dashboard, profil, galerie vidéo, paiements)
    jury/           coquille + dashboard, grille de notation
    admin/          back-office (coquille + tous les écrans)
    billetterie/    soirées, réservation, tickets, scan QR
  shared/components/ topbar, site-header, bottom-nav, site-footer, partners-strip, modal, vote-modal
styles/
  _tokens.scss      charte graphique NKS (noir/or/blanc, Cinzel Decorative + Inter)
```

Alias TypeScript : `@core/*`, `@shared/*`, `@env/*`.

## Fonctionnalités live

**Public**
- Accueil, galerie candidats, profil candidat public
- Vote en ligne (page dédiée + modale depuis la galerie), classement public avec podium
- Inscription candidature, connexion
- Billetterie : soirées, réservation, mes tickets, scan QR (rôle agent d'accueil)
- Page de retour de paiement LigdiCash (`/paiement/retour`), partagée par les 3 flux payants

**Espace candidat** (`/mon-espace`)
- Dashboard, profil, galerie (vidéos — upload par phase avec contrôle durée 45-60s), paiements (frais d'inscription)

**Jury** (`/jury`)
- Coquille avec navigation persistante (sidebar desktop / barre basse mobile)
- Dashboard (soirées assignées, candidats à noter/notés), grille de notation

**Admin** (`/admin`) — back-office complet
- Tableau de bord, Éditions, Phases, Poules & Duos, Résultats & classement
- Candidatures (CRUD, validation/rejet, dossier complet, renvoi SMS/WhatsApp individuel ou en masse)
- Jury (gestion des jurés, clôture de notation par soirée)
- Soirées & catégories, Réservations & scans
- Partenaires, Communication (SMS/e-mail par filtre de statut)
- Paiements (historique, confirmation manuelle), Audit & sécurité (journal append-only)

## À développer (admin)

- Votes — suivi/modération admin
- Utilisateurs & rôles
- Paramètres plateforme

Ces 3 modules affichent un statut "Bientôt disponible" dans la navigation admin — pas de blocage frontend, juste jamais spécifiés/conçus.

## Notes pour le développeur backend

État au 01/09/2026, après revue des commits `edaad2b`/`bd90d11` (SMS HDR Stream, réécriture LigdiCash).

### Endpoint manquant — SMS unitaire via WhatsApp

Le bouton "Renvoyer via WhatsApp" (écran admin Candidatures, filtre "En attente de paiement")
appelle `POST /whatsapp/envoyer` — **cet endpoint n'existe pas encore**. `application.yml`
définit déjà `nks.sms.whatsapp-url` mais aucune classe Java ne le lit (pas de gateway, pas de
contrôleur). Contrat attendu, calqué sur `SmsController.envoyer()` :

```
POST /whatsapp/envoyer   (ADMIN/SUPER_ADMIN)
Body: { "to": "+226XXXXXXXX", "message": "..." }
Réponse: { "success": true, "sid": "..." }
```

Le bouton est déjà câblé côté frontend (`AdminService.envoyerWhatsappUnitaire()`) — il échoue
proprement en 404 pour l'instant (affiche "Échec"), se mettra à fonctionner dès l'ajout du
contrôleur, sans rien changer côté frontend.

### Endpoint manquant — enregistrer une photo après upload Cloudinary

`POST /medias/url-upload` renvoie bien une URL Cloudinary pré-signée, mais **aucun endpoint
n'enregistre la ligne `Media` en base après l'upload réel** (contrairement aux vidéos, qui ont
`POST /videos` pour ça). Impact concret : le changement de photo de profil
(`mon-profil.component.ts`) affiche un faux succès — l'upload part bien vers Cloudinary mais rien
ne persiste le média ensuite. Il faudrait un `POST /medias` (ou équivalent) qui accepte
`{ type, publicId, url, tailleOctets }` et crée la ligne `Media` liée au candidat courant (résolu
via le JWT, comme `POST /videos`).

### Endpoint manquant — déverrouiller la notation jury après clôture

`PUT /soirees/{id}/cloturer-notation` verrouille définitivement toutes les notes d'une soirée
(`NoteJury.verrouille = true`). **Aucun endpoint ne permet de revenir en arrière** — ni pour le
jury, ni pour l'admin via l'interface. Une clôture accidentelle ou une erreur de saisie découverte
après coup n'est aujourd'hui récupérable que par une intervention SQL directe. Un endpoint du
style `PUT /soirees/{id}/deverrouiller-notation` (ADMIN/SUPER_ADMIN) réglerait ça.

### Décision produit en attente — visibilité des notes candidat

Le candidat ne doit voir ses notes que lorsque le jury/admin le décide explicitement (règle
métier confirmée), mais rien dans le domaine actuel ne porte cette notion : `GET
/candidats/{id}/scores` est public et sans filtre. Deux options possibles, à trancher avant
implémentation :
- **Option A** : réutiliser `NoteJury.verrouille` comme signal de publication (verrouillage =
  publication) — simple, mais confond deux concepts (clôture de saisie / publication au public).
- **Option B** (recommandée) : nouveau champ `SoireeEvent.resultatsPublies` + endpoint dédié `PUT
  /soirees/{id}/publier-resultats`, découplé du verrouillage de notation.

Impacte aussi `/classement` (public) : à clarifier si le même gate s'applique.

### Confirmé fonctionnel (rien à faire)

- `GET /paiements/{id}/statut-public` (commit `bd90d11`) — testé en direct, contrat conforme à
  `PaiementService.statutPublic()` côté frontend.
- `POST /sms/candidatures-validees` et `POST /sms/envoyer` — testés en direct (échec 401 attendu,
  clé API HDR Stream absente en dev local — normal).
- Notifications automatiques (SMS + e-mail) à la validation et au rejet d'une candidature, motif
  de rejet inclus — déjà géré par `CandidatureService.valider()`/`.rejeter()`.
- Réécriture `LigdiCashGateway.java` — aucun changement de contrat sur `POST /paiements/initier`,
  rien à adapter côté frontend.
