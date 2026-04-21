import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { ArtistDetail } from './components/artist-detail/artist-detail';

export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'artist/:id', component: ArtistDetail },
  { path: '**', redirectTo: '' },
];
