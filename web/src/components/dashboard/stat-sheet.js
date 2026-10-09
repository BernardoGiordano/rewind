import { defineComponent, inject, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { STAT_NAVIGATOR } from './stat-navigator.js';

/** @import { StatType } from '../../models/types.js' */

/** Mobile adapter over the stat navigator: the stat list as a bottom sheet. */
export class AppStatSheet extends SignalElement {
  #nav = inject(STAT_NAVIGATOR);

  stats = this.#nav.list;
  current = this.#nav.current;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') this.close();
      },
      { signal: this.lifetime },
    );
  }

  /** @param {StatType} type */
  pick(type) {
    this.#nav.select(type);
    this.close();
  }

  close() {
    this.dispatchEvent(new CustomEvent('close'));
  }
}

await defineComponent({ tag: 'app-stat-sheet', element: AppStatSheet, module: import.meta.url, uses: [AppIcon] });
