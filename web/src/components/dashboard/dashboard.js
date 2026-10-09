import {
  computed,
  currentPath,
  defineComponent,
  inject,
  navigate,
  queryParams,
  signal,
  SignalElement,
  untracked,
} from '@srljs/core';

import { AppCardsLandscape } from '../cards-landscape/cards-landscape.js';
import { AppCardsPortrait } from '../cards-portrait/cards-portrait.js';
import { AppCardsSquare } from '../cards-square/cards-square.js';
import { AppIcon } from '../icon/icon.js';
import { NAVIDROME } from '../../services/navidrome.js';
import { LAYOUT } from '../../shell/layout-mode.js';
import { REWIND_RANGE } from '../../shell/rewind-range.js';
import { SHELL } from '../../shell/shell-state.js';
import { DASHBOARD } from './dashboard-state.js';
import { DashboardMenuActions } from './menu-actions.js';
import { DashboardRailControls } from './rail-controls.js';
import { DashboardRailTools } from './rail-tools.js';
import { AppStatSheet } from './stat-sheet.js';
import { STAT_NAVIGATOR } from './stat-navigator.js';
import { STAT_STORE } from './stat-store.js';
import { STAT_PARAM } from './stat-traversal.js';
import { watch } from '../../utils/watch.js';

/** @import { StatType } from '../../models/types.js' */

/** Horizontal travel that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 48;

const SIDEBAR_KEY = 'rewind.sidebarCollapsed';
const SONGS_STATS_KEY = 'rewind.songsStatsCollapsed';

/** The listening-stats page: the stat list, the card and its controls. */
export class Dashboard extends SignalElement {
  #nav = inject(STAT_NAVIGATOR);
  #range = inject(REWIND_RANGE);
  #layout = inject(LAYOUT);
  #shell = inject(SHELL);
  #store = inject(STAT_STORE);
  #state = inject(DASHBOARD);

  /** Expanded keeps the sidebar pinned and remembers it; medium opens the same panel as a drawer. */
  sidebarCollapsed = signal(localStorage.getItem(SIDEBAR_KEY) === 'true');
  drawerOpen = signal(false);
  songsStatsCollapsed = signal(localStorage.getItem(SONGS_STATS_KEY) === 'true');
  statSheetOpen = signal(false);

  // Stat selection, ordering, autoplay and URL sync live in the navigator.
  stats = this.#nav.list;
  selectedStat = this.#nav.current;
  statIndex = this.#nav.index;
  autoplay = this.#nav.autoplay;
  autoplayPaused = this.#nav.paused;

  rangeLabel = this.#range.label;
  loading = this.#store.loading;
  error = this.#store.error;

  selectedDef = computed(() => this.#nav.definition.value ?? undefined);

  /** A compact viewport has no room for anything but the portrait card. */
  effectiveCardMode = computed(() =>
    this.#layout.isCompact.value ? 'portrait' : this.#state.cardMode.value,
  );

  /** Whether the panel is on screen right now. Only the handle's label and icon read it. */
  sidebarShowing = computed(() =>
    this.#layout.isExpanded.value ? !this.sidebarCollapsed.value : this.drawerOpen.value,
  );

  /** @type {{ x: number, y: number } | null} */
  #swipeStart = null;

  connectedCallback() {
    super.connectedCallback();
    const navidrome = inject(NAVIDROME);

    // The navigator restores its selection once the range that filters the list is settled.
    const ready = signal(false);
    watch(this, () => {
      if (!this.#range.ready.value || untracked(() => ready.value)) return;
      untracked(() => {
        this.#nav.restore(queryParams.value.get(STAT_PARAM));
        ready.value = true;
      });
    });

    // One load path: whatever moves the selection, the range or the history, the
    // fetch follows. Data still held for what is on screen is shown as it is.
    watch(this, () => {
      const type = this.#nav.current.value;
      const range = this.#range.current.value;
      void navidrome.historyVersion.value;
      if (!ready.value) return;
      untracked(() => {
        if (!this.#store.holds(type, range)) void this.#store.load(type, range);
      });
    });

    // A landscape card runs the full width, so the Shell's corner credit steps aside.
    watch(this, () => {
      const quiet = this.effectiveCardMode.value !== 'landscape';
      if (untracked(() => currentPath.value) === '/') this.#shell.setQuietCorner(quiet);
    });

    document.addEventListener('keydown', (event) => this.#onKeydown(event), {
      signal: this.lifetime,
    });
  }

  onMount() {
    this.#shell.setRouteChrome({
      menu: { tag: DashboardMenuActions },
      railTools: { tag: DashboardRailTools },
      railControls: { tag: DashboardRailControls },
    });
    this.#shell.setQuietCorner(this.effectiveCardMode.value !== 'landscape');
    inject(NAVIDROME).loadConfig();
  }

  /**
   * A card asked to open the artist behind a row.
   *
   * @param {Event} event
   */
  onArtistClick(event) {
    const artistId = event instanceof CustomEvent ? event.detail : null;
    if (typeof artistId !== 'string' || !artistId) return;
    void navigate(this.#range.hrefFor(`/artist/${encodeURIComponent(artistId)}`));
  }

  toggleSidebar() {
    if (!this.#layout.isExpanded.value) {
      this.drawerOpen.value = !this.drawerOpen.value;
      return;
    }
    const next = !this.sidebarCollapsed.value;
    this.sidebarCollapsed.value = next;
    localStorage.setItem(SIDEBAR_KEY, String(next));
  }

  closeDrawer() {
    this.drawerOpen.value = false;
  }

  toggleSongsStats() {
    const next = !this.songsStatsCollapsed.value;
    this.songsStatsCollapsed.value = next;
    localStorage.setItem(SONGS_STATS_KEY, String(next));
  }

  openStatSheet() {
    this.statSheetOpen.value = true;
  }

  closeStatSheet() {
    this.statSheetOpen.value = false;
  }

  /** @param {StatType} type */
  selectStat(type) {
    this.#nav.select(type);
    this.closeDrawer();
  }

  nextStat() {
    this.#nav.next();
  }

  prevStat() {
    this.#nav.prev();
  }

  toggleAutoplayPause() {
    this.#nav.togglePause();
  }

  exportCard() {
    void this.#state.exportCard();
  }

  /** Re-runs the current request, for retry after an error. */
  reload() {
    void this.#store.load(this.#nav.current.value, this.#range.current.value);
  }

  // Touch adapter: a horizontal drag across the card steps to the neighbouring stat.

  /** @param {PointerEvent} event */
  onCardPointerDown(event) {
    this.#swipeStart = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  }

  /** @param {PointerEvent} event */
  onCardPointerUp(event) {
    const start = this.#swipeStart;
    this.#swipeStart = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0) this.#nav.next();
    else this.#nav.prev();
  }

  onCardPointerCancel() {
    this.#swipeStart = null;
  }

  /** @param {KeyboardEvent} event */
  #onKeydown(event) {
    if (event.key === 'Escape') {
      this.closeDrawer();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.#range.panelOpen.value || this.statSheetOpen.value || this.#shell.menuOpen.value) return;
    if (this.drawerOpen.value) return;

    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    event.preventDefault();
    if (event.key === 'ArrowLeft') this.#nav.prev();
    else this.#nav.next();
  }
}

await defineComponent({
  tag: 'app-dashboard',
  element: Dashboard,
  module: import.meta.url,
  uses: [AppIcon, AppCardsPortrait, AppCardsSquare, AppCardsLandscape, AppStatSheet],
});
