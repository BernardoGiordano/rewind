import { inject, signal, token } from '@srljs/core';

import { API } from './api.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { ArtistDetail, SoundtrackSongs, StatRange, StatSort, StatType } from '../models/types.js' */

/** @type {InjectionToken<NavidromeService>} */
export const NAVIDROME = token('Navidrome');

/**
 * The listening-history API, plus what screens share about it: whether covers and music
 * can load, and a version that moves whenever history changes under them.
 */
export class NavidromeService {
  coverArtAvailable = signal(false);
  musicAvailable = signal(false);

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
      .then((response) => {
        const config = /** @type {{ coverArtAvailable: boolean, musicAvailable?: boolean }} */ (response);
        this.coverArtAvailable.value = config.coverArtAvailable;
        this.musicAvailable.value = config.musicAvailable === true;
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

  /**
   * @param {string} id
   * @param {{ offset: number, transcode: boolean }} options
   * @returns {string}
   */
  streamUrl(id, { offset, transcode }) {
    const base = `/api/stream/${encodeURIComponent(id)}`;
    if (transcode) return `${base}?format=mp3&offset=${offset}`;
    return offset > 0 ? `${base}#t=${offset}` : base;
  }

  /** @returns {Promise<string[]>} */
  getYears() {
    return inject(API).get('/years');
  }

  /**
   * @param {StatType} type
   * @param {StatRange} range
   * @param {StatSort} sort
   * @param {AbortSignal} [signal]
   * @returns {Promise<unknown>}
   */
  getStat(type, range, sort, signal) {
    return inject(API).get(`/stats/${type}`, { ...rangeQuery(range), sort }, signal);
  }

  /**
   * The song each slide plays over `range`.
   *
   * @param {StatRange} range
   * @param {StatSort} sort
   * @param {AbortSignal} [signal]
   * @returns {Promise<SoundtrackSongs>}
   */
  getSoundtrack(range, sort, signal) {
    return inject(API).get('/soundtrack', { ...rangeQuery(range), sort }, signal);
  }

  /**
   * @param {string} artistId
   * @param {StatRange} range
   * @param {StatSort} sort
   * @param {AbortSignal} [signal]
   * @returns {Promise<ArtistDetail>}
   */
  getArtist(artistId, range, sort, signal) {
    const path = `/artist/${encodeURIComponent(artistId)}`;
    return inject(API).get(path, { ...rangeQuery(range), sort }, signal);
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
