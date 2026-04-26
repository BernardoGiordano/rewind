import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  BaseRouteReuseStrategy,
  DetachedRouteHandle,
} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class CachedRouteReuseStrategy extends BaseRouteReuseStrategy {
  private readonly stored = new Map<string, DetachedRouteHandle>();

  /** Drop all detached route handles — call when auth state changes. */
  clear(): void {
    this.stored.clear();
  }

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.key(route) !== null;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.key(route);
    if (key === null) return;
    if (handle) this.stored.set(key, handle);
    else this.stored.delete(key);
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.key(route);
    return key !== null && this.stored.has(key);
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.key(route);
    return key !== null ? (this.stored.get(key) ?? null) : null;
  }

  override shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot,
  ): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private key(route: ActivatedRouteSnapshot): string | null {
    if (route.data?.['reuse'] !== true) return null;
    const cfg = route.routeConfig;
    if (!cfg) return null;
    return `path:${cfg.path ?? ''}`;
  }
}
