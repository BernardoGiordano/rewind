import { computed, signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/**
 * Black is dark on pure black, with flat cards, for OLED screens.
 *
 * @typedef {'light' | 'dark' | 'black'} Theme
 */

const THEME_KEY = 'rewind.theme';

/** @type {readonly { id: Theme, labelKey: string }[]} */
export const THEMES = [
  { id: 'light', labelKey: 'theme.light' },
  { id: 'dark', labelKey: 'theme.dark' },
  { id: 'black', labelKey: 'theme.black' },
];

/** @type {InjectionToken<ThemeService>} */
export const THEME = token('Theme');

/**
 * Light, dark or black, remembered in the browser. Dark and black both apply `html.dark`,
 * and black adds `html.black`.
 */
export class ThemeService {
  theme = signal(/** @type {Theme} */ ('light'));

  /** Black cards trade their gradient for a flat fill. */
  flatCards = computed(() => this.theme.value === 'black');

  /** Before the first render, so the page never paints in the wrong theme. */
  initialize() {
    this.#apply(readTheme());
  }

  /** @param {Theme} theme */
  select(theme) {
    this.#apply(theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  /** @param {Theme} theme */
  #apply(theme) {
    this.theme.value = theme;
    const root = document.documentElement.classList;
    root.toggle('dark', theme !== 'light');
    root.toggle('black', theme === 'black');
  }
}

/** @returns {Theme} */
function readTheme() {
  const stored = THEMES.find((t) => t.id === localStorage.getItem(THEME_KEY));
  if (stored) return stored.id;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
