import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { ArtistDetail } from './components/artist-detail/artist-detail';
import { Login } from './components/login/login';
import { authGuard, loginGuard } from './guards/auth.guard';
import { Shell } from './shell/shell';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [loginGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: Dashboard, data: { reuse: true } },
      {
        path: 'library',
        loadComponent: () => import('./components/library/library').then((m) => m.Library),
      },
      { path: 'artist/:id', component: ArtistDetail },
    ],
  },
  { path: '**', redirectTo: '' },
];
