import { computed, currentPath, effect, inject, queryParams, signal, token, untracked } from '@srljs/core';

import {
  ALL_TIME,
  mergeParams,
  rangeFromParams,
  rangeLabel,
  rangeShortLabel,
  rangeToParams,
  sameRange,
} from '../models/range.js';
import { NAVIDROME } from '../services/navidrome.js';
import { sectionFor } from './sections.js';
import { SECTION_REGISTRY } from './section-registry.js';
import { replaceQuery } from './url.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { ParamReader, RangeParams, StatRange } from '../models/types.js' */

const CUSTOM_RANGE_KEY = 'rewind.customRange';

/** @type {InjectionToken<RewindRange>} */
export const REWIND_RANGE = token('RewindRange');

/**
 * The single source of the Rewind date range.
 *
 * Selection, labelling, persistence and URL encoding live here; the rail button,
 * the period panel, the dashboard sidebar and the artist header are thin adapters
 * that read {@link current} and call {@link set}. Sections declare whether the
 * range applies to them, so the Shell knows when to offer the control at all.
 */
export class RewindRange {
  #current = signal(/** @type {StatRange} */ (ALL_TIME));
  #years = signal(/** @type {string[]} */ ([]));
  #ready = signal(false);
  #panelOpen = signal(false);

  #initialized = false;

  current = computed(() => this.#current.value);

  /** Years with scrobbles, newest first, as the API returns them. */
  years = computed(() => this.#years.value);

  /** False until the stored and URL range are resolved, so nothing fetches twice. */
  ready = computed(() => this.#ready.value);

  /** True while the range panel is on screen, so routes can stand down their shortcuts. */
  panelOpen = computed(() => this.#panelOpen.value);

  label = computed(() => rangeLabel(this.#current.value));
  shortLabel = computed(() => rangeShortLabel(this.#current.value));

  constructor() {
    const navidrome = inject(NAVIDROME);
    let firstHistory = true;
    effect(() => {
      void navidrome.historyVersion.value;
      if (firstHistory) {
        firstHistory = false;
        return;
      }
      untracked(() => this.#loadYears());
    });

    // Landing on a range-aware section puts the range back in its URL.
    effect(() => {
      void currentPath.value;
      void queryParams.value;
      untracked(() => {
        if (this.#ready.value) this.#syncUrl();
      });
    });
  }

  /**
   * Resolves the range once per page load: the stored custom range, then the URL,
   * then the newest year with data.
   *
   * @param {ParamReader} params
   */
  init(params) {
    if (this.#initialized) return;
    this.#initialized = true;

    const stored = readStoredCustomRange();
    if (stored) this.#current.value = stored;

    const fromUrl = rangeFromParams(params);
    if (fromUrl) this.#current.value = fromUrl;

    inject(NAVIDROME)
      .getYears()
      .then(
        (years) => {
          this.#years.value = years;
          this.#settle(fromUrl !== null, years);
        },
        () => this.#settle(fromUrl !== null, []),
      );
  }

  /** @param {StatRange} range */
  set(range) {
    if (sameRange(range, this.#current.value)) return;
    this.#current.value = range;
    persist(range);
    this.#syncUrl();
  }

  /**
   * The current range as query params, for links that carry it to another route.
   *
   * @returns {RangeParams}
   */
  toParams() {
    return rangeToParams(this.#current.value);
  }

  /**
   * `path` with the current range in its query.
   *
   * @param {string} path
   * @returns {string}
   */
  hrefFor(path) {
    const query = mergeParams(new URLSearchParams(), { ...this.toParams() }).toString();
    return query === '' ? path : `${path}?${query}`;
  }

  togglePanel() {
    this.#panelOpen.value = !this.#panelOpen.value;
  }

  closePanel() {
    this.#panelOpen.value = false;
  }

  /** @param {boolean} urlPicked @param {string[]} years */
  #settle(urlPicked, years) {
    const newest = years[0];
    if (!urlPicked && newest !== undefined && this.#current.value.kind === 'all-time') {
      this.#current.value = { kind: 'year', year: newest };
    }
    this.#ready.value = true;
    this.#syncUrl();
  }

  #loadYears() {
    inject(NAVIDROME)
      .getYears()
      .then(
        (years) => {
          this.#years.value = years;
        },
        () => {},
      );
  }

  /** Writes the range into the URL of sections that use it, and nowhere else. */
  #syncUrl() {
    const { sections } = inject(SECTION_REGISTRY);
    void replaceQuery({ ...this.toParams() }, (path) => sectionFor(path, sections)?.usesRange === true);
  }
}

/**
 * Only a custom range survives a reload; any other choice drops the stored one.
 *
 * @param {StatRange} range
 */
function persist(range) {
  if (range.kind !== 'custom') {
    localStorage.removeItem(CUSTOM_RANGE_KEY);
    return;
  }
  localStorage.setItem(CUSTOM_RANGE_KEY, JSON.stringify({ from: range.from, to: range.to }));
}

/** @returns {StatRange | null} */
function readStoredCustomRange() {
  const raw = localStorage.getItem(CUSTOM_RANGE_KEY);
  if (!raw) return null;
  try {
    const parsed = /** @type {{ from?: string, to?: string } | null} */ (JSON.parse(raw));
    if (!parsed?.from || !parsed.to) return null;
    return { kind: 'custom', from: parsed.from, to: parsed.to };
  } catch {
    return null;
  }
}
