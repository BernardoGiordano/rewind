import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroHeart } from '@ng-icons/heroicons/outline';

/** Author credit. Declared once and rendered wherever the chrome has room for it. */
@Component({
  selector: 'app-byline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ heroHeart })],
  template: `
    Made with
    <ng-icon name="heroHeart" class="w-4 h-4 inline text-red-500 fill-current" aria-hidden="true" />
    by <a href="https://github.com/BernardoGiordano">Bernardo Giordano</a>
  `,
})
export class Byline {}
