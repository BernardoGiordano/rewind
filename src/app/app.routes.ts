import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { ArtistDetail } from './components/artist-detail/artist-detail';
import { Login } from './components/login/login';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [loginGuard] },
  { path: '', component: Dashboard, data: { reuse: true }, canActivate: [authGuard] },
  { path: 'artist/:id', component: ArtistDetail, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
