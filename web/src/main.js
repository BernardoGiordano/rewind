import { inject, provide, startApplication } from '@srljs/core';

import './template-globals.js';
import { API, createApi } from './services/api.js';
import { AUTH, AuthService } from './services/auth.js';
import { DOMINANT_COLOR, DominantColorService } from './services/dominant-color.js';
import { NAVIDROME, NavidromeService } from './services/navidrome.js';
import { THEME, ThemeService } from './services/theme.js';
import { LAYOUT, LayoutModeService } from './shell/layout-mode.js';
import { NAVIGATION_HISTORY, NavigationHistory } from './shell/navigation-history.js';
import { REWIND_RANGE, RewindRange } from './shell/rewind-range.js';
import { SECTION_REGISTRY, SectionRegistry } from './shell/section-registry.js';
import { SHELL, ShellState } from './shell/shell-state.js';
import { COVER_FOCUS, CoverFocusStore } from './components/pan-cover.js';
import { DASHBOARD, DashboardState } from './components/dashboard/dashboard-state.js';
import { STAT_NAVIGATOR, StatNavigator } from './components/dashboard/stat-navigator.js';
import { STAT_STORE, StatStore } from './components/dashboard/stat-store.js';
import { SOUNDTRACK, Soundtrack } from './components/dashboard/soundtrack.js';

await startApplication({
  providers: () => {
    provide(API, createApi);
    provide(AUTH, () => new AuthService());
    provide(NAVIDROME, () => new NavidromeService());
    provide(THEME, () => new ThemeService());
    provide(DOMINANT_COLOR, () => new DominantColorService());
    provide(LAYOUT, () => new LayoutModeService());
    provide(SECTION_REGISTRY, () => new SectionRegistry());
    provide(SHELL, () => new ShellState());
    provide(NAVIGATION_HISTORY, () => new NavigationHistory());
    provide(REWIND_RANGE, () => new RewindRange());
    provide(STAT_NAVIGATOR, () => new StatNavigator(inject(REWIND_RANGE)));
    provide(STAT_STORE, () => new StatStore());
    provide(DASHBOARD, () => new DashboardState());
    provide(
      SOUNDTRACK,
      () => new Soundtrack(inject(NAVIDROME), inject(REWIND_RANGE), inject(STAT_NAVIGATOR)),
    );
    provide(COVER_FOCUS, () => new CoverFocusStore());

    // Before the root renders, so the first paint is already in the right theme.
    inject(THEME).initialize();

    // From the first page on, so "Back" knows whether it would leave the site.
    inject(NAVIGATION_HISTORY);
  },

  // The guards then decide from a known session rather than racing its request.
  ready: () => inject(AUTH).bootstrap().catch(() => null),

  root: { load: () => import('./app-root.js').then((m) => m.AppRoot) },
});
