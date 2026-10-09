import { authGuard, loginGuard } from './guards/auth.js';
import { ArtistDetail } from './components/artist-detail/artist-detail.js';
import { Dashboard } from './components/dashboard/dashboard.js';
import { Login } from './components/login/login.js';
import { Shell } from './shell/shell.js';

/** @import { RouteDef } from '@core/navigation/types.js' */

/**
 * The login screen stands alone. Every other screen renders inside the Shell, whose
 * guard covers them all. The library loads on first visit.
 *
 * @type {RouteDef[]}
 */
export const routes = [
  { path: '/login', component: Login, canActivate: loginGuard },
  {
    path: '',
    component: Shell,
    canActivate: authGuard,
    children: [
      { path: '', component: Dashboard },
      { path: 'library', load: () => import('./components/library/library.js').then((m) => m.Library) },
      { path: 'artist/:id', component: ArtistDetail },
    ],
  },
  { path: '*', redirect: '/' },
];
