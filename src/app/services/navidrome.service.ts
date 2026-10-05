import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import type { StatRange } from '../models/range';
import type { ArtistDetail, StatType } from '../models/stats';

@Injectable({ providedIn: 'root' })
export class NavidromeService {
  private readonly http = inject(HttpClient);

  readonly coverArtAvailable = signal(false);
  readonly historyChanged = new Subject<void>();

  loadConfig(): void {
    this.http.get<{ coverArtAvailable: boolean }>('/api/config').subscribe({
      next: (cfg) => this.coverArtAvailable.set(cfg.coverArtAvailable),
    });
  }

  coverUrl(id: string, size = 150): string {
    return `/api/cover/${encodeURIComponent(id)}?size=${size}`;
  }

  getYears(): Observable<string[]> {
    return this.http.get<string[]>('/api/years');
  }

  getStat(type: StatType, range: StatRange): Observable<unknown> {
    let params = '';
    if (range.kind === 'year') {
      params = `?year=${encodeURIComponent(range.year)}`;
    } else if (range.kind === 'custom') {
      params = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    }
    return this.http.get(`/api/stats/${type}${params}`);
  }

  getArtist(artistId: string, range: StatRange): Observable<ArtistDetail> {
    let params = '';
    if (range.kind === 'year') {
      params = `?year=${encodeURIComponent(range.year)}`;
    } else if (range.kind === 'custom') {
      params = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    }
    return this.http.get<ArtistDetail>(`/api/artist/${encodeURIComponent(artistId)}${params}`);
  }
}
