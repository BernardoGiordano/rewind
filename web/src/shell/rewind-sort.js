import { computed, signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { StatSort } from '../models/types.js' */

const SORT_KEY = 'rewind.sort';

/**
 * Each sort with its icon, its name, a short name for the rail and a line on what it does.
 *
 * @type {readonly { id: StatSort, icon: string, labelKey: string, shortKey: string, hintKey: string }[]}
 */
export const SORTS = [
  {
    id: 'plays',
    icon: 'heroHashtag',
    labelKey: 'sort.plays',
    shortKey: 'sort.short.plays',
    hintKey: 'sort.playsHint',
  },
  {
    id: 'time',
    icon: 'heroClock',
    labelKey: 'sort.time',
    shortKey: 'sort.short.time',
    hintKey: 'sort.timeHint',
  },
];

/** @type {InjectionToken<RewindSort>} */
export const REWIND_SORT = token('RewindSort');

/**
 * What ranked lists order by, play count or listening time, kept across visits.
 *
 * The ranked cards, the soundtrack and the artist page read {@link current}, so one
 * choice reorders all of them. Each ranked row shows both figures either way. The
 * Shell opens the panel that chooses it, as it does the range's.
 */
export class RewindSort {
  #current = signal(readSort());
  #panelOpen = signal(false);

  current = computed(() => this.#current.value);

  /** The entry of {@link SORTS} for the current sort, for its labels. */
  option = computed(() => SORTS.find((s) => s.id === this.#current.value) ?? SORTS[0]);

  /** True while the sort panel is on screen, so routes can stand down their shortcuts. */
  panelOpen = computed(() => this.#panelOpen.value);

  /** @param {StatSort} sort */
  set(sort) {
    this.#current.value = sort;
    localStorage.setItem(SORT_KEY, sort);
  }

  togglePanel() {
    this.#panelOpen.value = !this.#panelOpen.value;
  }

  closePanel() {
    this.#panelOpen.value = false;
  }
}

/** @returns {StatSort} */
function readSort() {
  return localStorage.getItem(SORT_KEY) === 'time' ? 'time' : 'plays';
}
