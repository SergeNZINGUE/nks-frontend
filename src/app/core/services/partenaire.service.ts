import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Partenaire } from '@core/models';

/**
 * Partenaires — CdC §5.1 « Page Partenaires : logos et descriptions des sponsors ».
 * Endpoints réels : PartenaireController (GET/POST/PUT/DELETE /partenaires).
 */
@Injectable({ providedIn: 'root' })
export class PartenaireService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/partenaires`;

  /**
   * GET /partenaires — public, ne retourne QUE les partenaires ACTIF
   * (PartenaireController.lister() filtre côté serveur, `findByStatut(ACTIF)`).
   * Il n'existe aucun endpoint listant aussi les INACTIF : un partenaire désactivé
   * depuis l'admin (DELETE, cf. desactiver()) devient invisible ici et n'est
   * récupérable que par son id exact (detail()), pas par une liste.
   */
  lister(): Observable<Partenaire[]> {
    return this.http.get<Partenaire[]>(this.base);
  }

  /** GET /partenaires/{id} — fonctionne quel que soit le statut */
  detail(id: string): Observable<Partenaire> {
    return this.http.get<Partenaire>(`${this.base}/${id}`);
  }

  /** POST /partenaires — ADMIN/SUPER_ADMIN */
  creer(partenaire: Omit<Partenaire, 'id' | 'statut'>): Observable<Partenaire> {
    return this.http.post<Partenaire>(this.base, partenaire);
  }

  /**
   * PUT /partenaires/{id} — ADMIN/SUPER_ADMIN. Remplacement des champs éditables
   * uniquement (le backend ignore tout `statut` envoyé ici, cf. mettreAJour() côté
   * PartenaireController — seul DELETE change le statut).
   */
  mettreAJour(id: string, partenaire: Omit<Partenaire, 'id' | 'statut'>): Observable<Partenaire> {
    return this.http.put<Partenaire>(`${this.base}/${id}`, partenaire);
  }

  /**
   * DELETE /partenaires/{id} — pas une suppression réelle : le backend passe le
   * statut à INACTIF (soft delete). Le partenaire disparaît de lister() mais reste
   * en base, récupérable via detail(id) puis mettreAJour() pour le réactiver
   * (aucun endpoint dédié « réactiver », il faut renvoyer statut via un futur PUT
   * si le backend l'expose un jour — à ce jour mettreAJour() n'accepte pas le champ).
   */
  desactiver(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
