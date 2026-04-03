import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TrackStat {
  title: string;
  artist: string;
  album: string;
  play_count: number;
  track_duration_min: number;
  total_min_listened: number;
}

@Injectable({ providedIn: 'root' })
export class NavidromeService {
  private readonly http = inject(HttpClient);

  getTopTracks(): Observable<TrackStat[]> {
    return this.http.get<TrackStat[]>('/api/top-tracks');
  }
}
