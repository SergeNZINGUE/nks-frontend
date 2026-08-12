import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { httpTimeoutInterceptor } from '@core/interceptors/http-timeout.interceptor';
import { changeDetectionInterceptor } from '@core/interceptors/change-detection.interceptor';

// Locale FR obligatoire : DatePipe/DecimalPipe sont utilises avec 'fr' (ex. accueil,
// noms de mois des soirees) et plantent en NG0701 "Missing locale data" sans cet
// enregistrement — Angular n'embarque que en-US par defaut. L'erreur est synchrone
// pendant le rendu du template et interrompt le cycle de detection de changements
// en cours, ce qui fige l'interface sur son dernier etat rendu (ecran de chargement
// bloque indefiniment) sans lever d'exception visible cote reseau.
registerLocaleData(localeFr);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    // Angular 21+ est zoneless par defaut au niveau du scheduler (l'ApplicationRef
    // n'ecoute plus zone.js), et Angular 22 bascule au surplus tout composant sans
    // changeDetection explicite sur OnPush (au lieu de l'ancien Default/check-always).
    // Cette appli a ete migree 17->22 a la main (pas via `ng update`, qui aurait
    // stampe ChangeDetectionStrategy.Eager automatiquement sur l'existant) : ses
    // composants mutent encore des champs simples dans subscribe() sans signaux ni
    // markForCheck(). Sans les deux mesures ci-dessous, ces mutations ne sont plus
    // jamais reflechies a l'ecran (confirme empiriquement : donnees chargees en
    // memoire, DOM fige indefiniment sur le skeleton, meme apres clic reel).
    // 1) Restaure le scheduling zone.js global (tout evenement/tache async tente
    //    un cycle de detection applicatif, comme avant Angular 21).
    provideZoneChangeDetection(),
    // 2) Chaque composant est explicitement stampe Eager (voir leurs decorateurs
    //    @Component) pour ne pas etre saute par la verification OnPush malgre le
    //    tick ci-dessus. A retirer composant par composant lors d'une bascule
    //    ulterieure vers les signaux (cf. commentaire similaire supprime ici).
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Ordre significatif : le timeout enveloppe l'authentification, de sorte
    // qu'une tentative de refresh bloquée soit elle aussi coupée. changeDetectionInterceptor
    // en dernier : peu importe l'ordre pour lui (cf. change-detection.interceptor.ts),
    // il doit juste observer la reponse finale, succes ou erreur.
    provideHttpClient(withInterceptors([httpTimeoutInterceptor, authInterceptor, changeDetectionInterceptor])),
  ],
}).catch(err => console.error(err));
