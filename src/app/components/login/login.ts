import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroExclamationCircle,
  heroEye,
  heroEyeSlash,
  heroLockClosed,
  heroMoon,
  heroSun,
  heroUser,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [
    provideIcons({
      heroLockClosed,
      heroUser,
      heroEye,
      heroEyeSlash,
      heroExclamationCircle,
      heroMoon,
      heroSun,
    }),
  ],
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly darkMode = signal(false);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const stored = localStorage.getItem('rewind.theme');
      const prefers = stored
        ? stored === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.darkMode.set(prefers);
      document.documentElement.classList.toggle('dark', prefers);
    });
  }

  toggleDarkMode(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('rewind.theme', next ? 'dark' : 'light');
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  submit(event: Event): void {
    event.preventDefault();
    const u = this.username().trim();
    const p = this.password();
    if (!u || !p) {
      this.error.set('Please enter both username and password.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.login(u, p).subscribe({
      next: () => {
        this.submitting.set(false);
        const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/';
        const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
        this.router.navigateByUrl(safe);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const message =
          (err as { error?: { error?: string } })?.error?.error ??
          (err instanceof Error ? err.message : 'Login failed');
        this.error.set(message);
      },
    });
  }
}
