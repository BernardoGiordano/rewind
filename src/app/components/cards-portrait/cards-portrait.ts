import { Component, computed, ElementRef, inject, input } from '@angular/core';
import { CardShellComponent } from '../card-shell';
import {
  type DayOfWeek,
  type FavoriteDecade,
  type LateNightTrack,
  type ListeningClock,
  type ListeningStreak,
  type ListeningSummary,
  type MonthlyTrend,
  type OnRepeatEntry,
  type RecapData,
  type SongOfMonth,
  StatDefinition,
  StatType,
  type TopAlbum,
  type TopArtist,
  type TopGenre,
  type TopSong,
} from '../../models/stats';
import { NavidromeService } from '../../services/navidrome.service';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-cards-portrait',
  imports: [CardShellComponent, SlicePipe],
  templateUrl: './cards-portrait.html',
})
export class CardsPortrait {
  readonly el = inject(ElementRef<HTMLElement>);
  private readonly navidrome = inject(NavidromeService);

  readonly maxGenrePlays = input.required<number>();
  readonly maxClockPlays = input.required<number>();
  readonly maxDayPlays = input.required<number>();
  readonly maxDecadePlays = input.required<number>();

  readonly selectedDef = input.required<StatDefinition | undefined>();
  readonly selectedYear = input.required<string>();
  readonly selectedStat = input.required<StatType>();
  readonly summaryData = input.required<ListeningSummary | null>();
  readonly topSongs = input.required<TopSong[]>();
  readonly topArtists = input.required<TopArtist[]>();
  readonly topAlbums = input.required<TopAlbum[]>();
  readonly topGenres = input.required<TopGenre[]>();
  readonly listeningClock = input.required<ListeningClock[]>();
  readonly monthlyTrends = input.required<MonthlyTrend[]>();
  readonly dayOfWeek = input.required<DayOfWeek[]>();
  readonly streaks = input.required<ListeningStreak[]>();
  readonly lateNight = input.required<LateNightTrack[]>();
  readonly onRepeat = input.required<OnRepeatEntry[]>();
  readonly songOfMonth = input.required<SongOfMonth[]>();
  readonly favoriteDecades = input.required<FavoriteDecade[]>();
  readonly recapData = input.required<RecapData | null>();

  coverUrl(id: string, size = 150): string {
    return this.navidrome.coverUrl(id, size);
  }

  readonly currentGradient = computed(() => this.selectedDef()?.gradient ?? '');

  readonly yearLabel = computed(() => {
    const y = this.selectedYear();
    return y === 'all-time' ? 'All Time' : y;
  });

  readonly coverArtAvailable = this.navidrome.coverArtAvailable;

  formatNum(n: number): string {
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }

  padHour(h: number): string {
    return String(h).padStart(2, '0');
  }

  formatMonth(month: string): string {
    const [_, m] = month.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[parseInt(m, 10) - 1] ?? month;
  }

  genreBarWidth(plays: number): number {
    return this.maxGenrePlays() > 0 ? (plays / this.maxGenrePlays()) * 100 : 0;
  }

  clockBarWidth(plays: number): number {
    return this.maxClockPlays() > 0 ? (plays / this.maxClockPlays()) * 100 : 0;
  }

  dayBarWidth(plays: number): number {
    return this.maxDayPlays() > 0 ? (plays / this.maxDayPlays()) * 100 : 0;
  }

  decadeBarWidth(plays: number): number {
    return this.maxDecadePlays() > 0 ? (plays / this.maxDecadePlays()) * 100 : 0;
  }
}
