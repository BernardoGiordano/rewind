import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(false);

  initialize(): void {
    const stored = localStorage.getItem('rewind.theme');
    this.dark.set(
      stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
    document.documentElement.classList.toggle('dark', this.dark());
  }

  toggle(): void {
    this.dark.update((dark) => !dark);
    document.documentElement.classList.toggle('dark', this.dark());
    localStorage.setItem('rewind.theme', this.dark() ? 'dark' : 'light');
  }
}
