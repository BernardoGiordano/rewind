import { defineComponent, SignalElement } from '@srljs/core';

import { ICONS } from './icons.js';

/**
 * One heroicon by name. It draws at 1em in the surrounding text colour, as `app.css`
 * sets, so a caller sizes it through the font size around it.
 */
export class AppIcon extends SignalElement {
  static properties = { name: { type: String } };

  name = '';

  get paths() {
    return ICONS[this.name] ?? [];
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
  }
}

await defineComponent({ tag: 'app-icon', element: AppIcon, module: import.meta.url });
