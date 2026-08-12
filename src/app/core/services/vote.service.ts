import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { InitierVoteRequest, InitierVoteResponse, VoteCompteur } from '@core/models';

@Injectable({ providedIn: 'root' })
export class VoteService {
  private http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/votes`;

  /** POST /votes/initier — public, sans JWT */
  initier(req: InitierVoteRequest): Observable<InitierVoteResponse> {
    return this.http.post<InitierVoteResponse>(`${this.base}/initier`, req);
  }

  /** GET /votes/candidat/{id}?phaseId= */
  compteur(candidatId: string, phaseId: string): Observable<VoteCompteur> {
    const params = new HttpParams().set('phaseId', phaseId);
    return this.http.get<VoteCompteur>(`${this.base}/candidat/${candidatId}`, { params });
  }

  /** Prix d'un vote en FCFA */
  prixVote(nbVotes: number): number {
    return nbVotes * environment.votePriceFcfa;
  }
}
