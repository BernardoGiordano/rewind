import { defineComponent, inject, SignalElement } from '@srljs/core';

import { AppIcon } from '../components/icon/icon.js';
import { REWIND_SORT, SORTS } from './rewind-sort.js';

/** @import { StatSort } from '../models/types.js' */

/** The one place the sort is chosen: plays or listening time, each with what it ranks first. */
export class AppSortPanel extends SignalElement {
  #sort = inject(REWIND_SORT);

  sorts = SORTS;
  current = this.#sort.current;
  option = this.#sort.option;

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block');
  }

  /**
   * Applies the sort, then asks the host to dismiss the panel.
   *
   * @param {StatSort} sort
   */
  choose(sort) {
    this.#sort.set(sort);
    this.close();
  }

  /** Fires after a choice and on the close button, so the host can dismiss the panel. */
  close() {
    this.dispatchEvent(new CustomEvent('closed'));
  }
}

await defineComponent({
  tag: 'app-sort-panel',
  element: AppSortPanel,
  module: import.meta.url,
  uses: [AppIcon],
});
