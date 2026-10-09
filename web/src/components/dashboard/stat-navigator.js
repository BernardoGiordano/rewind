import { computed, currentPath, effect, signal, token, untracked } from '@srljs/core';

import { STAT_DEFINITIONS } from '../../models/stats.js';
import { replaceQuery } from '../../shell/url.js';
import { STAT_PARAM, isStatType, statsForRange, stepStat } from './stat-traversal.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { StatType } from '../../models/types.js' */
/** @import { RewindRange } from '../../shell/rewind-range.js' */

/** How long a card stays on screen while autoplay runs. */
export const AUTOPLAY_INTERVAL_MS = 10_000;

const AUTOPLAY_KEY = 'rewind.storiesMode';

/** The dashboard path. Autoplay suspends while the user is anywhere else. */
const HOST_PATH = '/';

/** @type {InjectionToken<StatNavigator>} */
export const STAT_NAVIGATOR = token('StatNavigator');

/**
 * The single source of which stat is on screen.
 *
 * Ordering, wrap-around, the year-only filter, autoplay and URL sync live here; the
 * sidebar list, the mobile sheet, swipe, the arrows and the keyboard are thin adapters
 * that read {@link list} and {@link current} and call {@link select}, {@link next} and
 * {@link prev}. Surfaces never hold their own index.
 */
export class StatNavigator {
  #current = signal(/** @type {StatType} */ ('summary'));
  #autoplay = signal(false);
  #paused = signal(false);
  #restored = false;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #timer = null;

  /** @type {import('@core/foundation/types.js').ReadonlySignal<boolean>} */
  #allTime;

  /** Stats the current range can show, in display order. */
  list;

  current = computed(() => this.#current.value);
  autoplay = computed(() => this.#autoplay.value);
  paused = computed(() => this.#paused.value);

  definition = computed(() => this.list.value.find((d) => d.type === this.#current.value) ?? null);

  /** Position of the selection in {@link list}, for progress indicators. */
  index = computed(() => {
    const at = this.list.value.findIndex((d) => d.type === this.#current.value);
    return at >= 0 ? at : 0;
  });

  /** @param {RewindRange} range */
  constructor(range) {
    this.#allTime = computed(() => range.current.value.kind === 'all-time');
    this.list = computed(() => statsForRange(STAT_DEFINITIONS, this.#allTime.value));

    // Autoplay runs only while the dashboard is on screen.
    effect(() => {
      const onHost = currentPath.value === HOST_PATH;
      untracked(() => {
        if (!onHost) this.#clearTimer();
        else if (this.#autoplay.value && !this.#paused.value) this.#runTimer();
      });
    });

    // A range change can hide the stat on screen; step to the first one it still shows.
    effect(() => {
      const list = this.list.value;
      untracked(() => {
        if (list.some((d) => d.type === this.#current.value)) return;
        this.#commit(list[0]?.type ?? 'summary');
      });
    });
  }

  /**
   * Restores the selection from the URL and the autoplay preference from storage, once
   * per page load, so returning to the dashboard keeps what the user left.
   *
   * @param {string | null} statParam
   */
  restore(statParam) {
    if (this.#restored) return;
    this.#restored = true;

    if (isStatType(statParam) && this.list.value.some((d) => d.type === statParam)) {
      this.#current.value = statParam;
    }

    if (localStorage.getItem(AUTOPLAY_KEY) !== 'false') this.startAutoplay();
  }

  /** @param {StatType} type */
  select(type) {
    if (!this.list.value.some((d) => d.type === type)) return;
    this.#commit(type);
  }

  next() {
    this.#commit(stepStat(this.list.value, this.#current.value, 1));
  }

  prev() {
    this.#commit(stepStat(this.list.value, this.#current.value, -1));
  }

  toggleAutoplay() {
    if (this.#autoplay.value) this.stopAutoplay();
    else this.startAutoplay();
  }

  startAutoplay() {
    this.#autoplay.value = true;
    this.#paused.value = false;
    this.#persistAutoplay();
    this.#runTimer();
  }

  stopAutoplay() {
    this.#autoplay.value = false;
    this.#paused.value = false;
    this.#clearTimer();
    this.#persistAutoplay();
  }

  togglePause() {
    if (this.#paused.value) {
      this.#paused.value = false;
      this.#runTimer();
    } else {
      this.#paused.value = true;
      this.#clearTimer();
    }
  }

  /** @param {StatType} type */
  #commit(type) {
    if (type === this.#current.value) return;
    this.#current.value = type;
    this.#paused.value = false;
    if (this.#autoplay.value) this.#runTimer();
    void replaceQuery({ [STAT_PARAM]: type }, (path) => path === HOST_PATH);
  }

  #persistAutoplay() {
    localStorage.setItem(AUTOPLAY_KEY, String(this.#autoplay.value));
  }

  #runTimer() {
    this.#clearTimer();
    this.#timer = setTimeout(() => this.next(), AUTOPLAY_INTERVAL_MS);
  }

  #clearTimer() {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }
}
