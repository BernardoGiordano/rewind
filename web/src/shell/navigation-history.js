import { currentPath, effect, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/** @type {InjectionToken<NavigationHistory>} */
export const NAVIGATION_HISTORY = token('NavigationHistory');

/**
 * Whether the user moved inside the application since the page loaded, so a page can
 * tell a "Back" that returns somewhere here from one that would leave the site.
 */
export class NavigationHistory {
  #moves = 0;

  constructor() {
    let first = true;
    effect(() => {
      void currentPath.value;
      if (first) first = false;
      else this.#moves += 1;
    });
  }

  /** At least one page of this application sits behind the current one. */
  get canGoBack() {
    return this.#moves > 0;
  }
}
