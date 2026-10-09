import { computed, inject, signal, SignalElement } from '@srljs/core';

import { DOMINANT_COLOR } from '../services/dominant-color.js';
import { NAVIDROME } from '../services/navidrome.js';
import { REWIND_RANGE } from '../shell/rewind-range.js';
import { STAT_NAVIGATOR } from './dashboard/stat-navigator.js';
import { STAT_STORE } from './dashboard/stat-store.js';
import { formatYearMonth, formatYearMonthWithYear } from '../utils/format.js';
import { watch } from '../utils/watch.js';

/** @import { ListeningClock } from '../models/types.js' */

/**
 * What every card aspect shares: the stat on screen, its data, and the gradient drawn
 * from the hero cover. Each aspect is a subclass with its own template.
 */
export class CardsBase extends SignalElement {
  #navidrome = inject(NAVIDROME);
  #store = inject(STAT_STORE);
  #nav = inject(STAT_NAVIGATOR);

  selectedStat = this.#nav.current;
  selectedDef = computed(() => this.#nav.definition.value ?? undefined);
  rangeLabel = inject(REWIND_RANGE).label;

  summaryData = this.#store.data.summary;
  topSongs = this.#store.data['top-songs'];
  topArtists = this.#store.data['top-artists'];
  topAlbums = this.#store.data['top-albums'];
  topGenres = this.#store.data['top-genres'];
  listeningClock = this.#store.data['listening-clock'];
  monthlyTrends = this.#store.data['monthly-trends'];
  dayOfWeek = this.#store.data['day-of-week'];
  streaks = this.#store.data.streak;
  lateNight = this.#store.data['late-night'];
  onRepeat = this.#store.data['on-repeat'];
  songOfMonth = this.#store.data['song-of-month'];
  favoriteDecades = this.#store.data['favorite-decades'];
  recapData = this.#store.data.recap;

  /** All 24 hours, so a quiet hour shows as an empty bar instead of a missing one. */
  clock = computed(() => {
    const byHour = new Map(this.listeningClock.value.map((h) => [h.hour, h]));
    return Array.from(
      { length: 24 },
      /** @returns {ListeningClock} */
      (_, hour) => byHour.get(hour) ?? { hour, plays: 0, total_hours: 0 },
    );
  });

  maxGenrePlays = computed(() => Math.max(...this.topGenres.value.map((g) => g.plays), 1));
  maxClockPlays = computed(() => Math.max(...this.listeningClock.value.map((c) => c.plays), 1));
  maxDayPlays = computed(() => Math.max(...this.dayOfWeek.value.map((d) => d.plays), 1));
  maxDecadePlays = computed(() => Math.max(...this.favoriteDecades.value.map((d) => d.total_plays), 1));
  maxMonthPlays = computed(() => Math.max(...this.monthlyTrends.value.map((m) => m.plays), 1));

  dynamicGradientStyle = signal(/** @type {string | null} */ (null));
  coverArtAvailable = this.#navidrome.coverArtAvailable;

  currentGradient = computed(() => this.selectedDef.value?.gradient ?? '');

  heroCoverId = computed(() => {
    switch (this.selectedStat.value) {
      case 'top-songs': return this.topSongs.value[0]?.album_id;
      case 'top-artists': return this.topArtists.value[0]?.artist_id;
      case 'top-albums': return this.topAlbums.value[0]?.album_id;
      case 'late-night': return this.lateNight.value[0]?.album_id;
      case 'recap': return this.recapData.value?.top_artist?.artist_id;
      default: return undefined;
    }
  });

  /** The first row of each ranked list, which the cards show larger. */
  get topSong() {
    return this.topSongs.value[0];
  }

  get topArtist() {
    return this.topArtists.value[0];
  }

  get topAlbum() {
    return this.topAlbums.value[0];
  }

  get bestStreak() {
    return this.streaks.value[0];
  }

  get recapTopArtist() {
    return this.recapData.value?.top_artist;
  }

  connectedCallback() {
    super.connectedCallback();
    watch(this, () => {
      const id = this.heroCoverId.value;
      if (!id || !this.coverArtAvailable.value) {
        this.dynamicGradientStyle.value = null;
        return;
      }
      const url = this.#navidrome.coverUrl(id, 200);
      void inject(DOMINANT_COLOR)
        .gradientFor(url)
        .then((gradient) => {
          if (this.heroCoverId.value === id) this.dynamicGradientStyle.value = gradient;
        });
    });
  }

  /**
   * Asks the host to open the artist behind a row.
   *
   * @param {string | null | undefined} artistId
   * @param {Event} [event]
   */
  openArtist(artistId, event) {
    if (!artistId) return;
    event?.stopPropagation();
    this.dispatchEvent(new CustomEvent('artist-click', { detail: artistId }));
  }

  /**
   * Enter on a focused row opens it, as a click does.
   *
   * @param {string | null | undefined} artistId
   * @param {KeyboardEvent} event
   */
  openArtistOnEnter(artistId, event) {
    if (event.key === 'Enter') this.openArtist(artistId, event);
  }

  /**
   * "Jan", or "Jan 25" once the list runs across more than one calendar year.
   *
   * @param {string} yearMonth
   * @param {readonly { month: string }[]} months
   * @returns {string}
   */
  monthLabel(yearMonth, months) {
    const year = months[0]?.month.slice(0, 4);
    const multiYear = months.some((m) => m.month.slice(0, 4) !== year);
    return multiYear ? formatYearMonthWithYear(yearMonth) : formatYearMonth(yearMonth);
  }
}
