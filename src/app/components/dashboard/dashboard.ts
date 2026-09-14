import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroCalendarDays,
  heroChartBar,
  heroChevronDown,
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
  heroTrophy,
} from '@ng-icons/heroicons/outline';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { NavidromeService, type StatRange } from '../../services/navidrome.service';
import { LayoutModeService } from '../../shell/layout-mode';
import { ShellService } from '../../shell/shell.service';
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
  type StatType,
  type TopAlbum,
  type TopArtist,
  type TopGenre,
  type TopSong,
} from '../../models/stats';
import { CardsPortrait } from '../cards-portrait/cards-portrait';
import { CardsSquare } from '../cards-square/cards-square';
import { CardsLandscape } from '../cards-landscape/cards-landscape';
import { MONTH_FULL, MONTH_SHORT, parseIsoDate } from '../../utils/format';
import { StatNavigator } from './stat-navigator';
import { STAT_PARAM } from './stat-traversal';
import { StatSheet } from './stat-sheet';

/** Horizontal travel that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 48;

@Component({
  selector: 'app-dashboard',
  host: { class: 'block h-full' },
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CardsPortrait, CardsSquare, CardsLandscape, DateRangePicker, StatSheet],
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
      heroHeart,
      heroChevronDown,
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
  private readonly shell = inject(ShellService);
  private readonly nav = inject(StatNavigator);
  private readonly layout = inject(LayoutModeService);

  /** Dashboard-only controls the Shell renders inside its compact menu. */
  readonly shellActions = viewChild<TemplateRef<unknown>>('shellActions');

  closeShellMenu(): void {
    this.shell.closeMenu();
  }

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

  readonly cardMode = signal<'portrait' | 'square' | 'landscape'>('portrait');

  /** Expanded keeps the sidebar pinned and remembers it; medium opens the same panel as a drawer. */
  readonly sidebarCollapsed = signal(false);
  readonly drawerOpen = signal(false);
  readonly songsStatsCollapsed = signal(false);
  readonly statSheetOpen = signal(false);
  readonly exporting = signal(false);

  // Stat selection, ordering, autoplay and URL sync live in the navigator.
  readonly stats = this.nav.list;
  readonly selectedStat = this.nav.current;
  readonly statIndex = this.nav.index;
  readonly autoplay = this.nav.autoplay;
  readonly autoplayPaused = this.nav.paused;

  readonly years = signal<string[]>([]);
  readonly selectedYear = signal<string>('all-time');
  readonly customRange = signal<{ from: string; to: string } | null>(null);
  readonly customPickerOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Data loads once the browser has resolved the stored range, not during SSR. */
  private readonly ready = signal(false);

  private swipeStart: { x: number; y: number } | null = null;

  readonly rangeLabel = computed(() => {
    const y = this.selectedYear();
    if (y === 'all-time') return 'All Time';
    if (y === 'custom') {
      const r = this.customRange();
      return r ? formatRangeLabel(r.from, r.to) : 'Custom';
    }
    return y;
  });

  readonly selectedDef = computed(() => this.nav.definition() ?? undefined);

  /** A compact viewport has no room for anything but the portrait card. */
  readonly effectiveCardMode = computed(() =>
    this.layout.isCompact() ? 'portrait' : this.cardMode(),
  );

  /**
   * Sidebar width per layout mode. `sidebarCollapsed` drives the expanded
   * classes and `drawerOpen` the medium ones, so the server renders the
   * sidebar pinned at expanded and the drawer closed at medium without
   * knowing the viewport.
   */
  readonly sidebarClasses = computed(() => {
    const expanded = this.sidebarCollapsed()
      ? 'expanded:w-0 expanded:border-r-0 expanded:blur-sm'
      : 'expanded:w-72 wide:w-80';
    const medium = this.drawerOpen()
      ? 'medium:w-72 medium:shadow-xl'
      : 'medium:w-0 medium:border-r-0';
    return `${expanded} ${medium}`;
  });

  /** Expanded pushes the card aside; medium overlays it, so only expanded gets a margin. */
  readonly mainClasses = computed(() =>
    this.sidebarCollapsed() ? 'expanded:ml-0' : 'expanded:ml-72 wide:ml-80',
  );

  /**
   * Whether the panel is on screen right now. Only the handle's label and icon
   * read it, so a correction on hydration costs nothing but an icon flip.
   */
  readonly sidebarShowing = computed(() =>
    this.layout.isExpanded() ? !this.sidebarCollapsed() : this.drawerOpen(),
  );

  /** The collapse handle rides the sidebar's right edge in whichever mode is showing it. */
  readonly sidebarToggleClasses = computed(() => {
    const expanded = this.sidebarCollapsed()
      ? 'expanded:left-16'
      : 'expanded:left-[22rem] wide:left-[24rem]';
    const medium = this.drawerOpen() ? 'medium:left-[22rem]' : 'medium:left-16';
    return `${expanded} ${medium}`;
  });

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
    // One load path: whatever moves the selection or the range, the fetch follows.
    effect(() => {
      const type = this.nav.current();
      const range = this.currentRange();
      if (!this.ready()) return;
      this.fetchStat(type, range);
    });

    this.navidrome.historyChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.navidrome
        .getYears()
        .subscribe({ next: (years) => this.years.set(years), error: () => {} });
      this.reload();
    });
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd && event.urlAfterRedirects.split('?')[0] === '/') {
        this.shell.setRouteActions(this.shellActions() ?? null);
      }
    });
    afterNextRender(() => {
      this.shell.setRouteActions(this.shellActions() ?? null);
      let urlSelectedYear = false;
      if (isPlatformBrowser(this.platformId)) {
        const storedCardMode = localStorage.getItem('rewind.cardMode');
        if (
          storedCardMode === 'portrait' ||
          storedCardMode === 'square' ||
          storedCardMode === 'landscape'
        ) {
          this.cardMode.set(storedCardMode);
        }

        const storedSidebar = localStorage.getItem('rewind.sidebarCollapsed');
        if (storedSidebar !== null) {
          this.sidebarCollapsed.set(storedSidebar === 'true');
        }

        const storedSongsStats = localStorage.getItem('rewind.songsStatsCollapsed');
        if (storedSongsStats !== null) {
          this.songsStatsCollapsed.set(storedSongsStats === 'true');
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
      }
      this.navidrome.loadConfig();
      const start = () => {
        this.nav.setAllTime(this.selectedYear() === 'all-time');
        this.nav.restore(this.route.snapshot.queryParamMap.get(STAT_PARAM));
        this.ready.set(true);
      };
      this.navidrome.getYears().subscribe({
        next: (years) => {
          this.years.set(years);
          if (!urlSelectedYear && years.length > 0 && this.selectedYear() === 'all-time') {
            this.selectedYear.set(years[0]);
          }
          start();
        },
        error: () => start(),
      });
    });
  }

  selectCardMode(mode: 'portrait' | 'square' | 'landscape'): void {
    this.cardMode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.cardMode', mode);
    }
  }

  toggleSidebar(): void {
    if (!this.layout.isExpanded()) {
      this.drawerOpen.update((open) => !open);
      return;
    }
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.sidebarCollapsed', String(next));
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleSongsStats(): void {
    const next = !this.songsStatsCollapsed();
    this.songsStatsCollapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.songsStatsCollapsed', String(next));
    }
  }

  openStatSheet(): void {
    this.statSheetOpen.set(true);
  }

  closeStatSheet(): void {
    this.statSheetOpen.set(false);
  }

  selectStat(type: StatType): void {
    this.nav.select(type);
    this.closeDrawer();
  }

  nextStat(): void {
    this.nav.next();
  }

  prevStat(): void {
    this.nav.prev();
  }

  toggleAutoplay(): void {
    this.shell.closeMenu();
    this.nav.toggleAutoplay();
  }

  toggleAutoplayPause(): void {
    this.nav.togglePause();
  }

  // Touch adapter: a horizontal drag across the card steps to the neighbouring stat.
  onCardPointerDown(event: PointerEvent): void {
    this.swipeStart = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  }

  onCardPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0) this.nav.next();
    else this.nav.prev();
  }

  onCardPointerCancel(): void {
    this.swipeStart = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDrawer();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.customPickerOpen() || this.statSheetOpen() || this.shell.menuOpen()) return;
    if (this.drawerOpen()) return;

    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    event.preventDefault();
    if (event.key === 'ArrowLeft') this.nav.prev();
    else this.nav.next();
  }

  selectYear(year: string): void {
    this.selectedYear.set(year);
    this.nav.setAllTime(year === 'all-time');
    this.closeDrawer();
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
    this.nav.setAllTime(false);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rewind.customRange', JSON.stringify(range));
    }
    this.customPickerOpen.set(false);
  }

  onCustomRangeCleared(): void {
    this.customRange.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('rewind.customRange');
    }
    if (this.selectedYear() === 'custom') {
      const years = this.years();
      const year = years.length > 0 ? years[0] : 'all-time';
      this.selectedYear.set(year);
      this.nav.setAllTime(year === 'all-time');
    }
  }

  /** Re-runs the current request, for retry after an error and for fresh scrobbles. */
  reload(): void {
    this.fetchStat(this.nav.current(), this.currentRange());
  }

  private fetchStat(type: StatType, range: StatRange): void {
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
    link.download = `navidrome-rewind-${this.nav.current()}-${this.selectedYear()}.png`;
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
      case 'top-genres':
        this.topGenres.set(data as TopGenre[]);
        break;
      case 'listening-clock':
        this.listeningClock.set(data as ListeningClock[]);
        break;
      case 'monthly-trends':
        this.monthlyTrends.set(data as MonthlyTrend[]);
        break;
      case 'day-of-week':
        this.dayOfWeek.set(data as DayOfWeek[]);
        break;
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
      case 'favorite-decades':
        this.favoriteDecades.set(data as FavoriteDecade[]);
        break;
      case 'recap':
        this.recapData.set(data as RecapData);
        break;
    }
  }
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRangeLabel(fromIso: string, toIso: string): string {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);

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
