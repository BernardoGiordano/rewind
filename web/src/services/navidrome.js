import { inject, signal, token } from '@srljs/core';

import { API } from './api.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { ArtistDetail, StatRange, StatType } from '../models/types.js' */

/** @type {InjectionToken<NavidromeService>} */
export const NAVIDROME = token('Navidrome');

/**
 * The listening-history API, plus what screens share about it: whether covers can load,
 * and a version that moves whenever history changes under them.
 */
export class NavidromeService {
  coverArtAvailable = signal(false);

  /**
   * Bumps when listening history changes, such as after a manual scrobble, and when
   * the signed-in user changes. Screens holding history reload when it moves.
   */
  historyVersion = signal(0);

  #configLoaded = false;

  loadConfig() {
    if (this.#configLoaded) return;
    this.#configLoaded = true;
    inject(API)
      .get('/config')
      .then((config) => {
        this.coverArtAvailable.value = /** @type {{ coverArtAvailable: boolean }} */ (config).coverArtAvailable;
      })
      .catch(() => {
        this.#configLoaded = false;
      });
  }

  historyChanged() {
    this.historyVersion.value += 1;
  }

  /** Listening history now belongs to someone else, so held copies are stale. */
  forgetHistory() {
    this.historyChanged();
  }

  /**
   * @param {string} id
   * @param {number} [size]
   * @returns {string}
   */
  coverUrl(id, size = 150) {
    return `/api/cover/${encodeURIComponent(id)}?size=${size}`;
  }

  /** @returns {Promise<string[]>} */
  getYears() {
    return inject(API).get('/years');
  }

  /**
   * @param {StatType} type
   * @param {StatRange} range
   * @param {AbortSignal} [signal]
   * @returns {Promise<unknown>}
   */
  getStat(type, range, signal) {
    return inject(API).get(`/stats/${type}`, rangeQuery(range), signal);
  }

  /**
   * @param {string} artistId
   * @param {StatRange} range
   * @param {AbortSignal} [signal]
   * @returns {Promise<ArtistDetail>}
   */
  getArtist(artistId, range, signal) {
    return inject(API).get(`/artist/${encodeURIComponent(artistId)}`, rangeQuery(range), signal);
  }
}

/**
 * @param {StatRange} range
 * @returns {Record<string, string>}
 */
function rangeQuery(range) {
  if (range.kind === 'year') return { year: range.year };
  if (range.kind === 'custom') return { from: range.from, to: range.to };
  return {};
}
