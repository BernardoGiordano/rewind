import { defineComponent, inject, SignalElement } from '@srljs/core';

import { THEME, THEMES } from '../../services/theme.js';

/**
 * The theme switch. `compact` drops the visible label for tight chrome, such as the
 * sign-in screen's top bar.
 */
export class AppThemePicker extends SignalElement {
  static properties = { compact: { type: Boolean } };

  #theme = inject(THEME);

  compact = false;
  themes = THEMES;
  current = this.#theme.theme;

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block');
  }

  /** @param {string} id */
  choose(id) {
    const theme = THEMES.find((t) => t.id === id);
    if (theme) this.#theme.select(theme.id);
  }
}

await defineComponent({
  tag: 'app-theme-picker',
  element: AppThemePicker,
  module: import.meta.url,
});
