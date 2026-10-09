import {
  computed,
  defineComponent,
  inject,
  navigate,
  resource,
  routeParams,
  signal,
  SignalElement,
} from '@srljs/core';

import { AppCover } from '../cover.js';
import { AppIcon } from '../icon/icon.js';
import { NAVIDROME } from '../../services/navidrome.js';
import { NAVIGATION_HISTORY } from '../../shell/navigation-history.js';
import { REWIND_RANGE } from '../../shell/rewind-range.js';
import { SECTION_REGISTRY } from '../../shell/section-registry.js';
import { MONTH_SHORT, parseIsoDate, toIsoDate } from '../../utils/format.js';
import { watch } from '../../utils/watch.js';

/** @import { ArtistDetail as ArtistDetailData } from '../../models/types.js' */

/** @typedef {'overview' | 'patterns' | 'activity'} TabKey */

/** @type {readonly { key: TabKey, label: string }[]} */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'activity', label: 'Activity' },
];

/** One artist's listening history over the Rewind range. */
export class ArtistDetail extends SignalElement {
  #navidrome = inject(NAVIDROME);
  #rewindRange = inject(REWIND_RANGE);

  tabs = TABS;

  artistId = computed(() => routeParams.value['id'] ?? '');
  activeTab = signal(/** @type {TabKey} */ ('overview'));

  /** The range is the Shell's; this page reads it and reloads when it moves. */
  range = this.#rewindRange.current;
  rangeLabel = this.#rewindRange.label;

  #artist = resource(
    (signal) => this.#navidrome.getArtist(this.artistId.value, this.range.value, signal),
    { initial: /** @type {ArtistDetailData | null} */ (null), lifetime: () => this.lifetime },
  );

  data = this.#artist.value;
  loading = this.#artist.pending;
  failed = this.#artist.failed;

  /**
   * Derived heatmap: 7-day rows, Sunday-top, filling the selected range. Empty days
   * are rendered as 0-play cells so the most recent date is always on the right.
   */
  heatmapCells = computed(() => {
    const d = this.data.value;
    if (!d) return null;

    const range = this.range.value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /** @type {Date} */
    let start;
    /** @type {Date} */
    let end;
    const firstDay = d.heatmap[0];
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
      if (firstDay) {
        start = parseIsoDate(firstDay.day);
      } else {
        start = new Date(today);
        start.setDate(start.getDate() - 52 * 7);
      }
      end = today;
    }
    if (end < start) return null;

    /** @type {Map<string, number>} */
    const byDay = new Map();
    for (const h of d.heatmap) byDay.set(h.day, h.plays);

    // Snap start to previous Sunday
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    // Snap end to next Saturday
    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    /** @type {{ date: string, plays: number, inRange: boolean }[]} */
    const cells = [];
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

  heatmapMax = computed(() => {
    const d = this.data.value;
    if (!d) return 0;
    return d.heatmap.reduce((m, h) => (h.plays > m ? h.plays : m), 0);
  });

  heatmapTotalPlays = computed(() => {
    const d = this.data.value;
    if (!d) return 0;
    return d.heatmap.reduce((sum, h) => sum + h.plays, 0);
  });

  heatmapWeekCount = computed(() => {
    const cells = this.heatmapCells.value;
    if (!cells) return 0;
    return Math.ceil(cells.length / 7);
  });

  heatmapMonthLabels = computed(() => {
    const cells = this.heatmapCells.value;
    if (!cells) return [];
    const weeks = Math.ceil(cells.length / 7);
    /** @type {{ col: number, label: string }[]} */
    const labels = [];
    let prevMonth = -1;
    for (let w = 0; w < weeks; w++) {
      // Use the first in-range day of the week (or first day if none)
      let monthCell = cells[w * 7];
      for (let dOff = 0; dOff < 7; dOff++) {
        const c = cells[w * 7 + dOff];
        if (c?.inRange) {
          monthCell = c;
          break;
        }
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
          labels.push({ col: w + 1, label: MONTH_SHORT[month] ?? '' });
          prevMonth = month;
        }
      }
    }
    return labels;
  });

  maxClockPlays = computed(() =>
    Math.max(...(this.data.value?.listening_clock ?? []).map((c) => c.plays), 1),
  );

  maxDayPlays = computed(() =>
    Math.max(...(this.data.value?.day_of_week ?? []).map((d) => d.plays), 1),
  );

  rankMin = computed(() => {
    const d = this.data.value;
    if (!d || d.rank_trajectory.length === 0) return 1;
    return Math.min(...d.rank_trajectory.map((p) => p.rnk));
  });

  rankMax = computed(() => {
    const d = this.data.value;
    if (!d || d.rank_trajectory.length === 0) return 1;
    return Math.max(...d.rank_trajectory.map((p) => p.rnk));
  });

  rankPath = computed(() => {
    const d = this.data.value;
    if (!d || d.rank_trajectory.length < 2) return '';
    const points = d.rank_trajectory;
    const min = this.rankMin.value;
    const max = this.rankMax.value;
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

  libraryDepthPct = computed(() => {
    const d = this.data.value;
    if (!d || d.library_tracks === 0) return 0;
    return Math.round((d.played_tracks / d.library_tracks) * 1000) / 10;
  });

  daysListening = computed(() => {
    const d = this.data.value;
    if (!d || !d.first_scrobble) return 0;
    const first = d.first_scrobble * 1000;
    const now = Date.now();
    return Math.max(1, Math.floor((now - first) / 86400000));
  });

  /** The first and last month of the rank chart, for its axis. */
  get firstRankMonth() {
    return this.data.value?.rank_trajectory[0]?.month ?? '';
  }

  get lastRankMonth() {
    return this.data.value?.rank_trajectory.at(-1)?.month ?? '';
  }

  /** The library's albums by this artist. */
  get libraryHref() {
    return `/library?kind=albums&artist=${encodeURIComponent(this.artistId.value)}`;
  }

  connectedCallback() {
    super.connectedCallback();

    // One load path: whatever moves the artist or the range, the fetch follows.
    watch(this, () => {
      void this.range.value;
      if (!this.artistId.value || !this.#rewindRange.ready.value) return;
      void this.#artist.reload();
    });
  }

  onMount() {
    this.#navidrome.loadConfig();
  }

  /** @param {TabKey} tab */
  selectTab(tab) {
    this.activeTab.value = tab;
  }

  openRangePanel() {
    this.#rewindRange.togglePanel();
  }

  /** Back where the user came from, or to the owning section when the page was deep-linked. */
  goBack() {
    if (inject(NAVIGATION_HISTORY).canGoBack) {
      history.back();
    } else {
      const route = inject(SECTION_REGISTRY).routeFor(location.pathname);
      void navigate(this.#rewindRange.hrefFor(route));
    }
  }

  /** @param {{ plays: number, inRange: boolean }} cell @returns {string} */
  heatmapColor(cell) {
    if (!cell.inRange) return 'bg-transparent';
    const max = this.heatmapMax.value;
    if (cell.plays === 0 || max === 0) return 'bg-fill';
    const pct = cell.plays / max;
    if (pct > 0.75) return 'bg-rose-500';
    if (pct > 0.5) return 'bg-rose-400';
    if (pct > 0.25) return 'bg-rose-300 dark:bg-rose-600';
    return 'bg-rose-200 dark:bg-rose-900';
  }

  /** @returns {string} */
  firstHeardLabel() {
    const d = this.data.value;
    if (!d?.first_scrobble) return 'No plays yet';
    return `First heard ${this.formatDate(d.first_scrobble)} · listening for ${this.daysListening.value} days`;
  }

  /** @param {number | null} ts @returns {string} */
  formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** @param {number} ts @returns {string} */
  formatRelative(ts) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return this.formatDate(ts);
  }
}

await defineComponent({
  tag: 'app-artist-detail',
  element: ArtistDetail,
  module: import.meta.url,
  uses: [AppIcon, AppCover],
});
