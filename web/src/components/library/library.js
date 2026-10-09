import {
  computed,
  currentPath,
  defineComponent,
  dt,
  inject,
  navigate,
  queryParams,
  resource,
  signal,
  SignalElement,
  t,
  untracked,
} from '@srljs/core';

import { AppCover } from '../cover.js';
import { AppIcon } from '../icon/icon.js';
import { mergeParams } from '../../models/range.js';
import { API } from '../../services/api.js';
import { NAVIDROME } from '../../services/navidrome.js';
import { errorKey } from '../../utils/api-error.js';
import { watch } from '../../utils/watch.js';

/**
 * @typedef {'artists' | 'albums' | 'songs'} LibraryKind
 *
 * @typedef {object} Item
 * @property {string} id
 * @property {string} title
 * @property {string} [artist]
 * @property {string} [album]
 * @property {string} [album_id]
 * @property {string} [artist_id]
 * @property {string} [cover_id]
 * @property {number} [songs]
 * @property {number} [albums]
 * @property {number} [plays]
 * @property {number} [duration]
 * @property {number | null} [year]
 * @property {number} [disc_number]
 * @property {number} [track_number]
 *
 * @typedef {Item & { time: number, duration: number }} Entry
 * @typedef {{ kind: 'song' | 'album', id: string, title: string }} Selection
 * @typedef {{ status: string, confirmed: number, total: number, accepted?: boolean }} ScrobbleResult
 * @typedef {{ key: string, params?: Record<string, unknown> }} Message
 * @typedef {{ id: string, name: string, cover_id: string }} Named
 * @typedef {{ artist?: Named, album?: Named & { artist: string, artist_id: string } }} Context
 * @typedef {{ items: Item[], total: number, canScrobble: boolean, context?: Context }} LibraryPage
 */

const PAGE_SIZE = 50;
const LIBRARY_PATH = '/library';

/**
 * The text each kind of view needs. The sentences differ per kind because other languages
 * inflect around the noun.
 *
 * @type {Readonly<Record<LibraryKind, { labelKey: string, allKey: string, noMatchKey: string }>>}
 */
const KINDS = {
  artists: {
    labelKey: 'library.kinds.artists.label',
    allKey: 'library.kinds.artists.all',
    noMatchKey: 'library.kinds.artists.noMatch',
  },
  albums: {
    labelKey: 'library.kinds.albums.label',
    allKey: 'library.kinds.albums.all',
    noMatchKey: 'library.kinds.albums.noMatch',
  },
  songs: {
    labelKey: 'library.kinds.songs.label',
    allKey: 'library.kinds.songs.all',
    noMatchKey: 'library.kinds.songs.noMatch',
  },
};

/** @type {readonly { key: LibraryKind, labelKey: string }[]} */
const TABS = [
  { key: 'artists', labelKey: KINDS.artists.labelKey },
  { key: 'albums', labelKey: KINDS.albums.labelKey },
  { key: 'songs', labelKey: KINDS.songs.labelKey },
];

/** Date and time, such as `Oct 9, 2026, 3:00:07 PM`. */
const MEDIUM_DATE = /** @type {Intl.DateTimeFormatOptions} */ ({
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

/** Everything in the music library, played or not, and the manual scrobble dialog. */
export class Library extends SignalElement {
  #navidrome = inject(NAVIDROME);

  tabs = TABS;
  pageSize = PAGE_SIZE;

  kind = signal(/** @type {LibraryKind} */ ('artists'));
  kindText = computed(() => KINDS[this.kind.value]);
  offset = signal(0);

  /** Drill-down: the artist or album whose contents are listed, named by the server. */
  artist = signal('');
  album = signal('');
  search = signal('');

  #page = resource(
    (signal) =>
      /** @type {Promise<LibraryPage>} */ (
        inject(API).get(
          '/library',
          {
            kind: this.kind.value,
            q: this.search.value,
            offset: String(this.offset.value),
            artist: this.artist.value,
            album: this.album.value,
          },
          signal,
        )
      ),
    {
      initial: /** @type {LibraryPage} */ ({ items: [], total: 0, canScrobble: false }),
      lifetime: () => this.lifetime,
    },
  );

  items = computed(() => this.#page.value.value.items);
  total = computed(() => this.#page.value.value.total);
  canScrobble = computed(() => this.#page.value.value.canScrobble);
  context = computed(() => this.#page.value.value.context ?? {});
  loading = this.#page.pending;
  loadFailed = this.#page.failed;

  focused = computed(() => this.context.value.album ?? this.context.value.artist ?? null);
  focusIsAlbum = computed(() => !!this.context.value.album);
  contextAlbum = computed(() => this.context.value.album ?? null);

  /** The artist crumb, falling back to the album's own artist when browsing an album directly. */
  artistCrumb = computed(() => {
    const { artist, album } = this.context.value;
    if (artist) return { id: artist.id, name: artist.name };
    if (album?.artist_id) return { id: album.artist_id, name: album.artist };
    return null;
  });

  /** The standing hero is an introduction, so it yields once the user is searching or paging. */
  heroCollapsed = computed(() => this.offset.value > 0 || this.search.value.length > 0);

  rangeStart = computed(() => (this.total.value === 0 ? 0 : this.offset.value + 1));
  rangeEnd = computed(() => Math.min(this.offset.value + PAGE_SIZE, this.total.value));
  hasPrevious = computed(() => this.offset.value > 0);
  hasNext = computed(() => this.offset.value + PAGE_SIZE < this.total.value);

  // Scrobble dialog
  selection = signal(/** @type {Selection | null} */ (null));
  entries = signal(/** @type {Entry[]} */ ([]));
  busy = signal(false);
  submitted = signal(false);
  message = signal(/** @type {Message | null} */ (null));
  failed = signal(false);

  /** A message key, or empty when the preview has nothing to report. */
  previewError = signal('');
  listenedAt = signal('');
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  #requestId = '';

  /** @type {ReturnType<typeof setTimeout> | null} */
  #searchTimer = null;

  connectedCallback() {
    super.connectedCallback();

    // The URL is the state: every change of view is a navigation, and this follows it.
    watch(this, () => {
      const params = queryParams.value;
      if (currentPath.value !== LIBRARY_PATH) return;
      untracked(() => {
        const kind = params.get('kind');
        this.kind.value = kind === 'albums' || kind === 'songs' ? kind : 'artists';
        this.artist.value = params.get('artist') ?? '';
        this.album.value = params.get('album') ?? '';
        this.search.value = params.get('q') ?? '';
        this.offset.value = Math.max(0, Number(params.get('offset') ?? 0) || 0);
        this.querySelector('[data-scroller]')?.scrollTo({ top: 0 });
        this.load();
      });
    });

    this.lifetime.addEventListener('abort', () => this.#clearSearchTimer(), { once: true });
  }

  onMount() {
    this.#navidrome.loadConfig();
  }

  load() {
    void this.#page.reload();
  }

  /**
   * Each tab keeps whatever part of the drill-down still applies at its level.
   *
   * @param {LibraryKind} kind
   */
  browse(kind) {
    this.show(kind, kind === 'artists' ? '' : this.artist.value, kind === 'songs' ? this.album.value : '');
  }

  /**
   * Open an item one level deeper: artist to its albums, album to its songs.
   *
   * @param {Item} item
   */
  open(item) {
    if (this.kind.value === 'artists') this.show('albums', item.id, '');
    else this.show('songs', this.artist.value, item.id);
  }

  /**
   * @param {LibraryKind} kind
   * @param {string} artist
   * @param {string} album
   */
  show(kind, artist, album) {
    const query = mergeParams(new URLSearchParams(), {
      kind,
      q: this.search.value || null,
      artist: artist || null,
      album: album || null,
    });
    void navigate(`${LIBRARY_PATH}?${query.toString()}`);
  }

  /** @param {string} id @returns {string} */
  artistHref(id) {
    return `/artist/${encodeURIComponent(id)}`;
  }

  /** @param {string} value */
  onSearchInput(value) {
    this.search.value = value;
    this.#clearSearchTimer();
    this.#searchTimer = setTimeout(() => this.applySearch(), 300);
  }

  clearSearch() {
    this.search.value = '';
    this.#clearSearchTimer();
    this.applySearch();
  }

  /** @param {Event} event */
  submitSearch(event) {
    event.preventDefault();
    this.applySearch();
  }

  /** Search replaces the history entry so Back leaves the page, not each keystroke. */
  applySearch() {
    this.#clearSearchTimer();
    this.#navigateQuery({ q: this.search.value || null, offset: null }, true);
  }

  /** @param {number} offset */
  page(offset) {
    this.#navigateQuery({ offset: offset ? String(offset) : null }, false);
  }

  /**
   * @param {Readonly<Record<string, string | null>>} params
   * @param {boolean} replace
   */
  #navigateQuery(params, replace) {
    const query = mergeParams(new URLSearchParams(location.search), params).toString();
    void navigate(query === '' ? LIBRARY_PATH : `${LIBRARY_PATH}?${query}`, { replace });
  }

  #clearSearchTimer() {
    if (this.#searchTimer !== null) {
      clearTimeout(this.#searchTimer);
      this.#searchTimer = null;
    }
  }

  /**
   * The counts under a tile: the year, the songs, and the albums where they apply.
   *
   * @param {Item} item
   * @returns {string}
   */
  tileCounts(item) {
    const parts = [t('library.count.songs', { count: item.songs ?? 0 })];
    if (item.year) parts.unshift(String(item.year));
    if (item.albums !== undefined) parts.push(t('library.count.albums', { count: item.albums }));
    return parts.join(' · ');
  }

  /**
   * The day period follows a narrow no-break space, as CLDR's en-US pattern has it.
   *
   * @param {number} ms
   * @returns {string}
   */
  mediumDate(ms) {
    return dt(ms, MEDIUM_DATE).replace(/\s(AM|PM)$/u, '\u202f$1');
  }

  // --- Scrobble dialog ---

  /** @returns {HTMLDialogElement | null} */
  get #dialog() {
    const dialog = this.querySelector('[data-scrobble-dialog]');
    return dialog instanceof HTMLDialogElement ? dialog : null;
  }

  /**
   * @param {'song' | 'album'} kind
   * @param {string} id
   * @param {string} title
   */
  start(kind, id, title) {
    this.selection.value = { kind, id, title };
    const now = new Date();
    this.listenedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    this.entries.value = [];
    this.message.value = null;
    this.failed.value = false;
    this.previewError.value = '';
    this.submitted.value = false;
    this.#requestId =
      globalThis.crypto.randomUUID?.() ??
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    this.#dialog?.showModal();
    this.preview();
  }

  /** @param {string} value */
  setListenedAt(value) {
    this.listenedAt.value = value;
    this.entries.value = [];
    this.previewError.value = '';
  }

  #body() {
    return { ...this.selection.value, finishedAt: new Date(this.listenedAt.value).getTime() };
  }

  preview() {
    if (this.busy.value) return;
    if (!this.listenedAt.value || !Number.isFinite(new Date(this.listenedAt.value).getTime())) {
      this.previewError.value = 'library.scrobble.invalidTime';
      return;
    }
    this.busy.value = true;
    this.entries.value = [];
    this.previewError.value = '';
    /** @type {Promise<{ entries: Entry[] }>} */ (
      inject(API).post('/library/scrobbles/preview', this.#body())
    ).then(
      (data) => {
        this.entries.value = data.entries;
        this.busy.value = false;
      },
      (cause) => {
        this.previewError.value = errorKey(cause, 'library.scrobble.previewFailed');
        this.busy.value = false;
      },
    );
  }

  submit() {
    if (this.busy.value || this.submitted.value || !this.entries.value.length) return;
    this.busy.value = true;
    /** @type {Promise<ScrobbleResult>} */ (
      inject(API).post('/library/scrobbles', {
        ...this.#body(),
        requestId: this.#requestId,
        entries: this.entries.value.map(({ id, time }) => ({ id, time })),
      })
    ).then(
      (result) => {
        this.message.value = resultMessage(result);
        this.failed.value = result.status !== 'confirmed';
        this.submitted.value = true;
        this.busy.value = false;
        this.#navidrome.historyChanged();
        this.load();
      },
      (cause) => {
        this.message.value = { key: errorKey(cause, 'library.scrobble.outcomeUnknown') };
        this.failed.value = true;
        this.submitted.value = true;
        this.busy.value = false;
        this.#navidrome.historyChanged();
      },
    );
  }

  /** @param {Event} [event] */
  close(event) {
    if (this.busy.value) {
      event?.preventDefault();
      return;
    }
    this.#dialog?.close();
  }
}

/**
 * What a submission did. The server verifies each scrobble after writing it, so a result
 * short of `confirmed` reports how many it could find.
 *
 * @param {ScrobbleResult} result
 * @returns {Message}
 */
function resultMessage(result) {
  if (result.status === 'confirmed') {
    return { key: 'library.scrobble.added', params: { count: result.total } };
  }
  if (result.accepted !== undefined) {
    return {
      key: 'library.scrobble.partial',
      params: { confirmed: result.confirmed, count: result.total },
    };
  }
  return { key: 'library.scrobble.unverified' };
}

await defineComponent({
  tag: 'app-library',
  element: Library,
  module: import.meta.url,
  uses: [AppIcon, AppCover],
});
