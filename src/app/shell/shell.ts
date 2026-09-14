import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowRightOnRectangle,
  heroChartPie,
  heroHeart,
  heroMoon,
  heroRectangleStack,
  heroSun,
  heroUserCircle,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { SECTIONS } from './sections';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon, NgTemplateOutlet],
  providers: [
    provideIcons({
      heroChartPie,
      heroRectangleStack,
      heroSun,
      heroMoon,
      heroUserCircle,
      heroArrowRightOnRectangle,
      heroHeart,
    }),
  ],
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sections = SECTIONS;
  readonly darkMode = this.theme.dark;
  readonly currentUser = this.auth.user;
  readonly canLogout = this.auth.canLogout;
  readonly menuOpen = this.shell.menuOpen;
  readonly routeActions = this.shell.routeActions;

  constructor() {
    // Leaving a route drops its contributed controls; the next route registers its own.
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.shell.setRouteActions(null);
        this.shell.closeMenu();
      }
    });
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
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.shell.closeMenu();
  }
}
