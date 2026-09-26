import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';

import { NotificationService } from '@core/services/notification.service';
import { NotificationInApp } from '@core/models';

/**
 * Cloche de notifications in-app — partagée entre le panel candidat et le back-office
 * (première brique visible du canal CanalNotification.IN_APP, prévu côté backend depuis
 * toujours mais jamais branché avant "Moments de l'événement"). Chaque notification se
 * marque lue à l'ouverture de son détail (pas de "tout marquer lu" groupé pour l'instant
 * — pas demandé, évite d'ajouter une action qui n'a pas été validée).
 */
@Component({
  selector: 'app-notif-bell',
  imports: [DatePipe],
  template: `
<div class="notif-bell" [class.notif-bell--open]="ouvert">
  <button type="button" class="notif-bell__btn" (click)="basculer()" aria-label="Notifications" [attr.aria-expanded]="ouvert">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
    @if (nombreNonLues > 0) {
      <span class="notif-bell__dot" aria-hidden="true"></span>
    }
  </button>

  @if (ouvert) {
    <div class="notif-bell__panel" role="dialog" aria-label="Notifications">
      <p class="notif-bell__title">Notifications</p>
      @if (chargement) {
        <p class="notif-bell__vide">Chargement…</p>
      } @else if (notifications.length === 0) {
        <p class="notif-bell__vide">Rien de nouveau pour l'instant.</p>
      } @else {
        @for (n of notifications; track n.id) {
          <button type="button" class="notif-item" [class.notif-item--non-lu]="!n.lu" (click)="ouvrirNotification(n)">
            <span class="notif-item__point" aria-hidden="true"></span>
            <span class="notif-item__text">
              {{ n.corpsMessage }}
              <span class="notif-item__time">{{ n.dateCreation | date:'d MMM, HH:mm' }}</span>
            </span>
          </button>
        }
      }
    </div>
  }
</div>
`,
  styleUrls: ['./notif-bell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class NotifBellComponent implements OnInit {
  private notifSvc = inject(NotificationService);
  private elementRef = inject(ElementRef);

  ouvert = false;
  chargement = true;
  nombreNonLues = 0;
  notifications: NotificationInApp[] = [];

  ngOnInit(): void {
    this.notifSvc.nombreNonLues().pipe(catchError(() => of(0))).subscribe(n => { this.nombreNonLues = n; });
    this.notifSvc.mesNotifications().pipe(catchError(() => of([]))).subscribe(liste => {
      this.notifications = liste;
      this.chargement = false;
    });
  }

  basculer(): void {
    this.ouvert = !this.ouvert;
  }

  ouvrirNotification(n: NotificationInApp): void {
    if (n.lu) return;
    n.lu = true;
    this.nombreNonLues = Math.max(0, this.nombreNonLues - 1);
    this.notifSvc.marquerLu(n.id).pipe(catchError(() => of(undefined))).subscribe();
  }

  /** Ferme la cloche au clic en dehors — même geste que la maquette de proposition. */
  @HostListener('document:click', ['$event'])
  onClicExterieur(event: MouseEvent): void {
    if (this.ouvert && !this.elementRef.nativeElement.contains(event.target)) {
      this.ouvert = false;
    }
  }
}
