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

/** Représentation d'une NoteJury retournée par le backend (entité JPA sérialisée) */
export interface NoteJuryBrut {
  id:        string;
  valeur:    number;
  verrouille: boolean;
  dateSaisie: string;
  critere: {
    id:      string;
    nom:     string;
    noteMin: number;
    noteMax: number;
  };
  candidat: {
    id:          string;
    codeCandidat: string;
  };
}

/**
 * Candidat retourné par GET /jury/candidats?soireeId=
 * Le backend sérialise l'entité Candidat (LAZY) + Utilisateur — peut être partiel
 * si LazyInitializationException (bug backend connu, open-in-view=false)
 */
export interface CandidatBrut {
  id:                  string;
  codeCandidat:        string;
  biographie:          string | null;
  chansonPreselection: string | null;
  statutProfil:        string;
  utilisateur?: {
    prenom: string;
    nom:    string;
  };
}

@Injectable({ providedIn: 'root' })
export class JuryService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

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
}
