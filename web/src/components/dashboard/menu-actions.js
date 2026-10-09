import { defineComponent, inject, SignalElement } from '@srljs/core';

import { AppIcon } from '../icon/icon.js';
import { SHELL } from '../../shell/shell-state.js';
import { DASHBOARD } from './dashboard-state.js';
import { STAT_NAVIGATOR } from './stat-navigator.js';

/** Dashboard entries the Shell renders in its compact menu. */
export class DashboardMenuActions extends SignalElement {
  #nav = inject(STAT_NAVIGATOR);

  autoplay = this.#nav.autoplay;

  toggleAutoplay() {
    inject(SHELL).closeMenu();
    this.#nav.toggleAutoplay();
  }

  exportCard() {
    void inject(DASHBOARD).exportCard();
    inject(SHELL).closeMenu();
  }
}

await defineComponent({
  tag: 'app-dashboard-menu-actions',
  element: DashboardMenuActions,
  module: import.meta.url,
  uses: [AppIcon],
});
