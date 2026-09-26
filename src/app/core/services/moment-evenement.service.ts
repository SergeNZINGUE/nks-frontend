import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { MomentEvenement, Page, TypeMoment } from '@core/models';

export interface CreerMomentAdminRequest {
  type: TypeMoment;
  publicId: string;
  url: string;
  tailleOctets: number;
  soireeId?: string | null;
  candidatIds?: string[];
  legende?: string | null;
}

/**
 * "Moments de l'événement" — table dédiée moments_evenement, distincte de
 * MediaService (photo de profil) et VideoService (prestation par phase). Deux chemins
 * d'écriture : candidat (file d'attente EN_ATTENTE) et admin/organisateur (publié
 * immédiatement, avec candidats tagués/soirée/légende — réservés à ce second chemin).
 */
@Injectable({ providedIn: 'root' })
export class MomentEvenementService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Public — GET /moments-evenement, uniquement les moments VALIDE. */
  listerPublic(page = 0, size = 24): Observable<Page<MomentEvenement>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<MomentEvenement>>(`${this.api}/moments-evenement`, { params });
  }

  /** CANDIDAT — dépose un nouveau moment (EN_ATTENTE), jamais de candidatIds/soireeId/legende. */
  ajouterCandidat(type: TypeMoment, publicId: string, url: string, tailleOctets: number): Observable<MomentEvenement> {
    return this.http.post<MomentEvenement>(`${this.api}/moments-evenement`, { type, publicId, url, tailleOctets });
  }

  /** CANDIDAT — ses propres envois ("Souvenirs de l'événement"), tous statuts confondus. */
  mesEnvois(): Observable<MomentEvenement[]> {
    return this.http.get<MomentEvenement[]>(`${this.api}/moments-evenement/mes-envois`);
  }

  /** CANDIDAT — retrait, uniquement possible tant que le statut est EN_ATTENTE (contrôlé côté backend). */
  retirer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/moments-evenement/${id}`);
  }

  /** ADMIN/SUPER_ADMIN/ORGANISATEUR — ajout direct, publié immédiatement. */
  ajouterAdmin(request: CreerMomentAdminRequest): Observable<MomentEvenement> {
    return this.http.post<MomentEvenement>(`${this.api}/admin/moments-evenement`, request);
  }

  /** ADMIN/SUPER_ADMIN/ORGANISATEUR — file de modération (envois candidats EN_ATTENTE). */
  listerEnAttente(): Observable<MomentEvenement[]> {
    return this.http.get<MomentEvenement[]>(`${this.api}/admin/moments-evenement/en-attente`);
  }

  /** Léger, dédié au badge de la sidebar — jamais la liste complète juste pour un chiffre. */
  compterEnAttente(): Observable<number> {
    return this.http.get<number>(`${this.api}/admin/moments-evenement/en-attente/nombre`);
  }

  valider(id: string): Observable<MomentEvenement> {
    return this.http.put<MomentEvenement>(`${this.api}/admin/moments-evenement/${id}/valider`, {});
  }

  /** Motif obligatoire — repris tel quel dans la notification in-app envoyée au candidat. */
  rejeter(id: string, motif: string): Observable<MomentEvenement> {
    return this.http.put<MomentEvenement>(`${this.api}/admin/moments-evenement/${id}/rejeter`, { motif });
  }

  /** Toujours admin/organisateur — jamais accessible au candidat sur son propre moment. */
  mettreALaUne(id: string): Observable<MomentEvenement> {
    return this.http.put<MomentEvenement>(`${this.api}/admin/moments-evenement/${id}/mettre-a-la-une`, {});
  }

  /**
   * Résout le libellé de crédit affiché sur une carte — candidatsTagues (photo de
   * groupe, admin uniquement) prime sur candidatUploadeurCode (envoi candidat), qui
   * prime sur le crédit générique "Équipe NKS" (rien des deux, ajout admin sans candidat).
   */
  credit(m: MomentEvenement): string {
    if (m.candidatsTagues.length > 0) {
      return m.candidatsTagues.map(c => c.codeCandidat).join(' & ');
    }
    if (m.candidatUploadeurCode) {
      return m.candidatUploadeurCode;
    }
    return 'Équipe NKS';
  }

  /** true si aucun candidat n'est identifiable — le frontend affiche alors le pictogramme "Équipe NKS" plutôt qu'un avatar. */
  estCreditEquipe(m: MomentEvenement): boolean {
    return m.candidatsTagues.length === 0 && !m.candidatUploadeurCode;
  }
}
