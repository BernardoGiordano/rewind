import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroCalendarDays,
  heroChartBar,
  heroClock,
  heroEllipsisHorizontalCircle,
  heroFire,
  heroHeart,
  heroMicrophone,
  heroMoon,
  heroMusicalNote,
  heroPause,
  heroPlay,
  heroRadio,
  heroSparkles,
  heroSquare3Stack3d,
  heroSun,
  heroTrophy,
} from '@ng-icons/heroicons/outline';
import { NavidromeService } from './services/navidrome.service';
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
  STAT_DEFINITIONS,
  type StatType,
  type TopAlbum,
  type TopArtist,
  type TopGenre,
  type TopSong,
} from './models/stats';
import { CardsPortrait } from './components/cards-portrait/cards-portrait';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CardsPortrait],
  providers: [
    provideIcons({
      heroMusicalNote,
      heroEllipsisHorizontalCircle,
      heroMicrophone,
      heroSquare3Stack3d,
      heroSparkles,
      heroClock,
      heroChartBar,
      heroCalendarDays,
      heroFire,
      heroMoon,
      heroArrowPath,
      heroTrophy,
      heroRadio,
      heroPlay,
      heroPause,
      heroSun,
      heroHeart,
    }),
  ],
})
export class App {
  private readonly navidrome = inject(NavidromeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly cardElement = viewChild<ElementRef<HTMLElement>>('cardElement');

  readonly darkMode = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly storiesMode = signal(true);
  readonly storiesPaused = signal(false);
  readonly storiesIndex = signal(0);
  readonly exporting = signal(false);

  private storiesTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly years = signal<string[]>([]);
  readonly selectedYear = signal<string>('all-time');
  readonly selectedStat = signal<StatType>('summary');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedDef = computed(() =>
    STAT_DEFINITIONS.find((d) => d.type === this.selectedStat()),
  );

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
  readonly recapData = signal<RecapData | null>(null);

  // Bar width helpers using max values
  protected maxGenrePlays = 0;
  protected maxClockPlays = 0;
  protected maxDayPlays = 0;
  protected maxDecadePlays = 0;

  readonly visibleStats = computed(() => {
    const year = this.selectedYear();
    return STAT_DEFINITIONS.filter((d) => !d.yearOnly || year !== 'all-time');
  });

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.darkMode.set(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
      }
      this.navidrome.loadConfig();
      this.navidrome.getYears().subscribe({
        next: (years) => {
          this.years.set(years);
          if (years.length > 0) {
            this.selectedYear.set(years[0]);
          }
          this.loadData();
          this.startStories();
        },
        error: () => {
          this.loadData();
          this.startStories();
        },
      });
    });

    this.destroyRef.onDestroy(() => this.clearStoriesTimer());
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', next);
    }
  }

  toggleStoriesMode(): void {
    this.mobileMenuOpen.set(false);
    if (this.storiesMode()) {
      this.stopStories();
    } else {
      this.startStories();
    }
  }

  storiesNext(): void {
    if (!this.storiesMode()) return;
    this.storiesPaused.set(false);
    this.advanceStories();
  }

  storiesPrev(): void {
    const stats = this.visibleStats();
    const prev = Math.max(0, this.storiesIndex() - 1);
    this.storiesIndex.set(prev);
    this.selectStat(stats[prev].type);
    this.storiesPaused.set(false);
    if (this.storiesMode()) {
      this.runStoriesTimer();
    }
  }

  toggleStoriesPause(): void {
    if (this.storiesPaused()) {
      this.storiesPaused.set(false);
      this.runStoriesTimer();
    } else {
      this.storiesPaused.set(true);
      this.clearStoriesTimer();
    }
  }

  startStories(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const stats = this.visibleStats();
    const currentType = this.selectedStat();
    const idx = stats.findIndex((s) => s.type === currentType);
    this.storiesIndex.set(idx >= 0 ? idx : 0);
    this.storiesMode.set(true);
    this.storiesPaused.set(false);
    this.runStoriesTimer();
  }

  private stopStories(): void {
    this.storiesMode.set(false);
    this.storiesPaused.set(false);
    this.clearStoriesTimer();
  }

  private clearStoriesTimer(): void {
    if (this.storiesTimeout !== null) {
      clearTimeout(this.storiesTimeout);
      this.storiesTimeout = null;
    }
  }

  private runStoriesTimer(): void {
    this.clearStoriesTimer();
    this.storiesTimeout = setTimeout(() => {
      this.advanceStories();
    }, 10000);
  }

  private advanceStories(): void {
    const stats = this.visibleStats();
    const next = (this.storiesIndex() + 1) % stats.length;
    this.storiesIndex.set(next);
    this.selectStat(stats[next].type);
    this.runStoriesTimer();
  }

  selectYear(year: string): void {
    this.selectedYear.set(year);
    const stat = this.selectedStat();
    const def = STAT_DEFINITIONS.find((d) => d.type === stat);
    if (def?.yearOnly && year === 'all-time') {
      this.selectedStat.set('summary');
    }
    this.loadData();
  }

  selectStat(type: StatType): void {
    this.selectedStat.set(type);
    // If stories mode is active and the user clicks a sidebar item, sync the index & restart timer
    if (this.storiesMode()) {
      const stats = this.visibleStats();
      const idx = stats.findIndex((s) => s.type === type);
      if (idx >= 0 && idx !== this.storiesIndex()) {
        this.storiesIndex.set(idx);
        this.storiesPaused.set(false);
        this.runStoriesTimer();
      }
    }
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

    this.exporting.set(true);
    // Allow Angular to re-render (removes rounded corners via noRound input)
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      ignoreElements: (element) => element.classList.contains('export-ignore'),
    });

    this.exporting.set(false);

    const link = document.createElement('a');
    link.download = `navidrome-rewind-${this.selectedStat()}-${this.selectedYear()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
        this.maxGenrePlays = Math.max(...genres.map((g) => g.plays), 1);
        break;
      }
      case 'listening-clock': {
        const clock = data as ListeningClock[];
        this.listeningClock.set(clock);
        this.maxClockPlays = Math.max(...clock.map((c) => c.plays), 1);
        break;
      }
      case 'monthly-trends':
        this.monthlyTrends.set(data as MonthlyTrend[]);
        break;
      case 'day-of-week': {
        const days = data as DayOfWeek[];
        this.dayOfWeek.set(days);
        this.maxDayPlays = Math.max(...days.map((d) => d.plays), 1);
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
        this.maxDecadePlays = Math.max(...decades.map((d) => d.total_plays), 1);
        break;
      }
      case 'recap':
        this.recapData.set(data as RecapData);
        break;
    }
  }
}
