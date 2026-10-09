import { computed, defineComponent, inject, SignalElement } from '@srljs/core';

import { AppDateRangePicker } from '../components/date-range-picker/date-range-picker.js';
import { AppIcon } from '../components/icon/icon.js';
import { rangePresets, sameRange } from '../models/range.js';
import { REWIND_RANGE } from './rewind-range.js';

/** @import { StatRange } from '../models/types.js' */

/**
 * The one place the Rewind range is chosen: relative presets, the years with
 * listening history, and a calendar for anything else.
 */
export class AppPeriodPanel extends SignalElement {
  #range = inject(REWIND_RANGE);

  label = this.#range.label;
  years = this.#range.years;
  presets = computed(() => rangePresets());

  custom = computed(() => {
    const current = this.#range.current.value;
    return current.kind === 'custom' ? current : null;
  });

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block');
  }

  /** @param {StatRange} range @returns {boolean} */
  isCurrent(range) {
    return sameRange(range, this.#range.current.value);
  }

  /** @param {string} year @returns {boolean} */
  isYear(year) {
    return this.isCurrent({ kind: 'year', year });
  }

  /**
   * Applies the range, then asks the host to dismiss the panel.
   *
   * @param {StatRange} range
   */
  choose(range) {
    this.#range.set(range);
    this.close();
  }

  /**
   * The calendar's applied range.
   *
   * @param {Event} event
   */
  chooseCustom(event) {
    if (!(event instanceof CustomEvent)) return;
    const { from, to } = /** @type {{ from: string, to: string }} */ (event.detail);
    this.choose({ kind: 'custom', from, to });
  }

  /** Fires after a choice and on the close button, so the host can dismiss the panel. */
  close() {
    this.dispatchEvent(new CustomEvent('closed'));
  }
}

await defineComponent({
  tag: 'app-period-panel',
  element: AppPeriodPanel,
  module: import.meta.url,
  uses: [AppIcon, AppDateRangePicker],
});
