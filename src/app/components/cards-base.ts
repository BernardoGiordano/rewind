import { Directive, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { DominantColorService } from '../services/dominant-color.service';
import { NavidromeService } from '../services/navidrome.service';
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
} from '../models/stats';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

@Directive()
export abstract class CardsBase {
  readonly el = inject(ElementRef<HTMLElement>);
  private readonly navidrome = inject(NavidromeService);
  private readonly dominantColor = inject(DominantColorService);

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

  readonly maxGenrePlays = computed(() => Math.max(...this.topGenres().map((g) => g.plays), 1));
  readonly maxClockPlays = computed(() => Math.max(...this.listeningClock().map((c) => c.plays), 1));
  readonly maxDayPlays = computed(() => Math.max(...this.dayOfWeek().map((d) => d.plays), 1));
  readonly maxDecadePlays = computed(() => Math.max(...this.favoriteDecades().map((d) => d.total_plays), 1));

  readonly dynamicGradientStyle = signal<string | null>(null);
  readonly coverArtAvailable = this.navidrome.coverArtAvailable;

  readonly currentGradient = computed(() => this.selectedDef()?.gradient ?? '');
  readonly yearLabel = computed(() => this.rangeLabel());

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

  coverUrl(id: string, size = 150): string {
    return this.navidrome.coverUrl(id, size);
  }

  formatNum(n: number): string {
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }

  padHour(h: number): string {
    return String(h).padStart(2, '0');
  }

  formatMonth(month: string): string {
    const [, m] = month.split('-');
    return MONTH_SHORT[parseInt(m, 10) - 1] ?? month;
  }

  genreBarWidth(plays: number): number {
    return (plays / this.maxGenrePlays()) * 100;
  }

  clockBarWidth(plays: number): number {
    return (plays / this.maxClockPlays()) * 100;
  }

  dayBarWidth(plays: number): number {
    return (plays / this.maxDayPlays()) * 100;
  }

  decadeBarWidth(plays: number): number {
    return (plays / this.maxDecadePlays()) * 100;
  }
}
