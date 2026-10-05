import { Injectable, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SECTIONS, type Section, sectionFor } from './sections';

/**
 * The single source of top-level navigation.
 *
 * Adapters render {@link sections} and read {@link active}; none of them holds its own
 * list or decides what "current" means. Adding a section is one entry in SECTIONS.
 */
@Injectable({ providedIn: 'root' })
export class SectionRegistry {
  private readonly router = inject(Router);

  readonly sections: readonly Section[] = [...SECTIONS].sort((a, b) => a.order - b.order);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** The section the current URL belongs to, so a drill-down keeps its parent highlighted. */
  readonly active = computed(() => sectionFor(this.url(), this.sections));

  /** Where a page under `url` belongs, for pages that need a destination rather than history. */
  routeFor(url: string): string {
    return sectionFor(url, this.sections)?.route ?? '/';
  }
}
