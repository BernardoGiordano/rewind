import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NavidromeService } from './services/navidrome.service';
import { CardShellComponent } from './components/card-shell';
import {
  type StatType,
  type TopSong,
  type TopArtist,
  type TopAlbum,
  type TopGenre,
  type ListeningSummary,
  type ListeningClock,
  type MonthlyTrend,
  type DayOfWeek,
  type ListeningStreak,
  type LateNightTrack,
  type OnRepeatEntry,
  type SongOfMonth,
  type FavoriteDecade,
  STAT_DEFINITIONS,
} from './models/stats';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardShellComponent],
})
export class App {
  private readonly navidrome = inject(NavidromeService);

  readonly cardElement = viewChild<ElementRef<HTMLElement>>('cardElement');

  readonly years = signal<string[]>([]);
  readonly selectedYear = signal<string>('all-time');
  readonly selectedStat = signal<StatType>('summary');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Stat data signals
  readonly summaryData = signal<ListeningSummary | null>(null);
  readonly topSongs = signal<TopSong[]>([]);
  readonly topArtists = signal<TopArtist[]>([]);
  readonly topAlbums = signal<TopAlbum[]>([]);
  readonly topGenres = signal<TopGenre[]>([]);
  readonly listeningClock = signal<ListeningClock[]>([]);
  readonly monthlyTrends = signal<MonthlyTrend[]>([]);
  readonly dayOfWeek = signal<DayOfWeek[]>([]);
  readonly streaks = signal<ListeningStreak[]>([]);
  readonly lateNight = signal<LateNightTrack[]>([]);
  readonly onRepeat = signal<OnRepeatEntry[]>([]);
  readonly songOfMonth = signal<SongOfMonth[]>([]);
  readonly favoriteDecades = signal<FavoriteDecade[]>([]);

  readonly visibleStats = computed(() => {
    const year = this.selectedYear();
    return STAT_DEFINITIONS.filter(d => !d.yearOnly || year !== 'all-time');
  });

  readonly selectedDef = computed(() =>
    STAT_DEFINITIONS.find(d => d.type === this.selectedStat()),
  );

  readonly currentGradient = computed(() => this.selectedDef()?.gradient ?? '');

  readonly yearLabel = computed(() => {
    const y = this.selectedYear();
    return y === 'all-time' ? 'All Time' : y;
  });

  // Bar width helpers using max values
  private maxGenrePlays = 0;
  private maxClockPlays = 0;
  private maxDayPlays = 0;
  private maxDecadePlays = 0;

  constructor() {
    afterNextRender(() => {
      this.navidrome.getYears().subscribe({
        next: (years) => {
          this.years.set(years);
          if (years.length > 0) {
            this.selectedYear.set(years[0]);
          }
          this.loadData();
        },
        error: () => this.loadData(),
      });
    });
  }

  selectYear(year: string): void {
    this.selectedYear.set(year);
    const stat = this.selectedStat();
    const def = STAT_DEFINITIONS.find(d => d.type === stat);
    if (def?.yearOnly && year === 'all-time') {
      this.selectedStat.set('summary');
    }
    this.loadData();
  }

  selectStat(type: StatType): void {
    this.selectedStat.set(type);
    this.loadData();
  }

  loadData(): void {
    const year = this.selectedYear();
    const type = this.selectedStat();
    const yearParam = year === 'all-time' ? null : year;

    this.loading.set(true);
    this.error.set(null);

    this.navidrome.getStat(type, yearParam).subscribe({
      next: (data) => {
        this.setStatData(type, data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Failed to load data');
        this.loading.set(false);
      },
    });
  }

  async exportCard(): Promise<void> {
    const el = this.cardElement()?.nativeElement;
    if (!el) return;

    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });

    const link = document.createElement('a');
    link.download = `navidrome-wrapped-${this.selectedStat()}-${this.selectedYear()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  formatNum(n: number): string {
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }

  padHour(h: number): string {
    return String(h).padStart(2, '0');
  }

  formatMonth(month: string): string {
    const [y, m] = month.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m, 10) - 1] ?? month;
  }

  genreBarWidth(plays: number): number {
    return this.maxGenrePlays > 0 ? (plays / this.maxGenrePlays) * 100 : 0;
  }

  clockBarWidth(plays: number): number {
    return this.maxClockPlays > 0 ? (plays / this.maxClockPlays) * 100 : 0;
  }

  dayBarWidth(plays: number): number {
    return this.maxDayPlays > 0 ? (plays / this.maxDayPlays) * 100 : 0;
  }

  decadeBarWidth(plays: number): number {
    return this.maxDecadePlays > 0 ? (plays / this.maxDecadePlays) * 100 : 0;
  }

  private setStatData(type: StatType, data: unknown): void {
    switch (type) {
      case 'summary':
        this.summaryData.set(data as ListeningSummary);
        break;
      case 'top-songs':
        this.topSongs.set(data as TopSong[]);
        break;
      case 'top-artists':
        this.topArtists.set(data as TopArtist[]);
        break;
      case 'top-albums':
        this.topAlbums.set(data as TopAlbum[]);
        break;
      case 'top-genres': {
        const genres = data as TopGenre[];
        this.topGenres.set(genres);
        this.maxGenrePlays = Math.max(...genres.map(g => g.plays), 1);
        break;
      }
      case 'listening-clock': {
        const clock = data as ListeningClock[];
        this.listeningClock.set(clock);
        this.maxClockPlays = Math.max(...clock.map(c => c.plays), 1);
        break;
      }
      case 'monthly-trends':
        this.monthlyTrends.set(data as MonthlyTrend[]);
        break;
      case 'day-of-week': {
        const days = data as DayOfWeek[];
        this.dayOfWeek.set(days);
        this.maxDayPlays = Math.max(...days.map(d => d.plays), 1);
        break;
      }
      case 'streak':
        this.streaks.set(data as ListeningStreak[]);
        break;
      case 'late-night':
        this.lateNight.set(data as LateNightTrack[]);
        break;
      case 'on-repeat':
        this.onRepeat.set(data as OnRepeatEntry[]);
        break;
      case 'song-of-month':
        this.songOfMonth.set(data as SongOfMonth[]);
        break;
      case 'favorite-decades': {
        const decades = data as FavoriteDecade[];
        this.favoriteDecades.set(decades);
        this.maxDecadePlays = Math.max(...decades.map(d => d.total_plays), 1);
        break;
      }
    }
  }
}
