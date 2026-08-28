import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { SoireeEvent } from '@core/models';

/** Entrée d'une note (aligne sur NoteInput.java) */
export interface NoteInput { critereId: string; valeur: number; }

/** Corps de POST /jury/notes (SaisirNotesRequest.java) */
export interface SaisirNotesRequest {
  candidatId: string;
  soireeId:   string;
  notes:      NoteInput[];
}

/** dto/critere/CritereNotationResponse.java — GET /jury/criteres?soireeId= (ajouté 09/08/2026) */
export interface CritereNotationResponse {
  id:      string;
  nom:     string;
  noteMin: number;
  noteMax: number;
  ordre:   number;
}

/**
 * Représentation d'une NoteJury retournée par le backend — `NoteJuryResponse` (DTO record) :
 * plus d'objets imbriqués `critere`/`candidat`/`jury`, tout est aplati en `xxxId`.
 * ⚠️ `noteMax` du critère n'est plus disponible sur cette réponse, contrairement à avant.
 */
export interface NoteJuryBrut {
  id:          string;
  juryId:      string;
  candidatId:  string;
  soireeId:    string;
  critereId:   string;
  critereNom:  string;
  valeur:      number;
  verrouille:  boolean;
  dateSaisie:  string;
}

/**
 * Candidat retourné par GET /jury/candidats?soireeId= — `CandidatPublicResponse` (DTO record,
 * même convention que `@core/models`). `prenom`/`nom` sont à plat, plus d'objet `utilisateur` imbriqué.
 */
export interface CandidatBrut {
  id:                  string;
  codeCandidat:        string;
  prenom:              string;
  nom:                 string;
  biographie:          string | null;
  chansonPreselection: string | null;
  statutProfil:        string;
}

/** Corps de POST /admin/jury (CreerJuryRequest.java — record, tous champs sauf specialite/bioPublique @NotBlank/@NotNull) */
export interface CreerJuryRequest {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  specialite?: string;
  bioPublique?: string;
  editionId: string;
}

/**
 * Représentation d'un Jury tel que renvoyé par AdminController — `JuryResponse` (DTO record) :
 * `utilisateur`/`edition` sont aplatis en `utilisateurId`/`editionId`, plus d'objets imbriqués.
 */
export interface JuryBrut {
  id: string;
  prenom: string;
  nom: string;
  specialite: string | null;
  bioPublique: string | null;
  statut: 'ACTIF' | 'INACTIF';
  editionId: string;
  utilisateurId: string;
}

@Injectable({ providedIn: 'root' })
export class JuryService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  /** GET /admin/jury?editionId= — AdminController.jury() — ADMIN/SUPER_ADMIN. */
  listerAdmin(editionId: string): Observable<JuryBrut[]> {
    return this.http.get<JuryBrut[]>(`${this.base}/admin/jury`, { params: { editionId } });
  }

  /** POST /admin/jury — AdminController.creerJury() — ADMIN/SUPER_ADMIN. Crée le compte utilisateur + le profil jury. */
  creerAdmin(req: CreerJuryRequest): Observable<JuryBrut> {
    return this.http.post<JuryBrut>(`${this.base}/admin/jury`, req);
  }

  /** DELETE /admin/jury/{id} — AdminController.desactiverJury() — ADMIN/SUPER_ADMIN. Désactivation logique (statut INACTIF), pas de suppression. */
  desactiverAdmin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/jury/${id}`);
  }

  /** GET /jury/notes/soiree/{soireeId} — JuryController.notesSoiree() — ADMIN/SUPER_ADMIN. */
  notesSoireeAdmin(soireeId: string): Observable<NoteJuryBrut[]> {
    return this.http.get<NoteJuryBrut[]>(`${this.base}/jury/notes/soiree/${soireeId}`);
  }

  /**
   * GET /jury/soirees
   * Retourne la liste des soirées auxquelles le juré connecté est affecté.
   * JuryController.mesSoirees() : retourne jury.getSoirees() (LAZY — peut échouer
   * si open-in-view=false et pas de @Transactional sur le contrôleur).
   */
  mesSoirees(): Observable<SoireeEvent[]> {
    return this.http.get<SoireeEvent[]>(`${this.base}/jury/soirees`);
  }

  /**
   * GET /jury/candidats?soireeId=
   * Candidats présents dans cette soirée via affectations_poules ou duos.
   * Requiert que la soirée ait des affectations — sinon retourne []
   */
  candidatsPourSoiree(soireeId: string): Observable<CandidatBrut[]> {
    return this.http.get<CandidatBrut[]>(`${this.base}/jury/candidats`, {
      params: { soireeId }
    });
  }

  /**
   * GET /jury/criteres?soireeId= — ajouté 09/08/2026.
   * Remplace le repli sur des UUID hardcodés (grille CdC en dur côté frontend) : la
   * grille officielle vit en base, scopée par édition (résolue côté backend via la soirée).
   */
  criteresNotation(soireeId: string): Observable<CritereNotationResponse[]> {
    return this.http.get<CritereNotationResponse[]>(`${this.base}/jury/criteres`, {
      params: { soireeId }
    });
  }

  /**
   * POST /jury/notes
   * SaisirNotesRequest : { candidatId, soireeId, notes: [{ critereId, valeur }] }
   * Retourne la liste des NoteJury enregistrées / mises à jour
   */
  saisirNotes(req: SaisirNotesRequest): Observable<NoteJuryBrut[]> {
    return this.http.post<NoteJuryBrut[]>(`${this.base}/jury/notes`, req);
  }

  /**
   * GET /jury/mes-notes?soireeId=
   * Notes déjà saisies par le juré connecté pour la soirée donnée
   */
  mesNotes(soireeId: string): Observable<NoteJuryBrut[]> {
    return this.http.get<NoteJuryBrut[]>(`${this.base}/jury/mes-notes`, {
      params: { soireeId }
    });
  }

  /**
   * PUT /soirees/{id}/cloturer-notation — JuryController.cloturerNotation() — ADMIN/SUPER_ADMIN.
   * Ferme définitivement la fenêtre de notation jury de la soirée (verrouille les notes déjà
   * saisies). Action irréversible côté métier — confirmation obligatoire côté UI avant appel.
   * 204 No Content en cas de succès.
   */
  cloturerNotationSoiree(soireeId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/soirees/${soireeId}/cloturer-notation`, {});
  }
}
