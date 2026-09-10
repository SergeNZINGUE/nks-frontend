import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { GalleryComponent } from './gallery/gallery.component';
import { CandidateProfileComponent } from './candidate-profile/candidate-profile.component';
import { VoteComponent } from './vote/vote.component';
import { RankingComponent } from './ranking/ranking.component';
import { ClassementPoulesComponent } from './classement-poules/classement-poules.component';

export const publicRoutes: Routes = [
  { path: '',                   component: HomeComponent },
  { path: 'galerie',            component: GalleryComponent },
  { path: 'candidat/:id',       component: CandidateProfileComponent },
  { path: 'voter/:id',          component: VoteComponent },
  { path: 'classement',         component: RankingComponent },
  { path: 'classement-poules',  component: ClassementPoulesComponent },
  {
    path: 'inscription',
    loadComponent: () =>
      import('./inscription/inscription.component').then(c => c.InscriptionComponent),
  },
  {
    // return_url / cancel_url LigdiCash — cf. PaiementRetourComponent. Générique
    // aux 3 flux payants (inscription/vote/billet) : identifie le paiement via
    // ?paiementId=, jamais via un contexte candidat/phase supposé.
    path: 'paiement/retour',
    loadComponent: () =>
      import('./paiement-retour/paiement-retour.component').then(c => c.PaiementRetourComponent),
  },
];
