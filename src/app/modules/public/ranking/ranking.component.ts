import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subscription, startWith, switchMap, catchError, of } from 'rxjs';
import { ClassementService } from '@core/services/classement.service';
import { Classement } from '@core/models';
import { environment } from '@env/environment';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BottomNavComponent } from '../../../shared/components/bottom-nav/bottom-nav.component';

@Component({
    selector: 'app-ranking',
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.scss'],
    imports: [
    SiteHeaderComponent,
    TopbarComponent,
    RouterLink,
    BottomNavComponent,
    DecimalPipe,
    DatePipe
],
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class RankingComponent implements OnInit, OnDestroy {
  private classementSvc = inject(ClassementService);

  classement: Classement[] = [];
  loading = true;
  lastUpdate = new Date();
  private sub = new Subscription();

  ngOnInit(): void {
    // catchError DANS le switchMap (pas autour) : placé à l'extérieur, la première erreur
    // réseau terminerait le flux et le rafraîchissement s'arrêterait définitivement — même
    // bug déjà identifié et corrigé sur ce pattern dans home.component.ts.
    const poll = interval(environment.pollIntervalMs).pipe(
      startWith(0),
      switchMap(() => this.classementSvc.global().pipe(catchError(() => of(null)))),
    ).subscribe(c => {
      if (c) { this.classement = c; this.lastUpdate = new Date(); }
      this.loading = false;
    });
    this.sub.add(poll);
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  rankIcon(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;
  }
}
