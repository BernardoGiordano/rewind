import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  // During SSR we can't reliably read the user's cookie via HttpClient — let
  // the route render and let the client hydrate + redirect if needed.
  if (!isPlatformBrowser(platformId)) return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  const redirect = (): UrlTree =>
    router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });

  if (auth.bootstrapped()) {
    return auth.isAuthenticated() ? true : redirect();
  }

  return auth.bootstrap().pipe(map((u) => (u ? true : redirect())));
};

export const loginGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) return true;

  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = (): boolean | UrlTree =>
    auth.isAuthenticated() ? router.createUrlTree(['/']) : true;

  if (auth.bootstrapped()) {
    return decide();
  }
  return auth.bootstrap().pipe(map(() => decide()));
};

// Re-export helper to enable eager bootstrap call without subscription leaks.
export const _noopBootstrap = () => of(null);
