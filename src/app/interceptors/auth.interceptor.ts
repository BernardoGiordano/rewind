import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        if (isPlatformBrowser(platformId) && req.url.startsWith('/api/')) {
          auth.clearLocal();
          const isAuthEndpoint = req.url.startsWith('/api/auth/');
          const onLogin = router.url.startsWith('/login');
          if (!isAuthEndpoint && !onLogin) {
            router.navigate(['/login'], { queryParams: { redirect: router.url } });
          }
        }
      }
      return throwError(() => err);
    }),
  );
};
