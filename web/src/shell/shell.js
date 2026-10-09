import {
  ComponentOutlet,
  computed,
  currentPath,
  defineComponent,
  inject,
  navigate,
  queryParams,
  RouteOutlet,
  signal,
  SignalElement,
  untracked,
} from '@srljs/core';

import { AppIcon } from '../components/icon/icon.js';
import { AUTH } from '../services/auth.js';
import { THEME } from '../services/theme.js';
import { watch } from '../utils/watch.js';
import { AppByline } from './byline.js';
import { AppPeriodPanel } from './period-panel.js';
import { REWIND_RANGE } from './rewind-range.js';
import { SECTION_REGISTRY } from './section-registry.js';
import { SHELL } from './shell-state.js';

/**
 * Owns the application chrome: section navigation, theme, identity and links.
 * Routes render into the content slot and draw nothing outside it.
 */
export class Shell extends SignalElement {
  #auth = inject(AUTH);
  #theme = inject(THEME);
  #shell = inject(SHELL);
  #registry = inject(SECTION_REGISTRY);
  #range = inject(REWIND_RANGE);

  sections = this.#registry.sections;
  activeSection = this.#registry.active;
  darkMode = this.#theme.dark;
  currentUser = this.#auth.user;
  canLogout = this.#auth.canLogout;
  menuOpen = this.#shell.menuOpen;
  quietCorner = this.#shell.quietCorner;
  accountOpen = signal(false);

  /** Controls the current route hands to the chrome, rendered through `<x-outlet>`. */
  menuActions = this.#shell.menu;
  railTools = this.#shell.railTools;
  railControls = this.#shell.railControls;

  /** One letter stands in for the user on the rail. */
  initial = computed(() => this.#auth.user.value?.username.charAt(0).toUpperCase() ?? '');

  /** The range control only appears for sections whose data the range applies to. */
  showRange = computed(() => this.#registry.active.value?.usesRange === true);
  rangeLabel = this.#range.label;
  rangeShortLabel = this.#range.shortLabel;
  rangePanelOpen = this.#range.panelOpen;

  connectedCallback() {
    super.connectedCallback();
    this.classList.add('block');

    // Leaving a page drops its contributed controls; the next page registers its own.
    let first = true;
    watch(this, () => {
      void currentPath.value;
      if (first) {
        first = false;
        return;
      }
      untracked(() => {
        this.#shell.setRouteChrome({});
        this.#shell.setQuietCorner(false);
        this.#closeOverlays();
      });
    });

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') this.#closeOverlays();
      },
      { signal: this.lifetime },
    );
  }

  onMount() {
    // The Shell outlives every route, so the range resolves once per page load.
    this.#range.init(queryParams.value);
  }

  /** @param {string} id @returns {boolean} */
  isActive(id) {
    return this.activeSection.value?.id === id;
  }

  toggleRangePanel() {
    this.#shell.closeMenu();
    this.accountOpen.value = false;
    this.#range.togglePanel();
  }

  closeRangePanel() {
    this.#range.closePanel();
  }

  toggleAccount() {
    this.#range.closePanel();
    this.accountOpen.value = !this.accountOpen.value;
  }

  closeAccount() {
    this.accountOpen.value = false;
  }

  toggleMenu() {
    this.#shell.toggleMenu();
  }

  closeMenu() {
    this.#shell.closeMenu();
  }

  toggleDarkMode() {
    this.#theme.toggle();
  }

  toggleDarkModeFromMenu() {
    this.#theme.toggle();
    this.#shell.closeMenu();
  }

  logout() {
    this.#closeOverlays();
    this.#auth.logout().then(
      () => navigate('/login'),
      () => navigate('/login'),
    );
  }

  /** Closes the menu, the account popover and the range panel. */
  #closeOverlays() {
    this.#shell.closeMenu();
    this.accountOpen.value = false;
    this.#range.closePanel();
  }
}

await defineComponent({
  tag: 'app-shell',
  element: Shell,
  module: import.meta.url,
  uses: [RouteOutlet, ComponentOutlet, AppIcon, AppByline, AppPeriodPanel],
});
