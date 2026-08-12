import { Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { GalleryComponent } from './gallery/gallery.component';
import { CandidateProfileComponent } from './candidate-profile/candidate-profile.component';
import { VoteComponent } from './vote/vote.component';
import { RankingComponent } from './ranking/ranking.component';

export const publicRoutes: Routes = [
  { path: '',             component: HomeComponent },
  { path: 'galerie',      component: GalleryComponent },
  { path: 'candidat/:id', component: CandidateProfileComponent },
  { path: 'voter/:id',    component: VoteComponent },
  { path: 'classement',   component: RankingComponent },
  {
    path: 'inscription',
    loadComponent: () =>
      import('./inscription/inscription.component').then(c => c.InscriptionComponent),
  },
];
