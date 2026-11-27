import { computed, inject, locale, num, signal, SignalElement, t } from '@srljs/core';

import { DOMINANT_COLOR } from '../services/dominant-color.js';
import { NAVIDROME } from '../services/navidrome.js';
import { REWIND_RANGE } from '../shell/rewind-range.js';
import { REWIND_SORT } from '../shell/rewind-sort.js';
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
  #sort = inject(REWIND_SORT);

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

  /** Song of the month split in two, earlier months in the first half, for side-by-side columns. */
  songOfMonthColumns = computed(() => {
    const months = this.songOfMonth.value;
    const half = Math.ceil(months.length / 2);
    return [months.slice(0, half), months.slice(half)].filter((column) => column.length > 0);
  });

  /** All 24 hours, so a quiet hour shows as an empty bar instead of a missing one. */
  clock = computed(() => {
    const byHour = new Map(this.listeningClock.value.map((h) => [h.hour, h]));
    return Array.from(
      { length: 24 },
      /** @returns {ListeningClock} */
      (_, hour) => byHour.get(hour) ?? { hour, plays: 0, total_hours: 0 },
    );
  });

  /** True while ranked lists order by listening time instead of plays. */
  byTime = computed(() => this.#sort.current.value === 'time');

  /** Genre and decade bars measure the figure their list ranks by. */
  maxGenreValue = computed(() =>
    Math.max(...this.topGenres.value.map((g) => this.rankValue(g.plays, g.total_hours)), 0),
  );
  maxDecadeValue = computed(() =>
    Math.max(...this.favoriteDecades.value.map((d) => this.rankValue(d.total_plays, d.total_hours)), 0),
  );
  maxClockPlays = computed(() => Math.max(...this.listeningClock.value.map((c) => c.plays), 1));
  maxDayPlays = computed(() => Math.max(...this.dayOfWeek.value.map((d) => d.plays), 1));
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
   * The figure a ranked row is ordered by.
   *
   * @param {number} plays
   * @param {number} time
   * @returns {number}
   */
  rankValue(plays, time) {
    return this.byTime.value ? time : plays;
  }

  /**
   * A ranked row's play count and listening time on one line, the ranked one first,
   * such as `46 plays · 2.5h`.
   *
   * @param {number} plays
   * @param {string} time Formatted with its unit.
   * @returns {string}
   */
  figures(plays, time) {
    const count = t('cards.playsCompact', { count: plays });
    return this.byTime.value ? `${time} · ${count}` : `${count} · ${time}`;
  }

  /**
   * The header of a table's last column, which holds {@link lead}.
   *
   * @param {string} timeKey The message naming the time column, minutes or hours.
   * @returns {string}
   */
  leadHeader(timeKey) {
    return t(this.byTime.value ? timeKey : 'cards.columns.plays');
  }

  /**
   * The header of the column before it, which holds {@link trail}.
   *
   * @param {string} timeKey The message naming the time column, minutes or hours.
   * @returns {string}
   */
  trailHeader(timeKey) {
    return t(this.byTime.value ? 'cards.columns.plays' : timeKey);
  }

  /**
   * The figure a ranked row is ordered by, for the end of the row or a table's last
   * column. Plays show as a bare number, as the column or the #1 entry names them.
   *
   * @param {number} plays
   * @param {string} time Formatted with its unit.
   * @returns {string}
   */
  lead(plays, time) {
    return this.byTime.value ? time : num(plays);
  }

  /**
   * The other figure, set smaller under {@link lead}.
   *
   * @param {number} plays
   * @param {string} time Formatted with its unit.
   * @returns {string}
   */
  trail(plays, time) {
    return this.byTime.value ? num(plays) : time;
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
    return multiYear
      ? formatYearMonthWithYear(yearMonth, locale.value)
      : formatYearMonth(yearMonth, locale.value);
  }
}
