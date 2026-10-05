import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  ALL_TIME,
  type ParamReader,
  type RangeParams,
  type StatRange,
  paramsMatch,
  rangeFromParams,
  rangeLabel,
  rangeShortLabel,
  rangeToParams,
  sameRange,
} from '../models/range';
import { NavidromeService } from '../services/navidrome.service';
import { sectionFor } from './sections';
import { SectionRegistry } from './section-registry';

const CUSTOM_RANGE_KEY = 'rewind.customRange';

/**
 * The single source of the Rewind date range.
 *
 * Selection, labelling, persistence and URL encoding live here; the rail button,
 * the period panel, the dashboard sidebar and the artist header are thin adapters
 * that read {@link current} and call {@link set}. Sections declare whether the
 * range applies to them, so the Shell knows when to offer the control at all.
 */
@Injectable({ providedIn: 'root' })
export class RewindRange {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly navidrome = inject(NavidromeService);
  private readonly registry = inject(SectionRegistry);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _current = signal<StatRange>(ALL_TIME);
  private readonly _years = signal<string[]>([]);
  private readonly _ready = signal(false);
  private readonly _panelOpen = signal(false);

  private initialized = false;

  readonly current = this._current.asReadonly();

  /** Years with scrobbles, newest first, as the API returns them. */
  readonly years = this._years.asReadonly();

  /** False until the browser has resolved the stored and URL range, so nothing fetches twice. */
  readonly ready = this._ready.asReadonly();

  /** True while the range panel is on screen, so routes can stand down their shortcuts. */
  readonly panelOpen = this._panelOpen.asReadonly();

  readonly label = computed(() => rangeLabel(this._current()));
  readonly shortLabel = computed(() => rangeShortLabel(this._current()));

  constructor() {
    this.navidrome.historyChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadYears();
    });

    // Landing on a range-aware section puts the range back in its URL.
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd && this._ready()) {
        this.syncUrl(event.urlAfterRedirects);
      }
    });
  }

  /**
   * Resolves the range once per page load: the stored custom range, then the URL,
   * then the newest year with data. Browser only, so SSR never guesses.
   */
  init(params: ParamReader): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;

    const stored = this.readStoredCustomRange();
    if (stored) this._current.set(stored);

    const fromUrl = rangeFromParams(params);
    if (fromUrl) this._current.set(fromUrl);

    this.navidrome.getYears().subscribe({
      next: (years) => {
        this._years.set(years);
        this.settle(fromUrl !== null, years);
      },
      error: () => this.settle(fromUrl !== null, []),
    });
  }

  set(range: StatRange): void {
    if (sameRange(range, this._current())) return;
    this._current.set(range);
    this.persist(range);
    this.syncUrl();
  }

  /** The current range as query params, for links that carry it to another route. */
  toParams(): RangeParams {
    return rangeToParams(this._current());
  }

  togglePanel(): void {
    this._panelOpen.update((open) => !open);
  }

  closePanel(): void {
    this._panelOpen.set(false);
  }

  private settle(urlPicked: boolean, years: string[]): void {
    if (!urlPicked && years.length > 0 && this._current().kind === 'all-time') {
      this._current.set({ kind: 'year', year: years[0] });
    }
    this._ready.set(true);
    this.syncUrl();
  }

  private loadYears(): void {
    this.navidrome.getYears().subscribe({
      next: (years) => this._years.set(years),
      error: () => {},
    });
  }

  /** Only a custom range survives a reload; any other choice drops the stored one. */
  private persist(range: StatRange): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (range.kind !== 'custom') {
      localStorage.removeItem(CUSTOM_RANGE_KEY);
      return;
    }
    localStorage.setItem(CUSTOM_RANGE_KEY, JSON.stringify({ from: range.from, to: range.to }));
  }

  private readStoredCustomRange(): StatRange | null {
    const raw = localStorage.getItem(CUSTOM_RANGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { from?: string; to?: string };
      if (!parsed?.from || !parsed?.to) return null;
      return { kind: 'custom', from: parsed.from, to: parsed.to };
    } catch {
      return null;
    }
  }

  /** Writes the range into the URL of sections that use it, and nowhere else. */
  private syncUrl(url = this.router.url): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!sectionFor(url, this.registry.sections)?.usesRange) return;

    const target = this.toParams();
    if (paramsMatch(this.router.parseUrl(url).queryParams, target)) return;

    void this.router.navigate([], {
      queryParams: target,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
