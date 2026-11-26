import { computed, signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { StatSort } from '../models/types.js' */

const SORT_KEY = 'rewind.sort';

/**
 * Each sort with the icon its control shows, a short label and a full title.
 *
 * @type {readonly { id: StatSort, icon: string, labelKey: string, titleKey: string }[]}
 */
export const SORTS = [
  { id: 'plays', icon: 'heroHashtag', labelKey: 'sort.plays', titleKey: 'sort.byPlays' },
  { id: 'time', icon: 'heroClock', labelKey: 'sort.time', titleKey: 'sort.byTime' },
];

/** @type {InjectionToken<RewindSort>} */
export const REWIND_SORT = token('RewindSort');

/**
 * What ranked lists order by, play count or listening time, kept across visits.
 *
 * The ranked cards, the soundtrack and the artist page read {@link current}, so one
 * choice reorders all of them. Each ranked row shows both figures either way.
 */
export class RewindSort {
  #current = signal(readSort());

  current = computed(() => this.#current.value);

  /** @param {StatSort} sort */
  set(sort) {
    this.#current.value = sort;
    localStorage.setItem(SORT_KEY, sort);
  }
}

/** @returns {StatSort} */
function readSort() {
  return localStorage.getItem(SORT_KEY) === 'time' ? 'time' : 'plays';
}
