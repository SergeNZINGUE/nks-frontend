import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { Edition, Phase } from '@core/models';

@Injectable({ providedIn: 'root' })
export class EditionService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/editions`;

  lister(): Observable<Edition[]> {
    return this.http.get<Edition[]>(this.base);
  }

  detail(id: string): Observable<Edition> {
    return this.http.get<Edition>(`${this.base}/${id}`);
  }

  /** Retourne l'édition EN_COURS ou null */
  enCours(): Observable<Edition | null> {
    return this.lister().pipe(
      map(editions => editions.find(e => e.statut === 'EN_COURS') ?? null)
    );
  }

  /**
   * Édition à afficher sur l'accueil, même hors statut EN_COURS : priorité à
   * celle EN_COURS, sinon la plus récente par année (cas EN_PREPARATION, où
   * aucune édition n'est encore EN_COURS mais la page doit quand même
   * refléter l'édition à venir — sans quoi l'accueil affiche un CTA "Voter"
   * qui n'a aucun sens tant que la compétition n'a pas démarré).
   */
  courante(): Observable<Edition | null> {
    return this.lister().pipe(
      map(editions => {
        if (editions.length === 0) return null;
        return editions.find(e => e.statut === 'EN_COURS')
          ?? [...editions].sort((a, b) => b.annee - a.annee)[0];
      })
    );
  }

  phases(editionId: string): Observable<Phase[]> {
    return this.http.get<Phase[]>(`${this.base}/${editionId}/phases`);
  }

  /** Phase active (voteActif = true) parmi les phases d'une édition */
  phaseActive(editionId: string): Observable<Phase | null> {
    return this.phases(editionId).pipe(
      map(phases => phases.find(p => p.voteActif) ?? null)
    );
  }

  /**
   * Les inscriptions sont ouvertes ssi la date du jour est dans
   * [dateDebutInscriptions, dateFinInscriptions] de l'édition fournie.
   * `edition` est déjà celle EN_COURS (cf. `enCours()`) : le statut d'édition
   * (EN_PREPARATION/EN_COURS/TERMINEE/ARCHIVEE) porte sur toute la compétition,
   * pas spécifiquement sur la fenêtre d'inscription — d'où ce calcul par date.
   */
  inscriptionsOuvertes(edition: Edition | null): boolean {
    if (!edition?.dateDebutInscriptions || !edition?.dateFinInscriptions) return false;
    const aujourdhui = new Date().toISOString().slice(0, 10); // yyyy-MM-dd, comparable aux LocalDate backend
    return aujourdhui >= edition.dateDebutInscriptions && aujourdhui <= edition.dateFinInscriptions;
  }
}
