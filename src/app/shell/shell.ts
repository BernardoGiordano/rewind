import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowRightOnRectangle,
  heroCalendarDays,
  heroChartPie,
  heroChevronRight,
  heroHeart,
  heroMoon,
  heroRectangleStack,
  heroSun,
  heroUserCircle,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { Byline } from './byline';
import { PeriodPanel } from './period-panel';
import { RewindRange } from './rewind-range';
import { SectionRegistry } from './section-registry';
import { ShellService } from './shell.service';

/**
 * Owns the application chrome: section navigation, theme, identity and links.
 * Routes render into the content slot and draw nothing outside it.
 */
@Component({
  selector: 'app-shell',
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterOutlet, RouterLink, NgIcon, NgTemplateOutlet, Byline, PeriodPanel],
  providers: [
    provideIcons({
      heroChartPie,
      heroRectangleStack,
      heroCalendarDays,
      heroSun,
      heroMoon,
      heroUserCircle,
      heroArrowRightOnRectangle,
      heroChevronRight,
      heroHeart,
    }),
  ],
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  private readonly registry = inject(SectionRegistry);
  private readonly range = inject(RewindRange);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly sections = this.registry.sections;
  readonly activeSection = this.registry.active;
  readonly darkMode = this.theme.dark;
  readonly currentUser = this.auth.user;
  readonly canLogout = this.auth.canLogout;
  readonly menuOpen = this.shell.menuOpen;
  readonly chrome = this.shell.routeChrome;
  readonly quietCorner = this.shell.quietCorner;
  readonly accountOpen = signal(false);

  /** One letter stands in for the user on the rail. */
  readonly initial = computed(() => this.currentUser()?.username.charAt(0).toUpperCase() ?? '');

  /** The range control only appears for sections whose data the range applies to. */
  readonly showRange = computed(() => this.registry.active()?.usesRange === true);
  readonly rangeLabel = this.range.label;
  readonly rangeShortLabel = this.range.shortLabel;
  readonly rangePanelOpen = this.range.panelOpen;

  constructor() {
    // Leaving a route drops its contributed controls; the next route registers its own.
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.shell.setRouteChrome({});
        this.shell.setQuietCorner(false);
        this.shell.closeMenu();
        this.accountOpen.set(false);
        this.range.closePanel();
      }
    });

    // The Shell outlives every route, so the range resolves once per page load.
    afterNextRender(() => this.range.init(this.route.snapshot.queryParamMap));
  }

  toggleRangePanel(): void {
    this.shell.closeMenu();
    this.accountOpen.set(false);
    this.range.togglePanel();
  }

  closeRangePanel(): void {
    this.range.closePanel();
  }

  toggleAccount(): void {
    this.range.closePanel();
    this.accountOpen.update((open) => !open);
  }

  closeAccount(): void {
    this.accountOpen.set(false);
  }

  toggleMenu(): void {
    this.shell.toggleMenu();
  }

  closeMenu(): void {
    this.shell.closeMenu();
  }

  toggleDarkMode(): void {
    this.theme.toggle();
  }

  logout(): void {
    this.shell.closeMenu();
    this.accountOpen.set(false);
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.shell.closeMenu();
    this.accountOpen.set(false);
    this.range.closePanel();
  }
}
