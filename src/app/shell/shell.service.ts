import { Injectable, TemplateRef, signal } from '@angular/core';

/**
 * The seam between the Shell and the routes it hosts.
 *
 * Routes own their content; the Shell owns chrome. A route that needs its own
 * controls inside the chrome hands over a template instead of drawing its own bar.
 */
@Injectable({ providedIn: 'root' })
export class ShellService {
  private readonly _routeActions = signal<TemplateRef<unknown> | null>(null);
  private readonly _menuOpen = signal(false);
  private readonly _quietCorner = signal(false);

  readonly routeActions = this._routeActions.asReadonly();
  readonly menuOpen = this._menuOpen.asReadonly();

  /** A route with a quiet bottom-right corner lets the Shell float decoration there. */
  readonly quietCorner = this._quietCorner.asReadonly();

  setQuietCorner(quiet: boolean): void {
    this._quietCorner.set(quiet);
  }

  setRouteActions(template: TemplateRef<unknown> | null): void {
    this._routeActions.set(template);
  }

  toggleMenu(): void {
    this._menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this._menuOpen.set(false);
  }
}
