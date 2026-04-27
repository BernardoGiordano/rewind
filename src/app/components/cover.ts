import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NavidromeService } from '../services/navidrome.service';

@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (available() && id()) {
      <img
        [src]="src()"
        alt=""
        class="w-full h-full object-cover"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
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
}
