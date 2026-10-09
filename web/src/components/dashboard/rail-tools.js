import { defineComponent, inject, SignalElement } from '@srljs/core';

import { CARD_MODES, DASHBOARD } from './dashboard-state.js';

/** @import { CardMode } from './dashboard-state.js' */

/** Card aspect buttons, rendered by the Shell under the rail's section switcher. */
export class DashboardRailTools extends SignalElement {
  #state = inject(DASHBOARD);

  cardModes = CARD_MODES;
  cardMode = this.#state.cardMode;

  /** @param {CardMode} mode */
  select(mode) {
    this.#state.selectCardMode(mode);
  }
}

await defineComponent({ tag: 'app-dashboard-rail-tools', element: DashboardRailTools, module: import.meta.url });
