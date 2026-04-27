import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'login',
    renderMode: RenderMode.Server,
  },
  // Protected routes: render client-side so SSR doesn't flash an empty skeleton before the guard redirects.
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
