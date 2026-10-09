import { batch, inject, signal, token } from '@srljs/core';

import { NAVIDROME } from '../../services/navidrome.js';

/** @import { InjectionToken, Signal } from '@core/foundation/types.js' */
/** @import { StatData, StatRange, StatType } from '../../models/types.js' */

/** @typedef {{ [K in StatType]: Signal<StatData[K]> }} StatSignals */

/** @type {InjectionToken<StatStore>} */
export const STAT_STORE = token('StatStore');

/**
 * The stat data the dashboard shows, held outside the dashboard so it outlives it.
 *
 * Leaving for an artist and coming back finds the card as it was, without a request,
 * because the dashboard mounts again over data that is still here. A change of stat,
 * range or listening history fetches, so the card shows listens made since.
 */
export class StatStore {
  /** @type {StatSignals} */
  data = {
    summary: signal(/** @type {StatData['summary']} */ (null)),
    'top-songs': signal(/** @type {StatData['top-songs']} */ ([])),
    'top-artists': signal(/** @type {StatData['top-artists']} */ ([])),
    'top-albums': signal(/** @type {StatData['top-albums']} */ ([])),
    'top-genres': signal(/** @type {StatData['top-genres']} */ ([])),
    'listening-clock': signal(/** @type {StatData['listening-clock']} */ ([])),
    'monthly-trends': signal(/** @type {StatData['monthly-trends']} */ ([])),
    'day-of-week': signal(/** @type {StatData['day-of-week']} */ ([])),
    streak: signal(/** @type {StatData['streak']} */ ([])),
    'late-night': signal(/** @type {StatData['late-night']} */ ([])),
    'on-repeat': signal(/** @type {StatData['on-repeat']} */ ([])),
    'song-of-month': signal(/** @type {StatData['song-of-month']} */ ([])),
    'favorite-decades': signal(/** @type {StatData['favorite-decades']} */ ([])),
    recap: signal(/** @type {StatData['recap']} */ (null)),
  };

  loading = signal(false);
  /** A message key, so the error follows a language change. */
  error = signal(/** @type {string | null} */ (null));

  /** The stat, range and history version the data on screen answers. */
  #shown = /** @type {string | null} */ (null);

  /** @type {AbortController | null} */
  #request = null;

  /**
   * Whether the data on screen already answers `type` over `range`.
   *
   * @param {StatType} type
   * @param {StatRange} range
   * @returns {boolean}
   */
  holds(type, range) {
    return this.#shown === key(type, range) && this.error.value === null;
  }

  /**
   * Fetch `type` over `range`, cancelling a request still in flight.
   *
   * @param {StatType} type
   * @param {StatRange} range
   * @returns {Promise<void>}
   */
  async load(type, range) {
    this.#request?.abort();
    const request = new AbortController();
    this.#request = request;

    batch(() => {
      this.loading.value = true;
      this.error.value = null;
    });

    try {
      const shown = key(type, range);
      const data = await inject(NAVIDROME).getStat(type, range, request.signal);
      if (request.signal.aborted) return;
      batch(() => {
        /** @type {Signal<unknown>} */ (this.data[type]).value = data;
        this.loading.value = false;
      });
      this.#shown = shown;
    } catch {
      if (request.signal.aborted) return;
      batch(() => {
        this.error.value = 'dashboard.loadFailed';
        this.loading.value = false;
      });
    }
  }
}

/**
 * @param {StatType} type
 * @param {StatRange} range
 * @returns {string}
 */
function key(type, range) {
  return `${type}|${JSON.stringify(range)}|${inject(NAVIDROME).historyVersion.value}`;
}
