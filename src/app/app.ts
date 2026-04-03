import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { NavidromeService, TrackStat } from './services/navidrome.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly navidrome = inject(NavidromeService);

  protected readonly tracks = signal<TrackStat[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.navidrome.getTopTracks().subscribe({
        next: (data) => {
          this.tracks.set(data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to load tracks';
          this.error.set(message);
          this.loading.set(false);
        },
      });
    });
  }
}
