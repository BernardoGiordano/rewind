import { Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { DominantColorService } from '../../services/dominant-color.service';
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
  selector: 'app-cards-square',
  imports: [CardShellComponent, SlicePipe],
  templateUrl: './cards-square.html',
})
export class CardsSquare {
  readonly el = inject(ElementRef<HTMLElement>);
  private readonly navidrome = inject(NavidromeService);
  private readonly dominantColor = inject(DominantColorService);

  readonly dynamicGradientStyle = signal<string | null>(null);

  readonly heroCoverId = computed<string | undefined>(() => {
    switch (this.selectedStat()) {
      case 'top-songs': return this.topSongs()[0]?.album_id;
      case 'top-artists': return this.topArtists()[0]?.artist_id;
      case 'top-albums': return this.topAlbums()[0]?.album_id;
      case 'late-night': return this.lateNight()[0]?.album_id;
      case 'recap': return this.recapData()?.top_artist?.artist_id;
      default: return undefined;
    }
  });

  constructor() {
    effect(() => {
      const id = this.heroCoverId();
      if (!id || !this.coverArtAvailable()) {
        this.dynamicGradientStyle.set(null);
        return;
      }
      const url = this.coverUrl(id, 200);
      this.dominantColor.gradientFor(url).then((g) => {
        if (this.heroCoverId() === id) {
          this.dynamicGradientStyle.set(g);
        }
      });
    });
  }

  readonly maxGenrePlays = input.required<number>();
  readonly maxClockPlays = input.required<number>();
  readonly maxDayPlays = input.required<number>();
  readonly maxDecadePlays = input.required<number>();

  readonly selectedDef = input.required<StatDefinition | undefined>();
  readonly rangeLabel = input.required<string>();
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

  readonly yearLabel = computed(() => this.rangeLabel());

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
