import { computed, signal, token } from '@srljs/core';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/** @typedef {'compact' | 'medium' | 'expanded'} LayoutMode */

/**
 * Lower bound in px of each mode above `compact`.
 *
 * The `compact` / `medium` / `medium-up` / `expanded` / `wide` variants in
 * `web/src/app.css` encode the same numbers for templates. Retune both together.
 */
export const LAYOUT_BREAKPOINTS = Object.freeze({
  medium: 640,
  expanded: 1024,
});

/** @type {InjectionToken<LayoutModeService>} */
export const LAYOUT = token('LayoutMode');

/**
 * Resolves the layout mode once, for every route.
 *
 * Templates express layout with the named variants; this service is for the
 * decisions CSS cannot make, such as which component to instantiate or which
 * card aspect to force.
 */
export class LayoutModeService {
  #mode = signal(/** @type {LayoutMode} */ ('expanded'));

  mode = computed(() => this.#mode.value);
  isCompact = computed(() => this.#mode.value === 'compact');
  isMedium = computed(() => this.#mode.value === 'medium');
  isExpanded = computed(() => this.#mode.value === 'expanded');

  constructor() {
    const expanded = matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.expanded}px)`);
    const medium = matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.medium}px)`);
    const resolve = () => {
      this.#mode.value = expanded.matches ? 'expanded' : medium.matches ? 'medium' : 'compact';
    };

    resolve();
    expanded.addEventListener('change', resolve);
    medium.addEventListener('change', resolve);
  }
}
