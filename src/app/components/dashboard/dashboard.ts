import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
  heroChevronLeft,
  heroChevronRight,
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
import { ActivatedRoute, Router } from '@angular/router';
import { NavidromeService, type StatRange } from '../../services/navidrome.service';
import { DateRangePicker } from '../date-range-picker/date-range-picker';
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
} from '../../models/stats';
import { CardsPortrait } from '../cards-portrait/cards-portrait';
import { CardsSquare } from '../cards-square/cards-square';
import { CardsLandscape } from '../cards-landscape/cards-landscape';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CardsPortrait, CardsSquare, CardsLandscape, DateRangePicker],
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
      heroChevronLeft,
      heroChevronRight,
    }),
  ],
})
export class Dashboard {
  private readonly navidrome = inject(NavidromeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  openArtist(artistId: string | null | undefined): void {
    if (!artistId) return;
    const queryParams = this.artistQueryParams();
    this.router.navigate(['/artist', artistId], { queryParams });
  }

  private artistQueryParams(): Record<string, string> {
    const y = this.selectedYear();
    if (y === 'all-time') return {};
    if (y === 'custom') {
      const r = this.customRange();
      return r ? { from: r.from, to: r.to } : {};
    }
    return { year: y };
  }

  readonly squareCard = viewChild(CardsSquare);
  readonly portraitCard = viewChild(CardsPortrait);
  readonly landscapeCard = viewChild(CardsLandscape);

  readonly darkMode = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly cardMode = signal<'portrait' | 'square' | 'landscape'>('portrait');
  readonly isSmallScreen = signal(false);
  readonly storiesMode = signal(true);
  readonly sidebarCollapsed = signal(false);
  readonly storiesPaused = signal(false);
  readonly storiesIndex = signal(0);
  readonly exporting = signal(false);

  private storiesTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly years = signal<string[]>([]);
  readonly selectedYear = signal<string>('all-time');
  readonly customRange = signal<{ from: string; to: string } | null>(null);
  readonly customPickerOpen = signal(false);
  readonly selectedStat = signal<StatType>('summary');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rangeLabel = computed(() => {
    const y = this.selectedYear();
    if (y === 'all-time') return 'All Time';
    if (y === 'custom') {
      const r = this.customRange();
      return r ? formatRangeLabel(r.from, r.to) : 'Custom';
    }
    return y;
  });

  readonly selectedDef = computed(() =>
    STAT_DEFINITIONS.find((d) => d.type === this.selectedStat()),
  );

  readonly effectiveCardMode = computed(() =>
    this.isSmallScreen() ? 'portrait' : this.cardMode(),
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

  private currentRange(): StatRange {
    const y = this.selectedYear();
    if (y === 'all-time') return { kind: 'all-time' };
    if (y === 'custom') {
      const r = this.customRange();
      return r ? { kind: 'custom', from: r.from, to: r.to } : { kind: 'all-time' };
    }
    return { kind: 'year', year: y };
  }

  constructor() {
    afterNextRender(() => {
      let urlSelectedYear = false;
      if (isPlatformBrowser(this.platformId)) {
        const storedTheme = localStorage.getItem('rewind.theme');
        const prefersDark = storedTheme
          ? storedTheme === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.darkMode.set(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);

        const storedCardMode = localStorage.getItem('rewind.cardMode');
        if (
          storedCardMode === 'portrait' ||
          storedCardMode === 'square' ||
          storedCardMode === 'landscape'
        ) {
          this.cardMode.set(storedCardMode);
        }

        const storedStories = localStorage.getItem('rewind.storiesMode');
        if (storedStories !== null) {
          this.storiesMode.set(storedStories === 'true');
        }

        const storedSidebar = localStorage.getItem('rewind.sidebarCollapsed');
        if (storedSidebar !== null) {
          this.sidebarCollapsed.set(storedSidebar === 'true');
        }

        const storedRange = localStorage.getItem('rewind.customRange');
        if (storedRange) {
          try {
            const parsed = JSON.parse(storedRange) as { from: string; to: string };
            if (parsed?.from && parsed?.to) {
              this.customRange.set(parsed);
              this.selectedYear.set('custom');
            }
          } catch {
            // ignore corrupt entry
          }
        }

        // URL query params take priority over stored state (e.g. returning from artist detail)
        const qp = this.route.snapshot.queryParamMap;
        const urlFrom = qp.get('from');
        const urlTo = qp.get('to');
        const urlYear = qp.get('year');
        if (urlFrom && urlTo) {
          this.customRange.set({ from: urlFrom, to: urlTo });
          this.selectedYear.set('custom');
          urlSelectedYear = true;
        } else if (urlYear) {
          this.selectedYear.set(urlYear);
          urlSelectedYear = true;
        } else if (qp.get('range') === 'all-time') {
          this.selectedYear.set('all-time');
          urlSelectedYear = true;
        }

        const smallScreen = window.matchMedia('(max-width: 1023px)');
        this.isSmallScreen.set(smallScreen.matches);
        smallScreen.addEventListener('change', (e) => this.isSmallScreen.set(e.matches));
      }
      this.navidrome.loadConfig();
      const maybeStartStories = () => {
        if (this.storiesMode()) {
          this.startStories();
        }
      };
      this.navidrome.getYears().subscribe({
        next: (years) => {
          this.years.set(years);
          if (!urlSelectedYear && years.length > 0 && this.selectedYear() === 'all-time') {
            this.selectedYear.set(years[0]);
          }
          this.loadData();
          maybeStartStories();
        },
        error: () => {
          this.loadData();
          maybeStartStories();
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

  selectCardMode(mode: 'portrait' | 'square' | 'landscape'): void {
    this.cardMode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.cardMode', mode);
    }
  }

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.sidebarCollapsed', String(next));
    }
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('rewind.theme', next ? 'dark' : 'light');
    }
  }

  toggleStoriesMode(): void {
    this.mobileMenuOpen.set(false);
    if (this.storiesMode()) {
      this.stopStories();
    } else {
      this.startStories();
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.storiesMode', String(this.storiesMode()));
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

  toggleCustomPicker(): void {
    this.customPickerOpen.update((v) => !v);
  }

  closeCustomPicker(): void {
    this.customPickerOpen.set(false);
  }

  onCustomRangeSelected(range: { from: string; to: string }): void {
    this.customRange.set(range);
    this.selectedYear.set('custom');
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.customRange', JSON.stringify(range));
    }
    this.customPickerOpen.set(false);
    this.loadData();
  }

  onCustomRangeCleared(): void {
    this.customRange.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('rewind.customRange');
    }
    if (this.selectedYear() === 'custom') {
      const years = this.years();
      this.selectedYear.set(years.length > 0 ? years[0] : 'all-time');
      this.loadData();
    }
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
    const type = this.selectedStat();
    const range = this.currentRange();

    this.loading.set(true);
    this.error.set(null);

    this.navidrome.getStat(type, range).subscribe({
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
    const card = this.landscapeCard() ?? this.squareCard() ?? this.portraitCard();
    const el = card?.el.nativeElement;
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

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatRangeLabel(fromIso: string, toIso: string): string {
  const from = parseLocalIso(fromIso);
  const to = parseLocalIso(toIso);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  // Last week: rolling 7-day window ending today or yesterday
  const sevenAgo = new Date(today);
  sevenAgo.setDate(today.getDate() - 7);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const eightAgo = new Date(today);
  eightAgo.setDate(today.getDate() - 8);
  if (
    (sameDate(from, sevenAgo) && sameDate(to, today)) ||
    (sameDate(from, eightAgo) && sameDate(to, yesterday))
  ) {
    return 'Last Week';
  }

  // Last month (entire previous calendar month)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  if (sameDate(from, lastMonthStart) && sameDate(to, lastMonthEnd)) return 'Last Month';

  // Any full calendar month
  if (
    from.getDate() === 1 &&
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  ) {
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    if (sameDate(to, monthEnd)) {
      const year = from.getFullYear();
      return year === currentYear
        ? MONTH_FULL[from.getMonth()]
        : `${MONTH_FULL[from.getMonth()]} ${year}`;
    }
  }

  const sameYear = from.getFullYear() === to.getFullYear();
  const short = (d: Date) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  const withYear = (d: Date) => `${short(d)}, ${d.getFullYear()}`;

  if (sameYear) {
    const year = from.getFullYear();
    if (year === currentYear) return `${short(from)} – ${short(to)}`;
    return `${short(from)} – ${short(to)}, ${year}`;
  }
  return `${withYear(from)} – ${withYear(to)}`;
}
