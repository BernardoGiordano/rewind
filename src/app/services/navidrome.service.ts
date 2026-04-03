import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  TopSong,
  TopArtist,
  TopAlbum,
  TopGenre,
  ListeningSummary,
  ListeningClock,
  MonthlyTrend,
  DayOfWeek,
  ListeningStreak,
  LateNightTrack,
  OnRepeatEntry,
  SongOfMonth,
  FavoriteDecade,
  StatType,
} from '../models/stats';

@Injectable({ providedIn: 'root' })
export class NavidromeService {
  private readonly http = inject(HttpClient);

  readonly coverArtAvailable = signal(false);

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

  getStat(type: StatType, year: string | null): Observable<unknown> {
    const params = year && year !== 'all-time' ? `?year=${year}` : '';
    return this.http.get(`/api/stats/${type}${params}`);
  }

  getTopSongs(year: string | null): Observable<TopSong[]> {
    return this.getStat('top-songs', year) as Observable<TopSong[]>;
  }

  getTopArtists(year: string | null): Observable<TopArtist[]> {
    return this.getStat('top-artists', year) as Observable<TopArtist[]>;
  }

  getTopAlbums(year: string | null): Observable<TopAlbum[]> {
    return this.getStat('top-albums', year) as Observable<TopAlbum[]>;
  }

  getTopGenres(year: string | null): Observable<TopGenre[]> {
    return this.getStat('top-genres', year) as Observable<TopGenre[]>;
  }

  getSummary(year: string | null): Observable<ListeningSummary> {
    return this.getStat('summary', year) as Observable<ListeningSummary>;
  }

  getListeningClock(year: string | null): Observable<ListeningClock[]> {
    return this.getStat('listening-clock', year) as Observable<ListeningClock[]>;
  }

  getMonthlyTrends(year: string | null): Observable<MonthlyTrend[]> {
    return this.getStat('monthly-trends', year) as Observable<MonthlyTrend[]>;
  }

  getDayOfWeek(year: string | null): Observable<DayOfWeek[]> {
    return this.getStat('day-of-week', year) as Observable<DayOfWeek[]>;
  }

  getStreak(year: string | null): Observable<ListeningStreak[]> {
    return this.getStat('streak', year) as Observable<ListeningStreak[]>;
  }

  getLateNight(year: string | null): Observable<LateNightTrack[]> {
    return this.getStat('late-night', year) as Observable<LateNightTrack[]>;
  }

  getOnRepeat(year: string | null): Observable<OnRepeatEntry[]> {
    return this.getStat('on-repeat', year) as Observable<OnRepeatEntry[]>;
  }

  getSongOfMonth(year: string | null): Observable<SongOfMonth[]> {
    return this.getStat('song-of-month', year) as Observable<SongOfMonth[]>;
  }

  getFavoriteDecades(year: string | null): Observable<FavoriteDecade[]> {
    return this.getStat('favorite-decades', year) as Observable<FavoriteDecade[]>;
  }
}
