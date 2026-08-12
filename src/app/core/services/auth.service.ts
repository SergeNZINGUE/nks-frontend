import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { LoginRequest, LoginResponse } from '@core/models';

const TOKEN_KEY   = 'nks_access_token';
const REFRESH_KEY = 'nks_refresh_token';
const ROLES_KEY   = 'nks_roles';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly api = environment.apiUrl;
  private roles$ = new BehaviorSubject<string[]>(this.storedRoles());

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.api}/auth/login`, req).pipe(
      tap(res => this.storeTokens(res))
    );
  }

  refresh(): Observable<LoginResponse> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return this.http.post<LoginResponse>(`${this.api}/auth/refresh`, { refreshToken }).pipe(
      tap(res => this.storeTokens(res))
    );
  }

  logout(): void {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    this.http.post(`${this.api}/auth/logout`, { refreshToken }).subscribe();
    this.clearTokens();
    this.router.navigate(['/login']);
  }

  get accessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get roles(): string[] {
    return this.roles$.getValue();
  }

  isLoggedIn(): boolean {
    return !!this.accessToken;
  }

  hasRole(...allowedRoles: string[]): boolean {
    return allowedRoles.some(r => this.roles.includes(r));
  }

  isAdmin(): boolean    { return this.hasRole('ADMIN', 'SUPER_ADMIN'); }
  isCandidat(): boolean { return this.hasRole('CANDIDAT'); }
  isJury(): boolean     { return this.hasRole('JURY'); }
  isAgent(): boolean    { return this.hasRole('AGENT_ACCUEIL'); }

  private storeTokens(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    localStorage.setItem(ROLES_KEY, JSON.stringify(res.roles));
    this.roles$.next(res.roles);
  }

  private clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLES_KEY);
    this.roles$.next([]);
  }

  private storedRoles(): string[] {
    try {
      return JSON.parse(localStorage.getItem(ROLES_KEY) ?? '[]');
    } catch { return []; }
  }
}
