import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { STAT_DEFINITIONS, type StatType } from '../../models/stats';
import { RewindRange } from '../../shell/rewind-range';
import { STAT_PARAM, isStatType, statsForRange, stepStat } from './stat-traversal';

/** How long a card stays on screen while autoplay runs. */
export const AUTOPLAY_INTERVAL_MS = 10_000;

const AUTOPLAY_KEY = 'rewind.storiesMode';

/** The dashboard path. Autoplay suspends while the user is anywhere else. */
const HOST_PATH = '/';

/**
 * The single source of which stat is on screen.
 *
 * Ordering, wrap-around, the year-only filter, autoplay and URL sync live here; the
 * sidebar list, the mobile sheet, swipe, the arrows and the keyboard are thin adapters
 * that read {@link list} and {@link current} and call {@link select}, {@link next} and
 * {@link prev}. Surfaces never hold their own index.
 */
@Injectable({ providedIn: 'root' })
export class StatNavigator {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly range = inject(RewindRange);
  private readonly destroyRef = inject(DestroyRef);

  private readonly allTime = computed(() => this.range.current().kind === 'all-time');
  private readonly _current = signal<StatType>('summary');
  private readonly _autoplay = signal(false);
  private readonly _paused = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Stats the current range can show, in display order. */
  readonly list = computed(() => statsForRange(STAT_DEFINITIONS, this.allTime()));

  readonly current = this._current.asReadonly();
  readonly autoplay = this._autoplay.asReadonly();
  readonly paused = this._paused.asReadonly();

  readonly definition = computed(() => this.list().find((d) => d.type === this.current()) ?? null);

  /** Position of the selection in {@link list}, for progress indicators. */
  readonly index = computed(() => {
    const at = this.list().findIndex((d) => d.type === this.current());
    return at >= 0 ? at : 0;
  });

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      if (this.onHostPath(event.urlAfterRedirects)) {
        if (this._autoplay() && !this._paused()) this.runTimer();
      } else {
        this.clearTimer();
      }
    });

    // A range change can hide the stat on screen; step to the first one it still shows.
    effect(() => {
      const list = this.list();
      if (list.some((d) => d.type === this._current())) return;
      this.commit(list[0]?.type ?? 'summary');
    });

    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  /** Restores the selection from the URL and the autoplay preference from storage. */
  restore(statParam: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (isStatType(statParam) && this.list().some((d) => d.type === statParam)) {
      this._current.set(statParam);
    }

    if (localStorage.getItem(AUTOPLAY_KEY) !== 'false') this.startAutoplay();
  }

  select(type: StatType): void {
    if (!this.list().some((d) => d.type === type)) return;
    this.commit(type);
  }

  next(): void {
    this.commit(stepStat(this.list(), this._current(), 1));
  }

  prev(): void {
    this.commit(stepStat(this.list(), this._current(), -1));
  }

  toggleAutoplay(): void {
    if (this._autoplay()) this.stopAutoplay();
    else this.startAutoplay();
  }

  startAutoplay(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this._autoplay.set(true);
    this._paused.set(false);
    this.persistAutoplay();
    this.runTimer();
  }

  stopAutoplay(): void {
    this._autoplay.set(false);
    this._paused.set(false);
    this.clearTimer();
    this.persistAutoplay();
  }

  togglePause(): void {
    if (this._paused()) {
      this._paused.set(false);
      this.runTimer();
    } else {
      this._paused.set(true);
      this.clearTimer();
    }
  }

  private commit(type: StatType): void {
    if (type === this._current()) return;
    this._current.set(type);
    this._paused.set(false);
    if (this._autoplay()) this.runTimer();
    this.syncUrl();
  }

  private onHostPath(url: string): boolean {
    return url.split(/[?#]/)[0] === HOST_PATH;
  }

  private syncUrl(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.onHostPath(this.router.url)) return;
    void this.router.navigate([], {
      queryParams: { [STAT_PARAM]: this._current() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private persistAutoplay(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(AUTOPLAY_KEY, String(this._autoplay()));
  }

  private runTimer(): void {
    this.clearTimer();
    if (!isPlatformBrowser(this.platformId)) return;
    this.timer = setTimeout(() => this.next(), AUTOPLAY_INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
