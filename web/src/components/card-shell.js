import { defineComponent, inject, SignalElement } from '@srljs/core';

import { THEME } from '../services/theme.js';

/**
 * The frame every stat card shares: its gradient, the range badge and the credit.
 * The black theme draws a flat navy card instead of the gradient.
 */
export class AppCardShell extends SignalElement {
  static properties = {
    gradient: { attribute: false },
    gradientStyle: { attribute: false },
    yearLabel: { attribute: false },
    noRound: { attribute: false },
  };

  gradient = '';

  /** @type {string | null} */
  gradientStyle = null;

  yearLabel = '';
  noRound = false;

  flat = inject(THEME).flatCards;
}

await defineComponent({ tag: 'app-card-shell', element: AppCardShell, module: import.meta.url });
