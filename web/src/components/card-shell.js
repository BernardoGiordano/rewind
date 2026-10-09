import { defineComponent, SignalElement } from '@srljs/core';

/** The frame every stat card shares: its gradient, the range badge and the credit. */
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

  get containerClass() {
    const base =
      'w-full h-full overflow-hidden relative flex flex-col ' +
      (this.noRound ? '' : 'medium-up:rounded-xl ');
    if (this.gradientStyle) return base;
    return base + 'bg-gradient-to-br ' + this.gradient;
  }
}

await defineComponent({ tag: 'app-card-shell', element: AppCardShell, module: import.meta.url });
