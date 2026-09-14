import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** The three layout modes every route shares. */
export type LayoutMode = 'compact' | 'medium' | 'expanded';

/**
 * Lower bound in px of each mode above `compact`.
 *
 * The `compact` / `medium` / `medium-up` / `expanded` / `wide` variants in
 * `src/styles.css` encode the same numbers for templates. Retune both together.
 */
export const LAYOUT_BREAKPOINTS = {
  medium: 640,
  expanded: 1024,
} as const;

/**
 * Resolves the layout mode once, for every route.
 *
 * Templates express layout with the named variants; this service is for the
 * decisions CSS cannot make, such as which component to instantiate or which
 * card aspect to force.
 */
@Injectable({ providedIn: 'root' })
export class LayoutModeService {
  /** SSR has no viewport, so the server renders `expanded` and the browser corrects it on hydration. */
  private readonly _mode = signal<LayoutMode>('expanded');

  readonly mode = this._mode.asReadonly();
  readonly isCompact = computed(() => this._mode() === 'compact');
  readonly isMedium = computed(() => this._mode() === 'medium');
  readonly isExpanded = computed(() => this._mode() === 'expanded');

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    const expanded = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.expanded}px)`);
    const medium = window.matchMedia(`(min-width: ${LAYOUT_BREAKPOINTS.medium}px)`);
    const resolve = () =>
      this._mode.set(expanded.matches ? 'expanded' : medium.matches ? 'medium' : 'compact');

    resolve();
    expanded.addEventListener('change', resolve);
    medium.addEventListener('change', resolve);

    inject(DestroyRef).onDestroy(() => {
      expanded.removeEventListener('change', resolve);
      medium.removeEventListener('change', resolve);
    });
  }
}
