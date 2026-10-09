import { attachRouter, defineComponent, RouteOutlet, SignalElement } from '@srljs/core';

import { routes } from './routes.js';

/** The router renders the login screen or the Shell into this element's outlet. */
export class AppRoot extends SignalElement {
  onMount() {
    void attachRouter(this, routes, { outlet: 'x-route-outlet' });
  }
}

await defineComponent({
  tag: 'app-root',
  element: AppRoot,
  module: import.meta.url,
  uses: [RouteOutlet],
});
