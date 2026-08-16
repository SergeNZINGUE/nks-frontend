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
  /** Jury.prenom/.nom sont des champs propres à l'entité (pas via utilisateur, contrairement à Candidat) */
  jury?: {
    id:     string;
    prenom: string;
    nom:    string;
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
 * Représentation d'un Jury tel que sérialisé brut par AdminController (entité JPA).
 * `utilisateur`/`edition` sont LAZY sans @JsonIgnore → mêmes conditions de crash que
 * Classement/NoteJury (cf. rapport LazyInitializationException 15/08/2026).
 */
export interface JuryBrut {
  id: string;
  prenom: string;
  nom: string;
  specialite: string | null;
  bioPublique: string | null;
  statut: 'ACTIF' | 'INACTIF';
  utilisateur?: { id: string; email: string; telephone: string };
  edition?: { id: string; nom: string };
}

@Injectable({ providedIn: 'root' })
export class JuryService {
  private http = inject(HttpClient);

  private readonly base = environment.apiUrl;

  /**
   * GET /admin/jury?editionId= — AdminController.jury() — ADMIN/SUPER_ADMIN.
   * ⚠️ Bug backend confirmé (15/08/2026) : `Jury.utilisateur` LAZY sans @JsonIgnore → 500
   * dès qu'il y a des jurys en base sur l'édition.
   */
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

  /**
   * GET /jury/notes/soiree/{soireeId} — JuryController.notesSoiree() — ADMIN/SUPER_ADMIN.
   * ⚠️ Bug backend confirmé (15/08/2026) : `NoteJury.jury`/`.candidat`/`.soiree`/`.critere`
   * tous LAZY sans @JsonIgnore → 500 dès qu'il y a des notes en base pour la soirée.
   */
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
}
