import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NavidromeService } from '../services/navidrome.service';

@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (available() && id() && failedSrc() !== src()) {
      <img
        [src]="src()"
        alt=""
        class="w-full h-full object-cover"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        (error)="failedSrc.set(src())"
      />
    }
  `,
})
export class CoverComponent {
  private readonly navidrome = inject(NavidromeService);

  readonly id = input<string | null | undefined>();
  readonly size = input<number>(150);
  readonly eager = input<boolean>(false);

  readonly available = this.navidrome.coverArtAvailable;
  readonly src = computed(() => this.navidrome.coverUrl(this.id() ?? '', this.size()));

  /** A cover that failed to load leaves its tinted placeholder instead of a broken image. */
  protected readonly failedSrc = signal<string | null>(null);
}
