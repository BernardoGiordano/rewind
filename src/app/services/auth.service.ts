import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CachedRouteReuseStrategy } from '../route-reuse-strategy';

export type AuthMode = 'env' | 'session';

export interface AuthUser {
  username: string;
  mode: AuthMode;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly routeReuse = inject(CachedRouteReuseStrategy);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _bootstrapped = signal(false);

  readonly user = this._user.asReadonly();
  readonly bootstrapped = this._bootstrapped.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly canLogout = computed(() => this._user()?.mode === 'session');

  /** Fetch current auth state from the server. Safe to call multiple times. */
  bootstrap(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>('/api/auth/me').pipe(
      tap((u) => this._user.set(u)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this._user.set(null);
          return of(null);
        }
        throw err;
      }),
      tap(() => this._bootstrapped.set(true)),
    );
  }

  login(username: string, password: string): Observable<AuthUser> {
    return this.http.post<AuthUser>('/api/auth/login', { username, password }).pipe(
      tap((u) => {
        this.routeReuse.clear();
        this._user.set(u);
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<{ ok: boolean }>('/api/auth/logout', {}).pipe(
      tap(() => {
        this.routeReuse.clear();
        this._user.set(null);
      }),
      map(() => undefined),
    );
  }

  /** Mark current user as signed-out locally (e.g. after a 401 from another endpoint). */
  clearLocal(): void {
    if (this._user()?.mode === 'session') {
      this.routeReuse.clear();
      this._user.set(null);
    }
  }
}
