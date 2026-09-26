import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { NotificationInApp } from '@core/models';

/**
 * Cloche in-app — premier consommateur réel de CanalNotification.IN_APP (défini côté
 * backend depuis toujours, jamais branché avant "Moments de l'événement"). Générique :
 * n'importe quelle fonctionnalité future peut émettre des notifications lues ici.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  mesNotifications(limite = 20): Observable<NotificationInApp[]> {
    const params = new HttpParams().set('limite', limite);
    return this.http.get<NotificationInApp[]>(`${this.api}/notifications/mes-notifications`, { params });
  }

  nombreNonLues(): Observable<number> {
    return this.http.get<number>(`${this.api}/notifications/non-lues/nombre`);
  }

  marquerLu(id: string): Observable<void> {
    return this.http.put<void>(`${this.api}/notifications/${id}/lu`, {});
  }
}
