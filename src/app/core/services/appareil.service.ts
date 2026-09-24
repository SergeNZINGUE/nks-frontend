import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, defer, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { environment } from '@env/environment';

const CLE_JETON = 'nks_appareil_token';
const DB_NOM = 'nks-appareil';
const DB_STORE = 'kv';
const DELAI_IDB_MS = 2000;

/**
 * Jeton d'appareil du vote sur place : un même téléphone physique ne peut voter que pour UN
 * billet par soirée (blocage dur côté serveur). Le jeton est conservé en localStorage ET
 * IndexedDB (l'un restaure l'autre s'il est purgé) ; si aucun storage n'est disponible il reste
 * en mémoire pour la durée de la page. Service dédié à la page de vote — pas d'intercepteur global.
 */
@Injectable({ providedIn: 'root' })
export class AppareilService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private jeton: string | null = null;
  private enCours: Promise<string> | null = null;
  private empreinteCache: Promise<string | null> | null = null;

  /**
   * Exécute un appel `/vote-sur-place/...` avec les en-têtes d'appareil. Sur 400 APPAREIL_INCONNU
   * (jeton absent/invalide) : régénère le jeton et rejoue l'appel UNE seule fois.
   */
  avecAppareil<T>(appel: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return defer(() => from(this.entetes())).pipe(
      switchMap(h => appel(h)),
      catchError(err => {
        if (!this.estAppareilInconnu(err)) return throwError(() => err);
        return defer(() => from(this.regenererJeton())).pipe(
          switchMap(() => from(this.entetes())),
          switchMap(h => appel(h)),
        );
      }),
    );
  }

  /** Code métier du corps d'erreur standard `{code, message, details[]}` (lu dans `error.error.code`), sinon null. */
  codeErreur(err: unknown): string | null {
    if (!(err instanceof HttpErrorResponse)) return null;
    const body = err.error as { code?: unknown } | null | undefined;
    return typeof body?.code === 'string' ? body.code : null;
  }

  estAppareilInconnu(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 400) return false;
    if (this.codeErreur(err) === 'APPAREIL_INCONNU') return true;
    // Replis (formats non standard) : champ `error`, message ou corps texte.
    const body = err.error as { error?: string; message?: string } | string | null | undefined;
    if (typeof body === 'string') return body.includes('APPAREIL_INCONNU');
    return body?.error === 'APPAREIL_INCONNU'
      || (typeof body?.message === 'string' && body.message.includes('APPAREIL_INCONNU'));
  }

  private async entetes(): Promise<HttpHeaders> {
    let headers = new HttpHeaders();
    try {
      headers = headers.set('X-Appareil-Token', await this.obtenirJeton());
    } catch {
      // Création du jeton impossible (réseau) : la consultation reste possible sans, le vote
      // échouera proprement côté serveur (APPAREIL_INCONNU) et sera rejoué par avecAppareil().
    }
    const empreinte = await this.empreinte();
    if (empreinte) headers = headers.set('X-Appareil-Empreinte', empreinte);
    return headers;
  }

  /** Jeton en mémoire, sinon localStorage/IndexedDB (restauration croisée), sinon POST /vote-sur-place/appareil. */
  obtenirJeton(): Promise<string> {
    if (this.jeton) return Promise.resolve(this.jeton);
    this.enCours ??= this.chargerOuCreer().finally(() => { this.enCours = null; });
    return this.enCours;
  }

  private async chargerOuCreer(): Promise<string> {
    const local = this.lireLocal();
    const idb = await this.lireIdb();
    const existant = local ?? idb;
    if (existant) {
      this.jeton = existant;
      if (!local) this.ecrireLocal(existant);
      if (!idb) await this.ecrireIdb(existant);
      return existant;
    }
    return this.creerJeton();
  }

  private async regenererJeton(): Promise<string> {
    this.jeton = null;
    this.effacerLocal();
    await this.effacerIdb();
    this.enCours ??= this.creerJeton().finally(() => { this.enCours = null; });
    return this.enCours;
  }

  private async creerJeton(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ appareilToken: string }>(`${this.base}/vote-sur-place/appareil`, null),
    );
    const jeton = res?.appareilToken;
    if (typeof jeton !== 'string' || !jeton) throw new Error("Jeton d'appareil invalide");
    this.jeton = jeton;
    this.ecrireLocal(jeton);
    await this.ecrireIdb(jeton);
    return jeton;
  }

  // ── Empreinte navigateur (facultative) ──────────────────────────────────────

  /** SHA-256 hex de quelques traits stables du navigateur ; null si crypto.subtle est indisponible. */
  empreinte(): Promise<string | null> {
    this.empreinteCache ??= this.calculerEmpreinte();
    return this.empreinteCache;
  }

  private async calculerEmpreinte(): Promise<string | null> {
    try {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) return null;
      const traits = [
        navigator.userAgent,
        navigator.language,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        `${screen.width}x${screen.height}`,
        String(navigator.hardwareConcurrency ?? ''),
        String(screen.colorDepth),
      ].join('|');
      const hash = await subtle.digest('SHA-256', new TextEncoder().encode(traits));
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  // ── Storage (chaque accès isolé : la page reste fonctionnelle sans) ────────

  private lireLocal(): string | null {
    try { return this.valide(localStorage.getItem(CLE_JETON)); } catch { return null; }
  }
  private ecrireLocal(v: string): void {
    try { localStorage.setItem(CLE_JETON, v); } catch { /* storage indisponible : jeton gardé en mémoire */ }
  }
  private effacerLocal(): void {
    try { localStorage.removeItem(CLE_JETON); } catch { /* ignoré */ }
  }

  private valide(v: unknown): string | null {
    return typeof v === 'string' && v.length > 0 && v.length <= 512 ? v : null;
  }

  private lireIdb(): Promise<string | null> {
    return this.opIdb<string | null>(store => store.get(CLE_JETON), 'readonly')
      .then(v => this.valide(v)).catch(() => null);
  }
  private ecrireIdb(v: string): Promise<void> {
    return this.opIdb(store => store.put(v, CLE_JETON), 'readwrite').then(() => undefined).catch(() => undefined);
  }
  private effacerIdb(): Promise<void> {
    return this.opIdb(store => store.delete(CLE_JETON), 'readwrite').then(() => undefined).catch(() => undefined);
  }

  /** Une opération IndexedDB, bornée dans le temps (certains navigateurs en navigation privée ne répondent jamais). */
  private opIdb<R>(op: (store: IDBObjectStore) => IDBRequest, mode: IDBTransactionMode): Promise<R> {
    const tache = new Promise<R>((resolve, reject) => {
      try {
        const ouverture = indexedDB.open(DB_NOM, 1);
        ouverture.onupgradeneeded = () => ouverture.result.createObjectStore(DB_STORE);
        ouverture.onerror = () => reject(ouverture.error);
        ouverture.onblocked = () => reject(new Error('IndexedDB bloquée'));
        ouverture.onsuccess = () => {
          const db = ouverture.result;
          try {
            const tx = db.transaction(DB_STORE, mode);
            const req = op(tx.objectStore(DB_STORE));
            let resultat: R;
            req.onsuccess = () => { resultat = req.result as R; };
            tx.oncomplete = () => { db.close(); resolve(resultat); };
            tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
          } catch (e) { db.close(); reject(e); }
        };
      } catch (e) { reject(e); }
    });
    const delai = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB timeout')), DELAI_IDB_MS));
    return Promise.race([tache, delai]);
  }
}
