import { computed, currentPath, token } from '@srljs/core';

import { SECTIONS, sectionFor } from './sections.js';

/** @import { InjectionToken } from '@core/foundation/types.js' */

/** @type {InjectionToken<SectionRegistry>} */
export const SECTION_REGISTRY = token('SectionRegistry');

/**
 * The single source of top-level navigation.
 *
 * Adapters render {@link sections} and read {@link active}; none of them holds its own
 * list or decides what "current" means. Adding a section is one entry in SECTIONS.
 */
export class SectionRegistry {
  sections = [...SECTIONS].sort((a, b) => a.order - b.order);

  /** The section the current URL belongs to, so a drill-down keeps its parent highlighted. */
  active = computed(() => sectionFor(currentPath.value, this.sections));

  /**
   * Where a page under `url` belongs, for pages that need a destination rather than history.
   *
   * @param {string} url
   * @returns {string}
   */
  routeFor(url) {
    return sectionFor(url, this.sections)?.route ?? '/';
  }
}
