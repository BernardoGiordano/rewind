import { computed, signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */
/** @import { OutletTarget } from '@core/elements/types.js' */

/**
 * Components a route hands to the Shell, one per chrome slot.
 *
 * @typedef {object} RouteChrome
 * @property {OutletTarget | null} [menu] Entries at the end of the compact menu.
 * @property {OutletTarget | null} [railTools] Controls under the section switcher in the rail.
 * @property {OutletTarget | null} [railControls] Controls between the range button and the theme toggle at the foot of the rail.
 */

/** @type {InjectionToken<ShellState>} */
export const SHELL = token('Shell');

/**
 * The seam between the Shell and the routes it hosts.
 *
 * Routes own their content; the Shell owns chrome. A route that needs its own
 * controls inside the chrome hands over components instead of drawing its own bar,
 * and the Shell renders each one through an `<x-outlet>`.
 */
export class ShellState {
  menu = signal(/** @type {OutletTarget | null} */ (null));
  railTools = signal(/** @type {OutletTarget | null} */ (null));
  railControls = signal(/** @type {OutletTarget | null} */ (null));

  #menuOpen = signal(false);
  #quietCorner = signal(false);

  menuOpen = computed(() => this.#menuOpen.value);

  /** A route with a quiet bottom-right corner lets the Shell float decoration there. */
  quietCorner = computed(() => this.#quietCorner.value);

  /** @param {boolean} quiet */
  setQuietCorner(quiet) {
    this.#quietCorner.value = quiet;
  }

  /** @param {RouteChrome} chrome */
  setRouteChrome(chrome) {
    this.menu.value = chrome.menu ?? null;
    this.railTools.value = chrome.railTools ?? null;
    this.railControls.value = chrome.railControls ?? null;
  }

  toggleMenu() {
    this.#menuOpen.value = !this.#menuOpen.value;
  }

  closeMenu() {
    this.#menuOpen.value = false;
  }
}
