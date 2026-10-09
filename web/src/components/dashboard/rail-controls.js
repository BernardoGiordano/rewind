import { defineComponent, inject, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { STAT_NAVIGATOR } from './stat-navigator.js';

/** The autoplay toggle, rendered by the Shell at the foot of the rail. */
export class DashboardRailControls extends SignalElement {
  #nav = inject(STAT_NAVIGATOR);

  autoplay = this.#nav.autoplay;

  toggleAutoplay() {
    this.#nav.toggleAutoplay();
  }
}

await defineComponent({
  tag: 'app-dashboard-rail-controls',
  element: DashboardRailControls,
  module: import.meta.url,
  uses: [AppIcon],
});
