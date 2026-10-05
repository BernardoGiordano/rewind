import { Injectable, TemplateRef, signal } from '@angular/core';

/** Controls a route hands to the Shell, one template per chrome slot. */
export interface RouteChrome {
  /** Entries at the end of the compact menu. */
  menu?: TemplateRef<unknown> | null;

  /** Controls under the section switcher in the rail. */
  railTools?: TemplateRef<unknown> | null;

  /** Controls between the range button and the theme toggle at the foot of the rail. */
  railControls?: TemplateRef<unknown> | null;
}

/**
 * The seam between the Shell and the routes it hosts.
 *
 * Routes own their content; the Shell owns chrome. A route that needs its own
 * controls inside the chrome hands over templates instead of drawing its own bar.
 */
@Injectable({ providedIn: 'root' })
export class ShellService {
  private readonly _routeChrome = signal<RouteChrome>({});
  private readonly _menuOpen = signal(false);
  private readonly _quietCorner = signal(false);

  readonly routeChrome = this._routeChrome.asReadonly();
  readonly menuOpen = this._menuOpen.asReadonly();

  /** A route with a quiet bottom-right corner lets the Shell float decoration there. */
  readonly quietCorner = this._quietCorner.asReadonly();

  setQuietCorner(quiet: boolean): void {
    this._quietCorner.set(quiet);
  }

  setRouteChrome(chrome: RouteChrome): void {
    this._routeChrome.set(chrome);
  }

  toggleMenu(): void {
    this._menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this._menuOpen.set(false);
  }
}
