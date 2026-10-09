import { signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */

const THEME_KEY = 'rewind.theme';

/** @type {InjectionToken<ThemeService>} */
export const THEME = token('Theme');

/** Light or dark, remembered in the browser, applied as `html.dark`. */
export class ThemeService {
  dark = signal(false);

  /** Before the first render, so the page never paints in the wrong theme. */
  initialize() {
    const stored = localStorage.getItem(THEME_KEY);
    this.dark.value = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', this.dark.value);
  }

  toggle() {
    this.dark.value = !this.dark.value;
    document.documentElement.classList.toggle('dark', this.dark.value);
    localStorage.setItem(THEME_KEY, this.dark.value ? 'dark' : 'light');
  }
}
