import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DecimalPipe, Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroCalendarDays,
  heroChartBar,
  heroClock,
  heroFire,
  heroMusicalNote,
  heroSquare3Stack3d,
  heroTrophy,
} from '@ng-icons/heroicons/outline';
import { NavidromeService, type StatRange } from '../../services/navidrome.service';
import type { ArtistDetail as ArtistDetailData } from '../../models/stats';
import { formatRangeLabel } from '../dashboard/dashboard';

type TabKey = 'overview' | 'patterns' | 'activity';

@Component({
  selector: 'app-artist-detail',
  templateUrl: './artist-detail.html',
  styleUrl: './artist-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, NgIcon],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroMusicalNote,
      heroSquare3Stack3d,
      heroClock,
      heroCalendarDays,
      heroChartBar,
      heroFire,
      heroTrophy,
    }),
  ],
})
export class ArtistDetail {
  private readonly navidrome = inject(NavidromeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly canGoBack = signal(false);

  readonly artistId = signal<string>('');
  readonly data = signal<ArtistDetailData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<TabKey>('overview');
  readonly darkMode = signal(false);

  readonly coverArtAvailable = this.navidrome.coverArtAvailable;

  readonly range = signal<StatRange>({ kind: 'all-time' });

  readonly rangeLabel = computed(() => {
    const r = this.range();
    if (r.kind === 'all-time') return 'All Time';
    if (r.kind === 'year') return r.year;
    return formatRangeLabel(r.from, r.to);
  });

  readonly dashboardQueryParams = computed<Record<string, string>>(() => {
    const r = this.range();
    if (r.kind === 'year') return { year: r.year };
    if (r.kind === 'custom') return { from: r.from, to: r.to };
    const out: Record<string, string> = { range: 'all-time' };
    return out;
  });

  // Derived heatmap: 7-day rows, Sunday-top, filling the selected range.
  // Empty days are rendered as 0-play cells so the most recent date is always on the right.
  readonly heatmapCells = computed(() => {
    const d = this.data();
    if (!d) return null;

    const range = this.range();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date;
    let end: Date;
    if (range.kind === 'year') {
      const y = parseInt(range.year, 10);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
      if (end > today) end = today;
    } else if (range.kind === 'custom') {
      start = parseIsoDate(range.from);
      end = parseIsoDate(range.to);
    } else {
      // all-time: from first scrobble (or 52 weeks ago if no data) up to today
      if (d.heatmap.length > 0) {
        start = parseIsoDate(d.heatmap[0].day);
      } else {
        start = new Date(today);
        start.setDate(start.getDate() - 52 * 7);
      }
      end = today;
    }
    if (end < start) return null;

    const byDay = new Map<string, number>();
    for (const h of d.heatmap) byDay.set(h.day, h.plays);

    // Snap start to previous Sunday
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    // Snap end to next Saturday
    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const cells: { date: string; plays: number; inRange: boolean }[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const iso = toIsoDate(cursor);
      const plays = byDay.get(iso) ?? 0;
      const inRange = cursor >= start && cursor <= end;
      cells.push({ date: iso, plays, inRange });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  });

  readonly heatmapMax = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.heatmap.reduce((m, h) => (h.plays > m ? h.plays : m), 0);
  });

  readonly heatmapTotalPlays = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.heatmap.reduce((sum, h) => sum + h.plays, 0);
  });

  readonly heatmapWeekCount = computed(() => {
    const cells = this.heatmapCells();
    if (!cells) return 0;
    return Math.ceil(cells.length / 7);
  });

  readonly heatmapMonthLabels = computed(() => {
    const cells = this.heatmapCells();
    if (!cells) return [];
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weeks = Math.ceil(cells.length / 7);
    const labels: { col: number; label: string }[] = [];
    let prevMonth = -1;
    for (let w = 0; w < weeks; w++) {
      // Use the first in-range day of the week (or first day if none)
      let monthCell = cells[w * 7];
      for (let dOff = 0; dOff < 7; dOff++) {
        const c = cells[w * 7 + dOff];
        if (c?.inRange) { monthCell = c; break; }
      }
      if (!monthCell) continue;
      const month = parseIsoDate(monthCell.date).getMonth();
      if (month !== prevMonth) {
        // Only label if this week has at least ~3 days in the new month so the label fits
        let inNewMonth = 0;
        for (let dOff = 0; dOff < 7; dOff++) {
          const c = cells[w * 7 + dOff];
          if (c && parseIsoDate(c.date).getMonth() === month) inNewMonth++;
        }
        if (inNewMonth >= 3 || w === 0) {
          labels.push({ col: w + 1, label: names[month] });
          prevMonth = month;
        }
      }
    }
    return labels;
  });

  readonly maxTrackPlays = computed(() => {
    const d = this.data();
    if (!d || d.top_tracks.length === 0) return 1;
    return d.top_tracks[0].plays;
  });

  readonly maxAlbumPlays = computed(() => {
    const d = this.data();
    if (!d || d.top_albums.length === 0) return 1;
    return d.top_albums[0].plays;
  });

  readonly maxClockPlays = computed(() => {
    const d = this.data();
    if (!d || d.listening_clock.length === 0) return 1;
    return Math.max(...d.listening_clock.map((c) => c.plays), 1);
  });

  readonly maxDayPlays = computed(() => {
    const d = this.data();
    if (!d || d.day_of_week.length === 0) return 1;
    return Math.max(...d.day_of_week.map((x) => x.plays), 1);
  });

  readonly rankMin = computed(() => {
    const d = this.data();
    if (!d || d.rank_trajectory.length === 0) return 1;
    return Math.min(...d.rank_trajectory.map((p) => p.rnk));
  });

  readonly rankMax = computed(() => {
    const d = this.data();
    if (!d || d.rank_trajectory.length === 0) return 1;
    return Math.max(...d.rank_trajectory.map((p) => p.rnk));
  });

  readonly rankPath = computed(() => {
    const d = this.data();
    if (!d || d.rank_trajectory.length < 2) return '';
    const points = d.rank_trajectory;
    const min = this.rankMin();
    const max = this.rankMax();
    const span = Math.max(max - min, 1);
    const w = 100;
    const h = 100;
    const segs = points.map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = ((p.rnk - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return segs.join(' ');
  });

  readonly libraryDepthPct = computed(() => {
    const d = this.data();
    if (!d || d.library_tracks === 0) return 0;
    return Math.round((d.played_tracks / d.library_tracks) * 1000) / 10;
  });

  readonly daysListening = computed(() => {
    const d = this.data();
    if (!d || !d.first_scrobble) return 0;
    const first = d.first_scrobble * 1000;
    const now = Date.now();
    return Math.max(1, Math.floor((now - first) / 86400000));
  });

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, query]) => {
        this.artistId.set(params.get('id') ?? '');
        const year = query.get('year');
        const from = query.get('from');
        const to = query.get('to');
        if (from && to) this.range.set({ kind: 'custom', from, to });
        else if (year) this.range.set({ kind: 'year', year });
        else this.range.set({ kind: 'all-time' });
        this.load();
      },
    );

    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        const navId = (window.history.state as { navigationId?: number } | null)?.navigationId;
        this.canGoBack.set(typeof navId === 'number' && navId > 1);

        const storedTheme = localStorage.getItem('rewind.theme');
        const prefersDark = storedTheme
          ? storedTheme === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.darkMode.set(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
      }
      this.navidrome.loadConfig();
    });
  }

  load(): void {
    const id = this.artistId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.navidrome.getArtist(id, this.range()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Failed to load artist');
        this.loading.set(false);
      },
    });
  }

  coverUrl(id: string, size = 300): string {
    return this.navidrome.coverUrl(id, size);
  }

  selectTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    if (this.canGoBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/'], { queryParams: this.dashboardQueryParams() });
    }
  }

  clockBarPct(plays: number): number {
    return (plays / this.maxClockPlays()) * 100;
  }

  dayBarPct(plays: number): number {
    return (plays / this.maxDayPlays()) * 100;
  }

  heatmapColor(cell: { plays: number; inRange: boolean }): string {
    if (!cell.inRange) return 'bg-transparent';
    const max = this.heatmapMax();
    if (cell.plays === 0 || max === 0) return 'bg-slate-200 dark:bg-slate-800';
    const pct = cell.plays / max;
    if (pct > 0.75) return 'bg-rose-500';
    if (pct > 0.5) return 'bg-rose-400';
    if (pct > 0.25) return 'bg-rose-300 dark:bg-rose-600';
    return 'bg-rose-200 dark:bg-rose-900';
  }

  formatMonth(month: string): string {
    const [y, m] = month.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(m, 10) - 1] ?? m} ${y.slice(2)}`;
  }

  formatDate(ts: number | null): string {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatRelative(ts: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return this.formatDate(ts);
  }

  padHour(h: number): string {
    return String(h).padStart(2, '0');
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('rewind.theme', next ? 'dark' : 'light');
    }
  }
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
